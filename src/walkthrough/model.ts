export const WALKTHROUGH_VERSION = 1
export interface WalkthroughState {
  version: number
  completedGuides: string[]
  skippedGuides: string[]
  seenTips: string[]
}
export type ProgressAction = { id: string; kind: "guide" | "tip"; action: "claim" | "complete" | "skip"; version: number }
export const emptyState = (): WalkthroughState => ({ version: WALKTHROUGH_VERSION, completedGuides: [], skippedGuides: [], seenTips: [] })
const ids = (value: unknown): string[] => Array.isArray(value) ? value.filter((id): id is string => typeof id === "string" && /^[a-z][a-z0-9-]{0,63}$/.test(id)).slice(0, 256) : []
export function parseState(value: unknown): WalkthroughState {
  const row = value && typeof value === "object" ? value as Partial<WalkthroughState> : {}
  const completedGuides = [...new Set(ids(row.completedGuides))]
  return { version: Number.isInteger(row.version) && row.version! > 0 ? row.version! : WALKTHROUGH_VERSION,
    completedGuides, skippedGuides: [...new Set(ids(row.skippedGuides))].filter(id => !completedGuides.includes(id)), seenTips: [...new Set(ids(row.seenTips))] }
}
export function mergeState(a: WalkthroughState, b: WalkthroughState): WalkthroughState {
  return parseState({ version: Math.max(a.version, b.version), completedGuides: [...a.completedGuides, ...b.completedGuides], skippedGuides: [...a.skippedGuides, ...b.skippedGuides], seenTips: [...a.seenTips, ...b.seenTips] })
}
export const hasSeen = (state: WalkthroughState, id: string, kind: "guide" | "tip" = "guide") => kind === "tip" ? state.seenTips.includes(id) : state.completedGuides.includes(id) || state.skippedGuides.includes(id)
export function recordProgress(state: WalkthroughState, action: ProgressAction): WalkthroughState {
  return mergeState(state, { version: action.version, completedGuides: action.kind === "guide" && action.action === "complete" ? [action.id] : [], skippedGuides: action.kind === "guide" && action.action !== "complete" ? [action.id] : [], seenTips: action.kind === "tip" ? [action.id] : [] })
}

export interface Frame { x: number; y: number; width: number; height: number }
/** Always keeps controls inside the safe viewport, including large text and landscape. */
export function placeCard(width: number, height: number, top: number, bottom: number, target: Frame | null, cardHeight: number) {
  const cardWidth = Math.min(360, width - 32), minY = top + 12, maxY = height - bottom - 12
  const above = target ? Math.max(0, target.y - minY - 16) : 0
  const below = target ? Math.max(0, maxY - target.y - target.height - 16) : 0
  const maxHeight = target && Math.max(above, below) >= 220 ? Math.max(above, below) : maxY - minY
  const h = Math.min(cardHeight, maxHeight)
  const preferred = target && below >= h ? target.y + target.height + 16 : target && above >= h ? target.y - h - 16 : minY + (maxY - minY - h) / 2
  return { width: cardWidth, left: Math.max(16, Math.min(width - cardWidth - 16, target ? target.x + target.width / 2 - cardWidth / 2 : (width - cardWidth) / 2)), top: Math.max(minY, Math.min(maxY - h, preferred)), maxHeight }
}

export interface PlacedNote { index: number; target: Frame; box: Frame; from: { x: number; y: number }; to: { x: number; y: number } }
const GAP = 34
/** Rough height of a handwritten note (Caveat is narrow: about 0.42 em per character). */
function noteHeight(title: string, width: number) {
  return Math.max(1, Math.ceil(title.length * 26 * 0.42 / width)) * 29 + 4
}
const overlaps = (a: Frame, b: Frame) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height
/**
 * Places one handwritten note per on-screen target: below targets in the top half, above those in
 * the bottom half, shifted away from earlier notes and the targets themselves, and flipped to the
 * other side when it does not fit between `top` and `bottom`. Notes that fit nowhere are left out
 * (the overlay lists them instead). Each note gets an arrow from its edge to the target's edge.
 */
export function layoutNotes(steps: Array<{ title: string }>, frames: Array<Frame | null>, screenWidth: number, top: number, bottom: number): PlacedNote[] {
  const width = Math.min(210, screenWidth - 48)
  const targets = frames.filter((frame): frame is Frame => !!frame)
  const placed: PlacedNote[] = []
  steps.forEach((step, index) => {
    const target = frames[index]
    if (!target) return
    const height = noteHeight(step.title, width)
    const centerX = target.x + target.width / 2
    const x = Math.max(24, Math.min(screenWidth - 24 - width, centerX - width / 2))
    const below = target.y + target.height / 2 < (top + bottom) / 2
    const blocked = (box: Frame) => placed.some(note => overlaps(box, note.box)) || targets.some(frame => overlaps(box, { x: frame.x - 6, y: frame.y - 6, width: frame.width + 12, height: frame.height + 12 }))
    const attempt = (down: boolean) => {
      let y = down ? target.y + target.height + GAP : target.y - GAP - height
      for (let tries = 0; tries < 24; tries++) {
        const box = { x, y, width, height }
        if (y < top || y + height > bottom) return null
        if (!blocked(box)) return box
        y += down ? 16 : -16
      }
      return null
    }
    const box = attempt(below) ?? attempt(!below)
    if (!box) return
    const down = box.y > target.y
    const anchorX = Math.max(box.x + 20, Math.min(box.x + width - 20, centerX))
    placed.push({
      index, target, box,
      from: { x: anchorX, y: down ? box.y - 6 : box.y + height + 6 },
      // The arrow touches the dashed frame (6 px outside the target) at the point nearest the note.
      to: { x: Math.max(target.x + 8, Math.min(target.x + target.width - 8, anchorX)), y: down ? target.y + target.height + 8 : target.y - 8 },
    })
  })
  return placed
}

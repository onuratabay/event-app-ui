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

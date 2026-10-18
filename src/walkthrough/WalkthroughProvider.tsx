import AsyncStorage from "@react-native-async-storage/async-storage"
import { useGlobalSearchParams, usePathname } from "expo-router"
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react"
import { AppState, Keyboard, StyleSheet, View, useWindowDimensions } from "react-native"
import { getWalkthroughs, updateWalkthrough } from "../api/client"
import { apiLoading } from "../api/loading"
import { useOptionalGuest } from "../guest/GuestSession"
import { useStore } from "../native/Store"
import { useWalkthroughAutostartBlocked, useWalkthroughBlocked } from "./activity"
import { guideForRoute, GUIDES, walkthroughFlags, type Guide, type TipId } from "./config"
import { emptyState, hasSeen, type WalkthroughState } from "./model"
import { WalkthroughRepository } from "./repository"
import { hasTarget, measureTarget, useTargetRevision } from "./targets"
import WalkthroughOverlay, { type Presentation } from "./WalkthroughOverlay"

interface GuideContext {
  state: WalkthroughState
  ready: boolean
  available: boolean
  presenting: boolean
  preview: (id: string) => void
  replayOnNextScreen: (id: string) => void
  claimTip: (id: TipId) => Promise<boolean>
  dismissTip: (id: TipId) => void
  tip: TipId | null
}
const Context = createContext<GuideContext | null>(null)
export const useWalkthrough = () => useContext(Context)
type Run = { guide: Guide; route: string; accountId: string; preview: boolean; anonymous?: boolean }

export function WalkthroughProvider({ children }: { children: ReactNode }) {
  const { data } = useStore(), guest = useOptionalGuest()
  const viewport = useWindowDimensions()
  const targetRevision = useTargetRevision()
  const path = usePathname(), params = useGlobalSearchParams<{ userId?: string; eventId?: string }>()
  const accountId = guest && (!guest.ready || guest.guest) ? "" : data.user.id
  const route = `${path}:${params.userId || ""}:${params.eventId || ""}`
  const latestRoute = useRef(route); latestRoute.current = route
  const [repository, setRepository] = useState<WalkthroughRepository | null>(null)
  const [, redraw] = useState(0)
  const [pending, setPending] = useState(0), [keyboard, setKeyboard] = useState(false)
  const [foreground, setForeground] = useState(AppState.currentState === "active")
  const [interaction, setInteraction] = useState(0)
  const latestTouch = useRef(0)
  const blocked = useWalkthroughBlocked() || pending > 0 || keyboard || !foreground
  const autostartBlocked = useWalkthroughAutostartBlocked()
  const blockedRef = useRef(blocked); blockedRef.current = blocked
  const [presentation, setPresentation] = useState<Presentation | null>(null)
  const run = useRef<Run | null>(null), generation = useRef(0)
  const attempted = useRef(new Set<string>())
  const manual = useRef<string | null>(null)
  const anonymousOutcome = useRef<"complete" | "skip" | null>(null)
  const [tip, setTip] = useState<TipId | null>(null)
  const tipRef = useRef<TipId | null>(null), tipClaiming = useRef(false), tipRoute = useRef<string | null>(null)
  const lastPresentation = useRef(0)
  const repositoryRef = useRef(repository); repositoryRef.current = repository

  useEffect(() => {
    run.current = null; generation.current++; setPresentation(null); attempted.current.clear()
    tipRef.current = null; setTip(null); manual.current = null
    if (!accountId) { setRepository(null); return }
    const next = new WalkthroughRepository(accountId, {
      read: AsyncStorage.getItem, write: AsyncStorage.setItem,
      get: getWalkthroughs, update: action => updateWalkthrough(accountId, action),
    })
    setRepository(next)
    const stop = next.subscribe(() => redraw(value => value + 1))
    void next.load().then(() => { if (anonymousOutcome.current) void next.finish("application", anonymousOutcome.current) })
    return () => { stop(); next.dispose() }
  }, [accountId])

  useEffect(() => { const stop = apiLoading.subscribe(setPending); return () => { stop() } }, [])
  useEffect(() => {
    const shown = Keyboard.addListener("keyboardDidShow", () => setKeyboard(true))
    const willShow = Keyboard.addListener("keyboardWillShow", () => setKeyboard(true))
    const hidden = Keyboard.addListener("keyboardDidHide", () => { setKeyboard(false); setInteraction(Date.now()) })
    const app = AppState.addEventListener("change", state => {
      setForeground(state === "active")
      if (state === "active") { setInteraction(Date.now()); void repositoryRef.current?.refresh() }
    })
    return () => { shown.remove(); willShow.remove(); hidden.remove(); app.remove() }
  }, [])
  useEffect(() => {
    if (!repository || !foreground) return
    const timer = setInterval(() => { if (!repository.remoteReady || repository.needsSync) void repository.refresh() }, 15000)
    return () => clearInterval(timer)
  }, [repository, foreground])
  useEffect(() => {
    if (run.current && run.current.route !== route) {
      run.current = null; generation.current++; setPresentation(null)
    }
    tipRef.current = null; setTip(null); tipClaiming.current = false
    setInteraction(Date.now())
    // The server remains authoritative on every claim; this also retries cached outcomes.
    void repositoryRef.current?.flush()
  }, [route])

  const finish = (outcome: "complete" | "skip") => {
    const current = run.current
    run.current = null; generation.current++; setPresentation(null)
    lastPresentation.current = Date.now()
    if (!current) return
    if (current.anonymous) anonymousOutcome.current = outcome
    else void repositoryRef.current?.finish(current.guide.id, outcome)
    setInteraction(Date.now())
  }
  // Whole-screen annotation: measure every step's target as it sits now (no scrolling); steps whose
  // target is missing or off screen are listed on the overlay instead of pointed at.
  const measureAll = async (guide: Guide) => Promise.all(guide.steps.map(async step => {
    const frame = await measureTarget(step.target)
    return frame && frame.y + frame.height >= 32 && frame.y >= 0 && frame.y < viewport.height - 24 ? frame : null
  }))
  const showAll = async (current: Run) => {
    const token = ++generation.current
    const frames = current.preview ? current.guide.steps.map(() => null) : await measureAll(current.guide)
    if (token !== generation.current || run.current !== current || current.route !== latestRoute.current) return
    setPresentation({ guide: current.guide, frames, preview: current.preview })
    // Entrance animations can still move things for a moment: measure once more when they settle.
    if (!current.preview) setTimeout(() => {
      if (token !== generation.current || run.current !== current) return
      void measureAll(current.guide).then(next => { if (token === generation.current && run.current === current) setPresentation(value => value ? { ...value, frames: next } : null) })
    }, 450)
  }
  const begin = async (guide: Guide, preview = false, explicit = false, anonymous = false) => {
    if (run.current || blockedRef.current || tipRef.current) return
    const current: Run = { guide, route: latestRoute.current, accountId, preview, anonymous }
    const touchAtStart = latestTouch.current
    run.current = current
    if (anonymous) anonymousOutcome.current = "skip"
    else if (!explicit) {
      const granted = await repositoryRef.current?.claim(guide.id)
      if (!granted) { if (run.current === current) run.current = null; return }
    }
    if (run.current !== current || current.route !== latestRoute.current) return
    if (blockedRef.current || latestTouch.current !== touchAtStart) {
      run.current = null; redraw(value => value + 1)
      return
    }
    lastPresentation.current = Date.now()
    await showAll(current)
  }
  const eligible = walkthroughFlags.enabled && (!guest || guest.ready && !guest.guest)
  const currentGuide = guideForRoute(path, !!params.userId && params.userId !== accountId)
  const ready = repository?.accountId === accountId && repository.remoteReady
  useEffect(() => {
    const requested = manual.current ? GUIDES.find(guide => guide.id === manual.current) : undefined
    const guide = requested && `/${requested.screen}` === path ? requested : currentGuide
    const anonymous = !accountId && path === "/onboarding-1" && !anonymousOutcome.current
    if (!eligible || blocked || run.current || tipRef.current || !guide || !anonymous && !ready) return
    if (autostartBlocked && !requested) return
    if (!anonymous && !requested && hasSeen(repository!.state, guide.id)) return
    if (!requested && data.user.status && data.user.status !== "approved" && !guide.applicant && guide.id !== "interests") return
    if (attempted.current.has(route) && !requested) return
    const timer = setTimeout(() => {
      // Do not reserve a tour for a loading/error screen with no usable target yet.
      if (!guide.steps.some(step => hasTarget(step.target))) return
      attempted.current.add(route)
      if (requested) manual.current = null
      void begin(guide, false, !!requested, anonymous)
    }, 1000)
    return () => clearTimeout(timer)
  }, [route, ready, blocked, autostartBlocked, interaction, currentGuide?.id, repository?.state, eligible, accountId, data.user.status, targetRevision])

  useEffect(() => {
    const current = run.current
    if (!current || !presentation || presentation.preview || blocked) return
    let active = true
    void measureAll(presentation.guide).then(frames => {
      if (active && run.current === current) setPresentation(value => value ? { ...value, frames } : null)
    })
    return () => { active = false }
  }, [viewport.width, viewport.height, blocked])

  const value: GuideContext = {
    state: repository?.accountId === accountId ? repository.state : emptyState(), ready: !!ready,
    available: !blocked,
    presenting: !!run.current && run.current.route === route && run.current.accountId === accountId,
    tip: repository?.accountId === accountId ? tip : null,
    preview: id => { if (!walkthroughFlags.enabled) return; const guide = GUIDES.find(item => item.id === id); if (guide) void begin(guide, true, true) },
    replayOnNextScreen: id => { manual.current = id; setInteraction(Date.now()) },
    claimTip: async id => {
      if (!walkthroughFlags.enabled || !repository || repository.accountId !== accountId || !ready || blockedRef.current || run.current || tipRef.current || tipClaiming.current || tipRoute.current === latestRoute.current || Date.now() - lastPresentation.current < 1800) return false
      const expectedRoute = latestRoute.current
      tipClaiming.current = true
      try {
        const granted = await repository.claim(id, "tip")
        if (!granted || expectedRoute !== latestRoute.current || repositoryRef.current !== repository || blockedRef.current || run.current) return false
        tipRoute.current = expectedRoute; tipRef.current = id; setTip(id)
        return true
      } finally { tipClaiming.current = false }
    },
    dismissTip: id => { if (tipRef.current === id) { tipRef.current = null; setTip(null); lastPresentation.current = Date.now() } },
  }
  const visible = !!presentation && !blocked && run.current?.route === route && run.current.accountId === accountId
  return <Context.Provider value={value}>
    <View style={s.root} onStartShouldSetResponderCapture={() => { if (!presentation) { latestTouch.current++; setInteraction(Date.now()) }; return false }}>
      <View style={s.root} accessibilityElementsHidden={visible} importantForAccessibility={visible ? "no-hide-descendants" : "auto"}>{children}</View>
      {presentation && visible && <WalkthroughOverlay presentation={presentation} onClose={() => finish("skip")} onDone={() => finish("complete")} />}
    </View>
  </Context.Provider>
}
const s = StyleSheet.create({ root: { flex: 1 } })

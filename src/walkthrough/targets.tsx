import { useFocusEffect } from "expo-router"
import { createContext, useCallback, useContext, useSyncExternalStore, type RefObject } from "react"
import type { View } from "react-native"
import type { Frame } from "./model"

export const WalkthroughScrollContext = createContext<((target: View | null, animated?: boolean) => void) | null>(null)
interface Target { node: RefObject<View | null>; reveal: ((node: View | null, animated?: boolean) => void) | null }
const targets = new Map<string, Target>()
const listeners = new Set<() => void>()
const viewportListeners = new Set<() => void>()
export const notifyWalkthroughScroll = () => viewportListeners.forEach(listener => listener())
export function onWalkthroughScroll(listener: () => void) { viewportListeners.add(listener); return () => { viewportListeners.delete(listener) } }
let revision = 0
const changed = () => { revision++; listeners.forEach(listener => listener()) }
export const useTargetRevision = () => useSyncExternalStore(listener => { listeners.add(listener); return () => { listeners.delete(listener) } }, () => revision, () => 0)
export function TargetRegistration({ id, node }: { id: string; node: RefObject<View | null> }) {
  const reveal = useContext(WalkthroughScrollContext)
  // Only the focused screen registers: native-stack keeps previous screens mounted.
  useFocusEffect(useCallback(() => {
    const target = { node, reveal }; targets.set(id, target); changed()
    return () => { if (targets.get(id) === target) { targets.delete(id); changed() } }
  }, [id, node, reveal]))
  return null
}
export const hasTarget = (id: string) => targets.has(id)
export function measureTarget(id: string, reveal = false): Promise<Frame | null> {
  const target = targets.get(id)
  if (!target?.node.current) return Promise.resolve(null)
  if (reveal) target.reveal?.(target.node.current, false)
  return new Promise(resolve => {
    let settled = false
    const finish = (frame: Frame | null) => { if (!settled) { settled = true; clearTimeout(timeout); resolve(frame) } }
    const timeout = setTimeout(() => finish(null), 650)
    setTimeout(() => {
      if (targets.get(id) !== target) { finish(null); return }
      try { target.node.current?.measureInWindow((x, y, width, height) => finish(width > 0 && height > 0 && [x, y, width, height].every(Number.isFinite) ? { x, y, width, height } : null)) }
      catch { finish(null) }
    }, reveal && target.reveal ? 200 : 0)
  })
}

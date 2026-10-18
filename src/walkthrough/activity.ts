import { useCallback, useEffect, useSyncExternalStore } from "react"
import { useFocusEffect } from "expo-router"
const blockers = new Set<symbol>()
const automaticBlockers = new Set<symbol>()
const listeners = new Set<() => void>()
const emit = () => listeners.forEach(listener => listener())
export function blockWalkthrough() {
  const token = Symbol(); blockers.add(token); emit()
  return () => { blockers.delete(token); emit() }
}
/** Shared by native sheets, legal gates, permission flows and critical form operations. */
export function useWalkthroughBlocker(blocked: boolean) {
  useEffect(() => { if (blocked) return blockWalkthrough() }, [blocked])
}
export function useWalkthroughScreenBlocker(blocked: boolean) {
  useFocusEffect(useCallback(() => { if (blocked) return blockWalkthrough() }, [blocked]))
}
/** A draft can suppress a late introduction while still allowing first-use inline tips. */
export function useWalkthroughAutostartBlocker(blocked: boolean) {
  useFocusEffect(useCallback(() => {
    if (!blocked) return
    const token = Symbol(); automaticBlockers.add(token); emit()
    return () => { automaticBlockers.delete(token); emit() }
  }, [blocked]))
}
export function useWalkthroughAutostartBlocked() {
  return useSyncExternalStore(listener => { listeners.add(listener); return () => { listeners.delete(listener) } }, () => automaticBlockers.size > 0, () => false)
}
export function useWalkthroughBlocked() {
  return useSyncExternalStore(listener => { listeners.add(listener); return () => { listeners.delete(listener) } }, () => blockers.size > 0, () => false)
}

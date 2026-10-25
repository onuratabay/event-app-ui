import { useNavigationContainerRef, useRootNavigationState } from "expo-router"
import { useEffect } from "react"

// Every page and tab is pushed (back always returns to the previous page), so long sessions kept stacking
// pages: each stayed built in memory and the phone slowed down until it locked up. Past MAX pages the oldest
// are dropped, keeping the KEEP most recent ones (still mounted, same state); back from the oldest kept page
// then lands on home like any page with nothing below it.
const MAX = 12
const KEEP = 8
type StackState = { key?: string; type?: string; index?: number; routes?: Array<{ key: string; name: string; state?: StackState }>; [key: string]: unknown }

function pageStack(root: StackState | undefined): StackState | undefined {
  let state = root
  for (;;) {
    const focused = state?.routes?.[state.index ?? state.routes.length - 1]
    // The bottom-bar tabs are one page of the stack (each tab is built once), not pages to trim.
    if (!focused?.state?.routes?.length || focused.state.type === "tab") return state
    state = focused.state
  }
}

export default function HistoryLimit() {
  const navigation = useNavigationContainerRef()
  const stack = pageStack(useRootNavigationState() as StackState)
  const count = stack?.routes?.length ?? 0
  useEffect(() => {
    if (!stack?.key || !stack.routes || count <= MAX) return
    const routes = stack.routes.slice(-KEEP)
    navigation.dispatch({ type: "RESET", payload: { ...stack, index: routes.length - 1, routes }, target: stack.key } as never)
  }, [count, stack?.key])
  return null
}

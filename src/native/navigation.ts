import { useRootNavigationState, useRouter, type Href } from "expo-router"
import { useCallback } from "react"
import type { NavigateFn } from "../types"
// Back never lands on sign-in pages. A finished event-creation flow is removed from history when the
// event opens (aboveHome), so an unfinished one stays reachable like any other page.
const NO_RETURN = new Set(["index", "welcome", "login", "forgot-password", "onboarding-1", "onboarding-2", "onboarding-3", "approval"])
type NavState = { type?: string; index?: number; routes?: Array<{ key?: string; name: string; state?: NavState }>; history?: Array<{ type: string; key?: string }> }
/** The bottom-bar pages; they live in app/(tabs) and are switched, never stacked. */
export const TAB_SCREENS = new Set(["discover", "map", "rooms", "profile"])
/**
 * Route name of the page below the current one, or null when there is none.
 * expo-router's root state holds a single "__root" route; the app's page stack is nested inside it,
 * so the focused route is followed down to the stack that actually holds the pages.
 */
export function previousRouteIn(root: NavState | undefined): string | null {
  let state = root
  for (;;) {
    const focused = state?.routes?.[state.index ?? state.routes.length - 1]
    if (!focused?.state?.routes?.length) break
    // Bottom-bar tabs: the page before is the tab visited before; on the first one, the page below the tabs.
    if (focused.state.type === "tab") {
      const visits = (focused.state.history ?? []).filter(entry => entry.type === "route")
      const before = visits.length > 1 ? focused.state.routes.find(route => route.key === visits[visits.length - 2].key) : undefined
      if (before) return before.name
      break
    }
    state = focused.state
  }
  const index = state?.index ?? (state?.routes?.length ?? 1) - 1
  return state?.routes?.[index - 1]?.name ?? null
}
export function usePreviousRoute(): string | null {
  return previousRouteIn(useRootNavigationState() as NavState)
}
export function canReturnTo(previous: string | null) {
  return previous !== null && !NO_RETURN.has(previous)
}
export function useNavigate(): NavigateFn {
  const router = useRouter()
  const previous = usePreviousRoute()
  return useCallback(
    (screen, opts) => {
      if (opts?.back && router.canGoBack() && canReturnTo(previous)) { router.back(); return }
      // Another member's profile is its own page (app/member.tsx); the profile tab is the member's own.
      const member = screen === "profile" && !!opts?.userId
      const href = {
        pathname: screen === "splash" ? "/" : member ? "/member" : `/${screen}`,
        params: { ...(opts?.eventId ? { eventId: opts.eventId } : {}), ...(opts?.userId ? { userId: opts.userId } : {}), ...(opts?.activity ? { activity: opts.activity } : {}) },
      } as Href
      // Crossing the sign-in boundary clears history, so back can never return to login (or into the app after logout).
      // A blocked back (previous page is login or a finished creation flow) also clears it, landing on the fallback.
      if (opts?.reset || (opts?.back && previous !== null && !canReturnTo(previous))) {
        if (router.canDismiss()) router.dismissAll()
        router.replace(href)
        return
      }
      // Leaves only the home page below the target, e.g. the detail of a just-created event.
      if (opts?.aboveHome) {
        if (router.canDismiss()) router.dismissAll()
        router.replace("/discover")
        router.push(href)
        return
      }
      // A tab is switched to, not stacked: the tab's page is kept and opens at once (pages above the tabs close).
      if (TAB_SCREENS.has(screen) && !member && !opts?.back) { router.navigate(href); return }
      // Every other page goes on top of history so back always returns to the previous page.
      if (opts?.back || screen === "welcome") router.replace(href)
      else router.push(href)
    },
    [router, previous],
  )
}

import { useRootNavigationState, useRouter, type Href } from "expo-router"
import { useCallback } from "react"
import type { NavigateFn } from "../types"
// Back never lands on sign-in pages. A finished event-creation flow is removed from history when the
// event opens (aboveHome), so an unfinished one stays reachable like any other page.
const NO_RETURN = new Set(["index", "welcome", "login", "forgot-password", "onboarding-1", "onboarding-2", "onboarding-3", "approval"])
type NavState = { index?: number; routes?: Array<{ name: string; state?: NavState }> }
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
      const href = {
        pathname: screen === "splash" ? "/" : `/${screen}`,
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
      // Every other page, tabs included, goes on top of history so back always returns to the previous page.
      if (opts?.back || screen === "welcome") router.replace(href)
      else router.push(href)
    },
    [router, previous],
  )
}

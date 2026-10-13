import { useRootNavigationState, useRouter, type Href } from "expo-router"
import { useCallback } from "react"
import type { NavigateFn } from "../types"
const roots = new Set([
  "discover",
  "search",
  "create-event",
  "rooms",
  "profile",
  "map",
])
// Back never lands on sign-in pages or on a finished event-creation flow.
const NO_RETURN = new Set(["index", "welcome", "login", "forgot-password", "onboarding-1", "onboarding-2", "onboarding-3", "approval", "create-event"])
/** Route name of the page below the current one, or null when there is none. */
export function usePreviousRoute(): string | null {
  const state = useRootNavigationState()
  return state?.routes?.[(state.index ?? 0) - 1]?.name ?? null
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
        params: { ...(opts?.eventId ? { eventId: opts.eventId } : {}), ...(opts?.userId ? { userId: opts.userId } : {}) },
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
      if (screen === "profile" && opts?.userId) router.push(href)
      else if (opts?.back || screen === "welcome" || screen === "discover" || roots.has(screen))
        router.replace(href)
      else router.navigate(href)
    },
    [router, previous],
  )
}

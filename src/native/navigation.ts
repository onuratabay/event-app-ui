import { useRouter, type Href } from "expo-router"
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
export function useNavigate(): NavigateFn {
  const router = useRouter()
  return useCallback(
    (screen, opts) => {
      if (opts?.back && router.canGoBack()) { router.back(); return }
      const href = {
        pathname: screen === "splash" ? "/" : `/${screen}`,
        params: opts?.eventId ? { eventId: opts.eventId } : {},
      } as Href
      if (opts?.back || screen === "welcome" || screen === "discover" || roots.has(screen))
        router.replace(href)
      else router.navigate(href)
    },
    [router],
  )
}

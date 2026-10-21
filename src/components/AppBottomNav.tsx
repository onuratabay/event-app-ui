import { useOptionalGuest } from "../guest/GuestSession";
import { useGlobalSearchParams, usePathname } from "expo-router"
import { useNavigate } from "../native/navigation"
import type { Screen } from "../types"
import BottomNav, { useKeyboardVisible } from "./BottomNav"

// The bottom bar appears on every screen except these pre-app (sign-in and onboarding) routes.
const HIDDEN_ROUTES = new Set(["/", "/welcome", "/login", "/forgot-password", "/onboarding-1", "/phone-verify", "/onboarding-2", "/onboarding-3", "/approval", "/interests", "/legal", "/admin", "/app-guide"])

export default function AppBottomNav() {
  const pathname = usePathname()
  const { userId } = useGlobalSearchParams<{ userId?: string }>()
  const navigate = useNavigate()
  const keyboardVisible = useKeyboardVisible()
  const guest = useOptionalGuest()
  if (HIDDEN_ROUTES.has(pathname) || pathname.startsWith("/guest-") || guest && (!guest.ready || guest.guest) || keyboardVisible) return null
  const active = pathname.slice(1) as Screen
  return <BottomNav active={active} navigate={(screen, opts) => {
    // Re-opening create-event from its own tab would reset the unfinished draft.
    // The open tab is not pushed again (own profile still opens from another member's profile).
    if (screen === active && (screen !== "profile" || !userId)) return
    navigate(screen, opts)
  }} />
}

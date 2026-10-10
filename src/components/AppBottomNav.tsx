import { usePathname } from "expo-router"
import { useNavigate } from "../native/navigation"
import type { Screen } from "../types"
import BottomNav, { useKeyboardVisible } from "./BottomNav"

// The bottom bar appears on every screen except these pre-app (sign-in and onboarding) routes.
const HIDDEN_ROUTES = new Set(["/", "/welcome", "/login", "/forgot-password", "/onboarding-1", "/onboarding-2", "/onboarding-3", "/approval", "/interests"])

export default function AppBottomNav() {
  const pathname = usePathname()
  const navigate = useNavigate()
  const keyboardVisible = useKeyboardVisible()
  if (HIDDEN_ROUTES.has(pathname) || keyboardVisible) return null
  const active = pathname.slice(1) as Screen
  return <BottomNav active={active} navigate={(screen, opts) => {
    // Re-opening create-event from its own tab would reset the unfinished draft.
    if (screen === active && screen === "create-event") return
    navigate(screen, opts)
  }} />
}

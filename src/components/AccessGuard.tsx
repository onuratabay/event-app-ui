import { useOptionalGuest } from "../guest/GuestSession";
import { usePathname } from "expo-router"
import { useEffect } from "react"
import { gatedScreen, PRE_APP_ROUTES } from "../native/access"
import { useNavigate } from "../native/navigation"
import { useStore } from "../native/Store"

// Sends a pending account back to its own page whenever it reaches an in-app route.
export default function AccessGuard() {
  const { data } = useStore()
  const pathname = usePathname()
  const navigate = useNavigate()
  const guest = useOptionalGuest()
  const target = guest && !guest.ready || guest?.guest || pathname.startsWith("/guest-") ? null : gatedScreen(data.user.status)
  useEffect(() => {
    if (target && !PRE_APP_ROUTES.has(pathname)) navigate(target, { reset: true })
  }, [target, pathname, navigate])
  return null
}

import { useOptionalGuest } from "../guest/GuestSession";
import { usePathname, useRouter } from "expo-router"
import { useEffect } from "react"
import { BackHandler, Platform } from "react-native"
import { PRE_APP_ROUTES } from "../native/access"
import { canReturnTo, usePreviousRoute } from "../native/navigation"

// Android back follows the same rule as the on-screen back button: never into sign-in pages
// or a finished creation flow, and to the home page when there is nowhere else to go.
export default function HardwareBack() {
  const router = useRouter()
  const pathname = usePathname()
  const previous = usePreviousRoute()
  const guest = useOptionalGuest()
  useEffect(() => {
    if (Platform.OS !== "android") return
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      if (guest?.guest || pathname.startsWith("/guest-")) return true
      if (PRE_APP_ROUTES.has(pathname)) return false
      if (router.canGoBack() && canReturnTo(previous)) return false
      // Home closes the app, unless a blocked page (e.g. login) is still below it: that is cleared first.
      if (pathname === "/discover" && !router.canGoBack()) return false
      if (router.canDismiss()) router.dismissAll()
      router.replace("/discover")
      return true
    })
    return () => subscription.remove()
  }, [router, pathname, previous, guest?.guest?.code])
  return null
}

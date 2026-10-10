import { useEffect, useState } from "react"
import { getCurrentUser, hasSession } from "../api/client"
import { gatedScreen } from "./access"
import type { NavigateFn } from "../types"

// Hold auth screens until storage is read, so returning users never see a login flash.
export function useSignedOutEntry(navigate: NavigateFn) {
  const [checking, setChecking] = useState(true)
  useEffect(() => {
    let active = true
    hasSession().then(session => {
      if (!active) return
      if (!session) { setChecking(false); return }
      return getCurrentUser().then(me => { if (active) navigate(gatedScreen(me.status?.enum) ?? "discover", { reset: true }) })
    }).catch(() => { if (active) setChecking(false) })
    return () => { active = false }
  }, [navigate])
  return checking
}

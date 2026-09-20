import { useEffect, useState } from "react"
import { hasSession } from "../api/client"
import type { NavigateFn } from "../types"

// Hold auth screens until storage is read, so returning users never see a login flash.
export function useSignedOutEntry(navigate: NavigateFn) {
  const [checking, setChecking] = useState(true)
  useEffect(() => {
    let active = true
    hasSession().then(session => {
      if (!active) return
      if (session) navigate("discover")
      else setChecking(false)
    }).catch(() => { if (active) setChecking(false) })
    return () => { active = false }
  }, [navigate])
  return checking
}

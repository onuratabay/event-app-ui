import { useEffect, useState } from "react"

// The countdown is only a display: the server rejects an expired invitation on accept.
export function remainingLabel(ms: number) {
  if (ms <= 0) return "Süresi doldu"
  const totalSeconds = Math.ceil(ms / 1000)
  if (totalSeconds < 3600) {
    const minutes = Math.floor(totalSeconds / 60), seconds = totalSeconds % 60
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")} kaldı`
  }
  const totalMinutes = Math.ceil(ms / 60000)
  return `${Math.floor(totalMinutes / 60)} sa ${String(totalMinutes % 60).padStart(2, "0")} dk kaldı`
}

/** Milliseconds left until expiresAt, ticking every second; null when the invitation has no deadline. */
export function useRemaining(expiresAt?: string | null) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!expiresAt) return
    setNow(Date.now())
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [expiresAt])
  if (!expiresAt) return null
  const deadline = Date.parse(expiresAt)
  return Number.isFinite(deadline) ? deadline - now : null
}

import { useState } from "react"
import { showAlert } from "./AppDialog"

import { logout } from "../api/client"
import { useStore } from "../native/Store"
import { Label, Touch } from "../native/UI"
import { palette } from "../theme/palette"
import type { NavigateFn } from "../types"

// Pending accounts cannot reach Profile, so their pages offer sign-out directly.
export default function SignOutButton({ navigate }: { navigate: NavigateFn }) {
  const { resetSession } = useStore()
  const [busy, setBusy] = useState(false)
  const signOut = async () => {
    if (busy) return
    setBusy(true)
    try {
      await logout()
      resetSession()
      navigate("welcome", { reset: true })
    } catch { showAlert("Çıkış yapılamadı", "Lütfen tekrar dene.") }
    finally { setBusy(false) }
  }
  return <Touch accessibilityLabel="Çıkış yap" disabled={busy} onPress={() => void signOut()} style={{ minHeight: 44, paddingHorizontal: 8, justifyContent: "center" }}>
    <Label style={{ fontFamily: "Outfit-Medium", fontSize: 13, color: palette.muted }}>Çıkış yap</Label>
  </Touch>
}

import AsyncStorage from "@react-native-async-storage/async-storage"
import * as Clipboard from "expo-clipboard"
import { useEffect, useState } from "react"
import { getApiErrorMessage } from "../api/client"
import { remainingLabel, useRemaining } from "../availability/countdown"
import { Box, Label, Touch } from "../native/UI"
import { palette } from "../theme/palette"
import { ui } from "../theme/styles"
import { CheckIcon, CopyIcon } from "./Icons"

export interface IssuedCode { code: string; expiresAt: string }

/**
 * A "create code" button that turns into the code itself, a copy button and the time left (24 hours).
 * `load` brings back a code issued earlier; `storageKey` keeps it on this device when the server
 * cannot show it again (event codes are stored hashed).
 */
export function GeneratedCode({ label, hint, create, load, storageKey }: { label: string; hint?: string; create: () => Promise<IssuedCode>; load?: () => Promise<IssuedCode | null>; storageKey?: string }) {
  const [issued, setIssued] = useState<IssuedCode | null>(null)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState("")
  const remaining = useRemaining(issued?.expiresAt)
  useEffect(() => {
    let active = true
    const restore = async () => {
      try {
        if (storageKey) { const saved = await AsyncStorage.getItem(storageKey); if (saved) { const row = JSON.parse(saved) as IssuedCode; if (Date.parse(row.expiresAt) > Date.now()) { if (active) setIssued(row); return } } }
        const row = await load?.()
        if (active && row) setIssued(row)
      } catch {}
    }
    void restore()
    return () => { active = false }
  }, [storageKey])
  const generate = async () => {
    if (busy) return
    setBusy(true); setError(""); setCopied(false)
    try {
      const row = await create()
      setIssued(row)
      if (storageKey) await AsyncStorage.setItem(storageKey, JSON.stringify(row)).catch(() => {})
    } catch (cause) { setError(getApiErrorMessage(cause, "Kod oluşturulamadı. Tekrar dene.")) }
    finally { setBusy(false) }
  }
  const copy = async () => {
    if (!issued) return
    try { await Clipboard.setStringAsync(issued.code); setCopied(true); setTimeout(() => setCopied(false), 1800) } catch {}
  }
  const live = issued && remaining !== null && remaining > 0
  return <Box style={{ gap: 8 }}>
    {live ? <Box style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 14, borderWidth: 1, borderColor: "rgba(105,120,255,.35)", backgroundColor: palette.selected }}>
      <Box style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Label selectable numberOfLines={1} ellipsizeMode="middle" style={[[ui.textSm, ui.fontSemibold], { color: palette.text, letterSpacing: 0.5 }]}>{issued.code}</Label>
        <Label accessibilityLiveRegion="polite" style={[[ui.textXs], { color: palette.accent }]}>{remainingLabel(remaining)}</Label>
      </Box>
      <Touch accessibilityLabel={copied ? "Kod kopyalandı" : "Kodu kopyala"} onPress={() => void copy()} hitSlop={8} style={{ width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: palette.glass, borderWidth: 1, borderColor: palette.glassBorder }}>
        {copied ? <CheckIcon size={18} style={{ color: palette.success }} /> : <CopyIcon size={18} style={{ color: palette.text }} />}
      </Touch>
    </Box> : <Touch accessibilityLabel={label} onPress={() => void generate()} disabled={busy} glass style={[[ui.py3, ui.roundedXl, ui.textSm, ui.fontMedium], { color: palette.accent, borderWidth: 1, borderColor: "rgba(105,120,255,.35)", backgroundColor: palette.glass }]}>
      {busy ? "Oluşturuluyor…" : label}
    </Touch>}
    {hint ? <Label style={[[ui.textXs, ui.textWhite40]]}>{hint}</Label> : null}
    {error ? <Label accessibilityRole="alert" style={[[ui.textXs], { color: palette.error }]}>{error}</Label> : null}
  </Box>
}

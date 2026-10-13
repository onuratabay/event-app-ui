import { hasSession, getApiErrorMessage } from "../src/api/client"
import type { Href } from 'expo-router'
import { useEffect, useState } from 'react'
import { useRouter } from 'expo-router'
import { useGuest } from '../src/guest/GuestSession'
import { parseGuestCode } from '../src/guest/links'
import { Box, Field, Label, Touch } from '../src/native/UI'
import { palette } from '../src/theme/palette'
export default function GuestEntry() {
  const { enter, returnToMember } = useGuest()
  const router = useRouter()
  const [input, setInput] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [canReturn, setCanReturn] = useState(false)
  useEffect(() => { let active = true; void hasSession().then(value => { if (active) setCanReturn(value) }); return () => { active = false } }, [])
  const memberReturn = async () => {
    if (busy) return
    setBusy(true)
    try { await returnToMember(); router.replace('/discover') }
    catch (cause) { setError(getApiErrorMessage(cause, 'Onaylı üyelik oturumuna dönülemedi.')) }
    finally { setBusy(false) }
  }
  const open = async () => {
    const code = parseGuestCode(input)
    if (!code) { setError('Geçerli bir davet bağlantısı veya kodu gir.'); return }
    setBusy(true)
    try { await enter(code); router.replace({ pathname: '/guest-event', params: { code } } as Href) }
    catch { setError('Davet oturumu kaydedilemedi. Tekrar dene.') }
    finally { setBusy(false) }
  }
  return <Box style={{ flex: 1, justifyContent: 'center', padding: 24, gap: 18, backgroundColor: palette.background }}>
    <Label style={{ color: palette.text, fontSize: 28, fontFamily: 'Fraunces' }}>Misafir davetini aç</Label>
    <Label style={{ color: palette.muted, fontSize: 14, lineHeight: 22 }}>WhatsApp’taki davet bağlantısını veya indirme ekranındaki davet kodunu buraya yapıştır.</Label>
    <Field accessibilityLabel="Davet bağlantısı veya kodu" value={input} onChangeText={setInput} autoCapitalize="none" autoCorrect={false} placeholder="EWT-…" style={{ minHeight: 52, padding: 14, borderRadius: 14, backgroundColor: palette.surface, color: palette.text, fontSize: 15 }} />
    {error ? <Label accessibilityRole="alert" style={{ color: palette.error }}>{error}</Label> : null}
    {canReturn && <Touch disabled={busy} onPress={() => void memberReturn()} style={{ color: palette.muted, minHeight: 44 }}>Üyeliğime dön</Touch>}
    <Touch disabled={busy || !input.trim()} onPress={() => void open()} gradient={palette.actionGradient} style={{ minHeight: 52, borderRadius: 16, color: palette.text }}>Etkinliği aç</Touch>
  </Box>
}

import { useRef, useState } from 'react'
import { Alert, StyleSheet } from 'react-native'
import { createEventShare, getApiErrorMessage, revokeEventShare, type EventShareLink } from '../api/client'
import { copyEvent, shareEvent } from '../native/media'
import { Box, Label, Sheet, Touch } from '../native/UI'
import { CheckIcon, CloseIcon, ShareIcon } from './Icons'
import { palette } from '../theme/palette'
import type { AppEvent } from '../types'

export default function EventShareSheet({ event, onClose }: { event: AppEvent; onClose: () => void }) {
  const [accepted, setAccepted] = useState(false)
  const [link, setLink] = useState<EventShareLink | null>(null)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')
  const pending = useRef(false)
  const run = async (action: 'share' | 'copy') => {
    if (!accepted || pending.current) return
    pending.current = true; setBusy(true); setError('')
    try {
      const invite = link || await createEventShare(event.id)
      setLink(invite)
      if (action === 'share') await shareEvent(event, invite.url)
      else { await copyEvent(invite.url); setCopied(true) }
    } catch (cause) { setError(getApiErrorMessage(cause, 'Davet bağlantısı oluşturulamadı. Tekrar dene.')) }
    finally { pending.current = false; setBusy(false) }
  }
  const revoke = async () => {
    if (!link || pending.current) return
    pending.current = true; setBusy(true)
    try { await revokeEventShare(link.code); setLink(null); setCopied(false); setAccepted(false); Alert.alert('Davet bağlantısı iptal edildi', 'Bu bağlantıyla artık misafir erişimi sağlanamaz.') }
    catch (cause) { setError(getApiErrorMessage(cause)) }
    finally { pending.current = false; setBusy(false) }
  }
  return <Sheet onClose={() => { if (!busy) onClose() }}>
    <Box style={s.backdrop} />
    <Touch onPress={press => press.stopPropagation()} style={s.panel}>
      <Box style={s.header}><Label style={s.title}>Etkinliği paylaş</Label><Touch accessibilityLabel="Paylaşımı kapat" disabled={busy} onPress={onClose} style={s.close}><CloseIcon size={20} style={{ color: palette.text }} /></Touch></Box>
      <Label style={s.event}>{event.title}</Label>
      <Label style={s.body}>WhatsApp grubuna veya başka bir yere gönderebileceğin kişisel davet bağlantısı oluştur. Gelen misafirler yalnızca bu etkinliği görebilir.</Label>
      <Touch accessibilityRole="checkbox" accessibilityLabel="Misafir katılım sorumluluğunu kabul ediyorum" accessibilityState={{ checked: accepted }} disabled={busy || !!link} onPress={() => setAccepted(value => !value)} style={s.consent}>
        <Box style={[s.checkbox, accepted && s.checked]}>{accepted && <CheckIcon size={16} style={{ color: palette.text }} />}</Box>
        <Label style={s.consentText}>Bu bağlantı üzerinden gelen misafirlerin etkinliğe katılım sorumluluğunu kabul ediyorum.</Label>
      </Touch>
      <Label style={s.note}>Onayın ve davetin senin hesabına kaydedilir. Misafirler “Katıl”a bastığında sana bildirim gelir.</Label>
      {error ? <Label accessibilityRole="alert" style={s.error}>{error}</Label> : null}
      <Touch disabled={!accepted || busy} onPress={() => void run('share')} gradient={palette.actionGradient} style={s.primary}><ShareIcon size={18} style={{ color: palette.text }} /><Label style={s.buttonText}>{busy ? 'Hazırlanıyor…' : 'WhatsApp ve diğer uygulamalar'}</Label></Touch>
      <Touch disabled={!accepted || busy} onPress={() => void run('copy')} style={s.secondary}>{copied ? 'Bağlantı kopyalandı' : 'Davet bağlantısını kopyala'}</Touch>
      {link && <Touch disabled={busy} onPress={() => void revoke()} style={s.revoke}>Bu davet bağlantısını iptal et</Touch>}
    </Touch>
  </Sheet>
}
const s = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,.55)' },
  panel: { backgroundColor: palette.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, gap: 14, alignItems: 'stretch' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, title: { color: palette.text, fontSize: 21, fontFamily: 'Outfit-SemiBold' }, close: { width: 44, height: 44 },
  event: { color: palette.accent, fontSize: 15, fontFamily: 'Outfit-Medium' }, body: { color: palette.muted, fontSize: 13, lineHeight: 20, textAlign: 'left' },
  consent: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, backgroundColor: palette.elevated, borderRadius: 16, padding: 14 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 1, borderColor: palette.accent, alignItems: 'center', justifyContent: 'center' }, checked: { backgroundColor: palette.blue },
  consentText: { flex: 1, color: palette.text, fontSize: 13, lineHeight: 20, textAlign: 'left' }, note: { color: palette.muted, fontSize: 11, lineHeight: 17 },
  primary: { minHeight: 50, borderRadius: 16, flexDirection: 'row', gap: 10 }, buttonText: { color: palette.text, fontSize: 14, fontFamily: 'Outfit-SemiBold' }, secondary: { minHeight: 48, borderRadius: 16, backgroundColor: palette.elevated, color: palette.text, fontSize: 14 },
  error: { color: palette.error, fontSize: 12, lineHeight: 18 }, revoke: { color: palette.muted, fontSize: 12 },
})

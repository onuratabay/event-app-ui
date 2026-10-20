import { useRef, useState } from 'react'
import { showAlert } from "./AppDialog"
import { Pressable, StyleSheet } from 'react-native'
import { createEventShare, getApiErrorMessage, revokeEventShare, type EventShareLink } from '../api/client'
import { copyEvent } from '../native/media'
import { Box, Label, Sheet, Touch } from '../native/UI'
import { CheckIcon, CloseIcon } from './Icons'
import { shareMessage, shareTo, ShareTargetGrid, type ShareTargetId } from './ShareTargets'
import { palette } from '../theme/palette'
import { GlassFill } from './GlassFill'
import type { AppEvent } from '../types'

export default function EventShareSheet({ event, onClose }: { event: AppEvent; onClose: () => void }) {
  const [accepted, setAccepted] = useState(false)
  const [link, setLink] = useState<EventShareLink | null>(null)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')
  const pending = useRef(false)
  const run = async (target: ShareTargetId) => {
    if (!accepted || pending.current) return
    pending.current = true; setBusy(true); setError('')
    let invite = link
    try {
      invite = link || await createEventShare(event.id)
      setLink(invite)
    } catch (cause) {
      setError(getApiErrorMessage(cause, 'Davet bağlantısı oluşturulamadı. Tekrar dene.'))
      pending.current = false; setBusy(false); return
    }
    try {
      if (target === 'copy') { await copyEvent(invite.url); setCopied(true) }
      else await shareTo(target, shareMessage(event, invite.url), invite.url, event.title)
    } catch { setError('Bu uygulama açılamadı. “Diğer” ile paylaşabilir ya da bağlantıyı kopyalayabilirsin.') }
    finally { pending.current = false; setBusy(false) }
  }
  const revoke = async () => {
    if (!link || pending.current) return
    pending.current = true; setBusy(true)
    try { await revokeEventShare(link.code); setLink(null); setCopied(false); setAccepted(false); showAlert('Davet bağlantısı iptal edildi', 'Bu bağlantıyla artık misafir erişimi sağlanamaz.') }
    catch (cause) { setError(getApiErrorMessage(cause)) }
    finally { pending.current = false; setBusy(false) }
  }
  return <Sheet onClose={() => { if (!busy) onClose() }}>
    <Box style={s.backdrop} />
    {/* A plain surface (not a button) so taps inside never close the sheet or squash the panel. */}
    <Pressable onPress={press => press.stopPropagation()} style={s.panel}><GlassFill kind="sheet" topRadius={28} />
      <Box style={s.handle} />
      <Box style={s.header}>
        <Box style={s.headerCopy}>
          <Label style={s.title}>Etkinliği paylaş</Label>
          <Label style={s.event} numberOfLines={1}>{event.title}</Label>
        </Box>
        <Touch accessibilityLabel="Paylaşımı kapat" disabled={busy} onPress={onClose} style={s.close}><CloseIcon size={20} style={{ color: palette.text }} /></Touch>
      </Box>
      <Touch accessibilityRole="checkbox" accessibilityLabel="Misafir katılım sorumluluğunu kabul ediyorum" accessibilityState={{ checked: accepted }} disabled={busy || !!link} onPress={() => setAccepted(value => !value)} style={s.consent}>
        <Box style={[s.checkbox, accepted && s.checked]}>{accepted && <CheckIcon size={16} style={{ color: palette.text }} />}</Box>
        <Label style={s.consentText}>Bu bağlantıyla gelen misafirlerin etkinliğe katılım sorumluluğunu kabul ediyorum.</Label>
      </Touch>
      <Label style={s.note}>{accepted ? 'Bir uygulama seç; kişisel davet bağlantın oluşturulup mesaja eklenir. Misafirler yalnızca bu etkinliği görür.' : 'Paylaşmak için önce onay kutusunu işaretle.'}</Label>
      <ShareTargetGrid disabled={!accepted || busy} onPick={target => void run(target)} />
      {copied ? <Label accessibilityLiveRegion="polite" style={s.copied}>Bağlantı kopyalandı</Label> : null}
      {error ? <Label accessibilityRole="alert" style={s.error}>{error}</Label> : null}
      {link && <Touch disabled={busy} onPress={() => void revoke()} style={s.revoke}>Bu davet bağlantısını iptal et</Touch>}
    </Pressable>
  </Sheet>
}
const s = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,.55)' },
  panel: { backgroundColor: palette.glassSheet, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 24, gap: 16, borderWidth: 1, borderBottomWidth: 0, borderColor: palette.glassBorder },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,.18)' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerCopy: { flex: 1, minWidth: 0, gap: 2 },
  title: { color: palette.text, fontSize: 20, fontFamily: 'Outfit-SemiBold' },
  event: { color: palette.accent, fontSize: 14, fontFamily: 'Outfit-Medium' },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  consent: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'flex-start', gap: 12, backgroundColor: 'rgba(255,255,255,.05)', borderWidth: 1, borderColor: palette.glassBorder, borderRadius: 16, padding: 14 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 1, borderColor: palette.accent, alignItems: 'center', justifyContent: 'center' }, checked: { backgroundColor: palette.blue },
  consentText: { flex: 1, color: palette.text, fontSize: 13, lineHeight: 20, textAlign: 'left' },
  note: { color: palette.muted, fontSize: 12, lineHeight: 18 },
  copied: { color: palette.success, fontSize: 12, lineHeight: 18, textAlign: 'center' },
  error: { color: palette.error, fontSize: 12, lineHeight: 18 },
  revoke: { alignSelf: 'center', color: palette.muted, fontSize: 12, minHeight: 36 },
})

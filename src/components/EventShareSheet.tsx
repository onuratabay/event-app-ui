import { useRef, useState } from 'react'
import { showAlert } from "./AppDialog"
import { Image, Modal, Platform, Share, StyleSheet, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import { captureRef } from 'react-native-view-shot'
import * as Sharing from 'expo-sharing'
import { createEventShare, getApiErrorMessage, revokeEventShare, type EventShareLink } from '../api/client'
import { copyEvent } from '../native/media'
import { Box, Label, Picture, Scroll, Touch } from '../native/UI'
import { CheckIcon, ClockIcon, CloseIcon, LocationIcon, ShareIcon } from './Icons'
import { inviteExpiry, shareMessage, shareTo, ShareTargetGrid, type ShareTargetId } from './ShareTargets'
import { remainingLabel, useRemaining } from '../availability/countdown'
import { participantCount } from '../native/Store'
import { useWalkthroughBlocker } from '../walkthrough/activity'
import { palette } from '../theme/palette'
import type { AppEvent } from '../types'

const WORDMARK = require('../../assets/brand/ewent-wordmark-transparent.png')

/**
 * Full-screen event sharing: a card image of the event (cover, title, time, place, how full, invite
 * validity) shared with the personal 24-hour invite link, or the link alone to one app. Accepting
 * responsibility for guests comes first; the same accepted link is reused while the screen is open.
 */
export default function EventShareSheet({ event, onClose }: { event: AppEvent; onClose: () => void }) {
  useWalkthroughBlocker(true)
  const [accepted, setAccepted] = useState(false)
  const [link, setLink] = useState<EventShareLink | null>(null)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const pending = useRef(false)
  const card = useRef<View>(null)
  const remaining = useRemaining(link?.expiresAt)

  // Creates (once) the invite link, then runs the share action with it.
  const withLink = async (action: (invite: EventShareLink) => Promise<void>) => {
    if (!accepted || pending.current) return
    pending.current = true; setBusy(true); setError(''); setNotice('')
    let invite = link
    try {
      invite = link || await createEventShare(event.id)
      setLink(invite)
    } catch (cause) {
      setError(getApiErrorMessage(cause, 'Davet bağlantısı oluşturulamadı. Tekrar dene.'))
      pending.current = false; setBusy(false); return
    }
    try { await action(invite) }
    catch { setError('Paylaşım açılamadı. Bağlantıyı kopyalayıp kendin yapıştırabilirsin.') }
    finally { pending.current = false; setBusy(false) }
  }
  const run = (target: ShareTargetId) => withLink(async invite => {
    if (target === 'copy') { await copyEvent(invite.url); setCopied(true); return }
    await shareTo(target, shareMessage(event, invite.url, invite.expiresAt), invite.url, event.title)
  })
  // The card as an image plus the invite text. iOS takes both in one share; Android's share sheet takes
  // the image only, so the invite text is put on the clipboard to paste under it.
  const shareCard = () => withLink(async invite => {
    // Let the card re-render with the invite's validity before it is captured.
    await new Promise(resolve => setTimeout(resolve, 60))
    const message = shareMessage(event, invite.url, invite.expiresAt)
    const uri = await captureRef(card, { format: 'png', quality: 1, result: 'tmpfile' })
    if (Platform.OS === 'ios') { await Share.share({ url: uri, message }); return }
    await copyEvent(message)
    setNotice('Davet metni kopyalandı; görseli gönderdikten sonra mesaja yapıştır.')
    if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Etkinlik kartını paylaş', UTI: 'public.png' })
    else await Share.share({ message })
  })
  const revoke = async () => {
    if (!link || pending.current) return
    pending.current = true; setBusy(true)
    try { await revokeEventShare(link.code); setLink(null); setCopied(false); setNotice(''); setAccepted(false); showAlert('Davet bağlantısı iptal edildi', 'Bu bağlantıyla artık misafir erişimi sağlanamaz.') }
    catch (cause) { setError(getApiErrorMessage(cause)) }
    finally { pending.current = false; setBusy(false) }
  }
  const close = () => { if (!busy) onClose() }

  return <Modal visible animationType="slide" presentationStyle="fullScreen" statusBarTranslucent onRequestClose={close}>
    <SafeAreaView edges={['top', 'bottom']} style={s.screen}>
      <Box style={s.header}>
        <Box style={s.headerCopy}>
          <Label style={s.title}>Etkinliği paylaş</Label>
          <Label style={s.subtitle} numberOfLines={1}>{event.title}</Label>
        </Box>
        <Touch accessibilityLabel="Paylaşımı kapat" disabled={busy} onPress={close} style={s.close}><CloseIcon size={20} style={{ color: palette.text }} /></Touch>
      </Box>
      <Scroll style={s.scroll}>
        {/* The card that is captured and shared as an image. */}
        <View ref={card} collapsable={false} style={s.card}>
          <View style={s.cover}>
            <Picture uri={event.coverImage} accessibilityLabel={event.title} style={[StyleSheet.absoluteFill]} />
            <LinearGradient colors={['rgba(8,11,24,0)', 'rgba(8,11,24,.92)']} style={StyleSheet.absoluteFill} />
            <Image source={WORDMARK} resizeMode="contain" style={s.wordmark} accessibilityIgnoresInvertColors />
            <View style={s.category}><Label style={s.categoryText}>{event.category}{event.level ? ` · ${event.level}` : ''}</Label></View>
          </View>
          <View style={s.cardBody}>
            <Label style={s.cardTitle} numberOfLines={2}>{event.title}</Label>
            <View style={s.metaRow}><ClockIcon size={14} style={{ color: palette.accent }} /><Label style={s.metaText}>{`${event.date} · ${event.time}`}</Label></View>
            {event.location ? <View style={s.metaRow}><LocationIcon size={14} style={{ color: palette.accent }} /><Label style={s.metaText} numberOfLines={1}>{event.location}</Label></View> : null}
            <View style={s.cardFooter}>
              <Label style={s.count}>{`${participantCount(event.currentParticipants, event.maxParticipants)} kişi`}</Label>
              <Label style={s.brand}>ewent.app</Label>
            </View>
            <Label style={s.invite}>{link ? `Davetle katıl · ${inviteExpiry(link.expiresAt)} tarihine kadar geçerli` : 'Davetle katıl · 24 saat geçerli'}</Label>
          </View>
        </View>

        <Touch accessibilityRole="checkbox" accessibilityLabel="Misafir katılım sorumluluğunu kabul ediyorum" accessibilityState={{ checked: accepted }} disabled={busy || !!link} onPress={() => setAccepted(value => !value)} style={s.consent}>
          <Box style={[s.checkbox, accepted && s.checked]}>{accepted && <CheckIcon size={16} style={{ color: palette.text }} />}</Box>
          <Label style={s.consentText}>Bu bağlantıyla gelen misafirlerin etkinliğe katılım sorumluluğunu kabul ediyorum.</Label>
        </Touch>

        <Touch accessibilityLabel="Kartı paylaş" disabled={!accepted || busy} disabledOpacity={0.45} onPress={() => void shareCard()} style={s.primary} gradient={palette.actionGradient}>
          <Box style={s.primaryRow}><ShareIcon size={18} style={{ color: palette.text }} /><Label style={s.primaryText}>{busy ? 'Hazırlanıyor…' : 'Kartı paylaş'}</Label></Box>
        </Touch>
        <Label style={s.note}>{accepted ? 'Kart görseli 24 saat geçerli kişisel davet bağlantınla paylaşılır. Misafirler yalnızca bu etkinliği görür.' : 'Paylaşmak için önce onay kutusunu işaretle.'}</Label>

        <Label style={s.section}>Bağlantı olarak paylaş</Label>
        <ShareTargetGrid disabled={!accepted || busy} onPick={target => void run(target)} />

        {link && remaining !== null ? <Label accessibilityLiveRegion="polite" style={[s.validity, remaining <= 0 && { color: palette.error }]}>
          {remaining > 0 ? `Davet ${inviteExpiry(link.expiresAt)} tarihine kadar geçerli · ${remainingLabel(remaining)}` : 'Bu davetin süresi doldu. Yeni bir bağlantı için ekranı kapatıp yeniden aç.'}
        </Label> : null}
        {copied ? <Label accessibilityLiveRegion="polite" style={s.copied}>Bağlantı kopyalandı</Label> : null}
        {notice ? <Label accessibilityLiveRegion="polite" style={s.copied}>{notice}</Label> : null}
        {error ? <Label accessibilityRole="alert" style={s.error}>{error}</Label> : null}
        {link && <Touch disabled={busy} onPress={() => void revoke()} style={s.revoke}>Bu davet bağlantısını iptal et</Touch>}
      </Scroll>
    </SafeAreaView>
  </Modal>
}
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
  headerCopy: { flex: 1, minWidth: 0, gap: 2 },
  title: { color: palette.text, fontSize: 22, fontFamily: 'Fraunces' },
  subtitle: { color: palette.accent, fontSize: 14, fontFamily: 'Outfit-Medium' },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  scroll: { flex: 1, paddingHorizontal: 20, paddingBottom: 32, gap: 16 },
  card: { borderRadius: 24, overflow: 'hidden', backgroundColor: palette.surface, borderWidth: 1, borderColor: 'rgba(205,214,255,.18)' },
  cover: { height: 220, backgroundColor: palette.elevated },
  wordmark: { position: 'absolute', top: 16, left: 16, width: 92, height: 30 },
  category: { position: 'absolute', left: 16, bottom: 14, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: 'rgba(8,11,24,.55)', borderWidth: 1, borderColor: 'rgba(255,255,255,.16)' },
  categoryText: { color: palette.text, fontSize: 12, fontFamily: 'Outfit-Medium' },
  cardBody: { padding: 18, gap: 8 },
  cardTitle: { color: palette.text, fontFamily: 'Fraunces', fontSize: 24, lineHeight: 30 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  metaText: { flex: 1, color: 'rgba(244,245,255,.72)', fontSize: 14 },
  cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 },
  count: { color: palette.text, fontSize: 14, fontFamily: 'Outfit-SemiBold' },
  brand: { color: palette.accent, fontSize: 13, fontFamily: 'Outfit-SemiBold', letterSpacing: 0.3 },
  invite: { marginTop: 4, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(205,214,255,.2)', color: palette.accent, fontSize: 12 },
  consent: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'flex-start', gap: 12, backgroundColor: 'rgba(255,255,255,.05)', borderWidth: 1, borderColor: palette.glassBorder, borderRadius: 16, padding: 14 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 1, borderColor: palette.accent, alignItems: 'center', justifyContent: 'center' }, checked: { backgroundColor: palette.blue },
  consentText: { flex: 1, color: palette.text, fontSize: 13, lineHeight: 20, textAlign: 'left' },
  primary: { minHeight: 54, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  primaryRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  primaryText: { color: palette.text, fontSize: 15, fontFamily: 'Outfit-SemiBold' },
  note: { color: palette.muted, fontSize: 12, lineHeight: 18 },
  section: { color: palette.text, fontSize: 15, fontFamily: 'Outfit-SemiBold', marginTop: 4 },
  validity: { color: palette.accent, fontSize: 12, lineHeight: 18, textAlign: 'center' },
  copied: { color: palette.success, fontSize: 12, lineHeight: 18, textAlign: 'center' },
  error: { color: palette.error, fontSize: 12, lineHeight: 18 },
  revoke: { alignSelf: 'center', color: palette.muted, fontSize: 12, minHeight: 36 },
})

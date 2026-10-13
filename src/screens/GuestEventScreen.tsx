import type { Href } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { StyleSheet } from 'react-native'
import { getApiErrorMessage, hasSession, getGuestEvent, getGuestParticipation, joinGuestEvent, leaveGuestEvent, type GuestEvent } from '../api/client'
import { useGuest } from '../guest/GuestSession'
import { parseGuestCode } from '../guest/links'
import { Box, Field, Label, Picture, Scroll, Touch } from '../native/UI'
import { palette } from '../theme/palette'
import { CategoryIcon, CheckIcon } from '../components/Icons'
import LoadingSpinner from '../components/LoadingSpinner'

export default function GuestEventScreen() {
  const params = useLocalSearchParams<{ code?: string }>()
  const router = useRouter()
  const { ready, guest, enter, save, clearParticipation, returnToMember } = useGuest()
  const code = params.code ? parseGuestCode(params.code) : guest?.code || null
  const [event, setEvent] = useState<GuestEvent | null>(null)
  const [image, setImage] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const pending = useRef(false)
  const generation = useRef(0)
  const [canReturnToMember, setCanReturnToMember] = useState(false)
  useEffect(() => { let active = true; void hasSession().then(value => { if (active) setCanReturnToMember(value) }); return () => { active = false } }, [])
  const joined = !!(guest?.code === code && guest.session)
  useEffect(() => {
    if (!ready) return
    let active = true
    const captured = ++generation.current
    pending.current = false; setBusy(false)
    setEvent(null); setError(''); setLoading(true)
    if (!code) { router.replace('/guest-entry' as Href); return }
    void (async () => {
      try {
        await enter(code)
        const result = await getGuestEvent(code)
        if (active) { setEvent(result.event); setImage(result.event.coverPhoto || result.imageUrl) }
        if (guest?.code === code && guest.session) {
          try {
            const participation = await getGuestParticipation(code, guest.session)
            if (active) await save({ ...guest, name: participation.name, expiresAt: participation.expiresAt })
          } catch (cause) {
            if (active && cause instanceof Error && /^API (401|403|404):/.test(cause.message)) await clearParticipation(code)
            else throw cause
          }
        }
      } catch (cause) { if (active) setError(getApiErrorMessage(cause, 'Davet açılmadı. Bağlantı geçersiz veya süresi dolmuş olabilir.')) }
      finally { if (active) setLoading(false) }
    })()
    return () => { active = false; if (generation.current === captured) generation.current++ }
  }, [code, ready])
  useEffect(() => {
    if (guest?.name) setName(guest.name)
  }, [guest?.name])
  const join = async () => {
    if (!code || !name.trim() || pending.current) return
    const captured = generation.current
    pending.current = true; setBusy(true); setError('')
    try {
      const result = await joinGuestEvent(code, name.trim())
      if (captured !== generation.current) return
      await save({ code, session: result.session, name: result.name, expiresAt: result.expiresAt })
      const updated = await getGuestEvent(code)
      if (captured === generation.current) setEvent(updated.event)
    } catch (cause) { if (captured === generation.current) setError(getApiErrorMessage(cause, 'Katılım tamamlanamadı. Tekrar dene.')) }
    finally { if (captured === generation.current) { pending.current = false; setBusy(false) } }
  }
  const leave = async () => {
    if (!code || !guest?.session || pending.current) return
    const captured = generation.current
    pending.current = true; setBusy(true); setError('')
    try {
      await leaveGuestEvent(code, guest.session)
      if (captured !== generation.current) return
      await clearParticipation(code)
      const updated = await getGuestEvent(code)
      if (captured === generation.current) setEvent(updated.event)
    } catch (cause) { if (captured === generation.current) setError(getApiErrorMessage(cause, 'Katılım iptal edilemedi.')) }
    finally { if (captured === generation.current) { pending.current = false; setBusy(false) } }
  }
  const memberReturn = async () => {
    if (pending.current) return
    const captured = generation.current
    pending.current = true; setBusy(true)
    try { await returnToMember(); if (captured === generation.current) router.replace('/discover' as Href) }
    catch (cause) { if (captured === generation.current) setError(getApiErrorMessage(cause, 'Üyelik oturumuna dönülemedi. Onaylı üyeliğinin aktif olması gerekir.')) }
    finally { if (captured === generation.current) { pending.current = false; setBusy(false) } }
  }
  const ended = !event || ['cancelled', 'closed'].includes(event.status)
  return <Box style={s.screen}>
    <Box style={s.header}><Label style={s.brand}>ewent.app</Label><Label style={s.badge}>Misafir</Label></Box>
    {loading ? <Box style={s.center}><LoadingSpinner size="large" /></Box> : <Scroll style={s.scroll}>
      {event && <>
        {image ? <Picture uri={image} accessibilityLabel={event.title} style={s.cover} /> : <Box style={s.cover}><CategoryIcon name={event.category} size={48} style={{ color: palette.accent }} /></Box>}
        <Box style={s.content}>
          <Label style={s.title}>{event.title}</Label>
          <Label style={s.meta}>{event.date} · {event.time}</Label>
          <Label style={s.meta}>{event.location}</Label>
          <Label style={s.body}>Düzenleyen: {event.hostName}</Label>
          <Box style={s.card}><Label style={s.cardTitle}>Etkinlik hakkında</Label><Label style={s.body}>{event.description}</Label>{event.requirements ? <Label style={s.body}>{event.requirements}</Label> : null}</Box>
          <Label style={s.body}>{event.participantCount} katılımcı{event.maxParticipants < 100000 ? ` · ${Math.max(0, event.maxParticipants - event.participantCount)} yer kaldı` : ''}</Label>
          <Label style={s.note}>Bu davetle yalnızca bu etkinliğe erişebilirsin. Katılımından daveti paylaşan üye sorumludur.</Label>
          {joined ? <Box style={s.card}>
            <Box style={s.row}><CheckIcon size={18} style={{ color: palette.success }} /><Label style={s.joined}>{`Katıldın · Misafir ${guest?.name}`}</Label></Box>
            <Touch disabled={busy} onPress={() => void leave()} style={s.secondary}>Katılımı iptal et</Touch>
          </Box> : ended || event.status !== 'waiting_participants' ? <Label style={s.note}>Bu etkinliğe katılım kapanmış.</Label> : <Box style={s.card}>
            <Label style={s.cardTitle}>Misafir olarak katıl</Label>
            <Field accessibilityLabel="Misafir adın" placeholder="Adın" value={name} onChangeText={setName} maxLength={60} editable={!busy} style={s.field} />
            <Label style={s.note}>Diğer katılımcılar seni “Misafir · {name.trim() || 'Adın'}” olarak görecek.</Label>
            <Touch disabled={busy || !name.trim() || event.participantCount >= event.maxParticipants} onPress={() => void join()} style={s.primary} gradient={palette.actionGradient}>{busy ? 'Kaydediliyor…' : event.participantCount >= event.maxParticipants ? 'Kontenjan dolu' : 'Etkinliğe katıl'}</Touch>
          </Box>}
        </Box>
      </>}
      {error ? <Label accessibilityRole="alert" style={s.error}>{error}</Label> : null}
      {canReturnToMember && <Touch disabled={busy} onPress={() => void memberReturn()} style={s.secondary}>Üyeliğime dön</Touch>}
      {!event && !loading && <Touch onPress={() => router.replace('/guest-entry' as Href)} style={s.secondary}>Davet kodunu yeniden gir</Touch>}
    </Scroll>}
  </Box>
}
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.background }, header: { paddingHorizontal: 20, height: 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, brand: { color: palette.text, fontSize: 20, fontFamily: 'Outfit-SemiBold' }, badge: { color: palette.accent, fontSize: 12, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: palette.selected, borderRadius: 20 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' }, scroll: { flex: 1, paddingBottom: 32 }, cover: { width: '100%', height: 230, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.surface }, content: { padding: 20, gap: 14 }, title: { color: palette.text, fontSize: 27, fontFamily: 'Fraunces', lineHeight: 34 }, meta: { color: palette.accent, fontSize: 14 },
  card: { padding: 18, borderRadius: 20, backgroundColor: palette.surface, gap: 12, borderWidth: 1, borderColor: palette.border }, cardTitle: { color: palette.text, fontFamily: 'Outfit-SemiBold', fontSize: 15 }, body: { color: palette.muted, fontSize: 13, lineHeight: 21 }, note: { color: palette.muted, fontSize: 12, lineHeight: 19 },
  field: { minHeight: 48, padding: 12, backgroundColor: palette.elevated, color: palette.text, borderRadius: 12, fontSize: 16 }, primary: { minHeight: 50, color: palette.text, fontSize: 15, fontFamily: 'Outfit-SemiBold', borderRadius: 14 }, secondary: { minHeight: 48, paddingHorizontal: 16, color: palette.muted, backgroundColor: palette.elevated, borderRadius: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 }, joined: { flex: 1, color: palette.success, fontSize: 14, fontFamily: 'Outfit-Medium' }, error: { margin: 20, color: palette.error, fontSize: 13, lineHeight: 20 },
})

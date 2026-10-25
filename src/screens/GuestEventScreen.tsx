import type { Href } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { StyleSheet } from 'react-native'
import { getApiErrorMessage, hasSession, getGuestEvent, getGuestParticipation, joinGuestEvent, leaveGuestEvent, type GuestEvent } from '../api/client'
import { useGuest } from '../guest/GuestSession'
import { parseGuestCode } from '../guest/links'
import { Box, Field, Label, Scroll, Touch } from '../native/UI'
import { palette } from '../theme/palette'
import { AtmoBackground } from '../components/GlassUI'
import { BrandWordmark } from '../components/Brand'
import { CheckIcon, ClockIcon, LocationIcon } from '../components/Icons'
import { durationLabel } from './EventDetailScreen'
import TopNavBar from '../components/TopNavBar'
import ActionSheet from '../components/ActionSheet'
import { openDirections } from '../native/directions'
import { EventCover, EventHostCard, EventMetaGrid, EventParticipantsCard, EventRequirementsCard, EventTextCard, EventTitle, detailStyles } from '../components/EventDetailParts'
import { participantCount, type EventPhase } from '../native/Store'
import { ui } from '../theme/styles'
import LoadingSpinner from '../components/LoadingSpinner'

export default function GuestEventScreen() {
  const params = useLocalSearchParams<{ code?: string }>()
  const router = useRouter()
  const { ready, guest, enter, save, clearParticipation, returnToMember, exit } = useGuest()
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
  // The "Misafir" badge opens a menu: sign up (registration) or leave guest mode (welcome page). The guest
  // participation is kept, so the same invite resumes it later.
  const [menuOpen, setMenuOpen] = useState(false)
  const leaveGuest = async (target: '/onboarding-1' | '/welcome') => {
    if (pending.current) return
    pending.current = true; setBusy(true)
    try { await exit(); router.replace(target as Href) }
    catch (cause) { setError(getApiErrorMessage(cause, 'Misafir oturumundan çıkılamadı. Tekrar dene.')) }
    finally { pending.current = false; setBusy(false) }
  }
  const memberReturn = async () => {
    if (pending.current) return
    const captured = generation.current
    pending.current = true; setBusy(true)
    try { await returnToMember(); if (captured === generation.current) router.replace('/discover' as Href) }
    catch (cause) { if (captured === generation.current) setError(getApiErrorMessage(cause, 'Üyelik oturumuna dönülemedi. Onaylı üyeliğinin aktif olması gerekir.')) }
    finally { if (captured === generation.current) { pending.current = false; setBusy(false) } }
  }
  // The same page as a member's event detail (shared parts), showing only what the invitation shares: no
  // participant list or photos, no organizer photo, score or profile, no exact coordinates,
  // sharing or invitations. The room opens to a guest who joined, like to members.
  const phase: EventPhase = !event ? 'forming' : event.status === 'cancelled' ? 'cancelled' : event.status === 'closed' ? 'closed'
    : event.status === 'started' ? 'started' : event.participantCount >= event.minParticipants ? 'active' : 'forming'
  const participationOpen = !!event && event.status === 'waiting_participants'
  // A guest can use the room only before the start (like joining); once it started the invite only shows the event.
  const roomOpen = phase === 'active'
  const full = !!event && event.participantCount >= event.maxParticipants
  const frozenNote = event?.status === 'cancelled' ? 'Etkinlik iptal edildi; katılım durumu değiştirilemez.' : event?.status === 'closed' ? 'Etkinlik sona erdi; katılım durumu değiştirilemez.' : 'Bu etkinliğe katılım kapanmış.'
  return <Box style={[[ui.fixed, ui.inset0, ui.bg06060e, ui.overflowHidden]]}>
    <AtmoBackground />
    {/* No back: a guest can open only this event. The Ewent wordmark tops the page (the event's title is right
        below it); the badge says whose view this is. */}
    <TopNavBar navigate={() => {}} fallback="discover" hideBack floating title="" leading={<BrandWordmark width={96} />}
      right={<Touch accessibilityLabel="Misafir menüsü" accessibilityHint="Üye olabilir ya da misafir oturumundan çıkabilirsin" disabled={busy} onPress={() => setMenuOpen(true)} style={[s.badge, { minHeight: 0 }]}>Misafir ▾</Touch>} />
    {loading ? <Box style={s.center}><LoadingSpinner size="large" /></Box> : <Scroll style={[[ui.relative, ui.hFull, ui.flex, ui.flexCol], { paddingBottom: 32 }]}>
      {event && <>
        <EventCover uri={image} label={event.title} phase={phase} />
        <Box style={[[ui.px5, ui.spaceY5]]}>
          <Box>
            <EventTitle title={event.title} />
            {/* Participation under the title, with the same chips as for members. */}
            <Box style={[[ui.mt2]]}>
              {joined ? <Box style={detailStyles.hostRow}>
                <Box style={detailStyles.hostBadge}>
                  <CheckIcon size={12} strokeWidth={2.2} style={{ color: palette.success }} />
                  <Label style={detailStyles.hostBadgeText}>{`Katıldın · Misafir ${guest?.name}`}</Label>
                </Box>
                <Box style={detailStyles.rowActions}>
                  {/* Once the room is open (the minimum is reached), the guest talks there with the members. */}
                  {roomOpen && <Touch accessibilityLabel="Odaya Katıl" disabled={busy} onPress={() => router.push('/guest-room' as Href)} style={detailStyles.roomChip} gradient={palette.actionGradient}>
                    Odaya Katıl →
                  </Touch>}
                  {participationOpen && <Touch accessibilityLabel="Katılımı iptal et" disabled={busy} onPress={() => void leave()} style={detailStyles.cancelChip}>{busy ? 'Bekle…' : 'İptal Et'}</Touch>}
                </Box>
              </Box> : <>
                <Box style={detailStyles.hostRow}>
                  <Label style={detailStyles.countText}>{`${participantCount(event.participantCount, event.maxParticipants)} kişi`}</Label>
                  <Box style={detailStyles.rowActions}>
                    <Touch accessibilityLabel={full ? 'Kontenjan dolu' : 'Katıl'} disabled={busy || !participationOpen || full || !name.trim()} onPress={() => void join()} style={detailStyles.roomChip} gradient={palette.actionGradient}>
                      {busy ? 'Bekle…' : full ? 'Kontenjan dolu' : 'Katıl'}
                    </Touch>
                  </Box>
                </Box>
                {/* A guest joins with a name; members see them as "Misafir · Ad". */}
                {participationOpen && !full && <Box style={[[ui.mt3]]}>
                  <Field accessibilityLabel="Misafir adın" placeholder="Adın" placeholderTextColor={palette.muted} value={name} onChangeText={setName} maxLength={60} editable={!busy} style={s.field} />
                  <Label style={[[ui.textXs, ui.mt2, ui.textWhite50]]}>{`Diğer katılımcılar seni “Misafir · ${name.trim() || 'Adın'}” olarak görecek.`}</Label>
                </Box>}
              </>}
              {!participationOpen && <Label accessibilityRole="text" style={[[ui.textXs, ui.mt2, ui.textWhite50]]}>{frozenNote}</Label>}
            </Box>
            {/* Date, the place's name, duration and (when set) level. Without coordinates the map app looks the
                place up by its name, as for members tapping the location. */}
            <EventMetaGrid items={[
              { icon: <ClockIcon size={17} strokeWidth={1.75} />, label: 'Tarih ve saat', value: `${event.date} · ${event.time}` },
              ...(event.location ? [{ icon: <LocationIcon size={17} strokeWidth={1.75} />, label: 'Konum', value: event.location, onPress: () => openDirections({ name: event.location }) }] : []),
              { icon: <ClockIcon size={17} strokeWidth={1.75} />, label: 'Süre', value: durationLabel(event.durationMinutes ? String(event.durationMinutes) : undefined) },
              ...(event.level ? [{ icon: <CheckIcon size={17} strokeWidth={1.75} />, label: 'Seviye', value: event.level }] : []),
            ]} />
          </Box>
          {/* The count only: who joined is not shared with guests. */}
          <EventParticipantsCard count={participantCount(event.participantCount, event.maxParticipants)}
            forming={phase === 'forming' ? { current: event.participantCount, minimum: event.minParticipants } : undefined} />
          <EventTextCard title="Açıklama" text={event.description} />
          <EventRequirementsCard items={(event.requirements ?? '').split('\n').map(line => line.trim()).filter(Boolean)} />
          {/* The organizer's name only: no photo, score or profile link for guests. */}
          <EventHostCard name={event.hostName} avatar="" />
          <Label style={[[ui.textXs, ui.textWhite45]]}>Bu davetle yalnızca bu etkinliğe erişebilirsin. Katılımından daveti paylaşan üye sorumludur.</Label>
        </Box>
      </>}
      {error ? <Label accessibilityRole="alert" style={s.error}>{error}</Label> : null}
      <Box style={s.actions}>
        {canReturnToMember && <Touch disabled={busy} onPress={() => void memberReturn()} style={s.secondary}>Üyeliğime dön</Touch>}
        {!event && !loading && <Touch onPress={() => router.replace('/guest-entry' as Href)} style={s.secondary}>Davet kodunu yeniden gir</Touch>}
      </Box>
    </Scroll>}
    {menuOpen && <ActionSheet title="Misafir olarak geziyorsun" onClose={() => setMenuOpen(false)} options={[
      { label: 'Üye ol', onPress: () => void leaveGuest('/onboarding-1') },
      { label: 'Misafirlikten çık', danger: true, onPress: () => void leaveGuest('/welcome') },
    ]} />}
  </Box>
}
const s = StyleSheet.create({
  badge: { color: palette.accent, fontSize: 12, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: palette.selected, borderRadius: 20, overflow: 'hidden' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  field: { minHeight: 48, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1, borderColor: palette.glassBorder, backgroundColor: palette.glass, color: palette.text, fontSize: 15 },
  actions: { paddingHorizontal: 20, paddingTop: 20, gap: 10 },
  secondary: { minHeight: 48, paddingHorizontal: 16, color: palette.muted, backgroundColor: palette.elevated, borderRadius: 14 },
  error: { marginHorizontal: 20, marginTop: 16, color: palette.error, fontSize: 13, lineHeight: 20 },
})

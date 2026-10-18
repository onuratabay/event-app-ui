import ContextualTip from "../walkthrough/ContextualTip"
import { useWalkthroughScreenBlocker } from "../walkthrough/activity"
import EventShareSheet from "../components/EventShareSheet";
import { palette } from "../theme/palette";
import { useBottomNavInset } from "../components/BottomNav";
import { CategoryIcon } from "../components/Icons";
import { onSocket, socketAction, watchEvent } from '../services/socket';
import { participate, getApiErrorMessage, getEvent, getEventCandidateCount, cancelEvent, createEventCode } from "../api/client";
import { GeneratedCode } from "../components/GeneratedCode";
import { formatScore } from "../events/score";
import { eventPhase, isLivePhase, isRoomReady, isUnlimitedCapacity, mapApiEvent, participantCount } from "../native/Store";
import { useEffect, useState, type ReactNode } from "react";
import { Alert, StyleSheet } from "react-native";
import { AtmoBackground, Avatar, GlassCard } from "../components/GlassUI";
import { CheckIcon, ClockIcon, LocationIcon, ShareIcon, StarIcon } from "../components/Icons";
import { openDirections } from "../native/directions";
import TopNavBar, { NAV_ICON_SIZE, NAV_ICON_STROKE, NavAction } from "../components/TopNavBar";
import { useStore } from "../native/Store";
import { Box, Label, Picture, Scroll, Touch } from "../native/UI";
import { ui } from "../theme/styles";
import { NavigateFn } from "../types";
import InviteCandidatesSheet from "../availability/InviteCandidatesSheet";
import { remainingLabel, useRemaining } from "../availability/countdown";
interface Props {
  navigate: NavigateFn;
  eventId?: string;
}
// "90 dk" → "1 saat 30 dk"; events created without a duration say so instead of showing nothing.
// Event start on the device clock (date "dd/MM/yyyy", time "HH:mm").
// Every meta box has the same height; long values (location) wrap to two lines at most.
const META_BOX_HEIGHT = 112;
function startsAt(event: { date: string; time: string }) {
  const [day, month, year] = event.date.split("/").map(Number);
  const [hour, minute] = event.time.split(":").map(Number);
  return new Date(year, (month || 1) - 1, day || 1, hour || 0, minute || 0);
}
export function durationLabel(duration?: string) {
  const minutes = parseInt(duration || "", 10);
  if (!minutes || minutes <= 0) return "Belirtilmedi";
  const hours = Math.floor(minutes / 60), rest = minutes % 60;
  return [hours ? `${hours} saat` : "", rest ? `${rest} dk` : ""].filter(Boolean).join(" ");
}
export default function EventDetailScreen({
  navigate,
  eventId
}: Props) {
  const navInset = useBottomNavInset();
  const {
    data: store,
    setData: setStore
  } = useStore();
  const EVENTS = store.events;
  const event = EVENTS.find(e => e.id === eventId);
  const [shareOpen, setShareOpen] = useState(false);
  const [joining, setJoining] = useState(false);
  const [justJoined, setJustJoined] = useState(false);
  useWalkthroughScreenBlocker(joining);
  const [loadError, setLoadError] = useState('');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [actionHeight, setActionHeight] = useState(72);
  const remaining = useRemaining(event?.invited ? event.invitationExpiresAt : null);
  // The invitation stays open until the event is full: up to the maximum, or for as long as it waits
  // for participants when no maximum was set. Only the organizer invites (the server enforces it).
  const canInvite = !!event && event.host.id === store.user.id && event.status === "waiting_participants" && startsAt(event) > new Date()
    // Without a maximum, pool invitations are only needed until the minimum is reached.
    && event.currentParticipants < (isUnlimitedCapacity(event.maxParticipants) ? event.minParticipants : event.maxParticipants);
  // People in the availability pool who match this event and wait for an invitation; refreshed after the invite sheet closes.
  const [waitingCount, setWaitingCount] = useState(0);
  useEffect(() => {
    if (!eventId || !canInvite || inviteOpen) return;
    let active = true;
    getEventCandidateCount(eventId).then(result => { if (active) setWaitingCount(result.count); }).catch(() => { if (active) setWaitingCount(0); });
    return () => { active = false; };
  }, [eventId, canInvite, inviteOpen, event?.currentParticipants]);
  useEffect(() => {
    if (!eventId) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const load = (background = false) => getEvent(eventId, { background }).then(value => { if (active) setStore(p => ({ ...p, events: [mapApiEvent(value), ...p.events.filter(e => e.id !== value.id)] })); }).catch(error => { if (active && !background) setLoadError(getApiErrorMessage(error, 'Etkinlik yüklenemedi.')); });
    // An event already in the list (feed, rooms, search) shows at once: the fresh copy then loads quietly,
    // without the full-screen loader. Only an event not loaded yet shows the loader (and errors).
    const cached = !!event;
    void load(cached);
    // The socket only sends the new count; reload so the participant list shows who joined or left.
    // Bursts (several joins at once) collapse into one request.
    const release = watchEvent(eventId);
    const stop = onSocket("event:participant_count_changed", (payload: { eventId?: string }) => {
      if (payload?.eventId !== eventId) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => { void load(true); }, 300);
    });
    return () => { active = false; if (timer) clearTimeout(timer); stop(); release(); };
  }, [eventId]);
  if (!event) return <Box style={[[ui.fixed, ui.inset0, ui.bg06060e]]}><TopNavBar navigate={navigate} fallback="discover" title="Etkinlik" /><Box style={{ paddingTop: 96, paddingHorizontal: 20 }}><Label>{loadError || 'Etkinlik yükleniyor…'}</Label></Box></Box>;
  const joined = event.host.id === store.user.id || event.joined || event.participants.some(p => p.id === store.user.id);
  // Joining, leaving and the waitlist change only before the start: never once it started, was cancelled
  // or ended (the server enforces the same rule).
  const participationOpen = event.status === "waiting_participants" && startsAt(event) > new Date();
  const frozenNote = event.status === "cancelled" ? "Etkinlik iptal edildi; katılım durumu değiştirilemez." : event.status === "closed" ? "Etkinlik sona erdi; katılım durumu değiştirilemez." : "Etkinlik başladı; katılım durumu artık değiştirilemez.";
  const setJoined = async (join: boolean) => {
    if (joining) return;
    setJoining(true);
    try { const remote = await participate(event.id, join); if (join) setJustJoined(true); setStore(p => ({ ...p, events: p.events.map(e => e.id === remote.id ? mapApiEvent(remote) : e) })); }
    catch (error) { Alert.alert('Katılım güncellenemedi', getApiErrorMessage(error)); }
    finally { setJoining(false); }
  };
  const roomReady = isRoomReady(event);
  const isForming = !roomReady && !['cancelled', 'closed'].includes(event.status || '');
  return <Box style={[[ui.fixed, ui.inset0, ui.bg06060e, ui.overflowHidden]]}>
      <AtmoBackground />
      <TopNavBar navigate={navigate} fallback="discover" title={event.title} subtitle={`${event.date} · ${event.time}`} floating right={<NavAction label="Paylaş" onPress={() => setShareOpen(true)}><ShareIcon size={NAV_ICON_SIZE} strokeWidth={NAV_ICON_STROKE} style={{ color: palette.text }} /></NavAction>} />
      <Scroll style={[[ui.relative, ui.hFull, ui.flex, ui.flexCol], { paddingBottom: actionHeight + 20 + navInset }]}>
        {/* Cover image header */}
        <Box style={[[ui.relative, ui.h72, ui.flexShrink0, ui.bgGray900]]}>
          <Picture uri={event.coverImage} accessibilityLabel={event.title} style={[[ui.wFull, ui.hFull]]} />
          <Box style={[[ui.fixed, ui.inset0], {}]} gradient={[palette.background, "transparent"]} gradientDirection="up" />

          {/* Status */}
          <Box style={[[ui.fixed, ui.bottom4, ui.left5]]}>
            <Box style={[[ui.px3, ui.py15, ui.roundedFull, ui.textXs, ui.fontMedium, isLivePhase(eventPhase(event)) ? [ui.bgEmerald50025, ui.border, ui.borderEmerald40040, ui.textEmerald300] : [ui.bgAmber50020, ui.border, ui.borderAmber40030, ui.textAmber300]]]}>
              {{ cancelled: "Etkinlik iptal edildi", closed: "Etkinlik sona erdi", started: "● Etkinlik başladı · Oda açık", active: "● Aktif · Oda açık", forming: "◌ Katılımcı Bekleniyor" }[eventPhase(event)]}
            </Box>
          </Box>
        </Box>

        {/* Content */}
        <Box style={[[ui.px5, ui.spaceY5]]}>
          <Box>
            <Box style={[[ui.flex, ui.itemsStart, ui.justifyBetween, ui.mt1]]}>
              <Box style={[[ui.flex1]]}>
                <Label style={[[ui.textXs, ui.textWhite40, ui.fontMedium]]}>
                  {event.category}
                </Label>
                <Label style={[[ui.fontDisplay, ui.text3xl, ui.fontLight, ui.textWhite, ui.mt1, ui.leadingTight]]}>
                  {event.title}
                </Label>
              </Box>
            </Box>

            {/* Meta info */}
            <Box walkthroughId="event-meta" style={[[ui.mt4, ui.grid, ui.gap3]]} columns={2}>
              {[{
              icon: <ClockIcon size={17} strokeWidth={1.75} />,
              label: "Tarih & Saat",
              value: `${event.date} · ${event.time}`
            }, {
              icon: <LocationIcon size={17} strokeWidth={1.75} />,
              label: "Konum",
              value: event.location,
              // Tapping the location starts directions in the phone's map or navigation app.
              onPress: () => openDirections({ name: event.location, latitude: event.latitude, longitude: event.longitude })
            }, {
              icon: <ClockIcon size={17} strokeWidth={1.75} />,
              label: "Süre",
              value: durationLabel(event.duration)
            }, ...(event.level ? [{
              icon: <CheckIcon size={17} strokeWidth={1.75} />,
              label: "Seviye",
              value: event.level
            }] : [])].map((item: { icon: ReactNode; label: string; value: string; onPress?: () => void }, i) => {
              const card = <GlassCard key={i} style={[[ui.p3], { height: META_BOX_HEIGHT }]}>
                  <Box style={[[ui.flex, ui.itemsCenter, ui.justifyBetween, ui.mb1]]}>
                    <Box style={[[ui.textWhite30]]}>{item.icon}</Box>
                    {item.onPress ? <Label style={[[ui.text10px, ui.fontMedium], { color: palette.accent }]}>Yol tarifi ›</Label> : null}
                  </Box>
                  <Label style={[[ui.text10px, ui.textWhite30, ui.uppercase, ui.trackingWider]]}>
                    {item.label}
                  </Label>
                  <Label numberOfLines={2} style={[[ui.textSm, ui.textWhite80, ui.mt05, ui.fontMedium]]}>
                    {item.value}
                  </Label>
                </GlassCard>;
              return item.onPress ? <Touch key={i} accessibilityLabel={`${item.label}: ${item.value}, yol tarifi al`} onPress={item.onPress}>{card}</Touch> : card;
            })}
            </Box>
          </Box>

          {/* Participants */}
          <GlassCard walkthroughId="event-people" style={[[ui.p4]]}>
            <Box style={[[ui.flex, ui.itemsCenter, ui.justifyBetween, ui.mb3]]}>
              <Label style={[[ui.textSm, ui.fontMedium, ui.textWhite70]]}>
                Katılımcılar
              </Label>
              <Box style={[[ui.flex, ui.itemsCenter, ui.gap3]]}>
                <Label style={[[ui.textSm, ui.fontSemibold, ui.textWhite]]}>
                  {participantCount(event.currentParticipants, event.maxParticipants)}
                </Label>
              </Box>
            </Box>
            <Box style={[[ui.flex, ui.itemsCenter, ui.gap2, ui.flexWrap]]}>
              {event.participants.filter(p => p.id !== store.user.id).map(p => {
                const guest = p.id.startsWith("guest:");
                const person = <>
                    <Avatar uri={p.avatar} name={p.name} size="sm" />
                    <Label style={[[ui.text9px, ui.textWhite35, ui.textCenter], { maxWidth: guest ? 80 : 48 }]} numberOfLines={guest ? 2 : 1}>
                      {guest ? `Misafir · ${p.name.replace(/ · Misafir$/, "")}` : p.name.split(" ")[0]}
                    </Label>
                  </>;
                // Members open their profile; guests have none.
                return guest ? <Box key={p.id} style={[[ui.flex, ui.flexCol, ui.itemsCenter, ui.gap1]]}>{person}</Box>
                  : <Touch key={p.id} accessibilityLabel={`${p.name} profilini aç`} onPress={() => navigate("profile", { userId: p.id })} style={[[ui.flex, ui.flexCol, ui.itemsCenter, ui.gap1], { minHeight: 0 }]}>{person}</Touch>;
              })}
              {joined && <Box style={[[ui.flex, ui.flexCol, ui.itemsCenter, ui.gap1]]}>
                  <Box style={[[ui.w8, ui.h8, ui.roundedFull, ui.bgC8a44a20, ui.border, ui.borderC8a44a30, ui.flex, ui.itemsCenter, ui.justifyCenter]]}>
                    <Label style={[[ui.textXs, ui.textC8a44a]]}>Sen</Label>
                  </Box>
                  <Label style={[[ui.text9px, ui.textC8a44a]]}>{event.host.id === store.user.id ? "Sen" : "Katıldın"}</Label>
                </Box>}
            </Box>
            {/* Invitations come only from the in-app availability pool (Etkinlik Takvimim), inside the participants card. */}
            {canInvite && <Box style={[[ui.mt4, ui.pt4, ui.borderT, ui.borderWhite8, ui.flex, ui.itemsCenter, ui.gap3]]}>
                <Box style={[[ui.flex1]]}>
                  <Label style={[[ui.textSm, ui.fontMedium, ui.textWhite85]]}>Davet açık</Label>
                  <Label style={[[ui.textXs, ui.textWhite55, ui.mt05]]}>
                    {waitingCount > 0 ? `Takviminde bu tarih, saat ve yer için uygun ${waitingCount} kişi var` : "Şu anda takviminde bu tarih, saat ve yer için uygun kimse yok"}
                  </Label>
                </Box>
                {/* Opens the people whose calendar (Etkinlik Takvimim) is open for this date, time, place and activity. */}
                <Touch accessibilityLabel="Davet et" onPress={() => setInviteOpen(true)} style={[[ui.px4, ui.roundedXl, ui.textXs, ui.fontMedium, ui.border, ui.borderC8a44a30, ui.bgC8a44a10, ui.textC8a44a, ui.textCenter], { minHeight: 40, justifyContent: "center" }]}>
                  Davet et
                </Touch>
              </Box>}

            {isForming && <Box style={[[ui.mt3]]}>
                <Box style={[[ui.h1, ui.roundedFull, ui.bgWhite8, ui.overflowHidden]]}>
                  <Box style={[[ui.hFull, ui.roundedFull], {
                width: `${event.currentParticipants / event.minParticipants * 100}%`
              }]} gradient={["#4d5bcb", "#6651c9"]} gradientDirection="right" />
                </Box>
                <Label style={[[ui.textXs, ui.textAmber30060, ui.mt15]]}>
                  Etkinliğin aktif olması için{" "}
                  {Math.max(0, event.minParticipants - event.currentParticipants)} kişi daha
                  gerekiyor
                </Label>
                <Label style={[[ui.textXs, ui.textWhite45, ui.mt2]]}>
                  Etkinlik minimum katılımcı sayısına ulaştığında oda açılacak ({event.currentParticipants}/{event.minParticipants}).
                </Label>
              </Box>}
          </GlassCard>

          {/* Description */}
          <GlassCard style={[[ui.p4]]}>
            <Label style={[[ui.textXs, ui.textWhite35, ui.uppercase, ui.trackingWider, ui.mb2]]}>
              Açıklama
            </Label>
            <Label style={[[ui.textSm, ui.textWhite65, ui.leadingRelaxed]]}>
              {event.description}
            </Label>
          </GlassCard>

          {/* Requirements */}
          {event.requirements.length > 0 && <GlassCard style={[[ui.p4]]}>
              <Label style={[[ui.textXs, ui.textWhite35, ui.uppercase, ui.trackingWider, ui.mb2]]}>
                Gereksinimler
              </Label>
              <Box style={[[ui.spaceY15]]}>
                {event.requirements.map((req, i) => <Box key={i} style={[[ui.flex, ui.itemsCenter, ui.gap2]]}>
                    <Label style={[[ui.w15, ui.h15, ui.roundedFull, ui.bgC8a44a60, ui.flexShrink0]]} />
                    <Label style={[[ui.textSm, ui.textWhite60]]}>{req}</Label>
                  </Box>)}
              </Box>
            </GlassCard>}

          {/* Host */}
          <GlassCard style={[[ui.p4]]}>
            <Label style={[[ui.textXs, ui.textWhite35, ui.uppercase, ui.trackingWider, ui.mb3]]}>
              Düzenleyen
            </Label>
            <Box style={[[ui.flex, ui.itemsCenter, ui.gap3]]}>
              {/* Your own event shows your own photo; another organizer's photo comes from the server's rule. */}
              <Avatar uri={event.host.id === store.user.id ? store.user.avatar : event.host.avatar} name={event.host.name} size="md" />
              <Box style={[[ui.flex1]]}>
                {/* Another organizer's name opens their profile; your own event has no link to yourself. */}
                {event.host.id !== store.user.id ? <Touch accessibilityRole="link" accessibilityLabel={`${event.host.name} profilini aç`} onPress={() => navigate("profile", { userId: event.host.id })} style={{ alignSelf: "flex-start", justifyContent: "flex-start", minHeight: 0 }}>
                  <Label style={[[ui.textSm, ui.fontMedium, ui.textWhite85]]}>{event.host.name}</Label>
                </Touch> : <Label style={[[ui.textSm, ui.fontMedium, ui.textWhite85]]}>
                  {event.host.name}
                </Label>}
                <Box style={[[ui.flex, ui.itemsCenter, ui.gap1, ui.mt05]]}>
                  <StarIcon size={14} style={{ color: palette.accent }} />
                  <Label style={[[ui.textXs, ui.textWhite40], { flexShrink: 1 }]} numberOfLines={1}>
                    {`${formatScore(event.host.score)} · ${event.host.stats.organized} etkinlik`}
                  </Label>
                </Box>
              </Box>
            </Box>
          </GlassCard>

          {/* The organizer's 24-hour event code (EWT-…): whoever enters it in the app opens this event as a guest. */}
          {event.host.id === store.user.id && !["cancelled", "closed"].includes(event.status ?? "") && <GlassCard style={[[ui.p5]]}>
            <Label style={[[ui.textXs, ui.textWhite35, ui.uppercase, ui.trackingWider, ui.mb3]]}>Etkinlik kodu</Label>
            <GeneratedCode label="Etkinlik kodu oluştur" storageKey={`event-app:event-code:${event.id}`} create={() => createEventCode(event.id).then(link => ({ code: link.code, expiresAt: link.expiresAt }))}
              hint="Kod 24 saat geçerli. Kodu kullanan misafirlerin sorumluluğu sende; katıldıkları etkinliklerde aldıkları puanlar senin referans puanına yansır." />
          </GlassCard>}

        </Box>
      </Scroll>

      {shareOpen && <EventShareSheet event={event} onClose={() => setShareOpen(false)} />}

      {/* Compact action bar with an opaque surface so scrolling text cannot show through. */}
      <Box walkthroughId="event-action" onLayout={event => setActionHeight(event.nativeEvent.layout.height)} style={[actionStyles.bar, { bottom: navInset }]}>
        <ContextualTip id="participation" when={justJoined} />
        <ContextualTip id="invitations" when={!!event.invited && !joined} />
        {!participationOpen && event.host.id !== store.user.id && <Label accessibilityRole="text" style={[[ui.textXs, ui.mb2, ui.textWhite50]]}>{frozenNote}</Label>}
        {event.invited && !joined && remaining !== null && <Label accessibilityLiveRegion="polite" style={[[ui.textXs, ui.mb2], { color: remaining > 0 ? palette.accent : palette.error }]}>
            {remaining > 0 ? `Davete yanıt için ${remainingLabel(remaining)}` : "Bu davetin süresi doldu."}
          </Label>}
        {event.invited && !joined ? <Box style={actionStyles.row} enter>
            <Touch disabled={joining || !participationOpen || remaining !== null && remaining <= 0} onPress={() => setJoined(true)} style={actionStyles.primary} gradient={palette.actionGradient}>
              Daveti kabul et
            </Touch>
            <Touch disabled={joining || !participationOpen} onPress={() => setJoined(false)} style={actionStyles.secondary}>
              Reddet
            </Touch>
          </Box> : !joined ? <Touch disabled={joining || !participationOpen} onPress={async () => {
          if (event.waitlisted) return setJoined(false);
          if (event.currentParticipants < event.maxParticipants) return setJoined(true);
          setJoining(true);
          try { await socketAction('event:waitlist_join', { eventId: event.id }); Alert.alert('Yedek listedesin', 'Organizatör kabul ettiğinde katılımın güncellenecek.'); }
          catch (cause) { Alert.alert('Yedek liste', cause instanceof Error ? cause.message : 'Tekrar dene.'); }
          finally { setJoining(false); }
        }} style={[actionStyles.primary, { flex: 0 }]} gradient={palette.actionGradient} enter>
            {event.waitlisted ? 'Yedek listeden ayrıl' : event.currentParticipants >= event.maxParticipants ? 'Yedek listeye katıl' : 'Katıl'}
          </Touch> : <Box style={actionStyles.row}>
            {roomReady ? <Touch accessibilityLabel="Odaya Katıl" onPress={() => navigate("event-room", { eventId: event.id })} style={actionStyles.primary} gradient={palette.actionGradient}>
              Odaya Katıl →
            </Touch> : event.host.id === store.user.id && event.status === "cancelled" ? <Touch accessibilityLabel="Güncelle ve yeniden oluştur" onPress={() => navigate("create-event", { eventId: event.id })} style={actionStyles.primary} gradient={palette.actionGradient}>
              {/* A cancelled event stays cancelled; the organizer starts a new one from its details. */}
              Güncelle ve yeniden oluştur
            </Touch> : <Box style={actionStyles.status}>
              <CheckIcon size={16} strokeWidth={2} style={{ color: palette.success }} />
              <Label style={actionStyles.statusText}>{event.host.id === store.user.id ? "Düzenleyensin" : "Katıldın"}</Label>
            </Box>}
            {/* The organizer may cancel only before the start; members are notified and the room closes. */}
            {event.host.id === store.user.id && event.status === "waiting_participants" && startsAt(event) > new Date() && <Touch accessibilityLabel="Etkinliği iptal et" disabled={joining} onPress={() => Alert.alert("Etkinliği iptal et", "Etkinlik iptal edilecek, katılımcılara bildirim gidecek ve etkinlik odasında artık mesaj gönderilemeyecek. Emin misin?", [
              { text: "Vazgeç", style: "cancel" },
              { text: "Etkinliği iptal et", style: "destructive", onPress: async () => {
                try { await cancelEvent(event.id); setStore(p => ({ ...p, events: p.events.map(e => e.id === event.id ? { ...e, status: "cancelled", isActive: false } : e) })); }
                catch (error) { Alert.alert("Etkinlik iptal edilemedi", getApiErrorMessage(error)); }
              } },
            ])} style={actionStyles.cancel}>
              Etkinliği iptal et
            </Touch>}
            {event.host.id !== store.user.id && participationOpen && <Touch accessibilityLabel="Katılımı iptal et" disabled={joining} onPress={() => setJoined(false)} style={actionStyles.cancel}>
              {joining ? "Bekle…" : "İptal Et"}
            </Touch>}
          </Box>}

      </Box>
      {inviteOpen && <InviteCandidatesSheet eventId={event.id} onClose={() => setInviteOpen(false)} />}
    </Box>;
}

const actionStyles = StyleSheet.create({
  bar: {
    position: "absolute", left: 12, right: 12, zIndex: 40,
    padding: 12, borderRadius: 22, backgroundColor: palette.surface,
    borderWidth: 1, borderColor: "rgba(183,197,255,.20)",
    shadowColor: "#000", shadowOpacity: 0.35, shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 }, elevation: 12,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  primary: {
    flex: 1, minHeight: 48, paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 14, color: palette.text, fontSize: 14, fontFamily: "Outfit-SemiBold",
  },
  secondary: {
    flex: 1, minHeight: 48, paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 14, backgroundColor: palette.elevated,
    borderWidth: 1, borderColor: palette.border, color: palette.text, fontSize: 14,
  },
  cancel: {
    minHeight: 48, paddingHorizontal: 16, borderRadius: 14,
    backgroundColor: palette.elevated, borderWidth: 1, borderColor: palette.border,
    color: palette.muted, fontSize: 13, fontFamily: "Outfit-Medium",
  },
  status: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8, minHeight: 48, paddingHorizontal: 4 },
  statusText: { color: palette.success, fontSize: 14, fontFamily: "Outfit-Medium" },
});

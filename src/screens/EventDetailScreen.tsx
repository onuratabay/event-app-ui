import { palette } from "../theme/palette";
import { useBottomNavInset } from "../components/BottomNav";
import { CategoryIcon } from "../components/Icons";
import { socketAction } from '../services/socket';
import { participate, getApiErrorMessage, getEvent } from "../api/client";
import { eventPhase, isLivePhase, isRoomReady, isUnlimitedCapacity, mapApiEvent, participantCount } from "../native/Store";
import { useEffect, useState } from "react";
import { Alert } from "react-native";
import { Circle, Line, Path, Polyline, Rect } from "react-native-svg";
import { Avatar, GlassCard } from "../components/GlassUI";
import { CheckIcon, ClockIcon, LocationIcon, ShareIcon, StarIcon } from "../components/Icons";
import TopNavBar from "../components/TopNavBar";
import { copyEvent, shareEvent } from "../native/media";
import { useStore } from "../native/Store";
import { Box, Label, Picture, Scroll, Sheet, Touch, Vector } from "../native/UI";
import { ui } from "../theme/styles";
import { NavigateFn } from "../types";
interface Props {
  navigate: NavigateFn;
  eventId?: string;
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
  const [loadError, setLoadError] = useState('');
  useEffect(() => { let active = true; if (eventId) getEvent(eventId).then(value => { if (active) setStore(p => ({ ...p, events: [mapApiEvent(value), ...p.events.filter(e => e.id !== value.id)] })); }).catch(error => { if (active) setLoadError(getApiErrorMessage(error, 'Etkinlik yüklenemedi.')); }); return () => { active = false; }; }, [eventId]);
  if (!event) return <Box style={[[ui.fixed, ui.inset0, ui.bg06060e]]}><TopNavBar navigate={navigate} fallback="discover" title="Etkinlik" /><Box style={{ paddingTop: 96, paddingHorizontal: 20 }}><Label>{loadError || 'Etkinlik yükleniyor…'}</Label></Box></Box>;
  const joined = event.host.id === store.user.id || event.joined || event.participants.some(p => p.id === store.user.id);
  const setJoined = async (join: boolean) => {
    if (joining) return;
    setJoining(true);
    try { const remote = await participate(event.id, join); setStore(p => ({ ...p, events: p.events.map(e => e.id === remote.id ? mapApiEvent(remote) : e) })); }
    catch (error) { Alert.alert('Katılım güncellenemedi', getApiErrorMessage(error)); }
    finally { setJoining(false); }
  };
  const roomReady = isRoomReady(event);
  const isForming = !roomReady && !['cancelled', 'closed'].includes(event.status || '');
  return <Box style={[[ui.fixed, ui.inset0, ui.bg06060e, ui.overflowHidden]]}>
      <TopNavBar navigate={navigate} fallback="discover" title={event.title} subtitle={`${event.date} · ${event.time}`} floating right={<Touch accessibilityLabel="Paylaş" onPress={() => setShareOpen(true)} style={[[ui.w10, ui.h10, ui.roundedXl, ui.flex, ui.itemsCenter, ui.justifyCenter, ui.textWhite80]]}><ShareIcon size={18} /></Touch>} />
      <Scroll style={[[ui.relative, ui.hFull, ui.flex, ui.flexCol, ui.pb20], { paddingBottom: 80 + navInset }]}>
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
            <Box style={[[ui.mt4, ui.grid, ui.gap3]]} columns={2}>
              {[{
              icon: <ClockIcon size={17} strokeWidth={1.75} />,
              label: "Tarih & Saat",
              value: `${event.date} · ${event.time}`
            }, {
              icon: <LocationIcon size={17} strokeWidth={1.75} />,
              label: "Konum",
              value: event.location
            }, {
              icon: <StarIcon size={17} strokeWidth={1.75} />,
              label: "Mesafe",
              value: event.distance
            }, ...(event.level ? [{
              icon: <CheckIcon size={17} strokeWidth={1.75} />,
              label: "Seviye",
              value: event.level
            }] : [])].map((item, i) => <GlassCard key={i} style={[[ui.p3]]}>
                  <Box style={[[ui.textWhite30, ui.mb1]]}>{item.icon}</Box>
                  <Label style={[[ui.text10px, ui.textWhite30, ui.uppercase, ui.trackingWider]]}>
                    {item.label}
                  </Label>
                  <Label style={[[ui.textSm, ui.textWhite80, ui.mt05, ui.fontMedium]]}>
                    {item.value}
                  </Label>
                </GlassCard>)}
            </Box>
          </Box>

          {/* Participants */}
          <GlassCard style={[[ui.p4]]}>
            <Box style={[[ui.flex, ui.itemsCenter, ui.justifyBetween, ui.mb3]]}>
              <Label style={[[ui.textSm, ui.fontMedium, ui.textWhite70]]}>
                Katılımcılar
              </Label>
              <Label style={[[ui.textSm, ui.fontSemibold, ui.textWhite]]}>
                {participantCount(event.currentParticipants, event.maxParticipants)}
              </Label>
            </Box>
            <Box style={[[ui.flex, ui.itemsCenter, ui.gap2, ui.flexWrap]]}>
              {event.participants.filter(p => p.id !== store.user.id).map(p => <Box key={p.id} style={[[ui.flex, ui.flexCol, ui.itemsCenter, ui.gap1]]}>
                    <Avatar uri={p.avatar} name={p.name} size="sm" />
                    <Label style={[[ui.text9px, ui.textWhite35, ui.maxW48px, ui.textCenter]]} numberOfLines={1}>
                      {p.name.split(" ")[0]}
                    </Label>
                  </Box>)}
              {joined && <Box style={[[ui.flex, ui.flexCol, ui.itemsCenter, ui.gap1]]}>
                  <Box style={[[ui.w8, ui.h8, ui.roundedFull, ui.bgC8a44a20, ui.border, ui.borderC8a44a30, ui.flex, ui.itemsCenter, ui.justifyCenter]]}>
                    <Label style={[[ui.textXs, ui.textC8a44a]]}>Sen</Label>
                  </Box>
                  <Label style={[[ui.text9px, ui.textC8a44a]]}>Sen</Label>
                </Box>}
              {/* Empty slots */}
              {Array.from({
              length: isUnlimitedCapacity(event.maxParticipants) ? 0 : Math.max(0, event.maxParticipants - event.currentParticipants)
            }).map((_, i) => <Box key={i} style={[[ui.w8, ui.h8, ui.roundedFull, ui.border, ui.borderDashed, ui.borderWhite15, ui.flex, ui.itemsCenter, ui.justifyCenter]]}>
                  <Label style={[[ui.textWhite20, ui.textXs]]}>+</Label>
                </Box>)}
            </Box>

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
              <Avatar uri={event.host.avatar} name={event.host.name} size="md" />
              <Box style={[[ui.flex1]]}>
                <Label style={[[ui.textSm, ui.fontMedium, ui.textWhite85]]}>
                  {event.host.name}
                </Label>
                <Box style={[[ui.flex, ui.itemsCenter, ui.gap1, ui.mt05]]}>
                  <StarIcon size={14} style={{ color: palette.accent }} />
                  <Label style={[[ui.textXs, ui.textWhite40]]}>
                    {event.host.score} · {event.host.stats.organized} etkinlik
                  </Label>
                </Box>
              </Box>
              <Touch onPress={() => navigate("profile")} style={[[ui.textXs, ui.px3, ui.py15, ui.roundedXl, ui.textWhite50, ui.border, ui.borderWhite10]]}>
                Profil
              </Touch>
            </Box>
          </GlassCard>

          <Box style={[[ui.pb36]]} />
        </Box>
      </Scroll>

      {/* Share Sheet */}
      {shareOpen && <Sheet onClose={() => setShareOpen(false)} style={[[ui.fixed, ui.inset0, ui.z80, ui.flex, ui.itemsEnd]]}>
          <Box style={[[ui.fixed, ui.inset0, ui.bgBlack50]]} />
          <Touch onPress={e => e.stopPropagation()} style={[[ui.relative, ui.wFull, ui.roundedT28px, ui.overflowHidden], {
        backgroundColor: "rgba(10,10,22,0.92)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.10)",
        borderBottomWidth: 0,
        borderBottomColor: "transparent"
      }]} glass enter>
            <Box style={[[ui.fixed, ui.inset0], {}]} gradient={["rgba(255,255,255,0.04)", "transparent", "rgba(105,120,255,0.03)"]} pointerEvents="none" />
            <Box style={[[ui.relative, ui.px5, ui.pt4, ui.pb10]]}>
              <Box style={[[ui.w10, ui.h1, ui.roundedFull, ui.bgWhite15, ui.mxAuto, ui.mb5]]} />
              <Box style={[[ui.grid, ui.gap3, ui.mb4]]} columns={4}>
                {[{
              label: "WhatsApp",
              color: "#25D366",
              icon: <Vector width="20" height="20" viewBox="0 0 24 24" fill="#25D366">
                        <Path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413z" />
                        <Path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.12 1.529 5.845L.057 23.617a.5.5 0 0 0 .63.63l5.772-1.472A11.947 11.947 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22a9.944 9.944 0 0 1-5.073-1.388l-.364-.216-3.768.961.977-3.672-.236-.38A9.952 9.952 0 0 1 2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z" />
                      </Vector>
            }, {
              label: "Facebook",
              color: "#1877F2",
              icon: <Vector width="20" height="20" viewBox="0 0 24 24" fill="#1877F2">
                        <Path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                      </Vector>
            }, {
              label: "X",
              color: "#000000",
              icon: <Vector width="18" height="18" viewBox="0 0 24 24" fill="white">
                        <Path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.713 5.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                      </Vector>
            }, {
              label: "Mail",
              color: "#6B7280",
              icon: <Vector width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <Path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                        <Polyline points="22,6 12,13 2,6" />
                      </Vector>
            }].map(p => <Touch onPress={() => shareEvent(event)} key={p.label} style={[[ui.flex, ui.flexCol, ui.itemsCenter, ui.gap2]]}>
                    <Box style={[[ui.w14, ui.h14, ui.rounded2xl, ui.flex, ui.itemsCenter, ui.justifyCenter], {
                backgroundColor: `${p.color}20`,
                borderWidth: 1,
                borderColor: `${p.color}30`
              }]}>
                      {p.icon}
                    </Box>
                    <Label style={[[ui.text11px, ui.textWhite40]]}>
                      {p.label}
                    </Label>
                  </Touch>)}
              </Box>
              <Touch onPress={async () => {
            if (await copyEvent(event)) Alert.alert("Kopyalandı");
          }} style={[[ui.wFull, ui.flex, ui.itemsCenter, ui.gap3, ui.px4, ui.py35, ui.rounded2xl], {
            backgroundColor: "rgba(255,255,255,0.06)",
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.09)"
          }]}>
                <Box style={[[ui.w9, ui.h9, ui.roundedXl, ui.flex, ui.itemsCenter, ui.justifyCenter], {
              backgroundColor: "rgba(105,120,255,0.10)",
              borderWidth: 1,
              borderColor: "rgba(105,120,255,0.15)"
            }]}>
                  <Vector width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={palette.accent} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                    <Path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                    <Path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                  </Vector>
                </Box>
                <Box style={[[ui.flex1, ui.textLeft]]}>
                  <Label style={[[ui.textSm, ui.fontMedium, ui.textWhite70]]}>
                    Bağlantıyı Kopyala
                  </Label>
                  <Label style={[[ui.textXs, ui.textWhite25]]}>
                    Paylaşılabilir etkinlik bağlantısı
                  </Label>
                </Box>
              </Touch>
            </Box>
          </Touch>
        </Sheet>}

      {/* Sticky CTA */}
      <Box style={[[ui.fixed, ui.left0, ui.right0, ui.px5, ui.pb8, ui.pt4, ui.z40, ui.spaceY25], { bottom: navInset }]} gradient={[palette.background, "transparent"]} gradientDirection="up">
        {/* Room entry — only once the minimum is reached AND the user has joined */}
        {roomReady && joined ? <Touch onPress={() => navigate("event-room", {
        eventId: event.id
      })} style={[[ui.wFull, ui.py35, ui.rounded2xl, ui.fontMedium, ui.textSm, ui.textEmerald300], {
        backgroundColor: "rgba(52,211,153,0.10)",
        borderWidth: 1,
        borderColor: "rgba(52,211,153,0.20)"
      }]}>
            Odaya Katıl →
          </Touch> : roomReady && !joined /* Room open but not joined: show disabled room entry with hint */ ? <Box style={[[ui.wFull, ui.py35, ui.rounded2xl, ui.flex, ui.itemsCenter, ui.justifyCenter, ui.gap2], {
        backgroundColor: "rgba(255,255,255,0.03)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.07)"
      }]}>
            <Vector width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <Rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <Path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </Vector>
            <Label style={[[ui.textSm, ui.textWhite20]]}>
              Katılmadan odaya giremezsin
            </Label>
          </Box> : !joined /* Forming event: not joined yet */ ? null : null}

        {/* Below the minimum there is no room button; explain when it opens */}
        {isForming && <Box glass style={[[ui.rounded2xl, ui.px4, ui.py3, ui.flex, ui.itemsCenter, ui.gap25], {
        backgroundColor: "rgba(251,191,36,0.11)",
        borderWidth: 1,
        borderColor: "rgba(251,191,36,0.22)"
      }]}>
            <Vector width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(251,191,36,0.6)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <Circle cx="12" cy="12" r="10" />
              <Line x1="12" y1="8" x2="12" y2="12" />
              <Line x1="12" y1="16" x2="12.01" y2="16" />
            </Vector>
            <Label style={[[ui.textXs, ui.textAmber30060]]}>
              Etkinlik henüz aktif değil. Etkinlik minimum katılımcı sayısına ulaştığında oda açılacak ({event.currentParticipants}/{event.minParticipants}).
            </Label>
          </Box>}

        {event.invited && !joined ? <Box style={[[ui.flex, ui.gap3]]} enter>
            <Touch disabled={joining || ['cancelled', 'closed'].includes(event.status || '')} onPress={() => setJoined(true)} style={[[ui.py4, ui.rounded2xl, ui.fontSemibold, ui.textBase], { flex: 1, color: palette.text }]} gradient={palette.actionGradient}>
              Daveti kabul et
            </Touch>
            <Touch disabled={joining} onPress={() => setJoined(false)} style={[[ui.py4, ui.rounded2xl, ui.textBase, ui.textWhite60, ui.border, ui.borderWhite8], { flex: 1 }]}>
              Reddet
            </Touch>
          </Box> : !joined ? <Touch disabled={joining || ['cancelled', 'closed'].includes(event.status || '')} onPress={async () => {
          if (event.waitlisted) return setJoined(false);
          if (event.currentParticipants < event.maxParticipants) return setJoined(true);
          setJoining(true);
          try { await socketAction('event:waitlist_join', { eventId: event.id }); Alert.alert('Yedek listedesin', 'Organizatör kabul ettiğinde katılımın güncellenecek.'); }
          catch (cause) { Alert.alert('Yedek liste', cause instanceof Error ? cause.message : 'Tekrar dene.'); }
          finally { setJoining(false); }
        }} glass style={[[ui.wFull, ui.py4, ui.rounded2xl, ui.fontSemibold, ui.textBase], {
        color: palette.text,
        borderWidth: 1,
        borderColor: "rgba(183,197,255,.58)"
      }]} gradient={palette.actionGradient} enter>
            {event.waitlisted ? 'Yedek listeden ayrıl' : event.currentParticipants >= event.maxParticipants ? 'Yedek listeye katıl' : 'Katıl'}
          </Touch> : <Touch disabled={joining || event.host.id === store.user.id} onPress={() => setJoined(false)} style={[[ui.wFull, ui.py35, ui.rounded2xl, ui.textSm, ui.textWhite35, ui.border, ui.borderWhite8, ui.flex, ui.itemsCenter, ui.justifyCenter, ui.gap2]]}>
            <CheckIcon size={14} strokeWidth={2} style={[[ui.textWhite35]]} />
            {event.host.id === store.user.id ? "Bu etkinliği sen düzenliyorsun" : "Katıldın · İptal Et"}
          </Touch>}
      </Box>
    </Box>;
}

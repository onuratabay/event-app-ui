import { palette } from "../theme/palette";
import { MessageIcon } from "../components/Icons";
import TopNavBar from "../components/TopNavBar";
import { Circle, Path, Polygon, Polyline, Rect } from "react-native-svg";
import { ComingSoonCard } from "../components/Expressive";
import { AtmoBackground, GlassCard } from "../components/GlassUI";
import { byLatestMessage, isEventMember, isRoomReady, roomTitle, useStore } from "../native/Store";
import { Box, Label, Picture, Scroll, Touch, Vector } from "../native/UI";
import { ui } from "../theme/styles";
import { NavigateFn } from "../types";
import { useEffect, useRef, useState } from "react";
import { getDirectConversations, type DirectConversation } from "../api/client";
import { Avatar } from "../components/GlassUI";
import { onSocket } from "../services/socket";
import { useScreenActive } from "../native/useScreenActive";
import { RefreshControl } from "react-native";
interface Props {
  navigate: NavigateFn;
}
// Today shows the clock time, older messages show the day.
function lastMessageLabel(at: string) {
  const date = new Date(at), now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return date.toDateString() === now.toDateString() ? `${pad(date.getHours())}:${pad(date.getMinutes())}` : `${pad(date.getDate())}/${pad(date.getMonth() + 1)}`;
}
/** How many chats and rooms show before "Daha fazla göster". */
const PREVIEW_COUNT = 3;
/** Under a list cut to its newest three: shows the rest, or folds them away again. Hidden when nothing is cut. */
function MoreToggle({ total, open, onPress }: { total: number; open: boolean; onPress: () => void }) {
  if (total <= PREVIEW_COUNT) return null;
  return <Touch accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={onPress} style={[[ui.textXs, ui.fontMedium], { color: palette.accent, alignSelf: "center", minHeight: 40, justifyContent: "center", paddingHorizontal: 12 }]}>
    {open ? "Daha az göster" : `Daha fazla göster (${total - PREVIEW_COUNT})`}
  </Touch>;
}
/** Last one-to-one chat list per account (this app session), shown at once while /direct refreshes it. */
const chatCache = new Map<string, DirectConversation[]>();
export default function RoomsScreen({
  navigate
}: Props) {
  const {
    data: store, refreshRooms
  } = useStore();
  // The list is built from cached events: /events/rooms runs once per session (and on pull-to-refresh);
  // socket events add new rooms, open them, and update last messages and unread counts.
  // One-to-one chats show the last known list at once (kept per account for this app session); /direct
  // then refreshes it in the background and the screen updates only if something changed.
  const cacheKey = store.user.id;
  const [chats, setChats] = useState<DirectConversation[]>(() => (cacheKey && chatCache.get(cacheKey)) || []);
  const loadChats = () => getDirectConversations().then(result => {
    if (cacheKey) chatCache.set(cacheKey, result.items);
    setChats(current => JSON.stringify(current) === JSON.stringify(result.items) ? current : result.items);
  }).catch(() => {});
  // Messages and rooms show their newest three; "Daha fazla göster" lists the rest.
  const [showAllChats, setShowAllChats] = useState(false);
  const [showAllRooms, setShowAllRooms] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const reloadMine = async (pulled = false) => {
    if (pulled) setRefreshing(true);
    // Rooms and chats load together; pulling down refreshes both.
    try { await Promise.all([refreshRooms(pulled).catch(() => { /* The store shows a retryable error notice. */ }), loadChats()]); }
    finally { if (pulled) setRefreshing(false); }
  };
  useEffect(() => { void reloadMine(); }, []);
  // Coming back to the page, a new message, a friendship change or a reconnect refreshes the chats.
  const screenActive = useScreenActive();
  const firstFocus = useRef(true);
  useEffect(() => {
    if (!screenActive) return;
    if (firstFocus.current) firstFocus.current = false; else void loadChats();
    const stops = ["dm:message", "friend:changed", "sync:required"].map(name => onSocket(name, () => { void loadChats(); }));
    // Online / offline changes update the dots without reloading the list.
    stops.push(onSocket("presence:changed", (payload: { userId: string; online: boolean }) => setChats(current => {
      const next = current.map(chat => chat.user.id === payload.userId ? { ...chat, online: payload.online } : chat);
      if (cacheKey) chatCache.set(cacheKey, next);
      return next;
    })));
    return () => { stops.forEach(stop => stop()); };
  }, [screenActive]);
  const EVENTS = store.events;
  // Each event whose room is open appears as a chat named after the event.
  const activeEvents = EVENTS.filter(e => isRoomReady(e) && isEventMember(e, store.user.id)).sort(byLatestMessage);
  const formingEvents = EVENTS.filter(e => !['closed', 'cancelled'].includes(e.status || '') && !isRoomReady(e) && isEventMember(e, store.user.id));
  return <Box style={[[ui.fixed, ui.inset0, ui.bg06060e, ui.overflowHidden]]}>
      <AtmoBackground />
      <TopNavBar navigate={navigate} fallback="discover" title="Etkinliklerim" subtitle="Katıldığın ve düzenlediğin etkinlikler" />

      <Scroll style={[[ui.relative, ui.hFull, ui.pb28], { paddingTop: 80 }]} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { void reloadMine(true); }} tintColor={palette.accent} colors={[palette.accent]} progressBackgroundColor={palette.surface} progressViewOffset={80} />}>

        {/* Direct messages */}
        {chats.length > 0 && <Box style={[[ui.px5, ui.mb6]]}>
          <Label style={[[ui.textXs, ui.textWhite30, ui.uppercase, ui.trackingWider, ui.mb3]]}>
            Mesajlar
          </Label>
          <Box style={[[ui.spaceY3]]}>
            {(showAllChats ? chats : chats.slice(0, PREVIEW_COUNT)).map(chat => {
              const name = `${chat.user.firstName} ${chat.user.lastName}`.trim();
              const last = chat.lastMessage;
              return <Touch key={chat.id} accessibilityLabel={`${name} ile sohbet`} onPress={() => navigate("direct-chat", { userId: chat.user.id })} style={[[ui.wFull, ui.textLeft]]}>
                <GlassCard style={[[ui.p4]]}>
                  <Box style={[[ui.flex, ui.itemsCenter, ui.gap3]]}>
                    {/* A green dot only while the person is online; nothing when offline. */}
                    <Box style={{ position: "relative" }}>
                      <Avatar uri={chat.user.profilePhoto || ""} name={name} size="lg" />
                      {chat.online && <Box accessibilityLabel="Çevrimiçi" style={{ position: "absolute", right: 0, bottom: 0, width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: palette.background, backgroundColor: palette.success }} />}
                    </Box>
                    <Box style={[[ui.flex1, ui.minW0]]}>
                      <Label style={[[ui.textSm, chat.unreadCount > 0 ? ui.fontSemibold : ui.fontMedium, ui.textWhite85]]} numberOfLines={1}>{name}</Label>
                      <Label style={[[ui.textXs, chat.unreadCount > 0 ? ui.textWhite70 : ui.textWhite40]]} numberOfLines={1}>
                        {last ? `${last.senderId === store.user.id ? "Sen: " : ""}${last.text}` : "Henüz mesaj yok"}
                      </Label>
                      {!chat.canSend && <Label style={[[ui.text10px, ui.textWhite30, ui.mt1]]}>Artık bağlantın değil · yalnızca okunur</Label>}
                    </Box>
                    <Box style={[[ui.flex, ui.flexCol, ui.itemsEnd, ui.gap1]]}>
                      {last && <Label style={[[ui.text10px, ui.textWhite30]]}>{lastMessageLabel(last.createdAt)}</Label>}
                      {chat.unreadCount > 0 && <Box accessibilityLabel={`${chat.unreadCount} okunmamış mesaj`} style={{ minWidth: 22, height: 22, paddingHorizontal: 6, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: palette.accent }}>
                          <Label style={{ fontFamily: "Outfit-SemiBold", fontSize: 11, lineHeight: 14, color: palette.background }}>{chat.unreadCount > 99 ? "99+" : chat.unreadCount}</Label>
                        </Box>}
                    </Box>
                  </Box>
                </GlassCard>
              </Touch>;
            })}
            <MoreToggle total={chats.length} open={showAllChats} onPress={() => setShowAllChats(open => !open)} />
          </Box>
        </Box>}

        {/* Active rooms */}
        <Box style={[[ui.px5, ui.mb6]]}>
          <Box walkthroughId="rooms-active"><Label style={[[ui.textXs, ui.textWhite30, ui.uppercase, ui.trackingWider, ui.mb3]]}>
            Sohbetler</Label></Box>
          {activeEvents.length > 0 ? <Box style={[[ui.spaceY3]]}>
              {(showAllRooms ? activeEvents : activeEvents.slice(0, PREVIEW_COUNT)).map(event => <Touch key={event.id} onPress={() => navigate("event-room", {
            eventId: event.id
          })} style={[[ui.wFull, ui.textLeft]]}>
                  <GlassCard style={[[ui.p4, ui.borderEmerald40010]]}>
                    <Box style={[[ui.flex, ui.itemsCenter, ui.gap3]]}>
                      <Box style={[[ui.relative]]}>
                        <Picture uri={event.coverImage} accessibilityLabel="" style={[[ui.w12, ui.h12, ui.roundedXl]]} />
                      </Box>
                      <Box style={[[ui.flex1, ui.minW0]]}>
                        <Label style={[[ui.textSm, (event.unreadCount || 0) > 0 ? ui.fontSemibold : ui.fontMedium, ui.textWhite85]]} numberOfLines={1}>
                          {roomTitle(event)}
                        </Label>
                        <Label style={[[ui.textXs, ui.textWhite40]]} numberOfLines={1}>
                          {event.lastMessageAt ? `Son mesaj ${lastMessageLabel(event.lastMessageAt)}` : "Henüz mesaj yok"} · {event.time}
                        </Label>
                        <Label style={[[ui.text10px, ui.textWhite30, ui.mt1]]}>
                          {event.participants.length} katılımcı
                        </Label>
                      </Box>
                      <Box style={[[ui.flex, ui.flexCol, ui.itemsEnd, ui.gap1]]}>
                        {(store.mutedRooms || []).includes(event.id) ? <Label accessibilityLabel="Sessize alındı" style={[[ui.text10px, ui.textWhite40]]}>🔕 Sessiz</Label> : (event.unreadCount || 0) > 0 ? <Box accessibilityLabel={`${event.unreadCount} okunmamış mesaj`} style={{ minWidth: 22, height: 22, paddingHorizontal: 6, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: palette.accent }}>
                            <Label style={{ fontFamily: "Outfit-SemiBold", fontSize: 11, lineHeight: 14, color: palette.background }}>
                              {(event.unreadCount || 0) > 99 ? "99+" : event.unreadCount}
                            </Label>
                          </Box> : <Label style={[[ui.text10px, ui.textEmerald400, ui.fontMedium]]}>
                          Oda açık
                        </Label>}
                        <Label style={[[ui.text10px, ui.textWhite30]]}>
                          Odaya gir →
                        </Label>
                      </Box>
                    </Box>
                  </GlassCard>
                </Touch>)}
              <MoreToggle total={activeEvents.length} open={showAllRooms} onPress={() => setShowAllRooms(open => !open)} />
            </Box> : <GlassCard style={[[ui.p6, ui.textCenter]]}>
              <MessageIcon size={32} style={{ color: palette.muted, marginBottom: 16 }} />
              <Label style={[[ui.textSm, ui.textWhite35]]}>
                Henüz açık bir sohbet odan yok. Etkinliğin minimum katılımcıya ulaşınca oda burada açılır.
              </Label>
              <Touch onPress={() => navigate("discover")} style={[[ui.mt3, ui.textXs, ui.textC8a44a, ui.underline]]}>
                Etkinlikleri keşfet
              </Touch>
            </GlassCard>}
        </Box>

        {/* Forming events */}
        <Box style={[[ui.px5, ui.mb6]]}>
          <Box walkthroughId="rooms-forming"><Label style={[[ui.textXs, ui.textWhite30, ui.uppercase, ui.trackingWider, ui.mb3]]}>
            Katılımcı Bekleyenler</Label></Box>

          <Box style={[[ui.spaceY3]]}>
            {formingEvents.map(event => <Touch key={event.id} onPress={() => navigate("event-detail", {
            eventId: event.id
          })} style={[[ui.wFull, ui.textLeft]]}>
                <GlassCard style={[[ui.p4]]}>
                  <Box style={[[ui.flex, ui.itemsCenter, ui.gap3]]}>
                    <Picture uri={event.coverImage} accessibilityLabel="" style={[[ui.w12, ui.h12, ui.roundedXl, ui.opacity60]]} />
                    <Box style={[[ui.flex1, ui.minW0]]}>
                      <Label style={[[ui.textSm, ui.fontMedium, ui.textWhite70]]} numberOfLines={1}>
                        {roomTitle(event)}
                      </Label>
                      <Label style={[[ui.textXs, ui.textWhite35]]}>
                        {event.time}{event.location ? ` · ${event.location}` : ""}
                      </Label>
                      <Box style={[[ui.mt1, ui.flex, ui.itemsCenter, ui.gap2]]}>
                        <Box style={[[ui.flex1, ui.h1, ui.roundedFull, ui.bgWhite8, ui.overflowHidden]]}>
                          <Box style={[[ui.hFull, ui.roundedFull, ui.bgAmber40060], {
                        width: `${event.currentParticipants / event.minParticipants * 100}%`
                      }]} />
                        </Box>
                        <Label style={[[ui.text10px, ui.textAmber40070]]}>
                          {event.currentParticipants}/{event.minParticipants}
                        </Label>
                      </Box>
                    </Box>
                  </Box>
                </GlassCard>
              </Touch>)}
          </Box>
        </Box>

        {/* Coming soon features */}
        <Box style={[[ui.px5, ui.mb6, ui.spaceY3]]}>
          <Label style={[[ui.textXs, ui.textWhite30, ui.uppercase, ui.trackingWider, ui.mb3]]}>
            Yakında
          </Label>
          <ComingSoonCard accent="violet" icon={<Vector width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(178,174,248,0.9)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <Path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                <Circle cx="12" cy="10" r="3" />
              </Vector>} title="Canlı Konum Paylaşımı" subtitle="Buluşma noktasını gerçek zamanlı görün, geç kalma." />
          <ComingSoonCard accent="gold" icon={<Vector width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(105,120,255,0.9)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <Rect x="3" y="3" width="18" height="18" rx="2" />
                <Circle cx="8.5" cy="8.5" r="1.5" />
                <Polyline points="21 15 16 10 5 21" />
              </Vector>} title="Etkinlik Fotoğraf Galerisi" subtitle="Anlarını toplulukla paylaş, sonradan tekrar yaşa." />
          <ComingSoonCard accent="emerald" icon={<Vector width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(110,231,183,0.9)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <Polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </Vector>} title="Etkinlik Sonrası Puanlama" subtitle="Birlikte geçirdiğin anları değerlendir, güveni birlikte inşa et." />
        </Box>
      </Scroll>

    </Box>;
}

import { useWalkthroughScreenBlocker } from "../walkthrough/activity"
import { palette } from "../theme/palette";
import CityPicker from "../components/CityPicker";
import { CalendarIcon, MessageIcon, StarIcon } from "../components/Icons";
import TopNavBar, { NavAction } from "../components/TopNavBar";
import { Alert, StyleSheet } from "react-native";
import { useEffect, useState } from "react";
import { Circle, Path, Polyline } from "react-native-svg";
import { logout, updateProfile, setProfilePhoto, getMapInterests, setUserInterests, getUserProfile, getApiErrorMessage, getFriendRelationship, getAttendedEvents, getOrganizedEvents, getProfileStats, getCurrentUser, type FriendRelationship } from "../api/client";
import FriendActions from "../components/FriendActions";
import ConnectionsSheet from "../components/ConnectionsSheet";
import EventsSheet from "../components/EventsSheet";
import EventArchive from "../components/EventArchive";
import { onSocket } from "../services/socket";
import { useScreenActive } from "../native/useScreenActive";
import { ComingSoonCard } from "../components/Expressive";
import { AtmoBackground, Avatar, GlassCard, InterestChip, ScoreBadge } from "../components/GlassUI";
import { InstagramIcon } from "../components/Icons";

import { selectPhoto } from "../native/media";
import { formatScore } from "../events/score";
import { EMPTY_USER, mapApiEvent, updateStoreUser, useStore } from "../native/Store";
import { Box, Field, Label, Picture, Scroll, Touch, Vector, openExternal } from "../native/UI";
import { ui } from "../theme/styles";
import { AppEvent, AppUser, NavigateFn } from "../types";
interface Props {
  navigate: NavigateFn;
  isOwn?: boolean;
  userId?: string;
}
function InlineEditField({
  value,
  onSave,
  multiline = false
}: {
  value: string;
  onSave: (v: string) => Promise<void>;
  multiline?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  useWalkthroughScreenBlocker(editing || saving);
  const save = async () => { if (saving) return; setSaving(true); try { await onSave(draft); setEditing(false); } catch {} finally { setSaving(false); } };
  if (editing) {
    return <Box style={[[]]} enter>
        {multiline ? <Field value={draft} onChangeText={e => setDraft(e)} autoFocus style={[[ui.wFull, ui.bgWhite8, ui.border, ui.borderC8a44a40, ui.roundedXl, ui.px3, ui.py25, ui.textSm, ui.textWhite80]]} multiline /> : <Field value={draft} onChangeText={e => setDraft(e)} autoFocus style={[[ui.wFull, ui.bgWhite8, ui.border, ui.borderC8a44a40, ui.roundedXl, ui.px3, ui.py25, ui.textSm, ui.textWhite80]]} />}
        <Box style={[[ui.flex, ui.gap2, ui.mt15]]}>
          <Touch onPress={save} style={[[ui.textXs, ui.px3, ui.py1, ui.roundedLg, ui.text1a1200, ui.fontMedium], {
          backgroundColor: "#4d5bcb"
        }]}>
            Kaydet
          </Touch>
          <Touch onPress={() => {
          setDraft(value);
          setEditing(false);
        }} style={[[ui.textXs, ui.px3, ui.py1, ui.roundedLg, ui.textWhite40, ui.border, ui.borderWhite10]]}>
            İptal
          </Touch>
        </Box>
      </Box>;
  }
  // Touch centres its content by default; keep the value left-aligned with the line below it.
  return <Touch onPress={() => setEditing(true)} accessibilityLabel="Düzenle" style={[[ui.relative, ui.flex, ui.itemsCenter], { justifyContent: "flex-start", alignSelf: "flex-start", minHeight: 0 }]}>
      <Label style={[[]]} numberOfLines={1}>{value}</Label>
    </Touch>;
}
function InstagramField({ handle, onSave }: { handle: string; onSave: (handle: string) => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(handle);
  const [saving, setSaving] = useState(false);
  useWalkthroughScreenBlocker(editing || saving);
  const save = async () => {
    if (saving) return;
    setSaving(true);
    try { await onSave(draft.replace(/^@/, "").trim()); setEditing(false); } catch { /* update() already alerted */ } finally { setSaving(false); }
  };
  if (editing) return <Box style={[[ui.mt3, ui.flex, ui.itemsCenter, ui.gap2]]}>
      <Label style={profileInstagramStyles.handle}>@</Label>
      <Field value={draft} onChangeText={value => setDraft(value.replace(/^@/, "").replace(/\s/g, "").toLowerCase())} autoFocus autoCapitalize="none" autoCorrect={false} placeholder="kullanici_adi" accessibilityLabel="Instagram kullanıcı adı" style={[[ui.flex1, ui.bgWhite8, ui.border, ui.borderC8a44a40, ui.roundedXl, ui.px3, ui.py25, ui.textSm, ui.textWhite80]]} />
      <Touch onPress={save} disabled={saving} style={[[ui.textXs, ui.px3, ui.py1, ui.roundedLg, ui.text1a1200, ui.fontMedium], { backgroundColor: "#4d5bcb" }]}>Kaydet</Touch>
      <Touch onPress={() => { setDraft(handle); setEditing(false); }} style={[[ui.textXs, ui.px3, ui.py1, ui.roundedLg, ui.textWhite40, ui.border, ui.borderWhite10]]}>İptal</Touch>
    </Box>;
  // A saved handle can no longer be edited here; tapping it opens Instagram.
  if (handle) return <Touch accessibilityRole="link" accessibilityLabel={`Instagram profilini aç: @${handle}`} onPress={() => openExternal(`https://instagram.com/${handle}`)} style={profileInstagramStyles.link}>
      <InstagramIcon size={19} strokeWidth={1.8} style={profileInstagramStyles.icon} />
      <Label style={profileInstagramStyles.handle}>{`@${handle}`}</Label>
      <Label style={profileInstagramStyles.private}>Özel</Label>
    </Touch>;
  return <Touch accessibilityLabel="Instagram kullanıcı adı ekle" onPress={() => { setDraft(""); setEditing(true); }} style={profileInstagramStyles.link}>
      <InstagramIcon size={19} strokeWidth={1.8} style={profileInstagramStyles.icon} />
      <Label style={profileInstagramStyles.empty}>@ kullanıcı adını ekle</Label>
    </Touch>;
}
const ABOUT_LIMIT = 280;
// Counted and cut by characters (code points) so an emoji is never split in half at the limit.
const limitAbout = (text: string) => Array.from(text).slice(0, ABOUT_LIMIT).join("");
const QUICK_EMOJIS = ["😄", "😎", "🤩", "🎾", "🏃", "🚴", "⛰️", "☕", "🍕", "🎶", "🎨", "📸", "🐶", "✈️", "❤️", "✨"];
/** "About me" (stored as bio): a few fun facts other members read before meeting you. */
function AboutMe({ bio, isOwn, name, onSave }: { bio: string; isOwn: boolean; name: string; onSave: (bio: string) => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(bio);
  const [saving, setSaving] = useState(false);
  useWalkthroughScreenBlocker(editing || saving);
  const save = async () => {
    if (saving) return;
    setSaving(true);
    try { await onSave(draft.trim()); setEditing(false); } catch { /* update() already alerted */ } finally { setSaving(false); }
  };
  return <Box style={[[ui.px5, ui.mb4]]}>
      <GlassCard style={[[ui.p4]]}>
        <Label style={[[ui.textXs, ui.textWhite35, ui.uppercase, ui.trackingWider]]}>
          Benimle Tanışmadan Önce Bil ✦
        </Label>
        {editing ? <Box style={[[ui.mt3]]}>
            <Field value={draft} onChangeText={value => setDraft(limitAbout(value))} multiline autoFocus accessibilityLabel="Hakkımda" placeholder="Örn. Pazar kahvaltısı uzmanıyım, padelde backhand'im efsane, kedim Pamuk'un tek fan kulübüyüm." style={[[ui.wFull, ui.bgWhite8, ui.border, ui.borderC8a44a40, ui.roundedXl, ui.px3, ui.py25, ui.textSm, ui.textWhite80]]} />
            {/* Quick emoji row: keyboards often hide the emoji key, so one tap adds one here. */}
            <Scroll horizontal style={[[ui.mt2]]} keyboardShouldPersistTaps="always">
              <Box style={[[ui.flex, ui.gap1]]}>
                {QUICK_EMOJIS.map(emoji => <Touch key={emoji} accessibilityLabel={`${emoji} ekle`} onPress={() => setDraft(current => limitAbout(current + emoji))} style={{ width: 40, height: 40, minHeight: 40, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.05)" }}>
                    <Label style={{ fontSize: 20 }}>{emoji}</Label>
                  </Touch>)}
              </Box>
            </Scroll>
            <Box style={[[ui.flex, ui.itemsCenter, ui.justifyBetween, ui.mt15]]}>
              <Box style={[[ui.flex, ui.gap2]]}>
                <Touch onPress={save} disabled={saving} style={[[ui.textXs, ui.px3, ui.py1, ui.roundedLg, ui.text1a1200, ui.fontMedium], { backgroundColor: "#4d5bcb" }]}>Kaydet</Touch>
                <Touch onPress={() => { setDraft(bio); setEditing(false); }} style={[[ui.textXs, ui.px3, ui.py1, ui.roundedLg, ui.textWhite40, ui.border, ui.borderWhite10]]}>İptal</Touch>
              </Box>
              <Label style={[[ui.textXs, ui.textWhite35]]}>{Array.from(draft).length}/{ABOUT_LIMIT}</Label>
            </Box>
          </Box> : bio.trim() ? isOwn
            // Only the owner can edit: tapping the text itself opens the editor.
            ? <Touch accessibilityLabel="Hakkımda yazısını düzenle" onPress={() => { setDraft(bio); setEditing(true); }} style={[[ui.mt2], { alignItems: "flex-start", justifyContent: "flex-start", minHeight: 0 }]}>
                <Label style={[[ui.textSm, ui.textWhite75, ui.leadingRelaxed]]}>{bio}</Label>
              </Touch>
            : <Label style={[[ui.textSm, ui.textWhite75, ui.leadingRelaxed, ui.mt2]]}>{bio}</Label>
          // Other members always see the section; an empty one says so instead of disappearing.
          : !isOwn ? <Label style={[[ui.textSm, ui.textWhite40, ui.leadingRelaxed, ui.mt2]]}>{`${name.split(" ")[0] || "Bu üye"} henüz kendinden bahsetmemiş.`}</Label>
          : <Touch accessibilityLabel="Hakkımda yazısı ekle" onPress={() => { setDraft(""); setEditing(true); }} style={[[ui.mt3, ui.p4, ui.roundedXl, ui.border, ui.borderDashed, ui.borderWhite15], { alignItems: "flex-start" }]}>
            <Label style={[[ui.textSm, ui.textWhite75, ui.fontMedium]]}>Kendini birkaç eğlenceli cümleyle anlat</Label>
            <Label style={[[ui.textXs, ui.textWhite40, ui.mt1, ui.leadingRelaxed]]}>Etkinlikte seninle tanışacak kişiler önce bunu okur. İlk izlenimi sen belirle.</Label>
          </Touch>}
      </GlassCard>
    </Box>;
}
const referenceRow = { flexDirection: "row" as const, alignItems: "center" as const, gap: 10, minHeight: 48, paddingVertical: 6 };
const referenceInitial = { width: 32, height: 32, borderRadius: 16, alignItems: "center" as const, justifyContent: "center" as const, backgroundColor: "rgba(146,125,255,0.14)" };
export default function ProfileScreen({
  navigate,
  isOwn: ownProfile = true,
  userId
}: Props) {
  const {
    data: store,
    resetSession,
    setData: setStore,
    loadReferences
  } = useStore();
  const EVENTS = store.events;
  const isOwn = ownProfile && (!userId || userId === store.user.id);
  const [otherUser, setOtherUser] = useState<AppUser | null>(null);
  const [profileError, setProfileError] = useState("");
  // Shown again (e.g. back from rating this member) → reload, so new scores appear without restarting the app.
  const screenActive = useScreenActive();
  useEffect(() => { setOtherUser(null); setProfileError(""); }, [userId]);
  useEffect(() => {
    if (isOwn || !userId || !screenActive) return;
    let active = true;
    getUserProfile(userId).then(remote => {
      if (active) setOtherUser({ ...updateStoreUser(EMPTY_USER, remote), interests: remote.interests.map(item => item.name) });
    }).catch(error => { if (active) setProfileError(getApiErrorMessage(error, "Profil yüklenemedi.")); });
    return () => { active = false; };
  }, [userId, isOwn, screenActive]);
  // Your own scores: reloaded each time your profile is shown (live updates also arrive via the store).
  useEffect(() => {
    if (!isOwn || !store.user.id || !screenActive) return;
    let active = true;
    getCurrentUser().then(remote => { if (active) setStore(p => p.user.id === remote.id ? { ...p, user: updateStoreUser(p.user, remote) } : p); }).catch(() => {});
    return () => { active = false; };
  }, [isOwn, store.user.id, screenActive]);
  const user = isOwn ? store.user : otherUser || EMPTY_USER;
  // Friendship: the profile owner's friend count ("Bağlantı") and, on someone else's profile, our status.
  // "friend:changed" arrives when either side sends, accepts, declines or withdraws, so it stays current.
  const relationTarget = isOwn ? store.user.id : userId;
  const [relation, setRelation] = useState<FriendRelationship | null>(null);
  useEffect(() => {
    if (!relationTarget) return;
    let active = true;
    const load = () => { void getFriendRelationship(relationTarget).then(next => { if (active) setRelation(next); }).catch(() => {}); };
    setRelation(null); load();
    const stop = onSocket("friend:changed", (payload: { userId: string }) => { if (isOwn || payload.userId === relationTarget) load(); });
    return () => { active = false; stop(); };
  }, [relationTarget, isOwn]);
  // "Katıldığı": ended events you joined. The count loads with the profile (one row); the list on tap.
  const [attendedCount, setAttendedCount] = useState<number | null>(null);
  const [organizedCount, setOrganizedCount] = useState<number | null>(null);
  // One sheet lists either the attended or the organized events (the two tappable counters).
  const [eventList, setEventList] = useState<{ kind: "attended" | "organized"; events: AppEvent[] | null; error: string } | null>(null);
  // "Düzenlediği" = own events that started or ended; "Katıldığı" = joined ones that started or ended + those organized ones.
  // They reload when one of your events starts or ends (server push), after a reconnect and whenever the page is shown again.
  useEffect(() => {
    if (!isOwn || !store.user.id || !screenActive) return;
    let active = true;
    const load = () => { getProfileStats().then(stats => { if (active) { setAttendedCount(stats.attended); setOrganizedCount(stats.organized); } }).catch(() => {}); };
    load();
    const changed = onSocket("profile:stats_changed", load);
    const sync = onSocket("sync:required", load);
    return () => { active = false; changed(); sync(); };
  }, [isOwn, store.user.id, screenActive]);
  const openEventList = (kind: "attended" | "organized") => {
    setEventList({ kind, events: null, error: "" });
    (kind === "attended" ? getAttendedEvents() : getOrganizedEvents()).then(result => {
      const found = result.items.map(mapApiEvent);
      // The detail page opens events from the shared list, so these join it (not the Discover feed).
      setStore(p => ({ ...p, events: [...new Map([...p.events, ...found].map(event => [event.id, event])).values()] }));
      setEventList(current => current?.kind === kind ? { ...current, events: found } : current);
      if (kind === "attended") setAttendedCount(result.total); else setOrganizedCount(result.total);
    }).catch(error => setEventList(current => current?.kind === kind ? { ...current, events: [], error: getApiErrorMessage(error, "Etkinlikler yüklenemedi.") } : current));
  };
  // Connections list: always on your own profile; on someone else's only when you are friends.
  const [connectionsOpen, setConnectionsOpen] = useState(false);
  const canSeeConnections = isOwn || relation?.status === "friends";
  const interests = new Set(user.interests);
  const [interestCatalog, setInterestCatalog] = useState<Array<{ id: string; name: string }> | null>(null);
  const [loadingInterests, setLoadingInterests] = useState(false);
  const openInterests = async () => {
    if (loadingInterests) return;
    setLoadingInterests(true);
    try { setInterestCatalog(await getMapInterests()); }
    catch (error) { Alert.alert('İlgi alanları yüklenemedi', getApiErrorMessage(error)); }
    finally { setLoadingInterests(false); }
  };
  const [showReferences, setShowReferences] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const signOut = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await logout();
      resetSession();
      navigate("welcome", { reset: true });
    } catch { Alert.alert("Çıkış yapılamadı", "Lütfen tekrar dene."); }
    finally { setLoggingOut(false); }
  };
  // References come from the store: fetched on the first visit, then kept current by socket events.
  const references = (store.references || []).filter(item => item.status === 'approved');
  useEffect(() => { if (isOwn) void loadReferences().catch(() => {}); }, [isOwn]);
  const update = async (key: string, value: string) => {
    try {
      if (key === 'avatar') await setProfilePhoto(value);
      else if (key === 'name') {
        const parts = value.trim().split(/\s+/); const lastName = parts.pop() || '';
        await updateProfile({ firstName: parts.join(' '), lastName });
      } else await updateProfile({ [key === 'instagram' ? 'instagramUsername' : key]: key === 'instagram' ? value.replace(/^@/, '') : value });
      setStore(p => ({ ...p, user: { ...p.user, [key]: value } }));
    } catch (error) { Alert.alert('Profil kaydedilemedi', getApiErrorMessage(error)); throw error; }
  };
  // Interest taps only change a local draft; "Kaydet" sends the whole list once (the server adds and removes).
  const [interestDraft, setInterestDraft] = useState<Set<string> | null>(null);
  const [savingInterests, setSavingInterests] = useState(false);
  const shownInterests = interestDraft ?? interests;
  const interestsChanged = !!interestDraft && (interestDraft.size !== interests.size || [...interestDraft].some(name => !interests.has(name)));
  const toggleInterest = (interest: string) => setInterestDraft(previous => {
    const next = new Set(previous ?? interests);
    if (next.has(interest)) next.delete(interest); else next.add(interest);
    return next;
  });
  const cancelInterests = () => { setInterestDraft(null); setInterestCatalog(null); };
  const saveInterests = async () => {
    if (!interestDraft || savingInterests) return;
    setSavingInterests(true);
    try {
      const catalog = interestCatalog || await getMapInterests();
      const saved = await setUserInterests(catalog.filter(item => interestDraft.has(item.name)).map(item => item.id));
      setStore(p => ({ ...p, user: { ...p.user, interests: saved.map(item => item.name) } }));
      cancelInterests();
    } catch (error) { Alert.alert('İlgi alanları kaydedilemedi', getApiErrorMessage(error)); }
    finally { setSavingInterests(false); }
  };
  const myEvents = EVENTS.filter(e => e.host.id === user.id || e.participants.some(p => p.id === user.id));
  if (!isOwn && !otherUser) return <Box style={[[ui.flex1, ui.bg06060e]]}>
    <TopNavBar navigate={navigate} fallback="discover" title="Profil" />
    <Box style={{ padding: 24, paddingTop: 100 }}><Label>{profileError || "Profil yükleniyor…"}</Label></Box>
  </Box>;
  return <Box style={[[ui.fixed, ui.inset0, ui.bg06060e, ui.overflowHidden]]}>
      <AtmoBackground variant="violet" />
      <TopNavBar
        navigate={navigate}
        fallback="discover"
        onBack={() => navigate("discover", { back: true })}
        backLabel="Geri"
        // Your own profile is a bottom-bar tab; only someone else's profile needs a way back.
        hideBack={isOwn}
        title="Profil"
        right={isOwn ? <>
          {/* Only admins see the panel link; the server checks the role again on every admin request. */}
          {store.user.role === "admin" && <NavAction label="Admin panelini aç" tone="accent" onPress={() => navigate("admin")}>Admin</NavAction>}
          <NavAction label="Ayarları aç" onPress={() => navigate("settings")}>Ayarlar</NavAction>
          <NavAction label="Çıkış yap" tone="accent" disabled={loggingOut} onPress={() => void signOut()}>{loggingOut ? "Bekle" : "Çıkış"}</NavAction>
        </> : undefined}
      />

      {eventList ? <EventsSheet title={eventList.kind === "attended" ? "Katıldığım etkinlikler" : "Düzenlediğim etkinlikler"} events={eventList.events} error={eventList.error}
        emptyText={eventList.kind === "attended" ? "Henüz katıldığın ya da düzenleyip başlattığın bir etkinlik yok." : "Henüz düzenleyip başlattığın bir etkinlik yok."}
        onClose={() => setEventList(null)} onOpen={eventId => navigate("event-detail", { eventId })} /> : null}
      {connectionsOpen && canSeeConnections && relationTarget ? <ConnectionsSheet userId={relationTarget} title={isOwn ? "Bağlantılarım" : `${user.name.split(" ")[0]} · Bağlantılar`} canRemove={isOwn}
        onClose={() => setConnectionsOpen(false)} onOpenProfile={id => navigate("profile", id === store.user.id ? {} : { userId: id })}
        onRemoved={() => setRelation(current => current ? { ...current, friendCount: Math.max(0, current.friendCount - 1) } : current)} /> : null}

      <Scroll style={[[ui.relative, ui.hFull, ui.pb28], { paddingTop: 80 }]}>
        {/* Header */}
        <Box walkthroughId="profile-header" style={[[ui.pt4, ui.px5, ui.pb5]]}>
          {/* Profile header */}
          <Box style={[[ui.flex, ui.itemsCenter, ui.gap4]]}>
            <Touch style={[[ui.relative]]} onPress={async () => {
            if (isOwn) {
              const uri = await selectPhoto();
              if (uri) void update("avatar", uri).catch(() => {});
            }
          }}>
              <Picture uri={user.avatar} accessibilityLabel={user.name} style={[[ui.w20, ui.h20, ui.rounded2xl]]} />
            </Touch>

            <Box style={[[ui.flex1, ui.minW0]]}>
              {isOwn ? <Box style={[[ui.textXl, ui.fontDisplay, ui.fontLight, ui.textWhite]]}>
                  <InlineEditField value={user.name} onSave={v => update("name", v)} />
                </Box> : <Label style={[[ui.textXl, ui.fontDisplay, ui.fontLight, ui.textWhite]]}>
                  {user.name}
                </Label>}

              {isOwn ? <Box style={[[ui.mt05]]}>
                  <CityPicker compact value={user.city} onChange={city => { void update("city", city).catch(() => {}); }} />
                </Box> : <Label style={[[ui.textSm, ui.textWhite45, ui.mt05]]}>
                  {user.city}
                </Label>}

            </Box>
          </Box>

          {/* Instagram: own profile can add a missing handle; a saved handle only opens Instagram */}
          {isOwn ? <InstagramField handle={user.instagram.replace(/^@/, "")} onSave={handle => update("instagram", handle)} /> : user.instagram ? <Touch
            accessibilityRole="link"
            accessibilityLabel={`Instagram profilini aç: @${user.instagram.replace(/^@/, "")}`}
            onPress={() => openExternal(`https://instagram.com/${user.instagram.replace(/^@/, "")}`)}
            style={profileInstagramStyles.link}
          >
            <InstagramIcon size={19} strokeWidth={1.8} style={profileInstagramStyles.icon} />
            <Label style={profileInstagramStyles.handle}>@{user.instagram.replace(/^@/, "")}</Label>
            <Label style={profileInstagramStyles.external}>↗</Label>
          </Touch> : null}

          {!isOwn && userId && relation ? <Box walkthroughId="profile-relation" style={{ marginTop: 16, gap: 10 }}>
            {relation.status === "friends" ? <Touch accessibilityLabel={`${user.name} bağlantılarını göster`} onPress={() => setConnectionsOpen(true)} style={{ alignSelf: "flex-start", minHeight: 32, justifyContent: "center" }}>
                <Label style={[[ui.textXs], { color: palette.accent }]}>{relation.friendCount} bağlantı ›</Label>
              </Touch> : <Label style={[[ui.textXs, ui.textWhite40]]}>{relation.friendCount} bağlantı</Label>}
            <FriendActions userId={userId} name={user.name} relation={relation} onChange={setRelation} />
            {/* Connections can chat without an event room. */}
            {relation.status === "friends" ? <Touch accessibilityLabel={`${user.name} ile mesajlaş`} onPress={() => navigate("direct-chat", { userId })} style={profileMessageStyles.button} gradient={["#4d5bcb", "#6651c9"]}>
                <MessageIcon size={16} style={{ color: palette.text }} />
                <Label style={profileMessageStyles.label}>Mesaj gönder</Label>
              </Touch> : null}
          </Box> : null}
        </Box>

        {/* Stats */}
        {isOwn && <Box walkthroughId="profile-connections" style={[[ui.px5, ui.mb4]]}>
          <Box style={[[ui.grid, ui.gap3]]} columns={3}>
            {[{
            value: attendedCount ?? user.stats.attended,
            label: "Katıldığı"
          }, {
            value: relation?.friendCount ?? user.stats.connections,
            label: "Bağlantı"
          }, {
            value: organizedCount ?? user.stats.organized,
            label: "Düzenlediği"
          }].map((s, i) => {
              const card = <GlassCard key={i} style={[[ui.p4, ui.textCenter]]}>
                <Label style={[[ui.fontDisplay, ui.text2xl, ui.fontLight, ui.textWhite]]}>
                  {s.value}
                </Label>
                <Label style={[[ui.textXs, ui.textWhite35, ui.mt05]]}>
                  {s.label}
                </Label>
              </GlassCard>;
              // Every counter opens its list: friends, attended events, organized events.
              return s.label === "Bağlantı" ? <Touch key={i} accessibilityLabel="Bağlantılarımı göster" onPress={() => setConnectionsOpen(true)}>{card}</Touch>
                : s.label === "Katıldığı" ? <Touch key={i} accessibilityLabel="Katıldığım etkinlikleri göster" onPress={() => openEventList("attended")}>{card}</Touch>
                : <Touch key={i} accessibilityLabel="Düzenlediğim etkinlikleri göster" onPress={() => openEventList("organized")}>{card}</Touch>;
            })}
          </Box>
        </Box>}

        {/* Event Score */}
        <Box walkthroughId="profile-score" style={[[ui.px5, ui.mb4]]}>
          <GlassCard style={[[ui.p5]]}>
            <Box style={[[ui.flex, ui.itemsCenter, ui.justifyBetween, ui.mb4]]}>
              <Box>
                <Label style={[[ui.textXs, ui.textWhite35, ui.uppercase, ui.trackingWider]]}>
                  Event Skoru
                </Label>
                <Label style={[[ui.fontDisplay, ui.text4xl, ui.fontLight, ui.mt1], {
                color: palette.accent
              }]}>
                  {formatScore(user.score)}
                </Label>
              </Box>
              <Box style={[[ui.flex, ui.gap1]]}>
                {[1, 2, 3, 4, 5].map(i => <StarIcon key={i} size={19} filled={i <= Math.round(user.score)} style={{ color: palette.accent, opacity: i <= Math.round(user.score) ? 1 : .25 }} />)}
              </Box>
            </Box>
            {/* Per-question averages are shown on every profile (the server sends them for any member). */}
            <Box style={[[ui.spaceY0]]}>
              <ScoreBadge score={user.scores.punctuality} label="Dakiklik & Güvenilirlik" />
              <ScoreBadge score={user.scores.communication} label="İletişim & Nezaket" />
              <ScoreBadge score={user.scores.community} label="Topluluk Uyumu" />
            </Box>
            {/* Addressed to "you": only on your own profile. */}
            {isOwn && <Label style={[[ui.textXs, ui.textWhite25, ui.mt3, ui.leadingRelaxed]]}>
              Birlikte etkinliğe gittiğin kişilerin sana verdiği puanlardan
              oluşur.
            </Label>}
          </GlassCard>
        </Box>

        {/* About me (bio) */}
        <AboutMe bio={user.bio || ""} isOwn={isOwn} name={user.name} onSave={bio => update("bio", bio)} />

        {/* Interests */}
        <Box style={[[ui.px5, ui.mb4]]}>
          <GlassCard style={[[ui.p4]]}>
            <Label style={[[ui.textXs, ui.textWhite35, ui.uppercase, ui.trackingWider, ui.mb3]]}>
              İlgi Alanları
            </Label>
            <Box style={[[ui.flex, ui.flexWrap, ui.gap2]]}>
              {(isOwn && interestCatalog ? interestCatalog.map(item => item.name) : Array.from(interests)).map(interest => <InterestChip key={interest} label={interest} selected={shownInterests.has(interest)} onPress={() => isOwn && toggleInterest(interest)} />)}
              {isOwn && !interestCatalog && <Touch accessibilityLabel="İlgi alanı ekle" disabled={loadingInterests} onPress={() => void openInterests()} style={[[ui.px3, ui.py2, ui.roundedXl, ui.textXs, ui.border, ui.borderDashed, ui.borderWhite15, ui.textWhite30]]}>
                  {loadingInterests ? "Yükleniyor…" : "+ Ekle"}
                </Touch>}
            </Box>
            {isOwn && interestsChanged && <Box style={[[ui.mt3]]}>
                {!interestDraft?.size && <Label style={[[ui.textXs, ui.mb2], { color: palette.error }]}>En az bir ilgi alanı seç.</Label>}
                <Box style={[[ui.flex, ui.gap2]]}>
                  <Touch accessibilityLabel="İlgi alanlarını kaydet" onPress={() => void saveInterests()} disabled={savingInterests || !interestDraft?.size} style={[[ui.textXs, ui.px4, ui.py2, ui.roundedLg, ui.fontMedium], { backgroundColor: "#4d5bcb", color: palette.text }]}>{savingInterests ? "Kaydediliyor…" : "Kaydet"}</Touch>
                  <Touch accessibilityLabel="İlgi alanı değişikliklerini geri al" onPress={cancelInterests} disabled={savingInterests} style={[[ui.textXs, ui.px4, ui.py2, ui.roundedLg, ui.textWhite40, ui.border, ui.borderWhite10]]}>Vazgeç</Touch>
                </Box>
              </Box>}
          </GlassCard>
        </Box>

        {/* Availability calendar (own only) */}
        {isOwn && <Box style={[[ui.px5, ui.mb4]]}>
            <GlassCard onPress={() => navigate("availability")} accessibilityLabel="Etkinlik Takvimim" style={[[ui.wFull, ui.flex, ui.itemsCenter, ui.justifyBetween, ui.p4]]}>
              <Box style={[[ui.flex, ui.itemsCenter, ui.gap3, ui.flex1, ui.minW0]]}>
                <Box style={[[ui.w9, ui.h9, ui.roundedXl, ui.flex, ui.itemsCenter, ui.justifyCenter], {
              backgroundColor: "rgba(105,120,255,0.12)",
              borderWidth: 1,
              borderColor: "rgba(105,120,255,0.24)"
            }]}>
                  <CalendarIcon size={18} style={{ color: palette.accent }} />
                </Box>
                <Box style={[[ui.textLeft, ui.flex1, ui.minW0]]}>
                  <Label style={[[ui.textSm, ui.fontMedium, ui.textWhite80]]}>
                    Etkinlik Takvimim
                  </Label>
                  <Label style={[[ui.textXs, ui.textWhite35]]}>
                    Müsait olduğun zamanlar · uygun etkinliklere davet al
                  </Label>
                </Box>
              </Box>
              <Label style={[[ui.textWhite30, ui.textSm]]}>›</Label>
            </GlassCard>
          </Box>}

        {/* References (own only) */}
        {isOwn && <Box style={[[ui.px5, ui.mb4]]}>
            <GlassCard style={[[ui.overflowHidden]]}>
              <Touch onPress={() => setShowReferences(!showReferences)} style={[[ui.wFull, ui.flex, ui.itemsCenter, ui.justifyBetween, ui.p4]]}>
                <Box style={[[ui.flex, ui.itemsCenter, ui.gap3]]}>
                  <Box style={[[ui.w9, ui.h9, ui.roundedXl, ui.flex, ui.itemsCenter, ui.justifyCenter, ui.textSm], {
                backgroundColor: "rgba(146,125,255,0.12)",
                borderWidth: 1,
                borderColor: "rgba(146,125,255,0.2)"
              }]}>
                    🤝
                  </Box>
                  <Box style={[[ui.textLeft]]}>
                    <Label style={[[ui.textSm, ui.fontMedium, ui.textWhite80]]}>
                      Referanslarım
                    </Label>
                  </Box>
                </Box>
                <Label style={[[ui.textWhite30, ui.textSm, showReferences ? [ui.rotate180] : []]]}>
                  ▾
                </Label>
              </Touch>

              {showReferences && <Box style={{ padding: 16 }}>
                {!references.length && <Label style={[[ui.textSm, ui.textWhite40]]}>Henüz onaylanmış referans yok.</Label>}
                {/* "incoming" = they asked me and I approved; the other person is always shown, never me. */}
                {[{ title: "Onay verdiklerim", rows: references.filter(ref => ref.direction === 'incoming').map(ref => ({ id: ref.id, person: ref.requester })) },
                  { title: "Bana referans olanlar", rows: references.filter(ref => ref.direction !== 'incoming').map(ref => ({ id: ref.id, person: ref.recipient })) }]
                  .filter(group => group.rows.length).map(group => <Box key={group.title} style={{ marginBottom: 12 }}>
                    <Label style={[[ui.textXs, ui.textWhite35, ui.uppercase, ui.trackingWider], { marginBottom: 6 }]}>{group.title} · {group.rows.length}</Label>
                    {group.rows.map(({ id, person }) => <Touch key={id} accessibilityLabel={`${person.name} profilini aç`} onPress={() => navigate("profile", { userId: person.id })} style={referenceRow}>
                      <Box style={referenceInitial}><Label style={[[ui.textSm, ui.fontMedium], { color: palette.accent }]}>{person.name.trim().charAt(0).toLocaleUpperCase("tr")}</Label></Box>
                      <Label style={[[ui.textSm, ui.textWhite80], { flex: 1, minWidth: 0 }]} numberOfLines={1}>{person.name}</Label>
                      <Label style={[[ui.textWhite30], { fontSize: 20, lineHeight: 22 }]}>›</Label>
                    </Touch>)}
                  </Box>)}
              </Box>}
            </GlassCard>
          </Box>}

        {/* Archive: every event you created with its status; only on your own profile. */}
        {isOwn && <Box style={[[ui.px5, ui.mb4]]}><EventArchive navigate={navigate} /></Box>}

        {/* Recent events */}
        <Box style={[[ui.px5, ui.mb4]]}>
          <GlassCard style={[[ui.p4]]}>
            <Label style={[[ui.textXs, ui.textWhite35, ui.uppercase, ui.trackingWider, ui.mb3]]}>
              Son Etkinlikler
            </Label>
            <Box style={[[ui.spaceY3]]}>
              {myEvents.slice(0, 3).map(event => <Touch key={event.id} onPress={() => navigate("event-detail", {
              eventId: event.id
            })} style={[[ui.wFull, ui.flex, ui.itemsCenter, ui.gap3, ui.textLeft]]}>
                  <Box style={[[ui.w10, ui.h10, ui.roundedXl, ui.overflowHidden, ui.flexShrink0], {
                backgroundColor: "rgba(255,255,255,0.05)"
              }]}>
                    <Picture uri={event.coverImage} accessibilityLabel="" style={[[ui.wFull, ui.hFull, ui.opacity70]]} />
                  </Box>
                  <Box style={[[ui.flex1, ui.minW0]]}>
                    <Label style={[[ui.textSm, ui.textWhite75, ui.fontMedium]]} numberOfLines={1}>
                      {event.title}
                    </Label>
                    <Label style={[[ui.textXs, ui.textWhite35]]}>
                      {event.date} ·{" "}
                      {event.host.id === store.user.id ? "Organizatör" : "Katılımcı"}
                    </Label>
                  </Box>
                  <Box style={[[ui.flex]]}>
                    {event.participants.slice(0, 3).map(p => <Picture key={p.id} uri={p.avatar} accessibilityLabel="" style={[[ui.w5, ui.h5, ui.roundedFull]]} />)}
                  </Box>
                </Touch>)}
            </Box>
          </GlassCard>
        </Box>
        {isOwn && <Box style={[[ui.px5, ui.mb4, ui.spaceY3]]}>
            <Label style={[[ui.textXs, ui.textWhite25, ui.uppercase, ui.trackingWider]]}>
              Sizinle Olacak
            </Label>
            <ComingSoonCard accent="gold" icon={<Vector width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(105,120,255,0.9)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <Circle cx="12" cy="8" r="7" />
                  <Polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88" />
                </Vector>} title="Rozetler ve Başarılar" subtitle="Etkinlik geçmişine göre özel rozetler kazan, topluluğa ilhamını yansıt." />
            <ComingSoonCard accent="violet" icon={<Vector width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(178,174,248,0.9)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <Path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <Circle cx="9" cy="7" r="4" />
                  <Path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <Path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </Vector>} title="Bağlantı Ağı" subtitle="Birlikte etkinliğe gittiğin kişileri keşfet, ortak çevreni gör." />
          </Box>}
      </Scroll>

      {/* Coming soon for profile */}

    </Box>;
}
;

const profileInstagramStyles = StyleSheet.create({
  link: {
    alignSelf: "flex-start",
    minHeight: 44,
    marginTop: 14,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 14,
    backgroundColor: "rgba(105,120,255,.09)",
    borderWidth: 1,
    borderColor: "rgba(105,120,255,.22)",
  },
  icon: { color: "#b9c3ff" },
  handle: {
    color: "#f2d889",
    fontFamily: "Outfit-SemiBold",
    fontSize: 14,
    lineHeight: 19,
    textDecorationLine: "underline",
  },
  external: { color: "rgba(183,197,255,.72)", fontSize: 14 },
  empty: { color: "rgba(226,232,240,.55)", fontFamily: "Outfit-Medium", fontSize: 14, lineHeight: 19 },
  private: {
    marginLeft: 2,
    color: "rgba(226,232,240,.48)",
    fontFamily: "Outfit-Medium",
    fontSize: 10,
    lineHeight: 14,
    textTransform: "uppercase",
    letterSpacing: .7,
  },
});
const profileMessageStyles = StyleSheet.create({
  button: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, minHeight: 44, borderRadius: 14 },
  label: { color: palette.text, fontFamily: "Outfit-SemiBold", fontSize: 14 },
});

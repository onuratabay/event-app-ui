import { useCallback, useEffect, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import { BellIcon, CheckIcon, MessageIcon, StarIcon, UsersIcon } from "../components/Icons";
import { useBottomNavInset } from "../components/BottomNav";
import { palette } from "../theme/palette";
import { ReferenceNotifications } from "../components/ReferenceNotifications";
import { EventInvitations } from "../components/EventInvitations";
import { AtmoBackground } from "../components/GlassUI";
import TopNavBar, { NavAction } from "../components/TopNavBar";
import { ErrorNotice } from "../components/ErrorNotice";
import { Alert } from "react-native";
import { getNotifications, readAllNotifications, readNotification, getEvent, getApiErrorMessage, hasSession, deleteAllNotifications, getIncomingFriendRequests, getReferenceRequests, getInvitations, declineFriendRequest, respondToReference, participate, type AppNotification } from "../api/client";
import { mapApiEvent, useStore } from "../native/Store";
import { onSocket } from "../services/socket";
import { Box, Label, Scroll, Touch } from "../native/UI";
import { ui } from "../theme/styles";
import type { NavigateFn } from "../types";

// Room and one-to-one chat messages arrive as device pushes only; the list never shows them (the server leaves them out too).
const CHAT_TYPES = new Set(["message", "direct_message"]);
export default function NotificationsScreen({ navigate }: { navigate: NavigateFn }) {
  const navInset = useBottomNavInset();
  const { data, setData } = useStore();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const generation = useRef(0);
  const pending = useRef(false);
  const refreshVersion = useRef(0);
  const refresh = useCallback(async () => {
    const current = generation.current;
    const version = ++refreshVersion.current;
    try {
      if (!await hasSession()) { if (current === generation.current) setLoading(false); return; }
      const result = await getNotifications();
      if (current !== generation.current || version !== refreshVersion.current) return;
      setNotifications(result.items.filter(row => !CHAT_TYPES.has(row.type))); setUnreadCount(result.unreadCount); setNextCursor(result.nextCursor); setError(null);
    } catch (cause) { if (current === generation.current) setError(getApiErrorMessage(cause, "Bildirimler yüklenemedi.")); }
    finally { if (current === generation.current) setLoading(false); }
  }, []);
  useEffect(() => {
    generation.current++;
    setNotifications([]); setUnreadCount(0); setNextCursor(null); setLoading(true); setError(null); setBusy(false); pending.current = false;
    const created = onSocket("notification:created", (row: AppNotification) => {
      refreshVersion.current++;
      if (CHAT_TYPES.has(row.type)) return;
      setNotifications(current => [row, ...current.filter(item => item.id !== row.id)]);
      void refresh();
    });
    const read = onSocket("notification:read", () => { void refresh(); });
    const sync = onSocket("sync:required", () => { void refresh(); });
    return () => { generation.current++; created(); read(); sync(); };
  }, [data.user.id, refresh]);
  useFocusEffect(useCallback(() => { void refresh(); }, [refresh, data.user.id]));
  const markAll = async () => {
    if (pending.current) return;
    pending.current = true; setBusy(true);
    const current = generation.current;
    try { await readAllNotifications(); if (current === generation.current) await refresh(); }
    catch (cause) { if (current === generation.current) setError(getApiErrorMessage(cause, "Bildirimler okundu işaretlenemedi.")); }
    finally { if (current === generation.current) { pending.current = false; setBusy(false); } }
  };
  // Pending sections (invitations, references) remount after a bulk decline so they reload.
  const [pendingVersion, setPendingVersion] = useState(0);
  // Like "Tümünü oku": "Tümünü sil" is disabled when nothing is shown (no notifications, invitations or reference cards).
  const [inviteCount, setInviteCount] = useState(0);
  const [referenceCount, setReferenceCount] = useState(0);
  const nothingToDelete = !notifications.length && !inviteCount && !referenceCount;
  /**
   * "Tümünü sil": deletes every notification. If something is still waiting for an answer
   * (friend requests, reference requests, event invitations) the user may decline those too.
   */
  const removeAll = async () => {
    if (pending.current) return;
    pending.current = true; setBusy(true);
    const current = generation.current;
    const release = () => { if (current === generation.current) { pending.current = false; setBusy(false); } };
    const [friends, references, invitations] = await Promise.all([
      getIncomingFriendRequests().then(r => r.items.map(item => item.user.id)).catch(() => [] as string[]),
      getReferenceRequests().then(r => r.items.filter(item => item.direction === "incoming" && item.status === "pending").map(item => item.id)).catch(() => [] as string[]),
      getInvitations().then(r => r.items.map(item => item.id)).catch(() => [] as string[]),
    ]);
    if (current !== generation.current) return;
    const run = async (declinePending: boolean) => {
      try {
        if (declinePending) await Promise.allSettled([
          ...friends.map(id => declineFriendRequest(id)),
          ...references.map(id => respondToReference(id, "declined")),
          ...invitations.map(id => participate(id, false)),
        ]);
        await deleteAllNotifications();
        if (current !== generation.current) return;
        setNotifications([]); setUnreadCount(0); setNextCursor(null);
        if (declinePending) setPendingVersion(v => v + 1);
        void refresh();
      } catch (cause) { if (current === generation.current) setError(getApiErrorMessage(cause, "Bildirimler silinemedi.")); }
      finally { release(); }
    };
    const waiting = [friends.length ? `${friends.length} arkadaşlık isteği` : "", references.length ? `${references.length} referans isteği` : "", invitations.length ? `${invitations.length} etkinlik daveti` : ""].filter(Boolean);
    if (waiting.length) Alert.alert("Onay bekleyen istekler var", `${waiting.join(", ")} yanıtını bekliyor. Bunları da reddetmek ister misin?`, [
      { text: "Vazgeç", style: "cancel", onPress: release },
      { text: "Sadece bildirimleri sil", onPress: () => void run(false) },
      { text: "Reddet ve tümünü sil", style: "destructive", onPress: () => void run(true) },
    ], { cancelable: true, onDismiss: release });
    else Alert.alert("Tüm bildirimler silinsin mi?", "Bu işlem geri alınamaz.", [
      { text: "Vazgeç", style: "cancel", onPress: release },
      { text: "Tümünü sil", style: "destructive", onPress: () => void run(false) },
    ], { cancelable: true, onDismiss: release });
  };
  const open = async (notification: AppNotification) => {
    if (pending.current) return;
    pending.current = true; setBusy(true);
    const current = generation.current;
    try {
      if (!notification.readAt) {
        await readNotification(notification.id);
        if (current !== generation.current) return;
        setNotifications(rows => rows.map(row => row.id === notification.id ? { ...row, readAt: new Date().toISOString() } : row));
        void refresh();
      }
      // A direct message opens the chat with its sender; "Etkinlik tamamlandı" opens the rating page.
      if (notification.type === "direct_message" && notification.actorId) navigate("direct-chat", { userId: notification.actorId });
      else if (notification.type === "event_rating" && notification.eventId) navigate("rate-event", { eventId: notification.eventId });
      else if (notification.eventId) {
        const event = await getEvent(notification.eventId);
        if (current !== generation.current) return;
        setData(store => ({ ...store, events: [mapApiEvent(event), ...store.events.filter(row => row.id !== event.id)] }));
        navigate(notification.type === "message" || notification.type === "announcement" ? "event-room" : "event-detail", { eventId: event.id });
      } else if (notification.actorId && !notification.type.startsWith("reference_")) navigate("profile", { userId: notification.actorId });
    } catch (cause) { if (current === generation.current) setError(getApiErrorMessage(cause, "Bildirim açılamadı.")); }
    finally { if (current === generation.current) { pending.current = false; setBusy(false); } }
  };
  const loadMore = async () => {
    if (pending.current || !nextCursor || !notifications.length) return;
    pending.current = true; setBusy(true);
    const current = generation.current;
    try {
      const result = await getNotifications(nextCursor);
      if (current !== generation.current) return;
      setNotifications(rows => [...new Map([...rows, ...result.items.filter(row => !CHAT_TYPES.has(row.type))].map(row => [row.id, row])).values()]); setNextCursor(result.nextCursor);
    } catch (cause) { if (current === generation.current) setError(getApiErrorMessage(cause)); }
    finally { if (current === generation.current) { pending.current = false; setBusy(false); } }
  };
  return <Box style={[[ui.fixed, ui.inset0, ui.bg06060e, ui.flex, ui.flexCol, ui.overflowHidden]]}>
    <AtmoBackground />
    <TopNavBar navigate={navigate} fallback="discover" title="Bildirimler" subtitle={unreadCount ? `${unreadCount} yeni bildirim` : undefined} right={<>
      <NavAction walkthroughId="notification-actions" label="Tüm bildirimleri okundu işaretle" tone="muted" disabled={busy || !unreadCount} onPress={() => void markAll()}>Tümünü oku</NavAction>
      <NavAction label="Tüm bildirimleri sil" tone="danger" disabled={busy || nothingToDelete} onPress={() => void removeAll()}>Tümünü sil</NavAction>
    </>} />
    <Scroll style={[[ui.flex1, ui.px5, ui.spaceY2], { paddingTop: 80, paddingBottom: 40 + navInset }]}>
      <Box walkthroughId="notification-invites" style={{ minHeight: 44 }}>
      <EventInvitations key={`invites-${pendingVersion}`} navigate={navigate} onCount={setInviteCount} />
      <ReferenceNotifications key={`references-${pendingVersion}`} onCount={setReferenceCount} />
      </Box>
      {error && <ErrorNotice title="Bildirimler yüklenemedi" message={error} onDismiss={() => setError(null)} />}
      {loading && <Label style={[[ui.textSm, ui.textWhite50, ui.py4]]}>Bildirimler yükleniyor…</Label>}
      {!loading && !error && !notifications.length && <Label style={[[ui.textSm, ui.textWhite50, ui.py4]]}>Henüz yeni uyarın yok.</Label>}
      {notifications.map(notification => <Touch key={notification.id} disabled={busy} accessibilityLabel={`${notification.readAt ? "" : "Yeni bildirim: "}${notification.title}`} onPress={() => void open(notification)} style={{ flexDirection: "row", alignItems: "flex-start", gap: 12, padding: 16, borderRadius: 18, backgroundColor: notification.readAt ? palette.surface : palette.elevated, borderWidth: 1, borderColor: notification.readAt ? palette.border : "rgba(185,195,255,.35)" }}>
        <Box style={{ width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: palette.selected }}>
          {notification.type === "message" || notification.type === "direct_message" ? <MessageIcon size={18} style={{ color: palette.accent }} /> : notification.type.startsWith("participant_") || notification.type.startsWith("friend_") ? <UsersIcon size={18} style={{ color: palette.accent }} /> : notification.type === "event_rating" ? <StarIcon size={18} style={{ color: palette.accent }} /> : notification.type === "room_ready" ? <CheckIcon size={18} style={{ color: palette.success }} /> : <BellIcon size={18} style={{ color: palette.accent }} />}
        </Box>
        <Box style={{ flex: 1, minWidth: 0, gap: 5 }}>
          <Label style={{ color: palette.text, fontSize: 14, fontFamily: "Outfit-SemiBold", textAlign: "left" }}>{notification.title}</Label>
          <Label style={{ color: palette.muted, fontSize: 12, lineHeight: 18, textAlign: "left" }}>{notification.body}</Label>
          <Label style={{ color: palette.muted, fontSize: 10, textAlign: "left" }}>{new Date(notification.createdAt).toLocaleString("tr-TR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</Label>
        </Box>
        {!notification.readAt && <Box accessibilityLabel="Okunmamış" style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: palette.accent, marginTop: 5 }} />}
      </Touch>)}
      {nextCursor && <Touch disabled={busy} onPress={() => void loadMore()} style={[[ui.textSm, ui.textWhite60, ui.py3]]}>Daha fazla göster</Touch>}
    </Scroll>
  </Box>;
}

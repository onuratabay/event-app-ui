import { useCallback, useEffect, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import { BellIcon, CheckIcon, MessageIcon, UsersIcon } from "../components/Icons";
import { useBottomNavInset } from "../components/BottomNav";
import { palette } from "../theme/palette";
import { ReferenceNotifications } from "../components/ReferenceNotifications";
import { EventInvitations } from "../components/EventInvitations";
import { AtmoBackground } from "../components/GlassUI";
import TopNavBar from "../components/TopNavBar";
import { ErrorNotice } from "../components/ErrorNotice";
import { getNotifications, readAllNotifications, readNotification, getEvent, getApiErrorMessage, hasSession, type AppNotification } from "../api/client";
import { mapApiEvent, useStore } from "../native/Store";
import { onSocket } from "../services/socket";
import { Box, Label, Scroll, Touch } from "../native/UI";
import { ui } from "../theme/styles";
import type { NavigateFn } from "../types";

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
      setNotifications(result.items); setUnreadCount(result.unreadCount); setNextCursor(result.nextCursor); setError(null);
    } catch (cause) { if (current === generation.current) setError(getApiErrorMessage(cause, "Bildirimler yüklenemedi.")); }
    finally { if (current === generation.current) setLoading(false); }
  }, []);
  useEffect(() => {
    generation.current++;
    setNotifications([]); setUnreadCount(0); setNextCursor(null); setLoading(true); setError(null); setBusy(false); pending.current = false;
    const created = onSocket("notification:created", (row: AppNotification) => {
      refreshVersion.current++;
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
      if (notification.eventId) {
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
      setNotifications(rows => [...new Map([...rows, ...result.items].map(row => [row.id, row])).values()]); setNextCursor(result.nextCursor);
    } catch (cause) { if (current === generation.current) setError(getApiErrorMessage(cause)); }
    finally { if (current === generation.current) { pending.current = false; setBusy(false); } }
  };
  return <Box style={[[ui.fixed, ui.inset0, ui.bg06060e, ui.flex, ui.flexCol, ui.overflowHidden]]}>
    <AtmoBackground />
    <TopNavBar navigate={navigate} fallback="discover" title="Bildirimler" subtitle={unreadCount ? `${unreadCount} yeni bildirim` : undefined} right={<Touch accessibilityLabel="Tüm bildirimleri okundu işaretle" disabled={busy || !unreadCount} onPress={() => void markAll()} style={[[ui.textXs, ui.textWhite50, ui.px2]]}>Tümünü oku</Touch>} />
    <Scroll style={[[ui.flex1, ui.px5, ui.spaceY2], { paddingTop: 80, paddingBottom: 40 + navInset }]}>
      <EventInvitations navigate={navigate} />
      <ReferenceNotifications />
      {error && <ErrorNotice title="Bildirimler yüklenemedi" message={error} onDismiss={() => setError(null)} />}
      {loading && <Label style={[[ui.textSm, ui.textWhite50, ui.py4]]}>Bildirimler yükleniyor…</Label>}
      {!loading && !error && !notifications.length && <Label style={[[ui.textSm, ui.textWhite50, ui.py4]]}>Henüz yeni uyarın yok.</Label>}
      {notifications.map(notification => <Touch key={notification.id} disabled={busy} accessibilityLabel={`${notification.readAt ? "" : "Yeni bildirim: "}${notification.title}`} onPress={() => void open(notification)} style={{ flexDirection: "row", alignItems: "flex-start", gap: 12, padding: 16, borderRadius: 18, backgroundColor: notification.readAt ? palette.surface : palette.elevated, borderWidth: 1, borderColor: notification.readAt ? palette.border : "rgba(185,195,255,.35)" }}>
        <Box style={{ width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: palette.selected }}>
          {notification.type === "message" ? <MessageIcon size={18} style={{ color: palette.accent }} /> : notification.type.startsWith("participant_") || notification.type.startsWith("friend_") ? <UsersIcon size={18} style={{ color: palette.accent }} /> : notification.type === "room_ready" ? <CheckIcon size={18} style={{ color: palette.success }} /> : <BellIcon size={18} style={{ color: palette.accent }} />}
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

import { useCallback, useEffect, useState } from "react";
import { useFocusEffect } from "expo-router";
import { getNotifications, hasSession } from "../api/client";
import { useStore } from "../native/Store";
import { onSocket } from "../services/socket";
import { palette } from "../theme/palette";
import { BellIcon } from "./Icons";
import HeaderIconButton from "./HeaderIconButton";
import CountBadge from "./CountBadge";

export default function NotificationButton({ onPress }: { onPress: () => void }) {
  const { data } = useStore();
  const [count, setCount] = useState(0);
  useFocusEffect(useCallback(() => {
    let active = true;
    const refresh = async () => {
      try { if (await hasSession()) { const result = await getNotifications(); if (active) setCount(result.unreadCount); } }
      catch { /* The notification screen provides errors and retry on open. */ }
    };
    setCount(0); void refresh();
    const created = onSocket("notification:created", () => { void refresh(); });
    const read = onSocket("notification:read", () => { void refresh(); });
    const sync = onSocket("sync:required", () => { void refresh(); });
    return () => { active = false; created(); read(); sync(); };
  }, [data.user.id]));
  useEffect(() => { if (!data.user.id) setCount(0); }, [data.user.id]);
  return <HeaderIconButton plain label={count ? `Bildirimler, ${count} okunmamış` : "Bildirimler"} onPress={onPress}>
    <BellIcon size={20} strokeWidth={1.8} style={{ color: palette.text }} />
    {/* Anchored past the bell's top-right corner so it only overlaps the corner, not the bell. */}
    <CountBadge count={count} solid style={{ position: "absolute", top: -9, left: 13 }} />
  </HeaderIconButton>;
}

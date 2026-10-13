import { useCallback, useEffect, useState } from "react";
import { useFocusEffect } from "expo-router";
import { getNotifications, hasSession } from "../api/client";
import { useStore } from "../native/Store";
import { onSocket } from "../services/socket";
import { Box, Label } from "../native/UI";
import { palette } from "../theme/palette";
import { BellIcon } from "./Icons";
import HeaderIconButton from "./HeaderIconButton";

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
    {count > 0 && <Box pointerEvents="none" style={{ position: "absolute", top: 3, right: 1, minWidth: 16, height: 16, paddingHorizontal: 3, borderRadius: 8, backgroundColor: palette.blue, alignItems: "center", justifyContent: "center" }}>
      <Label style={{ fontSize: 9, lineHeight: 12, color: palette.text, fontFamily: "Outfit-SemiBold" }}>{count > 99 ? "99+" : count}</Label>
    </Box>}
  </HeaderIconButton>;
}

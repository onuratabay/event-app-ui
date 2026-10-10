import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect } from "react";
import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import { useStore } from "./Store";
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});
export default function PushBoundary() {
  const router = useRouter(),
    { data } = useStore();
  useEffect(() => {
    if (!data.user.id || data.user.isGuest) return;
    let active = true;
    void AsyncStorage.getItem("event-app:pending-share").then(async (code) => {
      if (active && code) {
        await AsyncStorage.removeItem("event-app:pending-share");
        if (active) router.replace({ pathname: "/e/[code]", params: { code } });
      }
    });
    const seen = new Set<string>();
    const open = (r: Notifications.NotificationResponse | null) => {
      if (!active || !r) return;
      const id = r.notification.request.identifier;
      if (seen.has(id)) return;
      seen.add(id);
      const eventId = r.notification.request.content.data?.eventId;
      if (typeof eventId === "string" && /^[0-9a-f-]{36}$/i.test(eventId))
        router.push({ pathname: "/event-detail", params: { eventId } });
      else router.push("/notifications");
      void Notifications.clearLastNotificationResponseAsync();
    };
    void Notifications.getLastNotificationResponseAsync().then(open);
    const sub = Notifications.addNotificationResponseReceivedListener(open);
    return () => {
      active = false;
      sub.remove();
    };
  }, [data.user.id, router]);
  return null;
}

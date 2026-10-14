import Constants from "expo-constants"
import { Platform } from "react-native"
import { removePushToken, savePushToken, setBeforeLogout } from "../api/client"

export type PushState = "granted" | "denied" | "unavailable"
let registered: string | null = null
let handlerSet = false

/**
 * Registers this device for push (e.g. "Üyeliğin onaylandı") and sends its Expo token to the
 * server. `ask` shows the system permission prompt; without it only an existing permission is used.
 * Expo Go on Android has no remote push and crashes when expo-notifications loads, so it is skipped,
 * and the module is only required here, never at import time.
 */
export async function registerForPush(ask: boolean): Promise<PushState> {
  if (Constants.executionEnvironment === "storeClient" && Platform.OS === "android") return "unavailable"
  try {
    const Notifications = require("expo-notifications") as typeof import("expo-notifications")
    const Device = require("expo-device") as typeof import("expo-device")
    if (!Device.isDevice) return "unavailable"
    if (!handlerSet) {
      handlerSet = true
      Notifications.setNotificationHandler({ handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }) })
    }
    if (Platform.OS === "android") await Notifications.setNotificationChannelAsync("default", { name: "Bildirimler", importance: Notifications.AndroidImportance.HIGH })
    let { status } = await Notifications.getPermissionsAsync()
    if (status !== "granted" && ask) status = (await Notifications.requestPermissionsAsync()).status
    if (status !== "granted") return "denied"
    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId
    const { data: token } = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined)
    if (token !== registered) { await savePushToken(token, Platform.OS); registered = token }
    return "granted"
  } catch {
    return "unavailable"
  }
}

/**
 * Calls `handler` with the data of a push the user tapped (also the one that opened the app).
 * Returns an unsubscribe; does nothing where push is unavailable.
 */
export function onPushOpened(handler: (data: Record<string, unknown>) => void): () => void {
  if (Constants.executionEnvironment === "storeClient" && Platform.OS === "android") return () => {}
  try {
    const Notifications = require("expo-notifications") as typeof import("expo-notifications")
    if (typeof Notifications.addNotificationResponseReceivedListener !== "function") return () => {}
    let active = true
    void Notifications.getLastNotificationResponseAsync?.().then(response => { if (active && response) handler(response.notification.request.content.data ?? {}) }).catch(() => {})
    const subscription = Notifications.addNotificationResponseReceivedListener(response => handler(response.notification.request.content.data ?? {}))
    return () => { active = false; subscription.remove() }
  } catch {
    return () => {}
  }
}

// Signing out removes the token while the session can still authorize it, so the next account on
// this device does not receive the previous one's notifications.
setBeforeLogout(async () => {
  if (!registered) return
  const token = registered
  registered = null
  await removePushToken(token)
})

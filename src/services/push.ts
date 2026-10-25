import Constants from "expo-constants"
import { Platform } from "react-native"
import { removePushToken, savePushToken, setBeforeLogout } from "../api/client"

export type PushState = "granted" | "denied" | "unavailable"
let registered: string | null = null
let handlerSet = false

/** Native modules expo-notifications loads on import on Android (ExpoTopicSubscriptionModule is new in SDK 58). */
const ANDROID_NATIVE_MODULES = ["ExpoPushTokenManager", "ExpoNotificationsEmitter", "ExpoNotificationsHandlerModule", "ExpoNotificationPermissionsModule", "ExpoNotificationChannelManager", "ExpoTopicSubscriptionModule"]
let nativeReady: boolean | undefined
/**
 * expo-notifications, or null where its native side is missing: Expo Go on Android has no remote push, and an
 * app built before an SDK upgrade lacks newer modules. Loading the package there raises a red error screen in
 * development even inside try/catch (Metro reports a failing module before the catch), so the native modules
 * are looked up first without throwing.
 */
function notificationsModule() {
  try {
    // The native side does not change while the app runs: looked up once.
    nativeReady ??= Platform.OS !== "android" || (Constants.executionEnvironment !== "storeClient"
      && ANDROID_NATIVE_MODULES.every(name => !!(require("expo") as typeof import("expo")).requireOptionalNativeModule(name)))
    return nativeReady ? require("expo-notifications") as typeof import("expo-notifications") : null
  } catch { return null }
}

/**
 * Registers this device for push (e.g. "Üyeliğin onaylandı") and sends its Expo token to the
 * server. `ask` shows the system permission prompt; without it only an existing permission is used.
 * Expo Go on Android has no remote push and crashes when expo-notifications loads, so it is skipped,
 * and the module is only required here, never at import time.
 */
export async function registerForPush(ask: boolean): Promise<PushState> {
  const Notifications = notificationsModule()
  if (!Notifications) return "unavailable"
  try {
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
  const Notifications = notificationsModule()
  if (!Notifications) return () => {}
  try {
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

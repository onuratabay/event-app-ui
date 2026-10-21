import Constants from "expo-constants"
import { Platform } from "react-native"

type Ads = typeof import("react-native-google-mobile-ads")

/** First ad after this many events, then one after every AD_EVERY events (5th, 13th, 21st… place). */
export const AD_FIRST_AFTER = 4
export const AD_EVERY = 8

export type AdSlot = { id: string; ad: true }
/** The feed with ad slots: after AD_FIRST_AFTER items, then every AD_EVERY, and only where an item follows. */
export function withAdSlots<T extends { id: string }>(items: T[], enabled: boolean): Array<T | AdSlot> {
  if (!enabled) return items
  const out: Array<T | AdSlot> = []
  items.forEach((item, i) => {
    out.push(item)
    const shown = i + 1
    if (shown < items.length && shown >= AD_FIRST_AFTER && (shown - AD_FIRST_AFTER) % AD_EVERY === 0) out.push({ id: `ad-${shown}`, ad: true })
  })
  return out
}

// Google's sample native unit (shows "Test Ad"); used in development until the real units are set.
const TEST_NATIVE = Platform.OS === "ios" ? "ca-app-pub-3940256099942544/3986624511" : "ca-app-pub-3940256099942544/2247696110"
const realNative = Platform.OS === "ios" ? process.env.EXPO_PUBLIC_ADMOB_NATIVE_IOS : process.env.EXPO_PUBLIC_ADMOB_NATIVE_ANDROID

/** The native ad unit for this platform; null in a release build that has no real unit configured. */
export function nativeUnitId(): string | null {
  if (realNative?.trim()) return realNative.trim()
  return __DEV__ ? TEST_NATIVE : null
}

let sdk: Ads | null | undefined
/** The ads SDK, or null where it cannot run: Expo Go has no native ads module, and tests mock nothing. */
export function adsModule(): Ads | null {
  if (sdk !== undefined) return sdk
  if (Constants.executionEnvironment === "storeClient") return (sdk = null)
  try { sdk = require("react-native-google-mobile-ads") as Ads }
  catch { sdk = null }
  return sdk
}

let ready: Promise<boolean> | null = null
/**
 * Once per launch: the consent form where the law asks for one (Google UMP), the iOS tracking prompt,
 * then the SDK start. Resolves false when ads cannot be shown on this device.
 */
export function prepareAds(): Promise<boolean> {
  return ready ??= (async () => {
    const ads = adsModule()
    if (!ads || !nativeUnitId()) return false
    try {
      await ads.AdsConsent.requestInfoUpdate()
      await ads.AdsConsent.loadAndShowConsentFormIfRequired()
    } catch { /* No consent form available: ads still load as non-personalised where required. */ }
    if (Platform.OS === "ios") {
      try {
        const tracking = require("expo-tracking-transparency") as typeof import("expo-tracking-transparency")
        const { status } = await tracking.getTrackingPermissionsAsync()
        if (status === "undetermined") await tracking.requestTrackingPermissionsAsync()
      } catch { /* Without the prompt iOS treats tracking as denied; ads stay non-personalised. */ }
    }
    try { await ads.default().initialize(); return true }
    catch { return false }
  })()
}

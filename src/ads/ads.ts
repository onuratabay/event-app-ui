import Constants from "expo-constants"
import { Platform, TurboModuleRegistry } from "react-native"

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

/**
 * The native ad unit for this platform. Development and test builds always get Google's test unit, even
 * when the real one is set (clicking your own live ads can get the AdMob account closed); a release build without
 * a real unit shows no ads.
 */
export function nativeUnitId(): string | null {
  // EXPO_PUBLIC_ADS_TEST=1 (EAS preview and development environments) keeps test builds on test ads too.
  if (__DEV__ || process.env.EXPO_PUBLIC_ADS_TEST === "1") return TEST_NATIVE
  return realNative?.trim() || null
}

/** Native modules the ads package loads on import. */
const NATIVE_MODULES = ["RNAppModule", "RNGoogleMobileAdsModule", "RNGoogleMobileAdsConsentModule", "RNGoogleMobileAdsNativeModule"]
let sdk: Ads | null | undefined
/**
 * The ads SDK, or null where it cannot run: Expo Go and builds made without the ads module have no native side,
 * and tests mock nothing. The native modules are looked up first without throwing: loading the package where
 * they are missing raises a red error screen in development even inside try/catch.
 */
export function adsModule(): Ads | null {
  if (sdk !== undefined) return sdk
  if (Constants.executionEnvironment === "storeClient") return (sdk = null)
  try { if (NATIVE_MODULES.some(name => !TurboModuleRegistry.get(name))) return (sdk = null) }
  catch { return (sdk = null) }
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

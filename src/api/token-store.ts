import AsyncStorage from "@react-native-async-storage/async-storage"
import * as SecureStore from "expo-secure-store"

/**
 * Session tokens live in the Keychain (iOS) / Keystore-encrypted storage (Android), not in AsyncStorage,
 * which a rooted or jailbroken phone or a device backup can read in plain text. THIS_DEVICE_ONLY keeps them
 * out of backups restored to another phone; AFTER_FIRST_UNLOCK lets background work (push) read them.
 */
const ACCESS = "event-app.access-token"
const REFRESH = "event-app.refresh-token"
const LEGACY_ACCESS = "event-app:access-token"
const LEGACY_REFRESH = "event-app:refresh-token"
/** AsyncStorage marker of this installation. */
const INSTALLED = "event-app:installed"
const options: SecureStore.SecureStoreOptions = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY }

let ready: Promise<void> | null = null
/**
 * Runs once per launch, before the first token read or write:
 * - The iOS Keychain survives uninstalling the app; without the marker (removed with the app's
 *   AsyncStorage) a reinstalled app would open signed in. A missing marker drops the stored tokens.
 * - Tokens an earlier version kept in AsyncStorage move here, so updating does not sign anyone out.
 */
function prepare() {
  ready ??= (async () => {
    const [[, installed], [, legacyAccess], [, legacyRefresh]] = await AsyncStorage.multiGet([INSTALLED, LEGACY_ACCESS, LEGACY_REFRESH])
    if (!installed) {
      await Promise.all([SecureStore.deleteItemAsync(ACCESS, options), SecureStore.deleteItemAsync(REFRESH, options)])
      await AsyncStorage.setItem(INSTALLED, "1")
    }
    if (legacyAccess || legacyRefresh) {
      if (legacyAccess) await SecureStore.setItemAsync(ACCESS, legacyAccess, options)
      if (legacyRefresh) await SecureStore.setItemAsync(REFRESH, legacyRefresh, options)
      await AsyncStorage.multiRemove([LEGACY_ACCESS, LEGACY_REFRESH])
    }
  })().catch(error => { ready = null; throw error })
  return ready
}

export async function getAccessToken() { await prepare(); return SecureStore.getItemAsync(ACCESS, options) }
export async function getRefreshToken() { await prepare(); return SecureStore.getItemAsync(REFRESH, options) }
export async function setTokens(access: string, refresh: string) {
  await prepare()
  await SecureStore.setItemAsync(ACCESS, access, options)
  await SecureStore.setItemAsync(REFRESH, refresh, options)
}
export async function clearTokens() {
  await prepare()
  await Promise.all([SecureStore.deleteItemAsync(ACCESS, options), SecureStore.deleteItemAsync(REFRESH, options)])
}

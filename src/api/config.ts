/** Published builds (release APKs, store builds) always talk to the ewent.app server. */
export const PRODUCTION_API_URL = "https://ewent.app"

/**
 * The backend this build talks to. Published builds: always ewent.app, whatever the environment says.
 * Development builds: EXPO_PUBLIC_API_URL when set (e.g. https://ewent.app to try against production),
 * otherwise the local vibe-us backend on port 3000 of the computer running Expo. Expo's LAN host follows
 * that computer even when its IP changes, so a phone on the same network reaches it without edits.
 */
export function resolveApiUrl(configured: string | undefined, hostUri: string | undefined, platform: string, dev: boolean) {
  if (!dev) return PRODUCTION_API_URL
  if (configured?.trim()) return configured.trim().replace(/\/+$/, "")
  if (hostUri) {
    try {
      const host = new URL(hostUri.includes("://") ? hostUri : `http://${hostUri}`).hostname
      if (host) return `http://${host}:3000`
    } catch { /* Fall back to the emulator / simulator address for malformed manifests. */ }
  }
  return platform === "android" ? "http://10.0.2.2:3000" : "http://localhost:3000"
}

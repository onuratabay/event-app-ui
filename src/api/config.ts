// Expo's LAN host follows the development computer even when its IP changes.
export function resolveApiUrl(configured: string | undefined, hostUri: string | undefined, platform: string) {
  if (configured?.trim()) return configured.trim().replace(/\/+$/, "")
  if (hostUri) {
    try {
      const host = new URL(hostUri.includes("://") ? hostUri : `http://${hostUri}`).hostname
      if (host) return `http://${host}:3000`
    } catch { /* Fall back to the simulator address for malformed manifests. */ }
  }
  return platform === "android" ? "http://10.0.2.2:3000" : "http://localhost:3000"
}

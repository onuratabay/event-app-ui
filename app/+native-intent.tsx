import { parseGuestCode } from '../src/guest/links'
export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  try {
    const code = parseGuestCode(path)
    if (code) return `/guest-event?code=${encodeURIComponent(code)}`
    if (path.includes('/e/') || path.includes('guest-event')) return '/guest-entry'
    return path
  } catch { return '/guest-entry' }
}

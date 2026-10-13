export const GUEST_CODE = /^EWT-[A-Za-z0-9_-]{24}$/
export function parseGuestCode(value: string): string | null {
  const raw = value.trim()
  if (GUEST_CODE.test(raw)) return raw
  try {
    const url = new URL(raw, 'https://ewent.app')
    const candidate = url.pathname.match(/\/e\/([^/]+)\/?$/)?.[1] || (url.protocol === 'eventapp:' || url.pathname === '/guest-event' ? url.searchParams.get('code') : null)
    return candidate && GUEST_CODE.test(candidate) ? candidate : null
  } catch { return null }
}
export const isGuestRoute = (pathname: string) => pathname === '/guest-event' || pathname === '/guest-entry'

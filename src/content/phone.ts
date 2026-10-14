// Turkish mobile numbers as typed in the app: digits after +90, shown as "+90 5XX XXX XX XX".
export function phoneDigits(value: string) {
  const raw = value.replace(/\D/g, "")
  const local = raw.startsWith("90") ? raw.slice(2) : raw.startsWith("0") ? raw.slice(1) : raw
  // Turkish mobile numbers start with 5: it is added by default, so "32 123…" becomes "532 123…".
  return (local && !local.startsWith("5") ? `5${local}` : local).slice(0, 10)
}
/** What an empty phone field shows once it gets focus: the country code and the leading 5. */
export const PHONE_PREFIX = "+90 5"
export function formatPhone(value: string) {
  const digits = phoneDigits(value)
  if (!digits) return ""
  const parts = [digits.slice(0, 3), digits.slice(3, 6), digits.slice(6, 8), digits.slice(8, 10)].filter(Boolean)
  return `+90 ${parts.join(" ")}`
}

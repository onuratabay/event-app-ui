// Turkish numbers as typed in the app: the 10 digits after +90, exactly as entered (nothing is added).
// A pasted "+90 532…" (more than 10 digits) loses its country code, and "0532…" its leading 0.
export function phoneDigits(value: string) {
  const raw = value.replace(/\D/g, "")
  const local = raw.length > 10 && raw.startsWith("90") ? raw.slice(2) : raw.startsWith("0") ? raw.slice(1) : raw
  return local.slice(0, 10)
}
export function formatPhone(value: string) {
  const digits = phoneDigits(value)
  if (!digits) return ""
  const parts = [digits.slice(0, 3), digits.slice(3, 6), digits.slice(6, 8), digits.slice(8, 10)].filter(Boolean)
  return `+90 ${parts.join(" ")}`
}
/**
 * The number part of a split phone field (the "+90" sits in its own box): "532 123 45 67".
 * A pasted "+90 532…" or "0532…" is accepted; the country code and leading 0 are dropped.
 */
export function formatLocalPhone(value: string) {
  const digits = phoneDigits(value)
  return [digits.slice(0, 3), digits.slice(3, 6), digits.slice(6, 8), digits.slice(8, 10)].filter(Boolean).join(" ")
}
/** Shown in the fixed country-code box next to the number. */
export const PHONE_COUNTRY_CODE = "+90"

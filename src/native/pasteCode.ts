import * as Clipboard from "expo-clipboard"

/** The 6-digit code from the clipboard (e.g. copied from the email), or null when there is none. */
export async function pastedCode(): Promise<string | null> {
  try {
    const text = await Clipboard.getStringAsync()
    return text.match(/\b\d{6}\b/)?.[0] ?? (text.replace(/\D/g, "").length === 6 ? text.replace(/\D/g, "") : null)
  } catch {
    return null
  }
}

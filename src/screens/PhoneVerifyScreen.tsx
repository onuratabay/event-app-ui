import { useEffect, useState } from "react"
import { StyleSheet } from "react-native"
import TopNavBar from "../components/TopNavBar"
import { AtmoBackground } from "../components/GlassUI"
import { GlassFill, INPUT_FROST } from "../components/GlassFill"
import { ContinueButton } from "../components/ContinueButton"
import { formatPhone } from "../content/phone"
import { useStore } from "../native/Store"
import { getApiErrorMessage, sendPhoneCode, verifyPhoneCode } from "../api/client"
import { Box, Field, Label, Scroll, Touch } from "../native/UI"
import { palette } from "../theme/palette"
import type { NavigateFn } from "../types"

const CODE_LENGTH = 4
const RESEND_SECONDS = 60
// The server sends and checks the code (Verimor SMS). Until Verimor is configured there it sends
// nothing and accepts the temporary code 1111.

/** After the account is created and before the application's next step: confirm the phone number by SMS code. */
export default function PhoneVerifyScreen({ navigate }: { navigate: NavigateFn }) {
  const { data: store, setData } = useStore()
  const phone = formatPhone(store.onboarding.telefon || "") || "Telefonuna"
  const [code, setCode] = useState("")
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [busy, setBusy] = useState(false)
  const [wait, setWait] = useState(RESEND_SECONDS)
  const send = async () => {
    try { const result = await sendPhoneCode(); setWait(result.resendAfter || RESEND_SECONDS); return true }
    catch (cause) { setError(getApiErrorMessage(cause, "Kod gönderilemedi. Biraz sonra tekrar dene.")); setWait(0); return false }
  }
  // The first code goes out as soon as the page opens.
  useEffect(() => { void send() }, [])
  useEffect(() => {
    if (wait <= 0) return
    const timer = setTimeout(() => setWait(value => value - 1), 1000)
    return () => clearTimeout(timer)
  }, [wait])
  const verify = async (value = code) => {
    if (busy) return
    if (value.length !== CODE_LENGTH) { setError(`${CODE_LENGTH} haneli kodu gir.`); return }
    setBusy(true); setError(""); setNotice("")
    try {
      try { await verifyPhoneCode(value) }
      catch (cause) { setError(getApiErrorMessage(cause, "Kod hatalı. Tekrar dene.")); return }
      setData(current => ({ ...current, onboarding: { ...current.onboarding, phoneVerified: current.onboarding.telefon || "yes" } }))
      navigate("onboarding-2")
    } finally { setBusy(false) }
  }
  const resend = async () => {
    if (wait > 0 || busy) return
    setCode(""); setError(""); setNotice("")
    if (await send()) setNotice("Kod tekrar gönderildi.")
  }
  return <Box style={{ flex: 1, backgroundColor: palette.background }}>
    <AtmoBackground variant="violet" />
    <TopNavBar navigate={navigate} fallback="onboarding-1" title="Üyelik Başvurusu" floating />
    <Scroll style={s.page} keyboardDismissMode="interactive">
      <Box style={s.form}>
        <Label style={s.eyebrow}>TELEFON DOĞRULAMA</Label>
        <Label style={s.title}>Telefonunu doğrula.</Label>
        <Label style={s.body}>{`${phone} numarasına gönderdiğimiz ${CODE_LENGTH} haneli kodu gir.`}</Label>
        <Box style={s.inputFrame}>
          <GlassFill radius={16} {...INPUT_FROST} />
          <Field value={code} onChangeText={value => {
            const digits = value.replace(/\D/g, "").slice(0, CODE_LENGTH)
            setCode(digits); setError("")
            if (digits.length === CODE_LENGTH) void verify(digits)
          }} placeholder={"•".repeat(CODE_LENGTH)} accessibilityLabel="Doğrulama kodu" keyboardType="number-pad"
            textContentType="oneTimeCode" autoComplete="sms-otp" maxLength={CODE_LENGTH} autoFocus style={s.input} />
        </Box>
        {error ? <Label accessibilityRole="alert" style={s.error}>{error}</Label> : notice ? <Label accessibilityLiveRegion="polite" style={s.notice}>{notice}</Label> : null}
        <Touch accessibilityLabel="Kodu tekrar gönder" disabled={wait > 0} disabledOpacity={1} onPress={() => void resend()} style={s.resend}>
          <Label style={[s.resendText, wait > 0 && { color: "rgba(241,245,249,.4)" }]}>{wait > 0 ? `Kodu tekrar gönder (${wait} sn)` : "Kodu tekrar gönder"}</Label>
        </Touch>
        <ContinueButton onPress={() => void verify()} disabled={busy} dimmed={code.length !== CODE_LENGTH}>
          {busy ? "Doğrulanıyor..." : "Doğrula ve devam et"}
        </ContinueButton>
      </Box>
    </Scroll>
  </Box>
}
const s = StyleSheet.create({
  page: { flexGrow: 1, justifyContent: "center", paddingHorizontal: 28, paddingTop: 88, paddingBottom: 36 },
  form: { width: "100%", maxWidth: 440, alignSelf: "center", gap: 12 },
  eyebrow: { color: palette.accent, fontSize: 11, letterSpacing: 4, fontFamily: "Outfit-Medium" },
  title: { color: palette.text, fontFamily: "Fraunces", fontSize: 34, lineHeight: 42, letterSpacing: -0.6 },
  body: { color: "rgba(241,245,249,.55)", fontSize: 14, lineHeight: 21, marginBottom: 12 },
  inputFrame: { borderRadius: 16 },
  input: { minHeight: 64, borderRadius: 16, borderWidth: 1, borderColor: palette.glassBorder, backgroundColor: "transparent", color: "#f4f5ff", fontSize: 28, letterSpacing: 18, textAlign: "center", fontFamily: "Outfit-SemiBold" },
  error: { color: palette.error, fontSize: 12, marginLeft: 4 },
  notice: { color: palette.accent, fontSize: 12, marginLeft: 4 },
  resend: { alignSelf: "flex-start", minHeight: 44, justifyContent: "center", paddingHorizontal: 4 },
  resendText: { color: "#c7ceff", fontFamily: "Outfit-Medium", fontSize: 14 },
})

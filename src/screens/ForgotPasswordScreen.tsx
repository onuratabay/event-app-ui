import { palette } from "../theme/palette";
import { useEffect, useRef, useState } from "react"
import { KeyboardAvoidingView, Platform, StyleSheet } from "react-native"
import TopNavBar from "../components/TopNavBar"
import { AtmoBackground, GlassInput } from "../components/GlassUI"
import { forgotPassword, getApiErrorMessage, resetPassword, verifyResetCode } from "../api/client"
import { Box, Label, Scroll, Touch } from "../native/UI"
import type { NavigateFn } from "../types"
import { pastedCode } from "../native/pasteCode"
import { PASSWORD_ERROR, PASSWORD_HINT, PASSWORD_RULES, isStrongPassword, passwordRules } from "../content/password"

/** The emailed code is valid for 2 minutes (the server enforces the same limit). */
const CODE_TTL_SECONDS = 120
const onlyDigits = (value: string) => value.replace(/\D/g, "").slice(0, 6)
const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`

/**
 * "Şifremi unuttum" in three steps: the email address → the 6-digit code sent there (2 minutes) → the new
 * password twice. Signing in to the account meanwhile cancels the request on the server, so a code
 * triggered by someone who only knows the address stops working.
 */
export default function ForgotPasswordScreen({ navigate }: { navigate: NavigateFn }) {
  const [stage, setStage] = useState<"email" | "code" | "password" | "done">("email")
  const [email, setEmail] = useState("")
  const [code, setCode] = useState("")
  const [password, setPassword] = useState("")
  const [confirmation, setConfirmation] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expiresAt, setExpiresAt] = useState(0)
  const [now, setNow] = useState(Date.now())
  const revision = useRef(0)
  useEffect(() => () => { revision.current++ }, [])
  // Countdown while the code and new-password steps are open.
  useEffect(() => {
    if (stage !== "code" && stage !== "password") return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [stage])
  const secondsLeft = Math.max(0, Math.ceil((expiresAt - now) / 1000))
  const expired = (stage === "code" || stage === "password") && secondsLeft === 0

  const run = async (work: (current: number) => Promise<void>) => {
    if (busy) return
    setError(null)
    const current = ++revision.current
    setBusy(true)
    try { await work(current) }
    catch (cause) { if (current === revision.current) setError(getApiErrorMessage(cause, "İşlem tamamlanamadı. Lütfen tekrar dene.")) }
    finally { if (current === revision.current) setBusy(false) }
  }
  const sendCode = () => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setError("Geçerli bir e-posta adresi gir."); return }
    void run(async current => {
      await forgotPassword(email)
      if (current !== revision.current) return
      setCode(""); setExpiresAt(Date.now() + CODE_TTL_SECONDS * 1000); setNow(Date.now()); setStage("code")
    })
  }
  const checkCode = () => {
    if (code.length !== 6) { setError("E-postana gelen 6 haneli kodu gir."); return }
    if (expired) { setError("Kodun süresi doldu. Yeni bir kod iste."); return }
    void run(async current => {
      await verifyResetCode(email, code)
      if (current === revision.current) setStage("password")
    })
  }
  const savePassword = () => {
    if (!isStrongPassword(password)) { setError(PASSWORD_ERROR); return }
    if (password !== confirmation) { setError("Şifreler eşleşmiyor."); return }
    if (expired) { setError("Kodun süresi doldu. Yeni bir kod iste."); return }
    void run(async current => {
      await resetPassword(email, code, password)
      if (current !== revision.current) return
      setCode(""); setPassword(""); setConfirmation(""); setStage("done")
    })
  }
  const goBack = () => {
    revision.current++; setBusy(false); setError(null)
    if (stage === "password") { setStage("code"); setPassword(""); setConfirmation("") }
    else if (stage === "code") { setStage("email"); setCode("") }
    else navigate("login", { back: true })
  }

  const title = stage === "done" ? "Şifren yenilendi." : stage === "password" ? "Yeni şifreni belirle." : stage === "code" ? "Kodu gir." : "Şifreni mi unuttun?"
  const hint = stage === "done" ? "Artık yeni şifrenle giriş yapabilirsin."
    : stage === "password" ? "Yeni şifreni iki kez yaz."
    : stage === "code" ? `${email.trim()} kayıtlıysa bu adrese 6 haneli bir kod gönderdik. Gelen kutunu ve spam klasörünü kontrol et.`
    : "Hesabına bağlı e-posta adresini yaz; şifreni yenilemen için 6 haneli bir kod gönderelim."
  return <KeyboardAvoidingView style={s.root} behavior={Platform.OS === "ios" ? "padding" : "height"}>
    <AtmoBackground variant="violet" />
    <TopNavBar navigate={navigate} fallback="login" onBack={goBack} title="Şifre İşlemleri" />
    {/* flexGrow 0: the scroll content would stretch to the screen and the inputs (which grow) would drift apart. */}
    <Scroll style={s.page} contentContainerStyle={{ flexGrow: 0 }} keyboardShouldPersistTaps="handled">
      <Label style={s.eyebrow}>HESABINA YENİDEN ULAŞ</Label>
      <Label style={s.title}>{title}</Label>
      <Label style={s.hint}>{hint}</Label>

      {stage === "email" && <GlassInput label="E-posta" accessibilityLabel="Sıfırlama e-postası" mode="email" value={email} onChangeText={setEmail} placeholder="ornek@eposta.com" autoCapitalize="none" autoComplete="email" returnKeyType="send" onSubmitEditing={sendCode} />}

      {stage === "code" && <>
        <GlassInput label="6 haneli kod" accessibilityLabel="Sıfırlama kodu" value={code} onChangeText={value => setCode(onlyDigits(value))} keyboardType="number-pad" textContentType="oneTimeCode" autoComplete="one-time-code" maxLength={6} placeholder="••••••" returnKeyType="done" onSubmitEditing={checkCode} />
        <Box style={s.timerRow}>
          <Label style={[s.timer, expired && s.timerExpired, { flex: 1 }]} accessibilityLiveRegion="polite">{expired ? "Kodun süresi doldu." : `Kod ${clock(secondsLeft)} içinde geçersiz olacak.`}</Label>
          {/* The code copied from the email goes into the field with one tap. */}
          <Touch accessibilityLabel="Kodu yapıştır" onPress={() => void pastedCode().then(value => { if (value) { setCode(value); setError(null) } else setError("Panoda 6 haneli bir kod yok. Koda e-postada dokunup kopyala.") })} style={s.paste}>
            <Label style={s.linkText}>Kodu yapıştır</Label>
          </Touch>
        </Box>
      </>}

      {stage === "password" && <>
        <GlassInput label="Yeni şifre" accessibilityLabel="Yeni şifre" value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" placeholder={PASSWORD_HINT} />
        {!!password && <Box style={s.rules} accessibilityLiveRegion="polite">
          {PASSWORD_RULES.map(([key, text]) => { const ok = passwordRules(password)[key]; return <Label key={key} style={[s.rule, { color: ok ? palette.success : "#9aa3cf" }]}>{`${ok ? "✓" : "○"} ${text}`}</Label> })}
        </Box>}
        <GlassInput label="Yeni şifre tekrar" accessibilityLabel="Yeni şifre tekrar" value={confirmation} onChangeText={setConfirmation} secureTextEntry autoComplete="new-password" returnKeyType="done" onSubmitEditing={savePassword} />
        <Label style={[s.timer, expired && s.timerExpired]}>{expired ? "Kodun süresi doldu; yeni bir kod istemen gerekiyor." : `Kalan süre: ${clock(secondsLeft)}`}</Label>
      </>}

      {error && <Label accessibilityRole="alert" style={s.error}>{error}</Label>}

      {stage === "done" ? <Touch style={s.primary} onPress={() => navigate("login")}><Label style={s.primaryText}>Giriş yap</Label></Touch>
        : stage === "code" && expired ? <Touch style={s.primary} onPress={sendCode} disabled={busy}><Label style={s.primaryText}>{busy ? "Gönderiliyor…" : "Yeni kod gönder"}</Label></Touch>
        : stage === "password" && expired ? <Touch style={s.primary} onPress={() => { setStage("code"); setPassword(""); setConfirmation(""); sendCode() }} disabled={busy}><Label style={s.primaryText}>Yeni kod gönder</Label></Touch>
        : <Touch style={s.primary} onPress={stage === "email" ? sendCode : stage === "code" ? checkCode : savePassword} disabled={busy}>
            <Label style={s.primaryText}>{busy ? "İşleniyor…" : stage === "email" ? "Kod gönder" : stage === "code" ? "Kodu onayla" : "Şifremi yenile"}</Label>
          </Touch>}

      {stage === "code" && !expired && <Touch style={s.link} disabled={busy} onPress={sendCode}><Label style={s.linkText}>Kod gelmedi mi? Yeniden gönder</Label></Touch>}
      {stage === "code" && <Touch style={s.link} disabled={busy} onPress={goBack}><Label style={s.linkText}>E-posta adresini değiştir</Label></Touch>}
    </Scroll>
  </KeyboardAvoidingView>
}
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.background },
  page: { paddingHorizontal: 24, paddingTop: 88, paddingBottom: 36, gap: 18 },
  eyebrow: { color: "#c7ceff", fontSize: 11, letterSpacing: 2 },
  title: { fontFamily: "Fraunces", fontSize: 34, color: palette.text },
  hint: { color: "#cbd5e1", fontSize: 15, lineHeight: 22 },
  timerRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  paste: { minHeight: 36, justifyContent: "center", paddingHorizontal: 4 },
  timer: { color: "#9aa3cf", fontSize: 13, lineHeight: 18 },
  timerExpired: { color: "#f3aa91" },
  rules: { flexDirection: "row", flexWrap: "wrap", columnGap: 14, rowGap: 4, marginTop: -8 },
  rule: { fontSize: 12, lineHeight: 17 },
  error: { color: "#f3aa91", fontSize: 14, lineHeight: 20 },
  primary: { minHeight: 52, backgroundColor: "#4d5bcb", borderRadius: 17, padding: 15, alignItems: "center", justifyContent: "center" },
  primaryText: { color: palette.text, fontFamily: "Outfit-SemiBold", fontSize: 16 },
  link: { minHeight: 44, alignItems: "center", justifyContent: "center" },
  linkText: { color: "#c7ceff", fontSize: 14 },
})

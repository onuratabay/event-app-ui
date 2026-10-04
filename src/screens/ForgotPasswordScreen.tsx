import { palette } from "../theme/palette";
import { useEffect, useRef, useState } from "react"
import { KeyboardAvoidingView, Platform, StyleSheet } from "react-native"
import TopNavBar from "../components/TopNavBar"
import { AtmoBackground, GlassInput } from "../components/GlassUI"
import { forgotPassword, getApiErrorMessage, resetPassword } from "../api/client"
import { Box, Label, Scroll, Touch } from "../native/UI"
import type { NavigateFn } from "../types"

export function resetToken(value: string) {
  try { return new URL(value.trim()).searchParams.get("token") || value.trim() } catch { return value.trim() }
}
export default function ForgotPasswordScreen({ navigate }: { navigate: NavigateFn }) {
  const [stage, setStage] = useState<"email" | "reset" | "done">("email")
  const [email, setEmail] = useState("")
  const [token, setToken] = useState("")
  const [password, setPassword] = useState("")
  const [confirmation, setConfirmation] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [requested, setRequested] = useState(false)
  const revision = useRef(0)
  useEffect(() => () => { revision.current++ }, [])
  const goBack = () => {
    revision.current++; setBusy(false); setError(null)
    if (stage === "reset") { setStage("email"); setPassword(""); setConfirmation("") }
    else navigate("login", { back: true })
  }
  const submit = async () => {
    if (busy) return
    setError(null)
    if (stage === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setError("Geçerli bir e-posta adresi gir."); return }
    if (stage === "reset") {
      if (!resetToken(token)) { setError("E-postandaki sıfırlama kodunu veya bağlantısını gir."); return }
      if (password.length < 8 || !/[^A-Za-z0-9]/.test(password)) { setError("Şifren en az 8 karakter ve bir özel karakter içermeli."); return }
      if (password !== confirmation) { setError("Şifreler eşleşmiyor."); return }
    }
    const current = ++revision.current
    setBusy(true)
    try {
      if (stage === "email") {
        await forgotPassword(email)
        if (current !== revision.current) return
        setRequested(true); setStage("reset")
      } else {
        await resetPassword(resetToken(token), password)
        if (current !== revision.current) return
        setToken(""); setPassword(""); setConfirmation(""); setStage("done")
      }
    } catch (cause) {
      if (current === revision.current) setError(getApiErrorMessage(cause, "İşlem tamamlanamadı. Lütfen tekrar dene."))
    } finally { if (current === revision.current) setBusy(false) }
  }
  return <KeyboardAvoidingView style={s.root} behavior={Platform.OS === "ios" ? "padding" : "height"}>
    <AtmoBackground variant="violet" />
    <TopNavBar navigate={navigate} fallback="login" onBack={goBack} title="Şifre İşlemleri" />
    <Scroll style={s.page} keyboardShouldPersistTaps="handled">
      <Label style={s.eyebrow}>HESABINA YENİDEN ULAŞ</Label>
      <Label style={s.title}>{stage === "done" ? "Şifren yenilendi." : stage === "reset" ? "Yeni şifreni belirle." : "Şifreni mi unuttun?"}</Label>
      <Label style={s.hint}>{stage === "done" ? "Artık yeni şifrenle giriş yapabilirsin." : stage === "email" ? "Hesabına bağlı e-posta adresini yaz. Şifreni yenilemen için bir sıfırlama kodu isteyelim." : requested ? "Bu adres kayıtlıysa sıfırlama e-postası gönderilir. Gelen kutunu ve spam klasörünü kontrol et. Kod 8 saat geçerlidir." : "E-postandaki kodu veya sıfırlama bağlantısını yapıştır."}</Label>
      {stage === "email" && <GlassInput label="E-posta" accessibilityLabel="Sıfırlama e-postası" mode="email" value={email} onChangeText={setEmail} placeholder="ornek@eposta.com" autoCapitalize="none" autoComplete="email" />}
      {stage === "reset" && <>
        <GlassInput label="Sıfırlama kodu veya bağlantısı" accessibilityLabel="Sıfırlama kodu" value={token} onChangeText={setToken} autoCapitalize="none" autoCorrect={false} />
        <GlassInput label="Yeni şifre" accessibilityLabel="Yeni şifre" value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" placeholder="En az 8 karakter ve özel karakter" />
        <GlassInput label="Yeni şifre tekrar" accessibilityLabel="Yeni şifre tekrar" value={confirmation} onChangeText={setConfirmation} secureTextEntry autoComplete="new-password" />
      </>}
      {error && <Label accessibilityRole="alert" style={s.error}>{error}</Label>}
      {stage === "done" ? <Touch style={s.primary} onPress={() => navigate("login")}><Label style={s.primaryText}>Giriş yap</Label></Touch> : <Touch style={s.primary} onPress={() => void submit()} disabled={busy}><Label style={s.primaryText}>{busy ? "İşleniyor…" : stage === "email" ? "Sıfırlama kodu gönder" : "Şifremi yenile"}</Label></Touch>}
      {stage === "email" && <Touch style={s.link} disabled={busy} onPress={() => { setError(null); setRequested(false); setStage("reset") }}><Label style={s.linkText}>Zaten sıfırlama kodum var</Label></Touch>}
      {stage === "reset" && <Touch style={s.link} onPress={goBack}><Label style={s.linkText}>E-posta adresini değiştir / yeni kod iste</Label></Touch>}
    </Scroll>
  </KeyboardAvoidingView>
}
const s = StyleSheet.create({ root: { flex: 1, backgroundColor: palette.background }, page: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 88, paddingBottom: 36, gap: 18 }, eyebrow: { color: "#c7ceff", fontSize: 11, letterSpacing: 2 }, title: { fontFamily: "Fraunces", fontSize: 34, color: palette.text }, hint: { color: "#cbd5e1", fontSize: 15, lineHeight: 22 }, error: { color: "#f3aa91", fontSize: 14, lineHeight: 20 }, primary: { minHeight: 52, backgroundColor: "#4d5bcb", borderRadius: 17, padding: 15, alignItems: "center", justifyContent: "center" }, primaryText: { color: palette.text, fontFamily: "Outfit-SemiBold", fontSize: 16 }, link: { minHeight: 44, alignItems: "center", justifyContent: "center" }, linkText: { color: "#c7ceff", fontSize: 14 } })

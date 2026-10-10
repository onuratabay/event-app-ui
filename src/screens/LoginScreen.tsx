import { palette } from "../theme/palette";
import { gatedScreen } from "../native/access"
import { useEffect, useRef, useState } from "react"
import { AccessibilityInfo, Animated, Easing, ScrollView, StyleSheet } from "react-native"
import TopNavBar from "../components/TopNavBar"
import { AtmoBackground } from "../components/GlassUI"
import { ErrorNotice } from "../components/ErrorNotice"
import { Field, Label, Touch, Box } from "../native/UI"
import { getApiErrorMessage, login } from "../api/client"
import { useSignedOutEntry } from "../native/session"
import { updateStoreUser, useStore } from "../native/Store"
import type { NavigateFn } from "../types"
import { ui } from "../theme/styles"

export default function LoginScreen({ navigate }: { navigate: NavigateFn }) {
  const { refreshEvents, setData } = useStore()
  const checkingSession = useSignedOutEntry(navigate)
  const entrance = useRef(new Animated.Value(1)).current
  useEffect(() => {
    let active = true
    void AccessibilityInfo.isReduceMotionEnabled().then(reduceMotion => {
      if (!active || reduceMotion) return
      entrance.setValue(0)
      Animated.timing(entrance, { toValue: 1, duration: 420,
        easing: Easing.out(Easing.cubic), useNativeDriver: true }).start()
    }).catch(() => {})
    return () => { active = false; entrance.stopAnimation() }
  }, [entrance])
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [busy, setBusy] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const submit = async () => {
    if (!email.trim() || !password) {
      setErrorMessage("E-posta ve şifre gerekli.")
      return
    }
    setErrorMessage(null)
    setBusy(true)
    try {
      const response = await login(email.trim(), password)
      setData(current => ({ ...current, user: updateStoreUser(current.user, response.user), onboarding: {} }))
      // Pending accounts go to their own page and never load the in-app feed.
      const target = gatedScreen((response.user as { status?: { enum: string } }).status?.enum)
      if (target) { navigate(target, { reset: true }); return }
      void refreshEvents().catch(() => {})
      navigate("discover", { reset: true })
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, "Bilgilerini kontrol edip tekrar dene."))
    } finally {
      setBusy(false)
    }
  }

  if (checkingSession) return null
  return (
    <Box style={{ flex: 1, backgroundColor: palette.background }}>
      <AtmoBackground variant="violet" />
      <TopNavBar navigate={navigate} fallback="welcome" title="Giriş" />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.page}
        keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive"
        automaticallyAdjustKeyboardInsets showsVerticalScrollIndicator={false}>
      <Animated.View style={[styles.form, { opacity: entrance, transform: [{ translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] }]}> 
        <Box style={styles.heading}>
        <Label style={styles.eyebrow}>TOPLULUĞA GİRİŞ</Label>
        <Label style={styles.heroTitle}>Tekrar hoş geldin.</Label>
        <Label style={[[ui.textWhite50, ui.leadingRelaxed]]}>Hesabınla devam et.</Label>
        </Box>
        {errorMessage && (
          <ErrorNotice
            title="Giriş yapılamadı"
            message={errorMessage}
            onDismiss={() => setErrorMessage(null)}
            onRetry={submit}
          />
        )}
        <Label style={styles.fieldLabel}>E-posta</Label>
        <Field
          mode="email"
          value={email}
          onChangeText={setEmail}
          placeholder="ornek@eposta.com"
          accessibilityLabel="E-posta"
          autoComplete="email"
          style={styles.input}
        />
        <Label style={styles.fieldLabel}>Şifre</Label>
        <Field
          value={password}
          onChangeText={setPassword}
          placeholder="Şifreni gir"
          accessibilityLabel="Şifre"
          autoComplete="current-password"
          onSubmitEditing={() => void submit()}
          returnKeyType="go"
          secureTextEntry
          style={styles.input}
        />
        <Touch accessibilityLabel="Şifremi unuttum" onPress={() => navigate("forgot-password")} style={{ alignSelf: "flex-end", minHeight: 44, justifyContent: "center", paddingHorizontal: 8 }}><Label style={{ color: "#c7ceff", fontFamily: "Outfit-Medium", fontSize: 14 }}>Şifremi unuttum</Label></Touch>
        <Touch
          onPress={submit}
          disabled={busy}
          style={[[ui.p4, ui.rounded2xl, ui.textCenter, ui.fontSemibold, { color: palette.text, marginTop: 16, minHeight: 54, justifyContent: "center" }]]}
          gradient={palette.actionGradient}
        >
          {busy ? "Bağlanıyor..." : "Giriş Yap"}
        </Touch>
        <Touch
          onPress={() => { setErrorMessage(null); navigate("discover") }}
          disabled={busy}
          accessibilityRole="button"
          style={styles.demoButton}
        >
          Demo olarak devam et
        </Touch>
        <Label style={styles.demoHint}>Örnek verilerle uygulamayı keşfet.</Label>
        <Touch onPress={() => navigate("welcome")} style={[[ui.p3, ui.textCenter, ui.textWhite50]]}>
          Vazgeç
        </Touch>
      </Animated.View>
      </ScrollView>
    </Box>
  )
}
const styles = StyleSheet.create({
  demoButton: { minHeight: 50, padding: 14, borderRadius: 16, borderWidth: 1, borderColor: "rgba(105,120,255,0.25)", backgroundColor: "rgba(105,120,255,0.05)", color: "#927dff", textAlign: "center", justifyContent: "center", fontFamily: "Outfit-Medium" },
  demoHint: { color: "#89838a", fontSize: 11, textAlign: "center" },
  page: { flexGrow: 1, justifyContent: "center", paddingHorizontal: 28, paddingTop: 88, paddingBottom: 36 },
  form: { width: "100%", maxWidth: 440, alignSelf: "center", gap: 10 },
  heading: { gap: 12, marginBottom: 28 },
  heroTitle: { color: palette.text, fontFamily: "Fraunces", fontSize: 36, lineHeight: 45, letterSpacing: -0.7, paddingVertical: 2 },
  eyebrow: { color: palette.accent, fontSize: 11, letterSpacing: 4, fontFamily: "Outfit-Medium", marginBottom: 8 },
  fieldLabel: { color: "#b6b0ae", fontSize: 12, fontFamily: "Outfit-Medium", marginTop: 6, marginLeft: 4 },
  input: { minHeight: 56, paddingHorizontal: 18, paddingVertical: 16, borderRadius: 16, borderWidth: 1, borderColor: "rgba(105,120,255,0.18)", backgroundColor: "rgba(255,255,255,0.045)", color: "#f4f5ff", fontSize: 15 },
})

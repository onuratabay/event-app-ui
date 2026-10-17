import { palette } from "../theme/palette";
import { gatedScreen } from "../native/access"
import { useEffect, useRef, useState } from "react"
import { AccessibilityInfo, Animated, Easing, ScrollView, StyleSheet } from "react-native"
import TopNavBar from "../components/TopNavBar"
import { AtmoBackground } from "../components/GlassUI"
import { ErrorNotice } from "../components/ErrorNotice"
import { EyeIcon, EyeOffIcon } from "../components/Icons"
import { Field, Label, Touch, Box } from "../native/UI"
import { formatPhone, phoneDigits, PHONE_PREFIX } from "../content/phone"
import { getApiErrorMessage, login } from "../api/client"
import { useSignedOutEntry } from "../native/session"
import { updateStoreUser, useStore } from "../native/Store"
import type { NavigateFn } from "../types"
import { ui } from "../theme/styles"

export default function LoginScreen({ navigate }: { navigate: NavigateFn }) {
  const { refreshEvents, setData, whenReady } = useStore()
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
  // Members sign in with their phone number and password.
  const [phone, setPhone] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const submit = async () => {
    if (phoneDigits(phone).length !== 10 || !password) {
      setErrorMessage("Telefon numaranı ve şifreni gir.")
      return
    }
    setErrorMessage(null)
    setBusy(true)
    try {
      const response = await login(`+90${phoneDigits(phone)}`, password)
      setData(current => ({ ...current, user: updateStoreUser(current.user, response.user), onboarding: {} }))
      // Pending accounts go to their own page and never load the in-app feed.
      const target = gatedScreen((response.user as { status?: { enum: string } }).status?.enum, response.user as { instagramUsername?: string | null })
      if (target) { navigate(target, { reset: true }); return }
      // The button keeps its busy state while the feed loads (at most 4 s), so Discover opens filled.
      void refreshEvents().catch(() => {})
      await whenReady(4000)
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
        <Label style={styles.fieldLabel}>Telefon</Label>
        <Field
          mode="tel"
          value={phone}
          onChangeText={value => setPhone(formatPhone(value))}
          onFocus={() => { if (!phone) setPhone(PHONE_PREFIX) }}
          placeholder="+90 5XX XXX XX XX"
          accessibilityLabel="Telefon"
          keyboardType="phone-pad"
          textContentType="telephoneNumber"
          autoComplete="tel"
          maxLength={17}
          style={styles.input}
        />
        <Label style={styles.fieldLabel}>Şifre</Label>
        <Box style={styles.passwordWrap}>
          <Field
            value={password}
            onChangeText={setPassword}
            placeholder="Şifreni gir"
            accessibilityLabel="Şifre"
            autoComplete="current-password"
            autoCapitalize="none"
            autoCorrect={false}
            onSubmitEditing={() => void submit()}
            returnKeyType="go"
            secureTextEntry={!showPassword}
            style={[styles.input, styles.passwordInput]}
          />
          <Touch
            accessibilityLabel={showPassword ? "Şifreyi gizle" : "Şifreyi göster"}
            onPress={() => setShowPassword(value => !value)}
            style={styles.passwordToggle}
          >
            {showPassword ? <EyeOffIcon style={styles.passwordIcon} /> : <EyeIcon style={styles.passwordIcon} />}
          </Touch>
        </Box>
        <Touch accessibilityLabel="Şifremi unuttum" onPress={() => navigate("forgot-password")} style={{ alignSelf: "flex-end", minHeight: 44, justifyContent: "center", paddingHorizontal: 8 }}><Label style={{ color: "#c7ceff", fontFamily: "Outfit-Medium", fontSize: 14 }}>Şifremi unuttum</Label></Touch>
        <Touch
          onPress={submit}
          disabled={busy}
          style={[[ui.p4, ui.rounded2xl, ui.textCenter, ui.fontSemibold, { color: palette.text, marginTop: 16, minHeight: 54, justifyContent: "center" }]]}
          gradient={palette.actionGradient}
        >
          {busy ? "Bağlanıyor..." : "Giriş Yap"}
        </Touch>
        <Touch onPress={() => navigate("welcome")} style={[[ui.p3, ui.textCenter, ui.textWhite50]]}>
          Vazgeç
        </Touch>
      </Animated.View>
      </ScrollView>
    </Box>
  )
}
const styles = StyleSheet.create({
  page: { flexGrow: 1, justifyContent: "center", paddingHorizontal: 28, paddingTop: 88, paddingBottom: 36 },
  form: { width: "100%", maxWidth: 440, alignSelf: "center", gap: 10 },
  heading: { gap: 12, marginBottom: 28 },
  heroTitle: { color: palette.text, fontFamily: "Fraunces", fontSize: 36, lineHeight: 45, letterSpacing: -0.7, paddingVertical: 2 },
  eyebrow: { color: palette.accent, fontSize: 11, letterSpacing: 4, fontFamily: "Outfit-Medium", marginBottom: 8 },
  fieldLabel: { color: "#b6b0ae", fontSize: 12, fontFamily: "Outfit-Medium", marginTop: 6, marginLeft: 4 },
  passwordWrap: { position: "relative", justifyContent: "center" },
  passwordInput: { paddingRight: 56 },
  passwordToggle: { position: "absolute", right: 4, top: 0, bottom: 0, width: 48, alignItems: "center", justifyContent: "center" },
  passwordIcon: { color: "#c7ceff" },
  input: { minHeight: 56, paddingHorizontal: 18, paddingVertical: 16, borderRadius: 16, borderWidth: 1, borderColor: "rgba(105,120,255,0.18)", backgroundColor: "rgba(255,255,255,0.045)", color: "#f4f5ff", fontSize: 15 },
})

import { palette } from "../theme/palette";
import { gatedScreen } from "../native/access"
import { useEffect, useRef, useState } from "react"
import { AccessibilityInfo, Platform, Animated, Easing, StyleSheet } from "react-native"
import TopNavBar from "../components/TopNavBar"
import { AtmoBackground } from "../components/GlassUI"
import { GlassFill, INPUT_FROST } from "../components/GlassFill"
import { ErrorNotice } from "../components/ErrorNotice"
import { EyeIcon, EyeOffIcon } from "../components/Icons"
import { Field, Label, Touch, Box, Scroll } from "../native/UI"
import { formatLocalPhone, PHONE_COUNTRY_CODE, phoneDigits } from "../content/phone"
import { getApiErrorMessage, login } from "../api/client"
import { useSignedOutEntry } from "../native/session"
import { updateStoreUser, useStore } from "../native/Store"
import { useOptionalGuest } from "../guest/GuestSession"
import { parseGuestCode } from "../guest/links"
import { useRouter, type Href } from "expo-router"
import type { NavigateFn } from "../types"
import { ui } from "../theme/styles"

/** An Ewent invite (EWT-… code or its link) opens that event as a guest, without an account. */
function GuestInviteField() {
  const guest = useOptionalGuest()
  const router = useRouter()
  const [input, setInput] = useState("")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const open = async () => {
    const code = parseGuestCode(input)
    if (!code) { setError("Geçerli bir Ewent davet kodu veya bağlantısı gir.") ; return }
    if (!guest || busy) return
    setBusy(true); setError("")
    try { await guest.enter(code); router.replace({ pathname: "/guest-event", params: { code } } as Href) }
    catch { setError("Davet açılamadı. Tekrar dene.") }
    finally { setBusy(false) }
  }
  const filled = !!input.trim()
  const [shown, setShown] = useState(false)
  // A secondary path: one quiet button until it is needed, then the code field in its place.
  if (!shown) return <Touch accessibilityLabel="Ewent davet kodum var" onPress={() => setShown(true)} glass style={styles.inviteToggle}>
    <Label style={styles.inviteToggleText}>Ewent davet kodum var</Label>
  </Touch>
  return <Box>
    <Box style={styles.phoneRow}>
      <Box style={[styles.inputFrame, { flex: 1 }]}>
        <GlassFill radius={16} {...INPUT_FROST} />
        <Field value={input} onChangeText={text => { setInput(text); setError("") }} placeholder="Etkinlik davet kodunu gir" accessibilityLabel="Ewent davet kodu"
          autoFocus autoCapitalize="none" autoCorrect={false} returnKeyType="go" onSubmitEditing={() => void open()} style={styles.input} />
      </Box>
      <Touch accessibilityLabel="Daveti aç" disabled={busy || !filled} disabledOpacity={0.7} onPress={() => void open()} glass
        style={[styles.inviteButton, filled && styles.inviteButtonOn]}>{busy ? "…" : "Aç"}</Touch>
    </Box>
    {error ? <Label accessibilityRole="alert" style={styles.inviteError}>{error}</Label> : null}
  </Box>
}

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
      {/* The shared Scroll keeps the focused field above the keyboard and links phone → password. */}
      <Scroll style={styles.page} keyboardDismissMode="interactive">
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
        {/* Two boxes: the fixed country code, then the number. */}
        <Box style={styles.phoneRow}>
          <Box accessibilityLabel="Ülke kodu +90" style={[styles.inputFrame, styles.countryCode]}>
            <GlassFill radius={16} {...INPUT_FROST} />
            <Box style={styles.countryCodeInner}><Label style={styles.countryCodeText}>{PHONE_COUNTRY_CODE}</Label></Box>
          </Box>
          <Box style={[styles.inputFrame, { flex: 1 }]}>
            <GlassFill radius={16} {...INPUT_FROST} />
            <Field
              mode="tel"
              value={phone}
              onChangeText={value => setPhone(formatLocalPhone(value))}
              placeholder="5XX XXX XX XX"
              accessibilityLabel="Telefon numarası"
              keyboardType="phone-pad"
              textContentType={Platform.OS === "ios" ? "username" : undefined}
              autoComplete={Platform.OS === "android" ? "username" : undefined}
              importantForAutofill="yes"
              keyboardAppearance="dark"
              maxLength={13}
              style={styles.input}
            />
          </Box>
        </Box>
        <Label style={styles.fieldLabel}>Şifre</Label>
        <Box style={styles.passwordWrap}>
          <GlassFill radius={16} {...INPUT_FROST} />
          <Field
            value={password}
            onChangeText={setPassword}
            placeholder="Şifreni gir"
            accessibilityLabel="Şifre"
            textContentType={Platform.OS === "ios" ? "password" : undefined}
            autoComplete={Platform.OS === "android" ? "current-password" : undefined}
            importantForAutofill="yes"
            keyboardAppearance="dark"
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
        <Touch accessibilityLabel="Şifremi unuttum" onPress={() => navigate("forgot-password")} style={{ alignSelf: "flex-end", minHeight: 40, justifyContent: "center", paddingHorizontal: 8, marginTop: -4 }}><Label style={{ color: "#c7ceff", fontFamily: "Outfit-Medium", fontSize: 14 }}>Şifremi unuttum</Label></Touch>
        {/* The sign-in form ends with its action; other ways in follow below "veya". */}
        <Touch
          onPress={submit}
          disabled={busy}
          style={[[ui.p4, ui.rounded2xl, ui.textCenter, ui.fontSemibold, { color: palette.text, marginTop: 4, minHeight: 54, justifyContent: "center" }]]}
          gradient={palette.actionGradient}
        >
          {busy ? "Bağlanıyor..." : "Giriş Yap"}
        </Touch>
        <Box style={styles.divider}>
          <Box style={styles.dividerLine} />
          <Label style={styles.dividerText}>veya</Label>
          <Box style={styles.dividerLine} />
        </Box>
        <GuestInviteField />
        <Touch onPress={() => navigate("welcome")} style={[[ui.p3, ui.textCenter, ui.textWhite50]]}>
          Vazgeç
        </Touch>
      </Animated.View>
      </Scroll>
    </Box>
  )
}
const styles = StyleSheet.create({
  page: { flexGrow: 1, justifyContent: "center", paddingHorizontal: 28, paddingTop: 88, paddingBottom: 36 },
  form: { width: "100%", maxWidth: 440, alignSelf: "center", gap: 10 },
  heading: { gap: 12, marginBottom: 20 },
  heroTitle: { color: palette.text, fontFamily: "Fraunces", fontSize: 36, lineHeight: 45, letterSpacing: -0.7, paddingVertical: 2 },
  eyebrow: { color: palette.accent, fontSize: 11, letterSpacing: 4, fontFamily: "Outfit-Medium", marginBottom: 8 },
  fieldLabel: { color: "#b6b0ae", fontSize: 12, fontFamily: "Outfit-Medium", marginTop: 6, marginLeft: 4 },
  passwordWrap: { position: "relative", justifyContent: "center", borderRadius: 16 },
  passwordInput: { paddingRight: 56 },
  passwordToggle: { position: "absolute", right: 4, top: 0, bottom: 0, width: 48, alignItems: "center", justifyContent: "center" },
  passwordIcon: { color: "#c7ceff" },
  input: { minHeight: 56, paddingHorizontal: 18, paddingVertical: 16, borderRadius: 16, borderWidth: 1, borderColor: palette.glassBorder, backgroundColor: "transparent", color: "#f4f5ff", fontSize: 15 },
  inputFrame: { borderRadius: 16 },
  phoneRow: { flexDirection: "row", gap: 8 },
  countryCode: { width: 72 },
  countryCodeInner: { flex: 1, minHeight: 56, alignItems: "center", justifyContent: "center", borderRadius: 16, borderWidth: 1, borderColor: palette.glassBorder },
  divider: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 6 },
  dividerLine: { flex: 1, height: 1, backgroundColor: palette.glassBorder },
  dividerText: { color: "rgba(241,245,249,.4)", fontSize: 12 },
  inviteButton: { minHeight: 56, paddingHorizontal: 20, borderRadius: 16, borderWidth: 1, borderColor: palette.glassBorder, backgroundColor: palette.glass, justifyContent: "center", color: palette.text, fontFamily: "Outfit-SemiBold", fontSize: 15 },
  inviteButtonOn: { borderColor: "rgba(105,120,255,.55)", backgroundColor: palette.selected, color: palette.accent },
  inviteToggle: { minHeight: 52, borderRadius: 16, borderWidth: 1, borderColor: palette.glassBorder, backgroundColor: palette.glass, alignItems: "center", justifyContent: "center" },
  inviteToggleText: { color: palette.text, fontFamily: "Outfit-Medium", fontSize: 15 },
  inviteError: { color: palette.error, fontSize: 12, marginTop: 6, marginLeft: 4 },
  countryCodeText: { color: "#f4f5ff", fontSize: 15, fontFamily: "Outfit-Medium" },
})

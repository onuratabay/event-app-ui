import { useWalkthroughScreenBlocker } from "../walkthrough/activity"
import { showAlert } from "../components/AppDialog"
import { walkthroughFlags } from "../walkthrough/config"
import { useEffect, useState, type ReactNode } from "react"
import { Linking, StyleSheet, Switch } from "react-native"
import Constants from "expo-constants"
import { Box, Field, Label, Scroll, Touch, openExternal, Reveal } from "../native/UI"
import { EyeIcon, EyeOffIcon } from "../components/Icons"
import { DEFAULT_PREFERENCES, usePreferences, type AppPreferences } from "../native/preferences"
import { useStore } from "../native/Store"
import { changePassword, deleteAccount, getApiErrorMessage, getLegalConsents, getPreferences, logout, putPreference, setMarketingConsent, type NotificationPreferences } from "../api/client"
import { LEGAL_TITLES, useOpenLegal } from "../legal/links"
import TopNavBar from "../components/TopNavBar"
import { AtmoBackground } from "../components/GlassUI"
import { BRAND_NAME, BRAND_SITE, BRAND_URL } from "../components/Brand"
import { palette } from "../theme/palette"
import { ui } from "../theme/styles"
import type { NavigateFn } from "../types"
import { PASSWORD_ERROR, PASSWORD_RULES, isStrongPassword, passwordRules } from "../content/password"

const DEFAULT_NOTIFICATIONS: Required<NotificationPreferences> = { invites: true, messages: true, reminders: true }

function Section({ title, children }: { title: string; children: ReactNode }) {
  return <Box style={s.section}><Label accessibilityRole="header" style={s.sectionTitle}>{title}</Label><Box style={s.card}>{children}</Box></Box>
}
function Row({ title, detail, onPress, danger = false, open }: { title: string; detail: string; onPress?: () => void; danger?: boolean; open?: boolean }) {
  const content = <><Box style={s.copy}><Label style={[s.title, danger && s.danger]}>{title}</Label><Label style={s.detail}>{detail}</Label></Box>{onPress && <Label style={s.chevron}>{open === undefined ? "›" : open ? "▴" : "▾"}</Label>}</>
  return onPress ? <Touch accessibilityLabel={title} onPress={onPress} style={s.row}>{content}</Touch> : <Box style={s.row}>{content}</Box>
}
function Toggle({ title, detail, value, disabled, onChange }: { title: string; detail: string; value: boolean; disabled?: boolean; onChange: (value: boolean) => void }) {
  return <Box style={s.row}>
    <Box style={s.copy}><Label style={s.title}>{title}</Label><Label style={s.detail}>{detail}</Label></Box>
    <Switch accessibilityLabel={title} value={value} disabled={disabled} onValueChange={onChange}
      trackColor={{ false: palette.elevated, true: palette.violet }} thumbColor="#ffffff" ios_backgroundColor={palette.elevated} />
  </Box>
}
/** A password input with the same show / hide eye as the sign-in and sign-up forms. */
function Password({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const [visible, setVisible] = useState(false)
  return <Box style={s.passwordWrap}>
    <Field accessibilityLabel={label} placeholder={label} placeholderTextColor={palette.muted} value={value} onChangeText={onChange}
      secureTextEntry={!visible} autoCapitalize="none" autoCorrect={false} style={[s.input, s.passwordInput]} />
    <Touch accessibilityLabel={visible ? "Şifreyi gizle" : "Şifreyi göster"} onPress={() => setVisible(current => !current)} style={s.passwordToggle}>
      {visible ? <EyeOffIcon style={s.passwordIcon} /> : <EyeIcon style={s.passwordIcon} />}
    </Touch>
  </Box>
}

export default function SettingsScreen({ navigate }: { navigate: NavigateFn }) {
  const { values, ready, update } = usePreferences()
  const { data, resetSession } = useStore()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Errors of the password form show inside its panel, not at the top of the page.
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [notifications, setNotifications] = useState(DEFAULT_NOTIFICATIONS)
  const [notificationsReady, setNotificationsReady] = useState(false)
  const [passwordOpen, setPasswordOpen] = useState(false)
  const [oldPassword, setOldPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [repeatPassword, setRepeatPassword] = useState("")
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deletePassword, setDeletePassword] = useState("")
  const openLegal = useOpenLegal()
  const [marketing, setMarketing] = useState(false)
  const [marketingReady, setMarketingReady] = useState(false)
  useWalkthroughScreenBlocker(busy || passwordOpen || deleteOpen)

  useEffect(() => {
    let active = true
    getPreferences()
      .then(result => { if (active) setNotifications({ ...DEFAULT_NOTIFICATIONS, ...result.notifications }) })
      .catch(() => {})
      .finally(() => { if (active) setNotificationsReady(true) })
    getLegalConsents()
      .then(result => { if (active) { setMarketing(result.marketing); setMarketingReady(true) } })
      .catch(() => {})
    return () => { active = false }
  }, [])

  const savePreference = async (patch: Partial<AppPreferences>) => {
    if (!ready) return
    setError(null)
    try { await update(patch) } catch { setError("Tercihin kaydedilemedi. Lütfen tekrar dene.") }
  }
  const saveNotification = async (key: keyof NotificationPreferences, value: boolean) => {
    const previous = notifications
    const next = { ...notifications, [key]: value }
    setNotifications(next); setError(null)
    try { await putPreference("notifications", next) } catch (e) { setNotifications(previous); setError(getApiErrorMessage(e, "Bildirim tercihin kaydedilemedi.")) }
  }
  const saveMarketing = async (value: boolean) => {
    setMarketing(value); setError(null)
    try { setMarketing((await setMarketingConsent(value)).marketing) } catch (e) { setMarketing(!value); setError(getApiErrorMessage(e, "İzin tercihin kaydedilemedi.")) }
  }
  const openSystemSettings = () => { void Linking.openSettings().catch(() => showAlert("Ayarlar açılamadı", `Telefonunun Ayarlar uygulamasından ${BRAND_NAME}’i seçebilirsin.`)) }
  const endSession = async (target: "welcome" | "login") => {
    await logout()
    resetSession()
    navigate(target, { reset: true })
  }
  // The update button stays off until every check the app can make itself has passed.
  const passwordReady = !!oldPassword && isStrongPassword(newPassword) && newPassword === repeatPassword
  const submitPassword = async () => {
    if (busy) return
    if (!oldPassword || !newPassword) { setPasswordError("Mevcut ve yeni şifreni gir."); return }
    if (!isStrongPassword(newPassword)) { setPasswordError(PASSWORD_ERROR); return }
    if (newPassword !== repeatPassword) { setPasswordError("Şifreler uyuşmuyor."); return }
    setBusy(true); setPasswordError(null)
    try {
      await changePassword(oldPassword, newPassword)
      setOldPassword(""); setNewPassword(""); setRepeatPassword(""); setPasswordOpen(false)
      // This device stays signed in with fresh tokens; other devices are signed out by the server.
      showAlert("Şifren güncellendi", "Şifren başarıyla değiştirildi.")
    } catch (e) { setPasswordError(getApiErrorMessage(e, "Şifre değiştirilemedi.")) }
    finally { setBusy(false) }
  }
  const submitDelete = () => {
    if (busy) return
    if (!deletePassword) { setError("Hesabını silmek için şifreni gir."); return }
    showAlert("Hesabın kalıcı olarak silinsin mi?", "Profilin, etkinliklerin, katılımların ve mesajların silinir. Bu işlem geri alınamaz.", [
      { text: "Vazgeç", style: "cancel" },
      { text: "Hesabımı sil", style: "destructive", onPress: () => {
        setBusy(true); setError(null)
        void deleteAccount(deletePassword)
          .then(() => endSession("welcome"))
          .then(() => showAlert("Hesabın silindi", "Seni tekrar görmek isteriz."))
          .catch(e => { setError(getApiErrorMessage(e, "Hesap silinemedi.")); setBusy(false) })
      } },
    ])
  }

  return <Box style={[[ui.fixed, ui.inset0, ui.bg06060e, ui.overflowHidden]]}>
    <AtmoBackground variant="violet" />
    <TopNavBar navigate={navigate} fallback="profile" backLabel="Geri" title="Ayarlar" />
    <Scroll style={s.page}>
      {error && <Label accessibilityRole="alert" style={s.error}>{error}</Label>}


      <Section title="Hesap">
        <Row title="Şifremi değiştir" detail="Mevcut şifreni doğrulayarak yeni bir şifre belirle" open={passwordOpen} onPress={() => { setPasswordOpen(!passwordOpen); setPasswordError(null) }} />
        {passwordOpen && <Reveal><Box style={s.form}>
          <Password label="Mevcut şifre" value={oldPassword} onChange={value => { setOldPassword(value); setPasswordError(null) }} />
          <Password label="Yeni şifre" value={newPassword} onChange={value => { setNewPassword(value); setPasswordError(null) }} />
          <Password label="Yeni şifre tekrar" value={repeatPassword} onChange={value => { setRepeatPassword(value); setPasswordError(null) }} />
          <Box style={s.rules} accessibilityLiveRegion="polite">
            {PASSWORD_RULES.map(([key, text]) => { const ok = passwordRules(newPassword)[key]; return <Label key={key} style={[s.rule, { color: ok ? palette.success : "#9aa3cf" }]}>{`${ok ? "✓" : "○"} ${text}`}</Label> })}
          </Box>
          {!!repeatPassword && repeatPassword !== newPassword && <Label accessibilityLiveRegion="polite" style={s.formError}>Şifreler uyuşmuyor</Label>}
          {passwordError && <Label accessibilityRole="alert" style={s.formError}>{passwordError}</Label>}
          <Touch disabled={busy || !passwordReady} accessibilityState={{ disabled: busy || !passwordReady }} onPress={() => void submitPassword()} style={[s.primary, !passwordReady && s.primaryDisabled]}><Label style={s.primaryLabel}>{busy ? "Kaydediliyor…" : "Şifreyi güncelle"}</Label></Touch>
        </Box></Reveal>}
      </Section>

      <Box walkthroughId="settings-notifications"><Section title="Bildirimler">
        <Toggle title="Etkinlik davetleri" detail="Biri seni bir etkinliğe davet ettiğinde" value={notifications.invites} disabled={!notificationsReady} onChange={v => void saveNotification("invites", v)} />
        <Toggle title="Yeni mesajlar" detail="Etkinlik odalarındaki ve bire bir sohbetlerdeki mesajlar" value={notifications.messages} disabled={!notificationsReady} onChange={v => void saveNotification("messages", v)} />
        <Toggle title="Etkinlik hatırlatmaları" detail="Katılacağın etkinlik yaklaştığında" value={notifications.reminders} disabled={!notificationsReady} onChange={v => void saveNotification("reminders", v)} />
        <Row title="Telefon bildirim izinleri" detail="Sistem bildirim iznini telefon ayarlarından yönet" onPress={openSystemSettings} />
      </Section>

      </Box>
      <Section title="Görünüm ve etkileşim">
        <Toggle title="Dokunsal geri bildirim" detail="Butonlara dokunduğunda hafif titreşim" value={values.haptics} disabled={!ready} onChange={v => void savePreference({ haptics: v })} />
        <Box style={[s.row, s.stepsRow]}>
          <Box style={s.copy}><Label style={s.title}>Arka plan objelerini azalt</Label><Label style={s.detail}>Arka plandaki şekiller ve ışıltı kademe kademe soluklaşır, yazılar daha kolay okunur</Label></Box>
          <Box accessibilityRole="radiogroup" style={s.steps}>
            {[0, 1, 2, 3, 4, 5].map(level => {
              const selected = values.backgroundDim === level
              return <Touch key={level} accessibilityRole="radio" accessibilityState={{ selected, disabled: !ready }} accessibilityLabel={level ? `Arka plan azaltma ${level}. kademe` : "Arka plan azaltma kapalı"}
                disabled={!ready} onPress={() => void savePreference({ backgroundDim: level })} style={[s.step, selected && s.stepSelected]}>
                <Label style={[s.stepLabel, selected && s.stepLabelSelected]}>{level ? String(level) : "Kapalı"}</Label>
              </Touch>
            })}
          </Box>
        </Box>
        <Toggle title="Saydamlığı azalt" detail="Cam ve bulanıklık efektleri yerine düz zeminler kullan" value={values.reduceTransparency} disabled={!ready} onChange={v => void savePreference({ reduceTransparency: v })} />
        <Row title="Tema" detail="Gece mavisi · Bu sürümde koyu tema kullanılıyor" />
        <Row title="Dil" detail="Türkçe · Diğer diller henüz desteklenmiyor" />
        <Row title="Metin boyutu" detail="Bu sürümde yazı boyutu sabittir." />
      </Section>

      <Box walkthroughId="settings-privacy"><Section title="Gizlilik ve izinler">
        <Toggle title="Kampanya ve duyurular" detail="E-posta ve SMS ile ticari ileti izni · İstediğin zaman geri çekebilirsin" value={marketing} disabled={!marketingReady} onChange={v => void saveMarketing(v)} />
        <Row title="Konum erişimi" detail="Yakındaki etkinlikler ve harita için" onPress={openSystemSettings} />
        <Row title="Kamera ve fotoğraflar" detail="Profil ve etkinlik görselleri için" onPress={openSystemSettings} />
        <Row title="Kişiler" detail="Referans seçimi için rehber erişimi" onPress={openSystemSettings} />
      </Section>

      </Box>
      <Section title="Sözleşmeler ve politikalar">
        <Row title={LEGAL_TITLES.terms} detail="Üyelik, etkinlikler ve sorumluluklar" onPress={() => openLegal("terms")} />
        <Row title={LEGAL_TITLES.community} detail="Üyelik onayı, etkinlik oluşturma ve davranış kuralları" onPress={() => openLegal("community")} />
        <Row title={LEGAL_TITLES.privacy} detail="Hangi verileri neden işlediğimiz ve kimin gördüğü" onPress={() => openLegal("privacy")} />
        <Row title={LEGAL_TITLES.kvkk} detail="Kişisel verilerin korunması ve başvuru hakların" onPress={() => openLegal("kvkk")} />
        <Row title={LEGAL_TITLES.marketing} detail="Kampanya ve duyuru izninin metni" onPress={() => openLegal("marketing")} />
      </Section>

      {/* Hidden while the walkthrough is switched off (walkthroughFlags). */}
      {walkthroughFlags.enabled && <Box walkthroughId="settings-guide"><Section title="Uygulama Rehberi">
        <Row title="Uygulama Rehberi" detail="Her ekranı kendi hızında keşfet; istediğin rehberi yeniden aç" onPress={() => navigate("app-guide")} />
      </Section></Box>}

      <Section title="Yardım ve hakkında">
        <Row title="Web sitesi" detail={BRAND_SITE} onPress={() => void openExternal(BRAND_URL)} />
        <Row title="Uygulama sürümü" detail={`${BRAND_NAME} · ${Constants.expoConfig?.version || "1.0.0"}`} />
      </Section>

      <Section title="Oturum">
        <Row title="Cihaz tercihlerini sıfırla" detail="Titreşimi açar, saydamlığı azalt seçeneğini kapatır" onPress={() => {
          if (!ready) return
          showAlert("Tercihler sıfırlansın mı?", "Hesabın, fotoğrafların ve etkinliklerin silinmez.", [{ text: "Vazgeç", style: "cancel" }, { text: "Sıfırla", onPress: () => void savePreference(DEFAULT_PREFERENCES) }])
        }} />
      </Section>

      <Section title="Hesabı sil">
        <Row title="Hesabımı sil" detail="Hesabını ve ilişkili tüm verilerini kalıcı olarak kaldır" danger open={deleteOpen} onPress={() => { setDeleteOpen(!deleteOpen); setError(null) }} />
        {deleteOpen && <Reveal><Box style={s.form}>
          <Label style={s.detail}>Profilin, oluşturduğun etkinlikler, katılımların ve mesajların silinir. Bu işlem geri alınamaz.</Label>
          <Password label="Şifreni gir" value={deletePassword} onChange={setDeletePassword} />
          <Touch disabled={busy} onPress={submitDelete} style={s.destructive}><Label style={s.destructiveLabel}>{busy ? "Siliniyor…" : "Hesabımı kalıcı olarak sil"}</Label></Touch>
        </Box></Reveal>}
      </Section>
    </Scroll>
  </Box>
}
const s = StyleSheet.create({
  page: { paddingTop: 80, paddingHorizontal: 20, paddingBottom: 120 },
  section: { marginTop: 20, gap: 10 }, sectionTitle: { fontSize: 13, fontFamily: "Outfit-SemiBold", color: palette.accent },
  card: { borderRadius: 20, backgroundColor: "rgba(17,22,42,.9)", borderWidth: 1, borderColor: palette.border, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16, minHeight: 72, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.border },
  copy: { flex: 1, minWidth: 0, gap: 5 }, title: { color: palette.text, fontFamily: "Outfit-Medium", fontSize: 15 },
  detail: { color: palette.muted, fontSize: 12, lineHeight: 18 }, chevron: { color: palette.accent, fontSize: 20 },
  stepsRow: { flexDirection: "column", alignItems: "stretch" },
  steps: { flexDirection: "row", gap: 6 },
  step: { flex: 1, minHeight: 36, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: palette.elevated, borderWidth: 1, borderColor: palette.border },
  stepSelected: { backgroundColor: palette.selected, borderColor: palette.accent },
  stepLabel: { color: palette.muted, fontSize: 13, fontFamily: "Outfit-Medium" },
  stepLabelSelected: { color: palette.text },
  danger: { color: palette.error }, error: { color: palette.error, fontSize: 13, lineHeight: 19, marginTop: 12 },
  rules: { flexDirection: "row", flexWrap: "wrap", columnGap: 14, rowGap: 4, marginTop: -2, marginBottom: 2 },
  rule: { fontSize: 12, lineHeight: 17 },
  formError: { color: palette.error, fontSize: 13, lineHeight: 19 },
  form: { gap: 10, padding: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.border },
  passwordWrap: { position: "relative", justifyContent: "center" },
  passwordInput: { paddingRight: 52 },
  passwordToggle: { position: "absolute", right: 2, top: 0, bottom: 0, width: 48, alignItems: "center", justifyContent: "center" },
  passwordIcon: { color: "#c7ceff" },
  input: { minHeight: 48, borderRadius: 14, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.background, paddingHorizontal: 14, color: palette.text, fontSize: 15 },
  primaryDisabled: { opacity: .45 },
  primary: { minHeight: 48, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "#4d5bcb" },
  primaryLabel: { color: palette.text, fontFamily: "Outfit-SemiBold", fontSize: 15 },
  destructive: { minHeight: 48, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(243,155,175,.14)", borderWidth: 1, borderColor: "rgba(243,155,175,.4)" },
  destructiveLabel: { color: palette.error, fontFamily: "Outfit-SemiBold", fontSize: 15 },
})

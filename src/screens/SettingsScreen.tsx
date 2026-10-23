import { useWalkthroughScreenBlocker } from "../walkthrough/activity"
import { showAlert } from "../components/AppDialog"
import { walkthroughFlags } from "../walkthrough/config"
import { useEffect, useState, type ReactNode } from "react"
import { Linking, StyleSheet, Switch } from "react-native"
import Constants from "expo-constants"
import { Box, Field, Label, Scroll, Touch, openExternal, Reveal } from "../native/UI"
import { DEFAULT_PREFERENCES, usePreferences, type AppPreferences } from "../native/preferences"
import { useStore } from "../native/Store"
import { changePassword, deleteAccount, getApiErrorMessage, getLegalConsents, getPreferences, logout, putPreference, setMarketingConsent, type NotificationPreferences } from "../api/client"
import { LEGAL_TITLES, useOpenLegal } from "../legal/links"
import TopNavBar from "../components/TopNavBar"
import { AtmoBackground } from "../components/GlassUI"
import { BRAND_NAME, BRAND_URL } from "../components/Brand"
import { palette } from "../theme/palette"
import { ui } from "../theme/styles"
import type { NavigateFn } from "../types"
import { PASSWORD_ERROR, isStrongPassword } from "../content/password"

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
function Password({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <Field accessibilityLabel={label} placeholder={label} placeholderTextColor={palette.muted} value={value} onChangeText={onChange}
    secureTextEntry autoCapitalize="none" autoCorrect={false} style={s.input} />
}

export default function SettingsScreen({ navigate }: { navigate: NavigateFn }) {
  const { values, ready, update } = usePreferences()
  const { data, resetSession } = useStore()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
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
  const signOut = () => showAlert("Çıkış yapılsın mı?", "Tekrar giriş yaparak hesabına dönebilirsin.", [
    { text: "Vazgeç", style: "cancel" },
    { text: "Çıkış yap", style: "destructive", onPress: () => {
      if (busy) return
      setBusy(true)
      void endSession("welcome").catch(() => { setError("Çıkış yapılamadı. Lütfen tekrar dene."); setBusy(false) })
    } },
  ])
  const submitPassword = async () => {
    if (busy) return
    if (!oldPassword || !newPassword) { setError("Mevcut ve yeni şifreni gir."); return }
    if (!isStrongPassword(newPassword)) { setError(PASSWORD_ERROR); return }
    if (newPassword !== repeatPassword) { setError("Yeni şifreler birbiriyle aynı değil."); return }
    setBusy(true); setError(null)
    try {
      await changePassword(oldPassword, newPassword)
      setOldPassword(""); setNewPassword(""); setRepeatPassword(""); setPasswordOpen(false)
      // The server signs out every session after a password change.
      showAlert("Şifren güncellendi", "Güvenliğin için yeni şifrenle tekrar giriş yap.", [{ text: "Tamam", onPress: () => { void endSession("login") } }])
    } catch (e) { setError(getApiErrorMessage(e, "Şifre değiştirilemedi.")) }
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

      {/* Only admins see this; the server also checks the role on every admin request. */}
      {data.user.role === "admin" && <Section title="Yönetim">
        <Row title="Üyelik başvuruları" detail="Başvuruları ara, onayla, reddet veya incelemeye al" onPress={() => navigate("admin")} />
      </Section>}

      <Section title="Hesap">
        <Row title={data.user.name || "Profilim"} detail="Profil fotoğrafı, ad, şehir ve Instagram" onPress={() => navigate("profile")} />
        <Row title="İlgi alanlarım" detail="Önerilen etkinlikleri belirleyen ilgi alanlarını düzenle" onPress={() => navigate("interests")} />
        <Row title="Şifremi değiştir" detail="Mevcut şifreni doğrulayarak yeni bir şifre belirle" open={passwordOpen} onPress={() => { setPasswordOpen(!passwordOpen); setError(null) }} />
        {passwordOpen && <Reveal><Box style={s.form}>
          <Password label="Mevcut şifre" value={oldPassword} onChange={setOldPassword} />
          <Password label="Yeni şifre" value={newPassword} onChange={setNewPassword} />
          <Password label="Yeni şifre tekrar" value={repeatPassword} onChange={setRepeatPassword} />
          <Touch disabled={busy} onPress={() => void submitPassword()} style={s.primary}><Label style={s.primaryLabel}>{busy ? "Kaydediliyor…" : "Şifreyi güncelle"}</Label></Touch>
        </Box></Reveal>}
      </Section>

      <Box walkthroughId="settings-notifications"><Section title="Bildirimler">
        <Toggle title="Etkinlik davetleri" detail="Biri seni bir etkinliğe davet ettiğinde" value={notifications.invites} disabled={!notificationsReady} onChange={v => void saveNotification("invites", v)} />
        <Toggle title="Yeni mesajlar" detail="Katıldığın etkinlik odalarındaki mesajlar" value={notifications.messages} disabled={!notificationsReady} onChange={v => void saveNotification("messages", v)} />
        <Toggle title="Etkinlik hatırlatmaları" detail="Katılacağın etkinlik yaklaştığında" value={notifications.reminders} disabled={!notificationsReady} onChange={v => void saveNotification("reminders", v)} />
        <Row title="Uygulama içi bildirimler" detail="Davetlerini ve topluluktan gelen haberleri görüntüle" onPress={() => navigate("notifications")} />
        <Row title="Telefon bildirim izinleri" detail="Sistem bildirim iznini telefon ayarlarından yönet" onPress={openSystemSettings} />
      </Section>

      </Box>
      <Section title="Görünüm ve etkileşim">
        <Toggle title="Dokunsal geri bildirim" detail="Butonlara dokunduğunda hafif titreşim" value={values.haptics} disabled={!ready} onChange={v => void savePreference({ haptics: v })} />
        <Toggle title="Saydamlığı azalt" detail="Cam ve bulanıklık efektleri yerine düz zeminler kullan" value={values.reduceTransparency} disabled={!ready} onChange={v => void savePreference({ reduceTransparency: v })} />
        <Row title="Tema" detail="Gece mavisi · Bu sürümde koyu tema kullanılıyor" />
        <Row title="Dil" detail="Türkçe · Diğer diller henüz desteklenmiyor" />
        <Row title="Metin boyutu" detail="Uygulama her cihazda aynı görünmesi için sabit yazı boyutu kullanır." />
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
        <Row title="Nasıl çalışır?" detail="Keşfet, katıl ve birlikte plan yap" onPress={() => showAlert("İlk buluşmana doğru", "Keşfet veya Harita’dan bir etkinlik seç. Ayrıntılardan katılım durumunu takip et. Katıldığın etkinliğin odası açıldığında katılımcılarla sohbet edebilirsin. Kendi planını paylaşmak için Oluştur’u kullan.")} />
        <Row title="Bir sorun yaşıyorum" detail="Bağlantı, izin ve hesap sorunları için yardım" onPress={() => showAlert("Yardım", "Bağlantı sorunu varsa internet erişimini kontrol edip yeniden dene. Konum veya fotoğraf erişimi için Gizlilik ve izinler bölümünü kullan. Şifreni unuttuysan giriş ekranındaki Şifremi unuttum seçeneğinden ilerle.")} />
        <Row title="Web sitesi" detail={BRAND_NAME} onPress={() => void openExternal(BRAND_URL)} />
        <Row title="Uygulama sürümü" detail={`${BRAND_NAME} · ${Constants.expoConfig?.version || "1.0.0"}`} />
      </Section>

      <Section title="Oturum">
        <Row title="Cihaz tercihlerini sıfırla" detail="Titreşimi açar, saydamlığı azalt seçeneğini kapatır" onPress={() => {
          if (!ready) return
          showAlert("Tercihler sıfırlansın mı?", "Hesabın, fotoğrafların ve etkinliklerin silinmez.", [{ text: "Vazgeç", style: "cancel" }, { text: "Sıfırla", onPress: () => void savePreference(DEFAULT_PREFERENCES) }])
        }} />
        <Row title={busy ? "İşlem sürüyor…" : "Çıkış yap"} detail="Bu cihazdaki oturumu kapat" onPress={busy ? undefined : signOut} />
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
  danger: { color: palette.error }, error: { color: palette.error, fontSize: 13, lineHeight: 19, marginTop: 12 },
  form: { gap: 10, padding: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.border },
  input: { minHeight: 48, borderRadius: 14, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.background, paddingHorizontal: 14, color: palette.text, fontSize: 15 },
  primary: { minHeight: 48, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "#4d5bcb" },
  primaryLabel: { color: palette.text, fontFamily: "Outfit-SemiBold", fontSize: 15 },
  destructive: { minHeight: 48, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(243,155,175,.14)", borderWidth: 1, borderColor: "rgba(243,155,175,.4)" },
  destructiveLabel: { color: palette.error, fontFamily: "Outfit-SemiBold", fontSize: 15 },
})

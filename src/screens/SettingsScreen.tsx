import { enablePush,disablePush } from "../native/push";
import { useState, type ReactNode } from "react"
import { Alert, Linking, StyleSheet, Switch } from "react-native"
import Constants from "expo-constants"
import Screen from "../native/Screen"
import { Box, Label, Scroll, Touch, openExternal } from "../native/UI"
import { DEFAULT_PREFERENCES, usePreferences, type AppPreferences } from "../native/preferences"
import { useStore } from "../native/Store"
import { logout } from "../api/client"
import TopNavBar from "../components/TopNavBar"
import StoryNote from "../components/StoryNote"
import { AtmoBackground } from "../components/GlassUI"
import { BRAND_NAME, BRAND_URL } from "../components/Brand"
import { palette } from "../theme/palette"
import type { NavigateFn } from "../types"

function Section({ title, children }: { title: string; children: ReactNode }) {
  return <Box style={s.section}><Label accessibilityRole="header" style={s.sectionTitle}>{title}</Label><Box style={s.card}>{children}</Box></Box>
}
function Row({ title, detail, onPress, danger = false }: { title: string; detail: string; onPress?: () => void; danger?: boolean }) {
  const content = <><Box style={s.copy}><Label style={[s.title, danger && s.danger]}>{title}</Label><Label style={s.detail}>{detail}</Label></Box>{onPress && <Label style={s.chevron}>›</Label>}</>
  return onPress ? <Touch accessibilityLabel={title} onPress={onPress} style={s.row}>{content}</Touch> : <Box style={s.row}>{content}</Box>
}
export default function SettingsScreen({ navigate }: { navigate: NavigateFn }) {
  const { values, ready, update } = usePreferences()
  const { data, resetSession } = useStore()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const save = async (patch: Partial<AppPreferences>) => {
    if (busy || !ready) return
    setBusy(true); setError(null)
    try { await update(patch) } catch { setError("Tercihin kaydedilemedi. Lütfen tekrar dene.") }
    finally { setBusy(false) }
  }
  const permissions = () => { void Linking.openSettings().catch(() => Alert.alert("Ayarlar açılamadı", "Telefonunun Ayarlar uygulamasından ewent.app’i seçebilirsin.")) }
  const signOut = () => Alert.alert("Çıkış yapılsın mı?", "Tekrar giriş yaparak hesabına dönebilirsin.", [
    { text: "Vazgeç", style: "cancel" },
    { text: "Çıkış yap", style: "destructive", onPress: () => {
      if (busy) return
      setBusy(true)
      void logout().then(() => { resetSession(); navigate("welcome") }).catch(() => { setError("Çıkış yapılamadı. Lütfen tekrar dene."); setBusy(false) })
    } },
  ])
  const toggle = (key: keyof AppPreferences, title: string, detail: string) => <Box style={s.row}>
    <Box style={s.copy}><Label style={s.title}>{title}</Label><Label style={s.detail}>{detail}</Label></Box>
    <Switch accessibilityLabel={title} value={values[key]} disabled={!ready || busy} onValueChange={value => void save({ [key]: value })}
      trackColor={{ false: palette.elevated, true: palette.violet }} thumbColor="#ffffff" ios_backgroundColor={palette.elevated} />
  </Box>
  return <Screen background={<AtmoBackground variant="violet" />}>
    <TopNavBar navigate={navigate} fallback="profile" title="Ayarlar" />
    <Scroll style={s.page}>
      <StoryNote scene="settings" />
      {error && <Label accessibilityRole="alert" style={s.danger}>{error}</Label>}
      <Section title="Hesap ve güvenlik">
        <Row title={data.user.name || "Profilim"} detail="Profil fotoğrafı, kişisel bilgiler ve ilgi alanları" onPress={() => navigate("profile")} />
        <Row title="Şifremi değiştir" detail="Mevcut şifreni doğrulayarak yeni bir şifre belirle" onPress={() => navigate("account", {mode:"password"})} />
      </Section>
      <Section title="Bildirimler">
        <Row title="Telefon bildirimlerini etkinleştir" detail="Davet, yeni mesaj ve etkinlik hatırlatmaları" onPress={()=>{if(busy)return;setBusy(true);void enablePush().then(()=>Alert.alert('Bildirimler açık','Bu cihaz kaydedildi.')).catch(e=>setError(e instanceof Error?e.message:'Bildirimler açılamadı.')).finally(()=>setBusy(false))}}/>
        <Row title="Bu cihazda bildirimleri durdur" detail="Uygulama içi bildirimlerin saklanır" onPress={()=>{if(busy)return;setBusy(true);void disablePush().then(()=>Alert.alert('Bildirimler kapalı','Bu cihaza bildirim gönderimi durduruldu.')).catch(()=>setError('Tercih kaydedilemedi.')).finally(()=>setBusy(false))}}/>
        <Row title="Uygulama içi bildirimler" detail="Davetlerini ve topluluktan gelen haberleri görüntüle" onPress={() => navigate("notifications")} />
        <Row title="Telefon bildirim ayarları" detail="Sistem tarafından sunulan bildirim izinlerini yönet" onPress={permissions} />
      </Section>
      <Section title="Görünüm ve etkileşim">
        {toggle("haptics", "Dokunsal geri bildirim", "Butonlara dokunduğunda hafif titreşim kullan")}
        {toggle("reduceTransparency", "Saydamlığı azalt", "Cam ve bulanıklık efektleri yerine düz zeminler kullan")}
        <Row title="Tema" detail="Gece mavisi · Bu sürümde koyu tema kullanılıyor" />
        <Row title="Dil" detail="Türkçe · Diğer diller henüz desteklenmiyor" />
        <Row title="Metin boyutu" detail="Uygulama telefonunun sistem yazı boyutunu izler. Telefonunun Ekran veya Erişilebilirlik ayarlarından değiştirebilirsin." />
      </Section>
      <Section title="Gizlilik ve izinler">
        <Row title="Şikâyetlerim" detail="Gönderdiğin şikâyetlerin durumunu takip et" onPress={()=>navigate('reports')}/>
        <Row title="Gizlilik ve kullanım koşulları" detail="Yayımlanmış belgeler ve hesap hakları" onPress={()=>navigate('legal')}/>
        <Row title="Verilerimi indir" detail="Hesap verilerinin JSON kopyasını kaydet" onPress={()=>navigate('account',{mode:'export'})}/>
        <Row title="Hesabımı sil" detail="Hesabını ve ilişkili verilerini kalıcı olarak kaldır" danger onPress={()=>navigate('account',{mode:'delete'})}/>
        <Row title="Konum erişimi" detail="Yakındaki etkinlikler için konum iznini yönet" onPress={permissions} />
        <Row title="Kamera ve fotoğraflar" detail="Profil ve etkinlik görselleri için erişimi yönet" onPress={permissions} />
        <Row title="Kişiler" detail="Referans seçimi için verdiğin rehber erişimini yönet" onPress={permissions} />
        <Row title="Bu cihazdaki tercihler" detail="Titreşim ve görünüm tercihleri yalnızca bu cihazda saklanır; hesabını veya etkinliklerini değiştirmez." />
      </Section>
      <Section title="Yardım ve hakkında">
        <Row title="Nasıl çalışır?" detail="Keşfet, katıl ve birlikte plan yap" onPress={() => Alert.alert("İlk buluşmana doğru", "Keşfet veya Harita’dan bir etkinlik seç. Ayrıntılardan katılım durumunu takip et. Katıldığın etkinliğin odası açıldığında katılımcılarla sohbet edebilirsin. Kendi planını paylaşmak için Oluştur’u kullan.")} />
        <Row title="Bir sorun yaşıyorum" detail="Bağlantı, izin ve hesap sorunları için yardım" onPress={() => Alert.alert("Yardım", "Bağlantı sorunu varsa internet erişimini kontrol edip yeniden dene. Konum veya fotoğraf erişimi için Gizlilik ve izinler bölümünü kullan. Hesabına erişemiyorsan Şifremi yenile seçeneğinden ilerle.")} />
        <Row title="Web sitesi" detail={BRAND_NAME} onPress={() => void openExternal(BRAND_URL)} />
        <Row title="Uygulama sürümü" detail={`${BRAND_NAME} · ${Constants.expoConfig?.version || "1.0.0"}`} />
      </Section>
      <Section title="Tercihler ve oturum">
        <Row title="Cihaz tercihlerini sıfırla" detail="Titreşimi açar, saydamlığı azalt seçeneğini kapatır" onPress={() => {
          if (busy || !ready) return
          Alert.alert("Tercihler sıfırlansın mı?", "Hesabın, fotoğrafların ve etkinliklerin silinmez.", [{ text: "Vazgeç", style: "cancel" }, { text: "Sıfırla", onPress: () => void save(DEFAULT_PREFERENCES) }])
        }} />
        <Row title={busy ? "İşlem sürüyor…" : "Çıkış yap"} detail="Bu cihazdaki hesap oturumunu kapat" danger onPress={busy ? undefined : signOut} />
      </Section>
      <Label style={s.footer}>Engellenen kullanıcı yönetimi bu sürümde henüz sunulmuyor.</Label>
    </Scroll>
  </Screen>
}
const s = StyleSheet.create({
  page: { paddingTop: 80, paddingHorizontal: 20, paddingBottom: 32 },
  section: { marginTop: 20, gap: 10 }, sectionTitle: { fontSize: 13, fontFamily: "Outfit-SemiBold", color: palette.accent },
  card: { borderRadius: 20, backgroundColor: "rgba(17,22,42,.9)", borderWidth: 1, borderColor: palette.border, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16, minHeight: 72, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.border },
  copy: { flex: 1, minWidth: 0, gap: 5 }, title: { color: palette.text, fontFamily: "Outfit-Medium", fontSize: 15 },
  detail: { color: palette.muted, fontSize: 12, lineHeight: 18 }, chevron: { color: palette.accent, fontSize: 25 },
  danger: { color: palette.error }, footer: { color: palette.muted, fontSize: 12, lineHeight: 19, marginTop: 24 },
})

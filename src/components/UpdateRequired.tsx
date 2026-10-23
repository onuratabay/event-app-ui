import { useEffect, useState } from "react"
import { AppState, Linking, Platform, StyleSheet, View } from "react-native"
import { APP_VERSION, getVersionPolicy } from "../api/client"
import { AtmoBackground } from "./GlassUI"
import { GlassFill } from "./GlassFill"
import { Label, Touch } from "../native/UI"
import { palette } from "../theme/palette"

/** Compares dotted versions numerically: 1.10.0 > 1.9.0, 1.2 = 1.2.0. */
export function compareVersions(a: string, b: string) {
  const left = a.split(".").map(Number), right = b.split(".").map(Number)
  for (let i = 0; i < 3; i++) {
    const diff = (left[i] || 0) - (right[i] || 0)
    if (diff) return diff
  }
  return 0
}

/**
 * Forced update: when this build is older than the server's minimum for the platform, a full-screen
 * "Uygulamayı güncelle" page covers the app (checked on start and whenever the app comes back to the front).
 * A failed check never blocks anyone: the app opens as usual.
 */
export default function UpdateRequired() {
  const [storeUrl, setStoreUrl] = useState<string | null | undefined>(undefined)
  useEffect(() => {
    let active = true
    const check = () => {
      void getVersionPolicy().then(policy => {
        if (!active) return
        const platform = Platform.OS === "ios" ? "ios" : "android"
        const minimum = policy.minimumVersion?.[platform]
        setStoreUrl(minimum && compareVersions(APP_VERSION, minimum) < 0 ? policy.storeUrl?.[platform] ?? null : undefined)
      }).catch(() => {})
    }
    check()
    const subscription = AppState.addEventListener("change", state => { if (state === "active") check() })
    return () => { active = false; subscription.remove() }
  }, [])
  if (storeUrl === undefined) return null
  return <View style={s.layer} accessibilityViewIsModal>
    <AtmoBackground variant="violet" />
    <View style={s.card}>
      <GlassFill kind="sheet" radius={24} />
      <Label style={s.eyebrow}>YENİ SÜRÜM</Label>
      <Label style={s.title} accessibilityRole="header">Uygulamayı güncelle</Label>
      <Label style={s.body}>Ewent'in bu sürümü artık desteklenmiyor. Devam etmek için uygulamanın en son sürümünü yükle.</Label>
      {storeUrl ? <Touch accessibilityLabel={Platform.OS === "ios" ? "App Store'da aç" : "Google Play'de aç"} onPress={() => void Linking.openURL(storeUrl).catch(() => {})} style={s.button} gradient={palette.actionGradient}>
          <Label style={s.buttonText}>{Platform.OS === "ios" ? "App Store'da güncelle" : "Google Play'de güncelle"}</Label>
        </Touch>
        : <Label style={s.note}>{Platform.OS === "ios" ? "App Store'dan" : "Google Play'den"} Ewent'i güncelleyebilirsin.</Label>}
      <Label style={s.version}>{`Yüklü sürüm: ${APP_VERSION}`}</Label>
    </View>
  </View>
}

const s = StyleSheet.create({
  layer: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 5000, elevation: 5000, alignItems: "center", justifyContent: "center", padding: 24, backgroundColor: palette.background },
  card: { width: "100%", maxWidth: 380, gap: 12, padding: 24, borderRadius: 24, overflow: "hidden", backgroundColor: palette.glassSheet, borderWidth: 1, borderColor: palette.glassBorder },
  eyebrow: { color: "#c7ceff", fontSize: 11, letterSpacing: 2 },
  title: { fontFamily: "Fraunces", fontSize: 30, lineHeight: 36, color: palette.text },
  body: { color: palette.muted, fontSize: 15, lineHeight: 22 },
  button: { marginTop: 8, minHeight: 52, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  buttonText: { color: palette.text, fontFamily: "Outfit-SemiBold", fontSize: 16 },
  note: { marginTop: 4, color: palette.text, fontSize: 14, lineHeight: 20 },
  version: { color: palette.muted, fontSize: 12, marginTop: 4 },
})

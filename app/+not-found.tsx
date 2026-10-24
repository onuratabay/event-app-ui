import { useRouter } from "expo-router"
import { StyleSheet } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { AtmoBackground } from "../src/components/GlassUI"
import { GlassFill } from "../src/components/GlassFill"
import { BRAND_NAME } from "../src/components/Brand"
import { Box, Label, Scroll, Touch } from "../src/native/UI"
import { canReturnTo, usePreviousRoute } from "../src/native/navigation"
import { palette } from "../src/theme/palette"

export default function NotFound() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const previous = usePreviousRoute()
  // Welcome resolves the current session and account status before entering the app.
  const home = () => {
    if (router.canDismiss()) router.dismissAll()
    router.replace("/welcome")
  }
  return <Box style={s.screen}>
    <AtmoBackground variant="violet" />
    <Scroll style={s.scroll} contentContainerStyle={{ flexGrow: 1, justifyContent: "center", paddingBottom: 24 + insets.bottom }}>
      <Box style={s.card}>
        <GlassFill kind="sheet" radius={24} />
        <Label style={s.brand}>{BRAND_NAME}</Label>
        <Label style={s.code} accessible={false}>404</Label>
        <Label accessibilityRole="header" style={s.title}>Bu sayfayı bulamadık.</Label>
        <Label style={s.body}>Bağlantı eksik veya hatalı olabilir. Aradığın sayfa taşınmış ya da kaldırılmış da olabilir.</Label>
        <Touch onPress={home} style={s.primary} gradient={palette.actionGradient} accessibilityRole="button"><Label style={s.buttonText}>Ana ekrana dön</Label></Touch>
        {router.canGoBack() && canReturnTo(previous) && <Touch onPress={() => router.back()} style={s.secondary} accessibilityRole="button"><Label style={s.buttonText}>Önceki sayfaya dön</Label></Touch>}
      </Box>
    </Scroll>
  </Box>
}
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.background },
  scroll: { flex: 1, paddingHorizontal: 24, paddingTop: 24 },
  card: { width: "100%", maxWidth: 480, alignSelf: "center", padding: 24, gap: 16, borderRadius: 24, overflow: "hidden", backgroundColor: palette.glassSheet, borderWidth: 1, borderColor: palette.glassBorder },
  brand: { color: palette.accent, fontFamily: "Outfit-SemiBold", fontSize: 16 },
  code: { color: palette.accent, fontSize: 80, lineHeight: 100, fontFamily: "Outfit-SemiBold" },
  title: { color: palette.text, fontFamily: "Fraunces", fontSize: 30, lineHeight: 38 },
  body: { color: palette.muted, fontSize: 15, lineHeight: 23 },
  primary: { minHeight: 52, borderRadius: 16, alignItems: "center", justifyContent: "center", padding: 12, marginTop: 8 },
  secondary: { minHeight: 48, borderRadius: 16, alignItems: "center", justifyContent: "center", padding: 12, borderWidth: 1, borderColor: palette.glassBorder },
  buttonText: { color: palette.text, fontFamily: "Outfit-SemiBold", fontSize: 15 },
})

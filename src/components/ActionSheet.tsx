import { useEffect } from "react"
import { BackHandler, Pressable, StyleSheet, View } from "react-native"
import { hasOverlayHost, useOverlay } from "./OverlayHost"
import { Label, Touch } from "../native/UI"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { BAR_MAX_WIDTH, BAR_SIDE, barBottom } from "./BottomNav"
import { palette } from "../theme/palette"

export type SheetOption = { label: string; onPress: () => void; danger?: boolean }
/** Report reasons offered for a chat message (rooms and one-to-one chats). */
export const REPORT_REASONS = ["Taciz veya hakaret", "Spam veya reklam", "Uygunsuz içerik", "Güvenliğimi tehdit ediyor"]

/**
 * Options for a long-pressed chat message; the same look on iOS and Android (Android alerts are limited to
 * three buttons). It is drawn in the overlay layer above the bottom menu bar, in the same window, and its
 * bottom edge and sides are computed exactly like the bar's: on every phone it lines up with the bar.
 */
export default function ActionSheet({ title, options, onClose }: { title?: string; options: SheetOption[]; onClose: () => void }) {
  const safeBottom = useSafeAreaInsets().bottom
  // Android back closes the menu (a Modal used to do this).
  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => { onClose(); return true })
    return () => subscription.remove()
  }, [onClose])
  const panel = <Pressable accessibilityLabel="Menüyü kapat" style={[s.backdrop, { paddingHorizontal: BAR_SIDE, paddingBottom: barBottom(safeBottom) }]} onPress={onClose}>
    <Pressable style={s.sheet} onPress={() => {}}>
      {title ? <Label style={s.title} numberOfLines={2}>{title}</Label> : null}
      {options.map(option => <Touch key={option.label} accessibilityLabel={option.label} onPress={() => { onClose(); option.onPress(); }} style={s.option}>
        <Label style={[s.label, option.danger && s.danger]}>{option.label}</Label>
      </Touch>)}
      <Touch accessibilityLabel="Vazgeç" onPress={onClose} style={[s.option, s.cancel]}><Label style={s.label}>Vazgeç</Label></Touch>
    </Pressable>
  </Pressable>
  const hosted = hasOverlayHost()
  useOverlay(hosted ? panel : null)
  return hosted ? null : <View style={StyleSheet.absoluteFill}>{panel}</View>
}

const s = StyleSheet.create({
  backdrop: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,.55)" },
  sheet: { width: "100%", maxWidth: BAR_MAX_WIDTH, alignSelf: "center", gap: 4, paddingHorizontal: 12, paddingTop: 14, paddingBottom: 12, borderRadius: 24, backgroundColor: palette.glassSheet, borderWidth: 1, borderColor: palette.glassBorder },
  title: { color: palette.muted, fontSize: 13, lineHeight: 18, textAlign: "center", paddingHorizontal: 12, paddingBottom: 8 },
  option: { minHeight: 50, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,.04)" },
  cancel: { marginTop: 6, backgroundColor: "rgba(255,255,255,.08)" },
  label: { color: palette.text, fontFamily: "Outfit-Medium", fontSize: 15, lineHeight: 20 },
  danger: { color: palette.error },
})

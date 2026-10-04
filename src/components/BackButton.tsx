import { palette } from "../theme/palette";
import { StyleSheet } from "react-native"
import { ArrowLeftIcon } from "./Icons"
import { Label, Touch } from "../native/UI"
import type { NavigateFn, Screen } from "../types"
export default function BackButton({ navigate, fallback, onPress }: { navigate: NavigateFn; fallback: Screen; onPress?: () => void }) {
  return <Touch accessibilityLabel="Geri git" onPress={onPress || (() => navigate(fallback, { back: true }))} glass style={s.button}><ArrowLeftIcon size={20} strokeWidth={1.75} style={{ color: palette.text }} /><Label style={s.label}>Geri</Label></Touch>
}
const s = StyleSheet.create({ button: { alignSelf: "flex-start", minHeight: 44, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, borderRadius: 15, backgroundColor: "rgba(255,255,255,.09)", borderWidth: 1, borderColor: "rgba(255,255,255,.16)", marginBottom: 14 }, label: { color: palette.text, fontFamily: "Outfit-Medium", fontSize: 14 } })

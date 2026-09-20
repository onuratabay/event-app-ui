import { StyleSheet } from "react-native"
import { ArrowLeftIcon } from "./Icons"
import { Label, Touch } from "../native/UI"
import type { NavigateFn, Screen } from "../types"
export default function BackButton({ navigate, fallback, onPress }: { navigate: NavigateFn; fallback: Screen; onPress?: () => void }) {
  return <Touch accessibilityLabel="Geri git" onPress={onPress || (() => navigate(fallback, { back: true }))} style={s.button}><ArrowLeftIcon size={20} strokeWidth={1.8} style={{ color: "#f0ede8" }} /><Label style={s.label}>Geri</Label></Touch>
}
const s = StyleSheet.create({ button: { alignSelf: "flex-start", minHeight: 44, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, borderRadius: 14, backgroundColor: "#242336", borderWidth: 1, borderColor: "#4c485f", marginBottom: 14 }, label: { color: "#f0ede8", fontFamily: "Outfit-Medium", fontSize: 14 } })

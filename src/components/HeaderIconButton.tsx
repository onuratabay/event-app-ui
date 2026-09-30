import type { ReactNode } from "react"
import { StyleSheet, View } from "react-native"
import { Touch } from "../native/UI"
export default function HeaderIconButton({ label, children, onPress, highlighted = false }: { label: string; children: ReactNode; onPress: () => void; highlighted?: boolean }) {
  return <Touch glass accessibilityLabel={label} onPress={onPress} style={[s.button, highlighted && s.highlight]}><View style={s.icon}>{children}</View></Touch>
}
const s = StyleSheet.create({ button: { width: 44, height: 44, borderRadius: 14, backgroundColor: "rgba(22,31,56,.66)", borderWidth: 1, borderColor: "rgba(202,216,255,.24)", alignItems: "center", justifyContent: "center" }, highlight: { backgroundColor: "rgba(88,68,29,.56)", borderColor: "rgba(225,189,101,.48)" }, icon: { width: 24, height: 24, alignItems: "center", justifyContent: "center" } })

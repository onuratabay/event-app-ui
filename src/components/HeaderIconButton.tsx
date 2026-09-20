import type { ReactNode } from "react"
import { StyleSheet, View } from "react-native"
import { Touch } from "../native/UI"
export default function HeaderIconButton({ label, children, onPress, highlighted = false }: { label: string; children: ReactNode; onPress: () => void; highlighted?: boolean }) {
  return <Touch accessibilityLabel={label} onPress={onPress} style={[s.button, highlighted && s.highlight]}><View style={s.icon}>{children}</View></Touch>
}
const s = StyleSheet.create({ button: { width: 44, height: 44, borderRadius: 14, backgroundColor: "#242336", borderWidth: 1, borderColor: "#4c485f", alignItems: "center", justifyContent: "center" }, highlight: { backgroundColor: "#352b1d", borderColor: "#9d8040" }, icon: { width: 24, height: 24, alignItems: "center", justifyContent: "center" } })

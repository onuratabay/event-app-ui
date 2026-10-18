import type { ReactNode } from "react"
import { StyleSheet, View } from "react-native"
import { Touch } from "../native/UI"
export default function HeaderIconButton({ label, children, onPress, highlighted = false, plain = false, selected = false, walkthroughId }: { walkthroughId?: string; label: string; children: ReactNode; onPress: () => void; highlighted?: boolean; plain?: boolean; selected?: boolean }) {
  return <Touch walkthroughId={walkthroughId} glass={!plain} accessibilityLabel={label} accessibilityState={{ selected }} onPress={onPress} style={[s.button, highlighted && s.highlight, plain && s.plain]}><View style={s.icon}>{children}</View></Touch>
}
const s = StyleSheet.create({ button: { width: 44, height: 44, borderRadius: 14, backgroundColor: "rgba(22,31,56,.66)", borderWidth: 1, borderColor: "rgba(183,197,255,.12)", alignItems: "center", justifyContent: "center" }, highlight: { backgroundColor: "rgba(105,120,255,.14)", borderColor: "rgba(105,120,255,.38)" }, plain: { backgroundColor: "transparent", borderWidth: 0, borderRadius: 22 }, icon: { width: 24, height: 24, alignItems: "center", justifyContent: "center" } })

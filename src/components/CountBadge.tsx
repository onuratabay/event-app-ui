import { StyleSheet, Text, View } from "react-native"
import { palette } from "../theme/palette"

const SIZE = 20

/**
 * Small count pill (records tab, notification bell). `solid` swaps the translucent fill for its
 * opaque equivalent on the app background, for badges that sit on top of an icon.
 * One digit is an exact circle (fixed width = height); more digits widen it into a pill.
 */
export default function CountBadge({ count, solid = false, style }: { count: number; solid?: boolean; style?: object }) {
  if (count <= 0) return null
  const label = count > 99 ? "99+" : String(count)
  return <View pointerEvents="none" style={[s.badge, label.length === 1 ? s.circle : s.pill, solid && s.solid, style]}>
    <Text allowFontScaling={false} style={s.text}>{label}</Text>
  </View>
}

const s = StyleSheet.create({
  badge: { height: SIZE, borderRadius: SIZE / 2, alignItems: "center", justifyContent: "center", backgroundColor: palette.selected, borderWidth: 1, borderColor: "rgba(105,120,255,.38)" },
  circle: { width: SIZE },
  pill: { minWidth: SIZE, paddingHorizontal: 5 },
  // palette.selected composited over palette.background.
  solid: { backgroundColor: "#161a38" },
  // The line fills the inner height exactly, with no extra font padding, so the digit sits in the middle.
  text: { color: palette.accent, fontFamily: "Outfit-SemiBold", fontSize: 11, lineHeight: SIZE - 2, height: SIZE - 2, textAlign: "center", textAlignVertical: "center", includeFontPadding: false, fontVariant: ["tabular-nums"] },
})

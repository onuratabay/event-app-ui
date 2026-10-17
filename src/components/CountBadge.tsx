import { StyleSheet } from "react-native"
import { Box, Label } from "../native/UI"
import { palette } from "../theme/palette"

/**
 * Small count pill (records tab, notification bell). `solid` swaps the translucent fill for its
 * opaque equivalent on the app background, for badges that sit on top of an icon.
 */
export default function CountBadge({ count, solid = false, style }: { count: number; solid?: boolean; style?: object }) {
  if (count <= 0) return null
  return <Box pointerEvents="none" style={[s.badge, solid && s.solid, style]}>
    <Label style={s.text}>{count > 99 ? "99+" : count}</Label>
  </Box>
}

const s = StyleSheet.create({
  badge: { minWidth: 20, height: 18, paddingHorizontal: 6, borderRadius: 9, alignItems: "center", justifyContent: "center", backgroundColor: palette.selected, borderWidth: 1, borderColor: "rgba(105,120,255,.38)" },
  // palette.selected composited over palette.background.
  solid: { backgroundColor: "#161a38" },
  text: { color: palette.accent, fontFamily: "Outfit-SemiBold", fontSize: 11, lineHeight: 14, fontVariant: ["tabular-nums"] },
})

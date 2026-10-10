import { StyleSheet } from "react-native"
import { Box, Label } from "../native/UI"
import { story } from "../content/story"
import { palette } from "../theme/palette"
import type { Screen } from "../types"

/** Quiet, wrapping editorial annotation in the page's normal content flow. */
export default function StoryNote({ scene, inset = false, compact = false }: {
  scene: Screen
  inset?: boolean
  compact?: boolean
}) {
  const beat = story[scene]
  return <Box style={[s.note, inset && s.inset]}>
    <Label style={[s.pair, compact && s.compact]}>
      {beat.pair[0]}<Label style={s.link}> · </Label>{beat.pair[1]}
    </Label>
    <Label style={s.copy}>{beat.note}</Label>
  </Box>
}
const s = StyleSheet.create({
  note: { minWidth: 0, borderLeftWidth: 2, borderLeftColor: "rgba(185,195,255,.45)", paddingLeft: 12, marginVertical: 14, gap: 5 },
  inset: { marginHorizontal: 20 },
  pair: { fontFamily: "Fraunces", fontStyle: "italic", fontSize: 18, lineHeight: 25, color: palette.accent },
  compact: { fontSize: 15, lineHeight: 21 },
  link: { color: palette.cyan },
  copy: { fontSize: 12, lineHeight: 19, color: "rgba(244,245,255,.68)" },
})

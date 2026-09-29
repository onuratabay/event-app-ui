import { StyleSheet } from "react-native"
import { Box, Label } from "../native/UI"

export default function EditorialQuote({ children }: { children: string }) {
  return (
    <Box glass style={s.card}>
      <Label style={s.mark}>“</Label>
      <Label style={s.copy}>{children}</Label>
      <Box style={s.rule} />
    </Box>
  )
}

const s = StyleSheet.create({
  card: {
    position: "relative",
    overflow: "hidden",
    maxWidth: 420,
    paddingTop: 18,
    paddingRight: 18,
    paddingBottom: 18,
    paddingLeft: 54,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.16)",
  },
  mark: {
    position: "absolute",
    top: 2,
    left: 14,
    color: "#e1bd65",
    fontFamily: "Fraunces",
    fontStyle: "italic",
    fontSize: 48,
    lineHeight: 52,
    opacity: .92,
  },
  copy: {
    color: "rgba(248,250,252,.86)",
    fontFamily: "Fraunces",
    fontStyle: "italic",
    fontSize: 17,
    lineHeight: 26,
  },
  rule: { width: 36, height: 2, borderRadius: 1, backgroundColor: "#e1bd65", marginTop: 14, opacity: .8 },
})

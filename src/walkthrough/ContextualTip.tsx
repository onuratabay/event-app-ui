import { useEffect, useRef } from "react"
import { Pressable, StyleSheet, Text, View, useWindowDimensions, type ViewInstance } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useScreenActive } from "../native/useScreenActive"
import { palette } from "../theme/palette"
import { TIPS, type TipId } from "./config"
import { useWalkthrough } from "./WalkthroughProvider"
import { onWalkthroughScroll } from "./targets"

/** Inline, dismissible help. Never intercepts the feature's action or opens another modal. */
export default function ContextualTip({ id, when = true }: { id: TipId; when?: boolean }) {
  const guide = useWalkthrough()
  const ref = useRef<ViewInstance | null>(null), active = useScreenActive()
  const { height } = useWindowDimensions(), insets = useSafeAreaInsets()
  const seen = guide?.state.seenTips.includes(id)
  useEffect(() => {
    if (!when || !active || !guide?.ready || !guide.available || seen || guide.presenting) return
    let cancelled = false
    let timer: ReturnType<typeof setTimeout>
    const check = () => ref.current?.measureInWindow((_x, y, width) => {
      // Reserve only after the inline location enters the viewport, away from floating bars.
      if (!cancelled && width > 0 && y >= insets.top + 60 && y < height - insets.bottom - 60) void guide.claimTip(id)
    })
    timer = setTimeout(check, 2000)
    const stop = onWalkthroughScroll(() => { clearTimeout(timer); timer = setTimeout(check, 500) })
    return () => { cancelled = true; clearTimeout(timer); stop() }
  }, [id, when, active, guide?.ready, guide?.available, seen, guide?.presenting, guide?.tip, height, insets.top, insets.bottom])
  useEffect(() => { if (!when || !active) guide?.dismissTip(id) }, [when, active, id])
  useEffect(() => () => guide?.dismissTip(id), [id])
  if (!when || !active || !guide) return null
  if (guide.tip !== id) return <View ref={ref} collapsable={false} accessible={false} />
  const copy = TIPS[id]
  return <View ref={ref} style={s.card} accessibilityLiveRegion="polite" testID={`walkthrough-tip-${id}`}>
    <View style={s.copy}><Text style={s.title}>{copy.title}</Text><Text style={s.body}>{copy.body}</Text></View>
    <Pressable accessibilityRole="button" accessibilityLabel="İpucunu kapat" onPress={() => guide.dismissTip(id)} style={s.close}><Text style={s.closeText}>×</Text></Pressable>
  </View>
}
const s = StyleSheet.create({ card: { marginVertical: 12, borderRadius: 18, padding: 16, paddingRight: 8, flexDirection: "row", gap: 8, borderWidth: 1, borderColor: "rgba(185,195,255,.25)", backgroundColor: "rgba(105,120,255,.1)" }, copy: { flex: 1, gap: 5 }, title: { color: palette.accent, fontFamily: "Outfit-SemiBold", fontSize: 13, lineHeight: 19 }, body: { color: "#c4cce1", fontFamily: "Outfit", fontSize: 13, lineHeight: 20 }, close: { minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center", alignSelf: "flex-start" }, closeText: { color: palette.accent, fontSize: 24 } })

import { useEffect, useRef, useState } from "react"
import { AccessibilityInfo, Animated, Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import Svg, { Path, Rect } from "react-native-svg"
import { LinearGradient } from "expo-linear-gradient"
import { SharedBlur } from "../native/SharedBlur"
import { palette } from "../theme/palette"
import { placeCard, type Frame } from "./model"
import type { Guide } from "./config"

export interface Presentation { guide: Guide; index: number; frame: Frame | null; preview: boolean }
function roundedHole(frame: Frame) {
  const { x, y, width: w, height: h } = frame, r = Math.min(16, w / 2, h / 2)
  return `M${x + r} ${y}H${x + w - r}Q${x + w} ${y} ${x + w} ${y + r}V${y + h - r}Q${x + w} ${y + h} ${x + w - r} ${y + h}H${x + r}Q${x} ${y + h} ${x} ${y + h - r}V${y + r}Q${x} ${y} ${x + r} ${y}Z`
}
export default function WalkthroughOverlay({ presentation, onNext, onBack, onClose }: { presentation: Presentation; onNext: () => void; onBack: () => void; onClose: () => void }) {
  const { width, height } = useWindowDimensions(), insets = useSafeAreaInsets()
  const [cardHeight, setCardHeight] = useState(270)
  const [reduceMotion, setReduceMotion] = useState(true)
  const opacity = useRef(new Animated.Value(1)).current
  const animatedStep = useRef<string | null>(null)
  const { guide, index, frame, preview } = presentation, step = guide.steps[index]
  const heading = useRef<Text | null>(null)
  useEffect(() => {
    let active = true
    void AccessibilityInfo.isReduceMotionEnabled().then(value => { if (active) setReduceMotion(value) }).catch(() => {})
    const subscription = AccessibilityInfo.addEventListener?.("reduceMotionChanged", setReduceMotion)
    return () => { active = false; subscription?.remove() }
  }, [])
  useEffect(() => {
    const key = `${guide.id}:${index}`, fresh = animatedStep.current !== key
    animatedStep.current = key
    opacity.stopAnimation(); opacity.setValue(reduceMotion || !fresh ? 1 : 0)
    if (!reduceMotion && fresh) Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }).start()
    return () => opacity.stopAnimation()
  }, [index, guide.id, reduceMotion])
  useEffect(() => {
    // Modal isolates the underlying screen; focus follows the step on both platforms.
    const timer = setTimeout(() => {
      if (heading.current) AccessibilityInfo.sendAccessibilityEvent?.(heading.current, "focus")
      AccessibilityInfo.announceForAccessibility(`${index + 1}. adım, ${guide.steps.length} adım. ${step.title}. ${step.body}`)
    }, 80)
    return () => clearTimeout(timer)
  }, [index, guide.id])
  const spot = frame ? { x: Math.max(6, frame.x - 6), y: Math.max(insets.top, frame.y - 6), width: Math.min(width - Math.max(6, frame.x - 6) - 6, frame.width + 12), height: Math.min(height - insets.bottom - Math.max(insets.top, frame.y - 6), frame.height + 12) } : null
  const placement = placeCard(width, height, insets.top, insets.bottom, spot, cardHeight)
  const last = index === guide.steps.length - 1
  return <Modal transparent visible animationType="none" statusBarTranslucent navigationBarTranslucent onRequestClose={onClose} onAccessibilityEscape={onClose}>
    <View style={s.root} accessibilityViewIsModal importantForAccessibility="yes" onAccessibilityEscape={onClose}>
      <Pressable accessible={false} style={StyleSheet.absoluteFill} onPress={onClose} testID="walkthrough-backdrop">
        <Svg width={width} height={height} pointerEvents="none">
          <Path fill="rgba(3,6,17,.65)" fillRule="evenodd" d={`M0 0H${width}V${height}H0Z${spot ? ` ${roundedHole(spot)}` : ""}`} />
          {spot && <Rect x={spot.x} y={spot.y} width={spot.width} height={spot.height} rx={16} fill="transparent" stroke="rgba(205,214,255,.85)" strokeWidth={1.5} />}
        </Svg>
      </Pressable>
      <Animated.View style={[s.card, placement, { opacity }]} testID="walkthrough-card">
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, s.paint]}>
          <SharedBlur intensity={85} tint="dark" style={StyleSheet.absoluteFill} />
          <LinearGradient colors={["rgba(185,195,255,.14)", "rgba(146,125,255,.025)"]} style={StyleSheet.absoluteFill} />
        </View>
        <ScrollView bounces={false} contentContainerStyle={s.content} onContentSizeChange={(_w, h) => setCardHeight(h)} showsVerticalScrollIndicator={false}>
          <View style={s.topRow}>
            <Text style={s.eyebrow}>{preview ? "REHBERE GÖZ AT" : "KÜÇÜK BİR KEŞİF"}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Rehberi geç ve kapat" onPress={onClose} style={s.close} hitSlop={8}><Text style={s.closeLabel}>Geç ×</Text></Pressable>
          </View>
          <Text ref={heading} accessibilityRole="header" style={s.title}>{step.title}</Text>
          <Text style={s.body}>{step.body}</Text>
          <View style={s.footer}>
            <View accessibilityRole="progressbar" accessibilityLabel="Rehber ilerlemesi" accessibilityValue={{ min: 1, max: guide.steps.length, now: index + 1, text: `${index + 1} / ${guide.steps.length}` }} style={s.progress}>
              {guide.steps.map((_, i) => <View key={i} style={[s.dot, i === index && s.currentDot]} />)}
              <Text style={s.count}>{index + 1}/{guide.steps.length}</Text>
            </View>
            <View style={s.actions}>
              {index > 0 && <Pressable accessibilityRole="button" accessibilityLabel="Önceki adım" onPress={onBack} style={s.back}><Text style={s.backLabel}>Geri</Text></Pressable>}
              <Pressable accessibilityRole="button" accessibilityLabel={last ? "Rehberi bitir" : "Sonraki adım"} onPress={onNext} style={s.next}>
                <LinearGradient colors={["#4d5bcb", "#6651c9"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.nextFill}><Text style={s.nextLabel}>{last ? "Bitir ✓" : "İleri →"}</Text></LinearGradient>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </Animated.View>
    </View>
  </Modal>
}
const s = StyleSheet.create({
  root: { flex: 1 }, card: { position: "absolute", borderRadius: 26, borderWidth: 1, borderColor: "rgba(205,214,255,.3)", backgroundColor: "rgba(14,20,42,.9)", overflow: "hidden", boxShadow: "0px 18px 48px rgba(0,0,0,.32)" },
  paint: { borderRadius: 26, overflow: "hidden" }, content: { padding: 22, gap: 12 }, topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  eyebrow: { fontFamily: "Outfit-Medium", color: palette.accent, fontSize: 10, letterSpacing: 1.7, flexShrink: 1 }, close: { minHeight: 44, minWidth: 52, alignItems: "flex-end", justifyContent: "center" }, closeLabel: { color: palette.muted, fontFamily: "Outfit", fontSize: 13 },
  title: { color: palette.text, fontFamily: "Fraunces", fontSize: 25, lineHeight: 32 }, body: { color: "#c4cce1", fontFamily: "Outfit", fontSize: 15, lineHeight: 23 },
  footer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap", marginTop: 6 }, progress: { flexDirection: "row", alignItems: "center", gap: 5, minHeight: 44 }, dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: "rgba(185,195,255,.25)" }, currentDot: { width: 16, backgroundColor: palette.accent }, count: { color: palette.muted, fontFamily: "Outfit", fontSize: 11, marginLeft: 4 },
  actions: { flexDirection: "row", alignItems: "center", gap: 8, flexShrink: 1 }, back: { minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" }, backLabel: { color: "#c4cce1", fontFamily: "Outfit-Medium", fontSize: 13 }, next: { borderRadius: 14, overflow: "hidden", minHeight: 48 }, nextFill: { minHeight: 48, justifyContent: "center", paddingHorizontal: 18, paddingVertical: 10 }, nextLabel: { color: palette.text, fontFamily: "Outfit-SemiBold", fontSize: 14 },
})

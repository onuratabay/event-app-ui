import { useEffect, useRef, useState } from "react"
import { AccessibilityInfo, Animated, Easing, StyleSheet, type StyleProp, type ViewStyle } from "react-native"
import { CategoryIcon } from "./Icons"
import { palette } from "../theme/palette"

const ACTIVITIES = ["Bisiklet", "Padel", "Doğa yürüyüşü", "Yüzme", "Müzik", "Kahve", "Sanat"]

/** One activity glyph at a time, with a gentle transition rather than a spinning ring. */
export default function LoadingSpinner({ color = palette.accent, size = "small", style }: { color?: string; size?: "small" | "large" | number; style?: StyleProp<ViewStyle> }) {
  const [activity, setActivity] = useState(() => Math.floor(Math.random() * ACTIVITIES.length))
  const [reduceMotion, setReduceMotion] = useState(false)
  const opacity = useRef(new Animated.Value(1)).current
  const diameter = typeof size === "number" ? size : size === "large" ? 56 : 20

  useEffect(() => {
    let active = true
    void AccessibilityInfo.isReduceMotionEnabled().then(value => { if (active) setReduceMotion(value) }).catch(() => {})
    const subscription = typeof AccessibilityInfo.addEventListener === "function"
      ? AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion)
      : undefined
    return () => { active = false; subscription?.remove() }
  }, [])

  useEffect(() => {
    opacity.setValue(1)
    if (reduceMotion) return
    let transition: ReturnType<typeof setTimeout> | undefined
    let animation: ReturnType<typeof Animated.timing> | undefined
    const interval = setInterval(() => {
      animation = Animated.timing(opacity, { toValue: 0, duration: 50, easing: Easing.out(Easing.quad), useNativeDriver: true })
      animation.start()
      transition = setTimeout(() => {
        // Pick a different activity on each transition, without a fixed sequence.
        setActivity(previous => (previous + 1 + Math.floor(Math.random() * (ACTIVITIES.length - 1))) % ACTIVITIES.length)
        animation = Animated.timing(opacity, { toValue: 1, duration: 80, easing: Easing.out(Easing.quad), useNativeDriver: true })
        animation.start()
      }, 50)
    }, 400)
    return () => { clearInterval(interval); clearTimeout(transition); animation?.stop(); opacity.stopAnimation() }
  }, [opacity, reduceMotion])

  return <Animated.View accessible accessibilityRole="progressbar" accessibilityLabel="Yükleniyor" style={[s.frame, style]}>
    <Animated.View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ width: diameter, height: diameter, opacity, alignItems: "center", justifyContent: "center" }}>
      <CategoryIcon name={ACTIVITIES[activity]} size={diameter} strokeWidth={1.65} style={{ color }} />
    </Animated.View>
  </Animated.View>
}
const s = StyleSheet.create({ frame: { alignItems: "center", justifyContent: "center" } })

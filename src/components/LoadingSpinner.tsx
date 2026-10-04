import { useEffect, useRef } from "react"
import { Animated, Easing, StyleSheet, type StyleProp, type ViewStyle } from "react-native"
import Svg, { Path } from "react-native-svg"
import { palette } from "../theme/palette"
/** Identical loading artwork and dimensions on iOS and Android. */
export default function LoadingSpinner({ color = palette.accent, size = "small", style }: { color?: string; size?: "small" | "large" | number; style?: StyleProp<ViewStyle> }) {
  const progress = useRef(new Animated.Value(0)).current
  const diameter = typeof size === "number" ? size : size === "large" ? 36 : 20
  useEffect(() => {
    const animation = Animated.loop(Animated.timing(progress, { toValue: 1, duration: 900, easing: Easing.linear, useNativeDriver: true }))
    animation.start(); return () => animation.stop()
  }, [progress])
  return <Animated.View accessibilityRole="progressbar" accessibilityLabel="Yükleniyor" style={[s.frame, style]}>
    <Animated.View style={{ width: diameter, height: diameter, transform: [{ rotate: progress.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] }) }] }}>
      <Svg width={diameter} height={diameter} viewBox="0 0 24 24" fill="none"><Path d="M12 3a9 9 0 1 1-9 9" stroke={color} strokeWidth={2} strokeLinecap="round" /></Svg>
    </Animated.View>
  </Animated.View>
}
const s = StyleSheet.create({ frame: { alignItems: "center", justifyContent: "center" } })

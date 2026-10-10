import { usePathname } from "expo-router"
import { useEffect, useRef, useState } from "react"
import { Animated, Easing, StyleSheet, View } from "react-native"
import { SharedBlur } from "../native/SharedBlur"
import { apiLoading } from "../api/loading"
import { Label } from "../native/UI"

/** The splash screen's ✦ mark, spinning inside the same tile. */
function SplashMarkSpinner() {
  const progress = useRef(new Animated.Value(0)).current
  useEffect(() => {
    // The lightweight native-host test shim does not implement animation loops.
    if (typeof Animated.loop !== "function") return
    const animation = Animated.loop(Animated.timing(progress, { toValue: 1, duration: 1400, easing: Easing.linear, useNativeDriver: true }))
    animation.start()
    return () => animation.stop()
  }, [progress])
  const rotate = progress.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] })
  return <View style={styles.tile}>
    <Animated.View style={{ transform: [{ rotate }] }}>
      <Label style={styles.mark}>✦</Label>
    </Animated.View>
  </View>
}

export default function ApiLoadingOverlay() {
  const [visible, setVisible] = useState(false)
  // Splash has its own intro animation; the overlay covers API waits on every other screen.
  const onSplash = usePathname() === "/"
  const pending = useRef(0)
  const appear = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const hide = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const shownAt = useRef(0)

  useEffect(() => {
    const unsubscribe = apiLoading.subscribe(count => {
      pending.current = count
      if (count > 0) {
        if (hide.current) clearTimeout(hide.current)
        hide.current = undefined
        if (!appear.current) appear.current = setTimeout(() => {
          appear.current = undefined
          if (pending.current > 0) {
            shownAt.current = Date.now()
            setVisible(true)
          }
        }, 80)
        return
      }
      if (appear.current) clearTimeout(appear.current)
      appear.current = undefined
      const remaining = Math.max(0, 650 - (Date.now() - shownAt.current))
      hide.current = setTimeout(() => { setVisible(false); hide.current = undefined }, remaining)
    })
    return () => {
      unsubscribe()
      if (appear.current) clearTimeout(appear.current)
      if (hide.current) clearTimeout(hide.current)
    }
  }, [])

  if (!visible || onSplash) return null
  // Only the spinner is shown: no caption or decorations around it.
  return <View pointerEvents="none" style={styles.layer} accessibilityRole="progressbar" accessibilityLabel="Yükleniyor">
    <SharedBlur intensity={9} tint="dark" style={StyleSheet.absoluteFill} />
    <SplashMarkSpinner />
  </View>
}

const styles = StyleSheet.create({
  layer: { ...StyleSheet.absoluteFill, zIndex: 900, elevation: 900, alignItems: "center", justifyContent: "center" },
  // Same tile as the splash screen's core mark.
  tile: { width: 80, height: 80, borderRadius: 28, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(105,120,255,.16)", borderWidth: 1, borderColor: "rgba(183,197,255,.42)" },
  mark: { fontFamily: "Fraunces", fontSize: 24, lineHeight: 31, color: "rgba(255,255,255,.9)", textAlign: "center" },
})

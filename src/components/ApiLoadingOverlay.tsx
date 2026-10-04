import { palette } from "../theme/palette";
import { useEffect, useRef, useState } from "react"
import { ActivityIndicator, Animated, Easing, StyleSheet, View } from "react-native"
import { BlurView } from "expo-blur"
import { apiLoading } from "../api/loading"
import { Label } from "../native/UI"

export default function ApiLoadingOverlay() {
  const [visible, setVisible] = useState(false)
  const pending = useRef(0)
  const appear = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const hide = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const shownAt = useRef(0)
  const pulse = useRef(new Animated.Value(0)).current
  const orbit = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (typeof Animated.loop !== "function") return
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ]))
    const orbitAnimation = Animated.loop(Animated.timing(orbit, { toValue: 1, duration: 2800, easing: Easing.linear, useNativeDriver: true }))
    animation.start()
    orbitAnimation.start()
    return () => { animation.stop(); orbitAnimation.stop() }
  }, [orbit, pulse])

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

  if (!visible) return null
  const spin = orbit.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] })
  const counterSpin = orbit.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "-360deg"] })
  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [.9, 1.08] })
  return <View pointerEvents="none" style={styles.layer} accessibilityRole="progressbar" accessibilityLabel="Etkinlikler hazırlanıyor">
    <BlurView intensity={9} tint="dark" style={StyleSheet.absoluteFill} />
    <Animated.View style={[styles.orbit, { transform: [{ rotate: spin }] }]}>
      {[["🏃", -64, -52], ["🎨", 64, -45], ["☕", 54, 66], ["🎵", -66, 52]].map(([icon, x, y]) => <Animated.View key={String(icon)} style={[styles.event, { transform: [{ translateX: x as number }, { translateY: y as number }, { rotate: counterSpin }] }]}><Label style={styles.eventIcon}>{icon}</Label></Animated.View>)}
      <View style={styles.orbitRing} />
    </Animated.View>
    <Animated.View style={[styles.core, { transform: [{ scale }] }]}>
      <Label style={styles.spark}>✦</Label>
    </Animated.View>
    <Label style={styles.title}>Etkinlikler hazırlanıyor</Label>
    <ActivityIndicator color="#b9c3ff" style={styles.spinner} />
  </View>
}

const styles = StyleSheet.create({
  layer: { ...StyleSheet.absoluteFill, zIndex: 900, elevation: 900, alignItems: "center", justifyContent: "center" },
  orbit: { width: 184, height: 184, alignItems: "center", justifyContent: "center" },
  event: { position: "absolute", width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,.10)", borderWidth: 1, borderColor: "rgba(226,200,117,.32)" },
  eventIcon: { fontSize: 21, lineHeight: 28, textShadowColor: "rgba(0,0,0,.55)", textShadowRadius: 8 },
  orbitRing: { position: "absolute", width: 128, height: 128, borderRadius: 64, borderWidth: 1, borderColor: "rgba(255,255,255,.08)" },
  core: { position: "absolute", marginTop: -71, width: 80, height: 80, borderRadius: 28, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(105,120,255,.16)", borderWidth: 1, borderColor: "rgba(183,197,255,.42)" },
  spark: { color: "#f4d47d", fontSize: 32, lineHeight: 38, textShadowColor: "rgba(105,120,255,.75)", textShadowRadius: 14 },
  title: { color: palette.text, fontFamily: "Outfit-SemiBold", fontSize: 13, lineHeight: 19, marginTop: 4, textShadowColor: "rgba(0,0,0,.75)", textShadowRadius: 7 },
  spinner: { marginTop: 7 },
})

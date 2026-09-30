import { useEffect, useRef, useState } from "react"
import { ActivityIndicator, Animated, StyleSheet, View } from "react-native"
import { apiLoading } from "../api/loading"
import { Label } from "../native/UI"

export default function ApiLoadingOverlay() {
  const [visible, setVisible] = useState(false)
  const pending = useRef(0)
  const appear = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const pulse = useRef(new Animated.Value(0)).current

  useEffect(() => {
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0, duration: 900, useNativeDriver: true }),
    ]))
    animation.start()
    return () => animation.stop()
  }, [pulse])

  useEffect(() => {
    const unsubscribe = apiLoading.subscribe(count => {
      pending.current = count
      if (count > 0) {
        if (!appear.current) appear.current = setTimeout(() => {
          appear.current = undefined
          if (pending.current > 0) setVisible(true)
        }, 220)
        return
      }
      if (appear.current) clearTimeout(appear.current)
      appear.current = undefined
      setVisible(false)
    })
    return () => {
      unsubscribe()
      if (appear.current) clearTimeout(appear.current)
    }
  }, [])

  if (!visible) return null
  return <View pointerEvents="auto" style={styles.layer} accessibilityRole="progressbar" accessibilityLabel="Etkinlikler hazırlanıyor">
    <View style={styles.card}>
      <Animated.Image source={require("../../assets/illustrations/event-loading.png")} style={[styles.image, {
        transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1.04] }) }, { rotate: pulse.interpolate({ inputRange: [0, 1], outputRange: ["-3deg", "3deg"] }) }],
      }]} />
      <Label style={styles.title}>Anlar hazırlanıyor</Label>
      <Label style={styles.subtitle}>Etkinlik akışın canlanıyor.</Label>
      <ActivityIndicator color="#e4c875" style={styles.spinner} />
    </View>
  </View>
}

const styles = StyleSheet.create({
  layer: { ...StyleSheet.absoluteFill, zIndex: 900, elevation: 900, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(7,12,25,.45)" },
  card: { width: 220, alignItems: "center", paddingVertical: 22, paddingHorizontal: 18, borderRadius: 28, borderWidth: 1, borderColor: "rgba(255,255,255,.18)", backgroundColor: "rgba(16,24,39,.94)", shadowColor: "#000", shadowOpacity: .35, shadowRadius: 22, shadowOffset: { width: 0, height: 12 } },
  image: { width: 112, height: 112, marginBottom: 4 },
  title: { color: "#f8fafc", fontFamily: "Outfit-SemiBold", fontSize: 16, lineHeight: 22 },
  subtitle: { color: "rgba(226,232,240,.64)", fontFamily: "Outfit", fontSize: 12, lineHeight: 18, marginTop: 3 },
  spinner: { marginTop: 12 },
})

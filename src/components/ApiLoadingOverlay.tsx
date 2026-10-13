import { usePathname } from "expo-router"
import { useEffect, useRef, useState } from "react"
import { StyleSheet, View } from "react-native"
import { SharedBlur } from "../native/SharedBlur"
import { apiLoading } from "../api/loading"
import LoadingSpinner from "./LoadingSpinner"

export default function ApiLoadingOverlay() {
  const [visible, setVisible] = useState(false)
  // Splash has its own intro animation; the overlay covers API waits on every other screen.
  const onSplash = usePathname() === "/"
  const pending = useRef(0)
  const showing = useRef(false)
  const appear = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const hide = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const shownAt = useRef(0)

  useEffect(() => {
    const unsubscribe = apiLoading.subscribe(count => {
      pending.current = count
      if (count > 0) {
        if (hide.current) clearTimeout(hide.current)
        hide.current = undefined
        if (!showing.current && !appear.current) appear.current = setTimeout(() => {
          appear.current = undefined
          if (pending.current > 0) {
            shownAt.current = Date.now()
            showing.current = true
            setVisible(true)
          }
        }, 180)
        return
      }
      if (appear.current) clearTimeout(appear.current)
      appear.current = undefined
      if (hide.current) clearTimeout(hide.current)
      const remaining = Math.max(0, 400 - (Date.now() - shownAt.current))
      hide.current = setTimeout(() => { showing.current = false; setVisible(false); hide.current = undefined }, remaining)
    })
    return () => {
      unsubscribe()
      if (appear.current) clearTimeout(appear.current)
      if (hide.current) clearTimeout(hide.current)
      appear.current = undefined
      hide.current = undefined
      showing.current = false
    }
  }, [])

  if (!visible || onSplash) return null
  // Only the spinner is shown: no caption or decorations around it.
  return <View pointerEvents="none" style={styles.layer}>
    <SharedBlur intensity={28} tint="dark" style={StyleSheet.absoluteFill} />
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.tint]} />
    <LoadingSpinner size="large" />
  </View>
}

const styles = StyleSheet.create({
  layer: { ...StyleSheet.absoluteFill, zIndex: 900, elevation: 900, alignItems: "center", justifyContent: "center" },
  tint: { backgroundColor: "rgba(8,11,24,.12)" },
})

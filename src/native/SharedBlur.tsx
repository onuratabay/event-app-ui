import { BlurView, type BlurViewProps } from "expo-blur"
import { type ReactNode } from "react"
import { Platform, View } from "react-native"
import { palette } from "../theme/palette"

/** Keep the native navigator outside Android's blur capture hierarchy. */
export function BlurSurface({ children, overlay }: { children: ReactNode; overlay?: ReactNode }) {
  return <>
    <View style={{ flex: 1 }}>{children}</View>
    {overlay}
  </>
}
export function SharedBlur({ style, children, tint = "dark", intensity = 50, ...props }: BlurViewProps) {
  // Android fallback also avoids capturing a target from a different Modal window.
  // Re-enable native capture only after verifying navigation on a physical device.
  if (Platform.OS === "android") {
    return <View pointerEvents="none" style={[style, {
      backgroundColor: tint === "light" || tint === "extraLight" ? palette.text : palette.surface,
      opacity: Math.min(0.9, Math.max(0, intensity) / 100),
    }]}>{children}</View>
  }
  return <BlurView {...props} style={style} tint={tint} intensity={intensity}>{children}</BlurView>
}

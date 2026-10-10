import { BlurView, type BlurViewProps } from "expo-blur"
import { type ReactNode } from "react"
import { Platform, View } from "react-native"
import { palette } from "../theme/palette"
import { usePreferences } from "./preferences"

/** Keep the native navigator outside Android's blur capture hierarchy. */
export function BlurSurface({ children, overlay }: { children: ReactNode; overlay?: ReactNode }) {
  return <>
    <View style={{ flex: 1 }}>{children}</View>
    {overlay}
  </>
}
export function SharedBlur({ style, children, tint = "dark", intensity = 50, ...props }: BlurViewProps) {
  const { values } = usePreferences()
  // Android fallback also avoids capturing a target from a different Modal window.
  // Re-enable native capture only after verifying navigation on a physical device.
  // "Saydamlığı azalt" swaps the glass for a near-opaque surface on every platform.
  if (Platform.OS === "android" || values.reduceTransparency) {
    return <View pointerEvents="none" style={[style, {
      backgroundColor: tint === "light" || tint === "extraLight" ? palette.text : palette.surface,
      // Proportional so layered fades (e.g. the header backdrop) stay smooth. Without a real
      // blur the surface must be dense enough that text scrolling behind it is not legible.
      opacity: Math.min(values.reduceTransparency ? 0.96 : 0.92, Math.max(0, intensity) / 100 * (values.reduceTransparency ? 2.5 : 1.5)),
    }]}>{children}</View>
  }
  return <BlurView {...props} style={style} tint={tint} intensity={intensity}>{children}</BlurView>
}

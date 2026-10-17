import { LinearGradient } from "expo-linear-gradient"
import { Platform, StyleSheet, View } from "react-native"
import { SharedBlur } from "../native/SharedBlur"
import { usePreferences } from "../native/preferences"
import { palette } from "../theme/palette"

/** Frost for text fields: a stronger blur and a denser tint so typed text always reads. */
export const INPUT_FROST = { intensity: 75, tint: "rgba(20,26,52,.6)" } as const

// Kept free of ../native/UI: UI.tsx renders DateTimeWheel, which uses this fill,
// so importing UI here (directly or via GlassUI) would create a require cycle.
/**
 * Frosted fill for a card or sheet: place it as the first child of a container with a
 * translucent `palette.glass*` background. Sheets always blur (they sit over content);
 * cards blur on iOS and use a plain tint on Android, where native blur is disabled.
 * `tint` paints a state colour over the frost (a selected option, for instance).
 */
export function GlassFill({ radius = 0, topRadius, kind = "card", tint, intensity }: { radius?: number; topRadius?: number; kind?: "card" | "sheet"; tint?: string; intensity?: number }) {
  const { values } = usePreferences()
  const corners = topRadius == null ? { borderRadius: radius } : { borderTopLeftRadius: topRadius, borderTopRightRadius: topRadius }
  const blur = kind === "sheet" || (Platform.OS === "ios" && !values.reduceTransparency)
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, corners, { overflow: "hidden" }]}>
      {blur
        ? <SharedBlur intensity={intensity ?? (kind === "sheet" ? 60 : 55)} tint="dark" style={StyleSheet.absoluteFill} />
        : <View style={[StyleSheet.absoluteFill, { backgroundColor: values.reduceTransparency ? palette.surface : "rgba(17,22,42,.5)" }]} />}
      {/* State colour (e.g. selected) goes above the blur, which would otherwise wash it out. */}
      {tint ? <View style={[StyleSheet.absoluteFill, { backgroundColor: tint }]} /> : null}
      <LinearGradient colors={palette.glassHighlight} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
    </View>
  )
}

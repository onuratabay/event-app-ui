import type { ReactNode } from "react"
import { StyleSheet } from "react-native"
import { LinearGradient } from "expo-linear-gradient"
import { Touch } from "../native/UI"
import { palette } from "../theme/palette"
import { ui } from "../theme/styles"

/**
 * The one "Devam Et" button every step uses. Inactive (something still missing): quiet grey glass. Ready: the
 * app's action gradient with a soft glow, so it is clear the step can go on. `dimmed` only changes the look;
 * `disabled` also blocks the press.
 */
export function ContinueButton({ onPress, disabled, dimmed = disabled, accessibilityLabel, children }: { onPress?: () => void; disabled?: boolean; dimmed?: boolean; accessibilityLabel?: string; children: ReactNode }) {
  return <Touch accessibilityLabel={accessibilityLabel} accessibilityState={{ disabled: !!disabled }} onPress={onPress} disabled={disabled} disabledOpacity={1} glass={dimmed} style={[[ui.wFull, ui.py4, ui.rounded2xl, ui.fontSemibold, ui.textBase, ui.trackingWide], {
    overflow: "hidden",
    borderWidth: 1,
    // Centred in both states (the ready state has no glass, which used to centre it).
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
  }, dimmed ? {
    color: palette.muted,
    borderColor: palette.glassBorder,
    backgroundColor: palette.glass,
    opacity: .75,
  } : {
    color: "#ffffff",
    borderColor: "rgba(185,195,255,.35)",
    boxShadow: "0px 10px 24px -8px rgba(105,120,255,.65)",
  }]}>
      {!dimmed && <LinearGradient pointerEvents="none" colors={palette.actionGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />}
      {children}
    </Touch>
}

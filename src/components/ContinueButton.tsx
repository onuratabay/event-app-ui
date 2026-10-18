import type { ReactNode } from "react"
import { Touch } from "../native/UI"
import { palette } from "../theme/palette"
import { ui } from "../theme/styles"

/**
 * The one "Devam Et" button every step uses: blurred glass, accent-tinted when it can go on and dimmed
 * otherwise. `dimmed` only changes the look; `disabled` also blocks the press.
 */
export function ContinueButton({ onPress, disabled, dimmed = disabled, accessibilityLabel, children }: { onPress?: () => void; disabled?: boolean; dimmed?: boolean; accessibilityLabel?: string; children: ReactNode }) {
  return <Touch accessibilityLabel={accessibilityLabel} onPress={onPress} disabled={disabled} disabledOpacity={1} glass style={[[ui.wFull, ui.py4, ui.rounded2xl, ui.fontSemibold, ui.textBase, ui.trackingWide], {
    color: dimmed ? palette.text : palette.accent,
    borderWidth: 1,
    borderColor: dimmed ? palette.glassBorder : "rgba(105,120,255,.55)",
    backgroundColor: dimmed ? palette.glass : palette.selected,
  }, dimmed && { opacity: .7 }]}>
      {children}
    </Touch>
}

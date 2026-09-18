import { Box, Label, Touch } from "../native/UI"
import { ui } from "../theme/styles"

export function ErrorNotice({
  title = "Bir şey ters gitti",
  message,
  onDismiss,
  onRetry,
}: {
  title?: string
  message: string
  onDismiss?: () => void
  onRetry?: () => void
}) {
  return (
    <Box
      accessibilityRole="alert"
      style={[[ui.wFull, ui.p4, ui.rounded2xl, ui.border, ui.bgWhite5, {
        borderColor: "rgba(224, 122, 95, 0.38)",
        backgroundColor: "rgba(224, 122, 95, 0.08)",
      }]]}
    >
      <Box style={[[ui.flex, ui.itemsStart, ui.gap3]]}>
        <Box style={[[ui.w8, ui.h8, ui.roundedXl, ui.flex, ui.itemsCenter, ui.justifyCenter, {
          backgroundColor: "rgba(224, 122, 95, 0.16)",
        }]]}>
          <Label style={[[ui.textBase, { color: "#e07a5f" }]]}>!</Label>
        </Box>
        <Box style={[[ui.flex1, ui.gap1]]}>
          <Label style={[[ui.textSm, ui.fontMedium, ui.textWhite85]]}>{title}</Label>
          <Label style={[[ui.textXs, ui.textWhite55, ui.leadingRelaxed]]}>{message}</Label>
          <Box style={[[ui.flex, ui.itemsCenter, ui.gap3, ui.mt2]]}>
            {onRetry && (
              <Touch onPress={onRetry} style={[[ui.textXs, ui.fontMedium, { color: "#c8a44a" }]]}>
                Tekrar dene
              </Touch>
            )}
            {onDismiss && (
              <Touch onPress={onDismiss} style={[[ui.textXs, ui.textWhite40]]}>
                Kapat
              </Touch>
            )}
          </Box>
        </Box>
      </Box>
    </Box>
  )
}

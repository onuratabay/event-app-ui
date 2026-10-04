import { palette } from "../theme/palette";
import { ReactNode } from "react"
import { Circle, Polyline } from "react-native-svg"
import type { TouchProps } from "../native/UI"
import { Box, Label, Touch, Vector } from "../native/UI"
import { ui } from "../theme/styles"
import { HeartIcon } from "./Icons"
/* ── ComingSoonCard ── */
interface ComingSoonCardProps {
  icon: ReactNode
  title: string
  subtitle: string
  accent?: "gold" | "violet" | "emerald"
}
const ACCENT_STYLES = {
  gold: {
    bg: "rgba(105,120,255,0.07)",
    border: "rgba(105,120,255,0.18)",
    badgeBg: "rgba(105,120,255,0.12)",
    badgeBorder: "rgba(105,120,255,0.25)",
    badgeText: palette.accent,
    iconBg: "rgba(105,120,255,0.10)",
    iconBorder: "rgba(105,120,255,0.18)",
  },
  violet: {
    bg: "rgba(146,125,255,0.07)",
    border: "rgba(146,125,255,0.18)",
    badgeBg: "rgba(146,125,255,0.12)",
    badgeBorder: "rgba(146,125,255,0.25)",
    badgeText: "rgba(178,174,248,0.95)",
    iconBg: "rgba(146,125,255,0.10)",
    iconBorder: "rgba(146,125,255,0.18)",
  },
  emerald: {
    bg: "rgba(52,211,153,0.06)",
    border: "rgba(52,211,153,0.15)",
    badgeBg: "rgba(52,211,153,0.10)",
    badgeBorder: "rgba(52,211,153,0.22)",
    badgeText: "rgba(110,231,183,0.95)",
    iconBg: "rgba(52,211,153,0.08)",
    iconBorder: "rgba(52,211,153,0.16)",
  },
}
export function ComingSoonCard({
  icon,
  title,
  subtitle,
  accent = "gold",
}: ComingSoonCardProps) {
  const s = ACCENT_STYLES[accent]
  return (
    <Box
      style={[
        [ui.rounded2xl, ui.p4, ui.flex, ui.itemsCenter, ui.gap4],
        {
          backgroundColor: s.bg,
          borderWidth: 1,
          borderColor: `${s.border}`,
        },
      ]}
    >
      <Box
        style={[
          [
            ui.w11,
            ui.h11,
            ui.roundedXl,
            ui.flex,
            ui.itemsCenter,
            ui.justifyCenter,
            ui.flexShrink0,
          ],
          {
            backgroundColor: s.iconBg,
            borderWidth: 1,
            borderColor: `${s.iconBorder}`,
          },
        ]}
      >
        {icon}
      </Box>
      <Box style={[[ui.flex1, ui.minW0]]}>
        <Label style={[[ui.textSm, ui.fontMedium, ui.textWhite75]]}>
          {title}
        </Label>
        <Label style={[[ui.textXs, ui.textWhite35, ui.mt05]]}>{subtitle}</Label>
      </Box>
      <Box
        style={[
          [
            ui.px25,
            ui.py1,
            ui.roundedFull,
            ui.text10px,
            ui.fontSemibold,
            ui.flexShrink0,
            ui.trackingWide,
          ],
          {
            backgroundColor: s.badgeBg,
            borderWidth: 1,
            borderColor: `${s.badgeBorder}`,
            color: s.badgeText,
          },
        ]}
      >
        Yakında
      </Box>
    </Box>
  )
}

/* ── ComingSoonBanner (full-width teaser) ── */
export function ComingSoonBanner({
  label,
  description,
}: {
  label: string
  description: string
}) {
  return (
    <Box
      style={[
        [
          ui.mx5,
          ui.mb4,
          ui.rounded2xl,
          ui.p4,
          ui.flex,
          ui.itemsCenter,
          ui.gap3,
        ],
        {
          borderWidth: 1,
          borderColor: "rgba(255,255,255,0.07)",
        },
      ]}
      gradient={["rgba(146,125,255,0.08)", "rgba(105,120,255,0.06)"]}
    >
      <Box
        style={[
          [
            ui.w9,
            ui.h9,
            ui.roundedXl,
            ui.flex,
            ui.itemsCenter,
            ui.justifyCenter,
            ui.flexShrink0,
          ],
          {
            backgroundColor: "rgba(146,125,255,0.12)",
            borderWidth: 1,
            borderColor: "rgba(146,125,255,0.2)",
          },
        ]}
      >
        <Vector
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="rgba(178,174,248,0.9)"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <Circle cx="12" cy="12" r="10" />
          <Polyline points="12 6 12 12 16 14" />
        </Vector>
      </Box>
      <Box style={[[ui.flex1, ui.minW0]]}>
        <Label style={[[ui.textXs, ui.fontSemibold, ui.textWhite60]]}>
          {label}
        </Label>
        <Label
          style={[[ui.text11px, ui.textWhite30, ui.mt05, ui.leadingRelaxed]]}
        >
          {description}
        </Label>
      </Box>
      <Label
        style={[
          [
            ui.px2,
            ui.py05,
            ui.roundedFull,
            ui.text9px,
            ui.fontBold,
            ui.trackingWider,
            ui.flexShrink0,
          ],
          {
            backgroundColor: "rgba(146,125,255,0.15)",
            borderWidth: 1,
            borderColor: "rgba(146,125,255,0.28)",
            color: "rgba(178,174,248,0.9)",
          },
        ]}
      >
        Az Kaldı
      </Label>
    </Box>
  )
}

export function SpringButton(props: TouchProps) {
  return <Touch {...props} />
}
export function RippleButton(props: TouchProps) {
  return <Touch {...props} />
}
export function HeartButton({
  saved,
  onChange,
  size = 14,
}: {
  saved: boolean
  onChange: (saved: boolean) => void
  size?: number
}) {
  return (
    <Touch
      accessibilityLabel={saved ? "Kaydı kaldır" : "Etkinliği kaydet"}
      onPress={(e) => {
        e.stopPropagation()
        onChange(!saved)
      }}
      style={{
        width: 44,
        height: 44,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <HeartIcon
        size={size + 4}
        strokeWidth={1.8}
        filled={saved}
        style={{ color: saved ? "#c7ceff" : "rgba(241,245,249,.78)" }}
      />
    </Touch>
  )
}
export default ComingSoonCard

import type { ReactNode } from "react"
import { StyleSheet } from "react-native"
import { BlurView } from "expo-blur"
import type { NavigateFn, Screen } from "../types"
import { Box, Label, Touch } from "../native/UI"
import { ArrowLeftIcon } from "./Icons"

export const TOP_NAV_HEIGHT = 68

export default function TopNavBar({
  navigate,
  fallback,
  onBack,
  title,
  subtitle,
  right,
  floating = true,
  backLabel,
}: {
  navigate: NavigateFn
  fallback: Screen
  onBack?: () => void
  title: string
  subtitle?: string
  right?: ReactNode
  floating?: boolean
  backLabel?: string
}) {
  return (
    <Box pointerEvents="box-none" style={[s.frame, floating && s.floatingFrame]}>
      {floating ? <BlurView intensity={34} tint="dark" style={s.backdrop} /> : null}
      <Box style={[s.bar, floating && s.floatingBar]}>
        <Touch
          accessibilityLabel="Geri git"
          onPress={onBack || (() => navigate(fallback, { back: true }))}
          style={[s.back, backLabel ? s.backWithLabel : undefined]}
        >
          <ArrowLeftIcon size={backLabel ? 17 : 21} strokeWidth={1.75} style={s.icon} />
          {backLabel ? <Label style={s.backLabel}>{backLabel}</Label> : null}
        </Touch>
        <Box style={s.copy}>
          <Label style={s.title} numberOfLines={1}>{title}</Label>
          {subtitle ? <Label style={s.subtitle} numberOfLines={1}>{subtitle}</Label> : null}
        </Box>
        <Box style={s.right}>{right}</Box>
      </Box>
    </Box>
  )
}

const s = StyleSheet.create({
  frame: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 200,
    alignItems: "center",
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  floatingFrame: {
    paddingHorizontal: 0,
    paddingTop: 0,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    // A tinted liquid-glass band keeps the application title legible over scrolling copy.
    backgroundColor: "rgba(11, 21, 44, .76)",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(195, 211, 255, .22)",
    shadowColor: "#020617",
    shadowOpacity: .3,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 9 },
  },
  bar: {
    width: "100%",
    minHeight: 52,
    paddingHorizontal: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  floatingBar: {
    paddingHorizontal: 20,
    minHeight: TOP_NAV_HEIGHT,
    backgroundColor: "rgba(36, 48, 86, .16)",
  },
  back: {
    width: 44,
    height: 44,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  backWithLabel: { width: 64, flexDirection: "row", gap: 5 },
  backLabel: {
    color: "#f8fafc",
    fontFamily: "Outfit-SemiBold",
    fontSize: 12,
    lineHeight: 16,
  },
  icon: { color: "#f8fafc" },
  copy: { flex: 1, minWidth: 0, paddingHorizontal: 12 },
  title: { color: "#f8fafc", fontFamily: "Outfit-SemiBold", fontSize: 15, lineHeight: 20 },
  subtitle: { color: "rgba(226,232,240,.62)", fontFamily: "Outfit", fontSize: 11, lineHeight: 15 },
  right: { minWidth: 44, alignItems: "flex-end", justifyContent: "center" },
})

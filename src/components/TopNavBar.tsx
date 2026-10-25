import { palette } from "../theme/palette";
import type { ReactNode } from "react"
import { StyleSheet } from "react-native"
import FeedHeaderBackdrop from "./FeedHeaderBackdrop"
import type { NavigateFn, Screen } from "../types"
import { Box, Label, Touch } from "../native/UI"
import { ArrowLeftIcon } from "./Icons"

export const TOP_NAV_HEIGHT = 68
/** One size for every top-bar control on every page: icons, text links and the back control. */
export const NAV_ICON_SIZE = 20
export const NAV_ICON_STROKE = 1.8

const TONES = { default: palette.text, accent: palette.accent, muted: "rgba(226,232,240,.62)", danger: palette.error }
/**
 * A top-bar action: pass a short text ("Ayarlar") or an icon drawn at NAV_ICON_SIZE. Every action
 * has the same touch size and text style, so the bars look alike across pages.
 */
export function NavAction({ label, onPress, disabled, tone = "default", children, walkthroughId }: {
  walkthroughId?: string
  label: string
  onPress: () => void
  disabled?: boolean
  tone?: keyof typeof TONES
  children: ReactNode
}) {
  const textual = typeof children === "string"
  return <Touch walkthroughId={walkthroughId} accessibilityLabel={label} disabled={disabled} onPress={onPress} style={[s.action, textual && s.actionText]}>
    {textual ? <Label style={[s.navText, { color: TONES[tone] }]} numberOfLines={1}>{children}</Label> : children}
  </Touch>
}

export default function TopNavBar({
  navigate,
  fallback,
  onBack,
  title,
  subtitle,
  right,
  floating = true,
  backLabel,
  onTitlePress,
  titleHint,
  hideBack = false,
  walkthroughId,
  leading,
}: {
  /** Shown before the title, e.g. the photo of the person in a one-to-one chat. */
  leading?: ReactNode
  walkthroughId?: string
  navigate: NavigateFn
  fallback: Screen
  onBack?: () => void
  title: string
  subtitle?: string
  right?: ReactNode
  floating?: boolean
  backLabel?: string
  onTitlePress?: () => void
  titleHint?: string
  /** For a tab's own top level (e.g. your profile), where there is nowhere to go back to. */
  hideBack?: boolean
}) {
  return (
    <Box pointerEvents="box-none" style={[s.frame, floating && s.floatingFrame]}>
      {floating ? <FeedHeaderBackdrop /> : null}
      <Box style={[s.bar, floating && s.floatingBar]}>
        {hideBack ? null : <Touch
          accessibilityLabel="Geri git"
          onPress={onBack || (() => navigate(fallback, { back: true }))}
          style={[s.back, backLabel ? s.backWithLabel : undefined]}
        >
          <ArrowLeftIcon size={NAV_ICON_SIZE} strokeWidth={NAV_ICON_STROKE} style={s.icon} />
          {backLabel ? <Label style={s.backLabel}>{backLabel}</Label> : null}
        </Touch>}
        {onTitlePress ? (
          <Touch walkthroughId={walkthroughId} accessibilityLabel={title} accessibilityHint={titleHint} onPress={onTitlePress} style={[s.copy, hideBack && s.copyFlush, leading ? s.copyRow : undefined]}>
            {leading}
            {title ? <Box style={leading ? s.copyText : undefined}>
              <Label style={s.title} numberOfLines={1}>{title}</Label>
              {subtitle ? <Label style={s.subtitle} numberOfLines={1}>{subtitle}</Label> : null}
            </Box> : null}
          </Touch>
        ) : (
          <Box walkthroughId={walkthroughId} style={[s.copy, hideBack && s.copyFlush, leading ? s.copyRow : undefined]}>
            {leading}
            {title ? <Box style={leading ? s.copyText : undefined}>
              <Label style={s.title} numberOfLines={1}>{title}</Label>
              {subtitle ? <Label style={s.subtitle} numberOfLines={1}>{subtitle}</Label> : null}
            </Box> : null}
          </Box>
        )}
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
    backgroundColor: "transparent",
  },
  back: {
    width: 44,
    height: 44,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  backWithLabel: { width: "auto", minWidth: 44, paddingHorizontal: 4, flexDirection: "row", gap: 4 },
  // Same text style as every NavAction.
  navText: { color: palette.text, fontFamily: "Outfit-SemiBold", fontSize: 13, lineHeight: 17 },
  backLabel: { color: palette.text, fontFamily: "Outfit-SemiBold", fontSize: 13, lineHeight: 17 },
  action: { minWidth: 44, height: 44, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  actionText: { paddingHorizontal: 8 },
  icon: { color: palette.text },
  copy: { flex: 1, minWidth: 0, paddingHorizontal: 12, justifyContent: "center" },
  copyRow: { flexDirection: "row", alignItems: "center", justifyContent: "flex-start", gap: 10 },
  copyText: { flex: 1, minWidth: 0, alignItems: "flex-start" },
  // Without a back button the title lines up with the page's left margin.
  copyFlush: { paddingLeft: 0 },
  title: { color: palette.text, fontFamily: "Outfit-SemiBold", fontSize: 15, lineHeight: 20 },
  subtitle: { color: "rgba(226,232,240,.62)", fontFamily: "Outfit", fontSize: 11, lineHeight: 15 },
  right: { minWidth: 44, flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 2 },
})

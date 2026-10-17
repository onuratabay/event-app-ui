import { palette } from "../theme/palette";
import { useEffect, useRef, useState } from "react"
import { Animated, Easing, Keyboard, Platform, StyleSheet } from "react-native"
import { BrandMark } from "./Brand"
import { useReduceMotion } from "./GlassUI"
import { useStore } from "../native/Store"
import { Box, Label, Picture, Touch } from "../native/UI"
import type { NavigateFn, Screen } from "../types"
import { MessageIcon, LocationIcon, CompassIcon } from "./Icons"
const nav: [Screen, string][] = [
  ["discover", "Keşfet"],
  ["map", "Harita"],
  ["create-event", "Oluştur"],
  ["rooms", "Odalar"],
  ["profile", "Profil"],
]
// Floating bar geometry. Bar radius = item radius + bar padding, so the active pill's
// corners run parallel to the bar's; every tab target is 52pt tall (above the 44/48 minimums).
const BAR_OFFSET = 10
const BAR_PADDING = 6
const ITEM_HEIGHT = 52
const ITEM_RADIUS = 16
/** Space the floating bar occupies above the bottom edge; content and sticky bars sit above it. */
export const NAV_CLEARANCE = BAR_OFFSET + ITEM_HEIGHT + BAR_PADDING * 2 + 2
export function useKeyboardVisible() {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow", () => setVisible(true))
    const hide = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide", () => setVisible(false))
    return () => { show.remove(); hide.remove() }
  }, [])
  return visible
}
/** Bottom padding a screen needs so the global bar never covers its content (0 while typing). */
export function useBottomNavInset() {
  return useKeyboardVisible() ? 0 : NAV_CLEARANCE
}
export default function BottomNav({
  active,
  navigate,
}: {
  active: Screen
  navigate: NavigateFn
}) {
  const { data } = useStore()
  const ME = data.user
  const reduceMotion = useReduceMotion()
  // Tapping "Oluştur" spins the W one full turn around its vertical axis with a small lift.
  const spin = useRef(new Animated.Value(0)).current
  const spinMark = () => {
    if (reduceMotion) return
    spin.stopAnimation()
    spin.setValue(0)
    Animated.timing(spin, { toValue: 1, duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start()
  }
  return (
    <Box pointerEvents="box-none" style={s.frame}>
      <Box glass style={s.bar}>
        {nav.map(([screen, label]) => (
          <Touch
            key={screen}
            accessibilityLabel={label}
            accessibilityState={{ selected: active === screen }}
            onPress={() => { if (screen === "create-event") spinMark(); navigate(screen) }}
            style={[
              s.item,
              active === screen && { backgroundColor: "rgba(185,195,255,.12)", borderColor: "rgba(185,195,255,.20)" },
              screen === "create-event" && s.create,
            ]}
          >
            {screen === "map" ? (
              <LocationIcon
                size={22}
                strokeWidth={1.75}
                style={{ color: active === screen ? palette.accent : palette.muted }}
              />
            ) : screen === "rooms" ? (
              <MessageIcon
                size={22}
                strokeWidth={1.75}
                style={{ color: active === screen ? palette.accent : palette.muted }}
              />
            ) : screen === "profile" ? (
              <Picture
                uri={ME.avatar}
                style={[s.avatar, active === screen && s.avatarActive]}
              />
            ) : (
              screen === "create-event" ? <Animated.View style={{ transform: [
                { perspective: 600 },
                { rotateY: spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] }) },
                { scale: spin.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1.18, 1] }) },
              ] }}><BrandMark size={34} /></Animated.View> : <CompassIcon size={22} strokeWidth={1.75} style={{ color: active === screen ? "#c7ceff" : palette.muted }} />
            )}
            {screen !== "create-event" && (
              <Label
                numberOfLines={1}
                style={[s.label, { color: active === screen ? "#c7ceff" : palette.muted }]}
              >
                {label}
              </Label>
            )}
          </Touch>
        ))}
      </Box>
    </Box>
  )
}
const s = StyleSheet.create({
  frame: {
    position: "absolute",
    bottom: BAR_OFFSET,
    left: 16,
    right: 16,
    alignItems: "center",
  },
  bar: {
    width: "100%",
    maxWidth: 420,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    padding: BAR_PADDING,
    borderRadius: ITEM_RADIUS + BAR_PADDING,
    backgroundColor: "rgba(11,16,32,.94)",
    borderWidth: 1,
    borderColor: "rgba(183,197,255,.12)",
    boxShadow: "0px 10px 22px rgba(0,0,0,.28)",
  },
  item: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    height: ITEM_HEIGHT,
    paddingVertical: 6,
    borderRadius: ITEM_RADIUS,
    borderWidth: 1,
    borderColor: "transparent",
  },
  // Square, slightly set apart from its neighbours so the primary action reads as one.
  // Dark glass tile with a blue rim and glow, like the app icon, so the colourful W stands out.
  create: { flex: 0, width: ITEM_HEIGHT, marginHorizontal: 4, backgroundColor: "#141a3c", borderColor: "rgba(122,140,255,.55)",
    boxShadow: "0px 0px 14px rgba(105,120,255,.45)" },
  label: { fontSize: 11, lineHeight: 14, letterSpacing: 0.2, fontFamily: "Outfit-Medium" },
  avatar: { width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, borderColor: "transparent" },
  avatarActive: { borderColor: palette.accent },
})

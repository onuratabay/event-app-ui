import { palette } from "../theme/palette"
import React, { useEffect, useRef, useState } from "react"
import { AccessibilityInfo, Animated, Easing, StyleSheet, View } from "react-native"
import { LinearGradient } from "expo-linear-gradient"
import { GlassFill, INPUT_FROST } from "./GlassFill"
import { useScreenActive } from "../native/useScreenActive"
import { LockIcon } from "./Icons"
import { formatScore } from "../events/score"
import Svg, { Circle, Defs, LinearGradient as SvgLinearGradient, Path, RadialGradient, Rect, Stop } from "react-native-svg"
import {
  Box,
  Field,
  Label,
  Picture,
  Touch,
  type NativeStyleProp,
  type TouchProps,
} from "../native/UI"
const s = StyleSheet.create({
  card: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: palette.glassBorder,
    backgroundColor: palette.glassCard,
  },
  bleed: { position: "absolute", top: -48, left: -48, right: -48, bottom: -48 },
  tile: { flex: 1, borderRadius: 28, borderWidth: 1, borderColor: "rgba(220,228,255,.10)", overflow: "hidden" },
  input: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.glassBorder,
    backgroundColor: "transparent",
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: palette.text,
    fontSize: 16,
  },
  locked: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, opacity: 0.6 },
  lockedText: { flex: 1, color: palette.text, fontSize: 16 },
  // Inputs cannot hold children, so the frost sits in a frame behind a transparent field.
  inputFrame: { borderRadius: 16 },
  label: {
    fontSize: 13,
    color: "rgba(241,245,249,.72)",
    marginBottom: 6,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    minHeight: 44,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: palette.glassBorder,
    backgroundColor: palette.glass,
    color: "rgba(248,250,252,.88)",
  },
  selected: {
    backgroundColor: palette.selected,
    borderColor: "rgba(105,120,255,.38)",
    color: palette.accent,
  },
  row: { flexDirection: "row", alignItems: "center" },
  gold: { backgroundColor: palette.selected, borderColor: "rgba(105,120,255,.38)", color: palette.accent },
})
export function GlassCard({
  style,
  variant,
  children,
  onPress,
  ...props
}: TouchProps & { variant?: "default" | "strong" | "dark" }) {
  const Component = onPress ? Touch : Box
  return (
    <Component
      {...props}
      onPress={onPress}
      style={[
        s.card,
        variant === "strong" && { backgroundColor: palette.glassCardStrong },
        style,
      ]}
    >
      <GlassFill radius={Number((StyleSheet.flatten([s.card, style] as never) as { borderRadius?: number } | undefined)?.borderRadius ?? 20)} />
      {children}
    </Component>
  )
}
type InputProps = React.ComponentProps<typeof Field> & {
  label?: string
  icon?: string
}
/** A submitted value shown as a disabled field: visible, but not editable while the application is pending. */
export function LockedField({ label, value }: { label: string; value: string }) {
  return (
    <Box style={{ flexShrink: 1, flexGrow: 1 }} accessible accessibilityLabel={`${label}: ${value}, kilitli`}>
      <Label style={s.label}>{label}</Label>
      <Box style={[s.input, s.locked]}>
        <GlassFill radius={16} {...INPUT_FROST} />
        <Label style={s.lockedText} numberOfLines={1}>{value}</Label>
        <LockIcon size={14} style={{ color: palette.muted }} />
      </Box>
    </Box>
  )
}
export function GlassInput({ label, icon, style, ...props }: InputProps) {
  return (
    <Box style={{ flexShrink: 1, flexGrow: 1 }}>
      {label && <Label style={s.label}>{label}</Label>}
      <View style={s.inputFrame}>
        <GlassFill radius={16} {...INPUT_FROST} />
        <Field
          {...props}
          accessibilityLabel={props.accessibilityLabel || label || props.placeholder}
          style={[s.input, style]}
        />
      </View>
    </Box>
  )
}
export function GlassTextarea(props: InputProps) {
  return <GlassInput {...props} multiline />
}
export function FilterChip({
  label,
  selected,
  onPress,
  emoji,
  solid = false,
}: {
  label: string
  selected: boolean
  onPress: () => void
  emoji?: string
  solid?: boolean
}) {
  return (
    <Touch
      onPress={onPress}
      accessibilityState={{ selected }}
      style={[s.chip, { flexShrink: 0 }, selected && s.gold, solid && { backgroundColor: selected ? palette.selected : palette.glass, borderColor: selected ? "rgba(105,120,255,.38)" : palette.glassBorder, borderWidth: 1, minHeight: 44, paddingHorizontal: 15, paddingVertical: 11 }]}
    >
      <Label style={solid ? { color: selected ? palette.accent : palette.text, fontFamily: "Outfit-SemiBold", fontSize: 13 } : undefined}>

        {label}
      </Label>
    </Touch>
  )
}
export function InterestChip({
  label,
  selected,
  onPress,
}: {
  label: string
  selected: boolean
  onPress: () => void
}) {
  return (
    <Touch
      onPress={onPress}
      accessibilityState={{ selected }}
      style={[s.chip, { borderRadius: 12 }, selected && s.selected]}
    >
      <Label>{label}</Label>
    </Touch>
  )
}
export function Avatar({
  uri,
  name,
  size = "md",
  style,
}: {
  uri: string
  name: string
  size?: "xs" | "sm" | "md" | "lg" | "xl"
  style?: NativeStyleProp
}) {
  const d = { xs: 24, sm: 32, md: 40, lg: 56, xl: 80 }[size]
  return (
    <Picture
      uri={uri}
      accessibilityLabel={name}
      style={[
        {
          width: d,
          height: d,
          borderRadius: d / 2,
          borderWidth: 2,
          borderColor: "rgba(255,255,255,.1)",
        },
        style,
      ]}
    />
  )
}
export function ProgressStepper({
  current,
  total,
}: {
  current: number
  total: number
  labels?: string[]
}) {
  return (
    <Box style={s.row}>
      {Array.from({ length: total }, (_, i) => (
        <Box key={i} style={s.row}>
          <Box
            style={[
              {
                width: 28,
                height: 28,
                borderRadius: 14,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "rgba(255,255,255,.1)",
              },
              i < current && s.gold,
            ]}
          >
            <Label style={{ fontSize: 12 }}>{i < current ? "✓" : i + 1}</Label>
          </Box>
          {i < total - 1 && (
            <Box
              style={{
                width: 32,
                height: 1,
                marginHorizontal: 4,
                backgroundColor:
                  i < current ? palette.accent : "rgba(255,255,255,.15)",
              }}
            />
          )}
        </Box>
      ))}
    </Box>
  )
}
export function AccordionItem({
  title,
  children,
  open,
  onToggle,
}: {
  title: string
  children: React.ReactNode
  open: boolean
  onToggle: () => void
}) {
  return (
    <Box style={{ borderBottomWidth: 1, borderColor: "rgba(255,255,255,.08)" }}>
      <Touch
        onPress={onToggle}
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          paddingVertical: 14,
        }}
      >
        <Label>{title}</Label>
        <Label>{open ? "▴" : "▾"}</Label>
      </Touch>
      {open && (
        <Label
          style={{
            paddingBottom: 14,
            color: "rgba(255,255,255,.55)",
            lineHeight: 22,
          }}
        >
          {children}
        </Label>
      )}
    </Box>
  )
}
export function ScoreBadge({ score, label }: { score: number; label: string }) {
  return (
    <Box
      style={[s.row, { justifyContent: "space-between", paddingVertical: 8 }]}
    >
      <Label style={{ color: "rgba(255,255,255,.6)" }}>{label}</Label>
      <Box style={[s.row, { gap: 6 }]}>
        {[1, 2, 3, 4, 5].map((i) => (
          <Box
            key={i}
            style={{
              width: 6,
              height: 6,
              borderRadius: 3,
              backgroundColor:
                i <= Math.round(score) ? palette.accent : "rgba(255,255,255,.15)",
            }}
          />
        ))}
        <Label style={{ color: palette.accent, marginLeft: 4 }}>
          {formatScore(score)}
        </Label>
      </Box>
    </Box>
  )
}
type Tile = { size: number; top: `${number}%`; left: `${number}%`; depth: number; drift: number; angle: string; tint: 0 | 1 | 2 }
const TILES: Tile[] = [
  { size: 172, top: "11%", left: "-20%", depth: 26, drift: 18, angle: "-16deg", tint: 0 },
  { size: 128, top: "27%", left: "62%", depth: -20, drift: -22, angle: "14deg", tint: 1 },
  { size: 102, top: "48%", left: "9%", depth: 16, drift: 14, angle: "22deg", tint: 2 },
  { size: 154, top: "59%", left: "66%", depth: -28, drift: -16, angle: "-9deg", tint: 0 },
  { size: 78, top: "76%", left: "33%", depth: 12, drift: 20, angle: "18deg", tint: 1 },
]
type Glyph = { body: string; detail?: string; dots?: [number, number, number][] }
type EventShape = Omit<Tile, "tint"> & { glyph: Glyph; color: string }
// Duotone event glyphs on a 48 grid: a filled body, stroked inner detail and solid accent dots.
const GLYPHS = {
  ticket: { body: "M10 10h28a4 4 0 0 1 4 4v5a5 5 0 0 0 0 10v5a4 4 0 0 1-4 4H10a4 4 0 0 1-4-4v-5a5 5 0 0 0 0-10v-5a4 4 0 0 1 4-4Z",
    detail: "M31 13v3m0 4v3m0 4v3m0 4v2M18.5 18.5l1.6 3.4 3.7.5-2.7 2.6.7 3.7-3.3-1.8-3.3 1.8.7-3.7-2.7-2.6 3.7-.5Z" },
  music: { body: "M18 12l20-5v6l-20 5v-6ZM18 34a4.5 4.5 0 1 1-9 0 4.5 4.5 0 1 1 9 0ZM38 29a4.5 4.5 0 1 1-9 0 4.5 4.5 0 1 1 9 0Z", detail: "M18 18v16M38 13v16" },
  pin: { body: "M24 43s-13-11.3-13-21a13 13 0 0 1 26 0c0 9.7-13 21-13 21Z", detail: "M29 22a5 5 0 1 1-10 0 5 5 0 0 1 10 0ZM17 45.5h14" },
  calendar: { body: "M8 14a4 4 0 0 1 4-4h24a4 4 0 0 1 4 4v22a4 4 0 0 1-4 4H12a4 4 0 0 1-4-4V14Z",
    detail: "M8 19h32M16 6v8M32 6v8M29 29h5v5h-5z", dots: [[16, 25, 1.3], [22.5, 25, 1.3], [29, 25, 1.3], [35, 25, 1.3], [16, 31.5, 1.3], [22.5, 31.5, 1.3]] },
  cocktail: { body: "M8 10h32L24 28 8 10Z", detail: "M24 28v12m-8 0h16M13 15.5h22M31 3l-6 13", dots: [[27, 12, 2.6]] },
  coffee: { body: "M10 18h22v10a10 10 0 0 1-10 10h-2a10 10 0 0 1-10-10V18Z", detail: "M32 21h3a5 5 0 0 1 0 10h-3M7 42h30M15 6c-1.5 2 1.5 4 0 6m6-7c-1.5 2 1.5 4 0 6m6-5c-1.5 2 1.5 4 0 6" },
  mic: { body: "M18 10a6 6 0 0 1 12 0v12a6 6 0 0 1-12 0V10Z", detail: "M12 20v2a12 12 0 0 0 24 0v-2M24 34v8m-7 0h14M18 13h4m-4 5h4" },
  clapper: { body: "M8 21h32v17a3 3 0 0 1-3 3H11a3 3 0 0 1-3-3V21Z", detail: "M7 15.5l29.5-8 1.5 5.6-29.5 8L7 15.5ZM14.5 13.5l4.5 5M22 11.5l4.5 5M29.5 9.5l4.5 5M8 28h32" },
  headphones: { body: "M8 28a4 4 0 0 1 4-4h2a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-2a4 4 0 0 1-4-4v-8ZM40 28a4 4 0 0 0-4-4h-2a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h2a4 4 0 0 0 4-4v-8Z",
    detail: "M8 30v-6a16 16 0 0 1 32 0v6" },
  popper: { body: "M8 42l7-21 12 12-19 9Z", detail: "M27 20c2-4 1-8-2-10m5 12c3-1 6 1 6 4M22 13c2-3 6-3 8-1M33 8l1-3m4 8 3-1", dots: [[26, 5, 1.6], [42, 21, 1.6], [17, 10, 1.4], [37, 31, 1.3]] },
  sparkle: { body: "M24 6Q26 22 42 24 26 26 24 42 22 26 6 24 22 22 24 6Z" },
  mountain: { body: "M4 40l13-20 7 9 6-10 14 21H4Z", detail: "M13 26l4 3 4-3m6-2 3 2 3-2M38 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z" },
  chat: { body: "M6 12a4 4 0 0 1 4-4h18a4 4 0 0 1 4 4v10a4 4 0 0 1-4 4H16l-6 5v-5a4 4 0 0 1-4-4V12Z",
    detail: "M36 18h2a4 4 0 0 1 4 4v9a4 4 0 0 1-4 4v5l-6-5h-9a4 4 0 0 1-4-4v-1", dots: [[13, 17, 1.6], [19, 17, 1.6], [25, 17, 1.6]] },
  art: { body: "M24 6C13 6 6 13.5 6 23s7.5 18 17 18c3 0 4-2 3-4s0-4 3-4h5c4 0 8-3 8-9 0-10-8-17-18-17Z",
    dots: [[15, 23, 2.2], [18.5, 15, 2.2], [27, 12.5, 2.2], [34.5, 18.5, 2.2]] },
} satisfies Record<string, Glyph>
const EVENT_SHAPES: EventShape[] = [
  { glyph: GLYPHS.ticket, size: 120, top: "7%", left: "-10%", depth: 24, drift: 16, angle: "-14deg", color: palette.accent },
  { glyph: GLYPHS.music, size: 86, top: "4%", left: "70%", depth: -20, drift: -18, angle: "10deg", color: palette.violet },
  { glyph: GLYPHS.sparkle, size: 40, top: "18%", left: "46%", depth: 10, drift: 22, angle: "0deg", color: palette.text },
  { glyph: GLYPHS.headphones, size: 80, top: "25%", left: "76%", depth: 18, drift: 14, angle: "-8deg", color: palette.cyan },
  { glyph: GLYPHS.pin, size: 78, top: "31%", left: "3%", depth: -16, drift: -14, angle: "-6deg", color: palette.cyan },
  { glyph: GLYPHS.chat, size: 90, top: "42%", left: "50%", depth: 14, drift: 18, angle: "6deg", color: palette.accent },
  { glyph: GLYPHS.cocktail, size: 82, top: "51%", left: "-5%", depth: -22, drift: -16, angle: "-10deg", color: palette.violet },
  { glyph: GLYPHS.art, size: 64, top: "38%", left: "84%", depth: 12, drift: 20, angle: "12deg", color: palette.violet },
  { glyph: GLYPHS.calendar, size: 100, top: "57%", left: "70%", depth: -26, drift: -14, angle: "9deg", color: palette.accent },
  { glyph: GLYPHS.mic, size: 70, top: "66%", left: "30%", depth: 16, drift: 16, angle: "-12deg", color: palette.cyan },
  { glyph: GLYPHS.sparkle, size: 30, top: "71%", left: "8%", depth: -10, drift: -22, angle: "0deg", color: palette.text },
  { glyph: GLYPHS.popper, size: 80, top: "75%", left: "72%", depth: 20, drift: 14, angle: "8deg", color: palette.violet },
  { glyph: GLYPHS.coffee, size: 72, top: "82%", left: "4%", depth: -14, drift: -16, angle: "6deg", color: palette.cyan },
  { glyph: GLYPHS.clapper, size: 84, top: "86%", left: "44%", depth: 14, drift: 18, angle: "-7deg", color: palette.accent },
  { glyph: GLYPHS.mountain, size: 74, top: "14%", left: "22%", depth: -12, drift: -12, angle: "0deg", color: palette.cyan },
]
const dotPath = ([x, y, r]: [number, number, number]) => `M${x + r} ${y}a${r} ${r} 0 1 1-${2 * r} 0a${r} ${r} 0 1 1 ${2 * r} 0Z`
function EventGlyph({ glyph, color, size, id }: { glyph: Glyph; color: string; size: number; id: number }) {
  // Stroke scaled against the 48 grid so every glyph draws a ~1.6px line whatever its size.
  const stroke = 1.6 * 48 / size
  return (
    <Svg width="100%" height="100%" viewBox="-2 -2 52 52">
      <Defs>
        <RadialGradient id={`glow${id}`} cx="50%" cy="50%" rx="50%" ry="50%">
          <Stop offset="0" stopColor={color} stopOpacity={0.16} />
          <Stop offset="1" stopColor={color} stopOpacity={0} />
        </RadialGradient>
        <SvgLinearGradient id={`fill${id}`} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={color} stopOpacity={0.26} />
          <Stop offset="1" stopColor={color} stopOpacity={0.03} />
        </SvgLinearGradient>
        <SvgLinearGradient id={`line${id}`} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={color} stopOpacity={0.62} />
          <Stop offset="1" stopColor={color} stopOpacity={0.2} />
        </SvgLinearGradient>
      </Defs>
      <Circle cx={24} cy={24} r={26} fill={`url(#glow${id})`} />
      <Path d={glyph.body} fill={`url(#fill${id})`} stroke={`url(#line${id})`} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" />
      {glyph.detail ? <Path d={glyph.detail} fill="none" stroke={`url(#line${id})`} strokeWidth={stroke * 0.85} strokeLinecap="round" strokeLinejoin="round" /> : null}
      {glyph.dots ? <Path d={glyph.dots.map(dotPath).join("")} fill={color} fillOpacity={0.45} /> : null}
    </Svg>
  )
}
const withAlpha = (hex: string, alpha: number) => {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`
}
// One device-motion subscription shared by every mounted background, released with the last one.
const tilt = { x: new Animated.Value(0), y: new Animated.Value(0) }
let tiltUsers = 0
let stopTilt: (() => void) | undefined
function startTilt() {
  let cancelled = false
  let subscription: { remove: () => void } | undefined
  let motion: typeof import("expo-sensors").DeviceMotion | undefined
  // Missing native module (tests, previews) leaves the background drifting without parallax.
  try { motion = require("expo-sensors").DeviceMotion } catch { return () => {} }
  if (!motion) return () => {}
  const deviceMotion = motion
  void deviceMotion.isAvailableAsync().then(available => {
    if (!available || cancelled) return
    deviceMotion.setUpdateInterval(60)
    subscription = deviceMotion.addListener(({ rotation }) => {
      tilt.x.setValue(Math.max(-1, Math.min(1, (rotation?.gamma || 0) / 0.45)))
      tilt.y.setValue(Math.max(-1, Math.min(1, (rotation?.beta || 0) / 0.45)))
    })
  }).catch(() => {})
  return () => { cancelled = true; subscription?.remove() }
}
function useTilt(active: boolean) {
  useEffect(() => {
    if (!active) return
    if (tiltUsers++ === 0) stopTilt = startTilt()
    return () => { if (--tiltUsers === 0) { stopTilt?.(); stopTilt = undefined } }
  }, [active])
}
export function useReduceMotion() {
  const [reduce, setReduce] = useState(false)
  useEffect(() => {
    let active = true
    void AccessibilityInfo.isReduceMotionEnabled().then(value => { if (active) setReduce(value) }).catch(() => {})
    const subscription = AccessibilityInfo.addEventListener?.("reduceMotionChanged", setReduce)
    return () => { active = false; subscription?.remove() }
  }, [])
  return reduce
}
/** Ambient screen backdrop: drifting glows and glass tiles that follow the device tilt. */
export function AtmoBackground({
  variant = "violet",
  motif = "tiles",
}: {
  variant?: "violet" | "gold" | "success"
  /** "events" swaps the glass tiles for outline glyphs of an event night (used on the feed). */
  motif?: "tiles" | "events"
}) {
  const colors = {
    violet: [palette.blue, palette.violet],
    gold: [palette.violet, palette.blue],
    success: [palette.blue, palette.success],
  }[variant]
  const screenActive = useScreenActive()
  const reduceMotion = useReduceMotion()
  const moving = screenActive && !reduceMotion
  const drift = useRef(new Animated.Value(0)).current
  useTilt(moving)
  useEffect(() => {
    if (!moving) return
    const ease = Easing.inOut(Easing.quad)
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(drift, { toValue: 1, duration: 14000, easing: ease, useNativeDriver: true }),
      Animated.timing(drift, { toValue: 0, duration: 14000, easing: ease, useNativeDriver: true }),
    ]))
    loop.start()
    return () => loop.stop()
  }, [drift, moving])
  const along = (from: number, to: number) => drift.interpolate({ inputRange: [0, 1], outputRange: [from, to] })
  const tileTints = [
    [withAlpha(colors[1], 0.2), withAlpha(colors[0], 0.05)],
    [withAlpha(palette.accent, 0.16), withAlpha(colors[1], 0.04)],
    ["rgba(248,250,252,.12)", withAlpha(palette.cyan, 0.03)],
  ] as const
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { overflow: "hidden" }]}>
      <Animated.View style={[s.bleed, { transform: [{ translateX: along(-26, 26) }, { translateY: along(-14, 22) }, { scale: along(1, 1.08) }] }]}>
        <Svg width="100%" height="100%">
          <Defs>
            <RadialGradient id="atmo" cx="28%" cy="14%" rx="82%" ry="65%">
              <Stop offset="0" stopColor={colors[0]} stopOpacity={0.26} />
              <Stop offset="1" stopColor={colors[0]} stopOpacity={0} />
            </RadialGradient>
            <RadialGradient id="atmoSecondary" cx="88%" cy="78%" rx="70%" ry="62%">
              <Stop offset="0" stopColor={colors[1]} stopOpacity={0.18} />
              <Stop offset="1" stopColor={colors[1]} stopOpacity={0} />
            </RadialGradient>
            <RadialGradient id="atmoTertiary" cx="6%" cy="62%" rx="55%" ry="40%">
              <Stop offset="0" stopColor={palette.cyan} stopOpacity={0.09} />
              <Stop offset="1" stopColor={palette.cyan} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#atmo)" />
          <Rect width="100%" height="100%" fill="url(#atmoSecondary)" />
          <Rect width="100%" height="100%" fill="url(#atmoTertiary)" />
        </Svg>
      </Animated.View>
      {(motif === "events" ? EVENT_SHAPES : TILES).map((tile, index) => (
        <Animated.View
          key={index}
          style={{ position: "absolute", top: tile.top, left: tile.left, width: tile.size, height: tile.size,
            transform: [{ translateX: along(-tile.drift, tile.drift) }, { translateY: along(tile.drift * 0.6, -tile.drift * 0.6) }] }}
        >
          <Animated.View style={["glyph" in tile ? { flex: 1 } : s.tile, { transform: [
            { perspective: 900 },
            { translateX: tilt.x.interpolate({ inputRange: [-1, 1], outputRange: [-tile.depth, tile.depth] }) },
            { translateY: tilt.y.interpolate({ inputRange: [-1, 1], outputRange: [-tile.depth, tile.depth] }) },
            { rotate: tile.angle },
            { rotateX: tilt.y.interpolate({ inputRange: [-1, 1], outputRange: ["-7deg", "7deg"] }) },
            { rotateY: tilt.x.interpolate({ inputRange: [-1, 1], outputRange: ["7deg", "-7deg"] }) },
          ] }]}>
            {"glyph" in tile
              ? <EventGlyph glyph={tile.glyph} color={tile.color} size={tile.size} id={index} />
              : <LinearGradient colors={tileTints[tile.tint]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />}
          </Animated.View>
        </Animated.View>
      ))}
    </View>
  )
}
export { GlassFill }
export default GlassCard

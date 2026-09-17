import React from "react"
import { StyleSheet, View } from "react-native"
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg"
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
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.1)",
    backgroundColor: "rgba(255,255,255,.07)",
  },
  input: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.12)",
    backgroundColor: "rgba(255,255,255,.06)",
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: "#fff",
    fontSize: 14,
  },
  label: {
    fontSize: 12,
    color: "rgba(255,255,255,.5)",
    marginBottom: 6,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.1)",
    backgroundColor: "rgba(255,255,255,.06)",
    color: "rgba(255,255,255,.7)",
  },
  selected: {
    backgroundColor: "rgba(200,164,74,.2)",
    borderColor: "rgba(200,164,74,.6)",
    color: "#c8a44a",
  },
  row: { flexDirection: "row", alignItems: "center" },
  gold: { backgroundColor: "#c8a44a", color: "#1a1200" },
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
      glass
      style={[
        s.card,
        variant === "strong" && { backgroundColor: "rgba(255,255,255,.12)" },
        style,
      ]}
    >
      {children}
    </Component>
  )
}
type InputProps = React.ComponentProps<typeof Field> & {
  label?: string
  icon?: string
}
export function GlassInput({ label, icon, style, ...props }: InputProps) {
  return (
    <Box style={{ flexShrink: 1, flexGrow: 1 }}>
      {label && <Label style={s.label}>{label}</Label>}
      <Field
        {...props}
        accessibilityLabel={label || props.placeholder}
        style={[s.input, style]}
      />
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
}: {
  label: string
  selected: boolean
  onPress: () => void
  emoji?: string
}) {
  return (
    <Touch
      onPress={onPress}
      accessibilityState={{ selected }}
      style={[s.chip, { flexShrink: 0 }, selected && s.gold]}
    >
      <Label>
        {emoji ? `${emoji} ` : ""}
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
                  i < current ? "#c8a44a" : "rgba(255,255,255,.15)",
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
                i <= Math.round(score) ? "#c8a44a" : "rgba(255,255,255,.15)",
            }}
          />
        ))}
        <Label style={{ color: "#c8a44a", marginLeft: 4 }}>
          {score.toFixed(1)}
        </Label>
      </Box>
    </Box>
  )
}
export function AtmoBackground({
  variant = "violet",
}: {
  variant?: "violet" | "gold" | "success"
}) {
  const color = { violet: "#4c1d95", gold: "#92400e", success: "#065f46" }[
    variant
  ]
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg width="100%" height="100%">
        <Defs>
          <RadialGradient id="atmo" cx="40%" cy="25%" rx="80%" ry="65%">
            <Stop offset="0" stopColor={color} stopOpacity={0.32} />
            <Stop offset="1" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#atmo)" />
      </Svg>
    </View>
  )
}
export default GlassCard

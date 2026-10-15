import { palette } from "../theme/palette";
import DateTimeWheel from "../components/DateTimeWheel"
import { SharedBlur } from "./SharedBlur"
import { usePreferences } from "./preferences"
import { photoUri } from "../api/client"
import * as Haptics from "expo-haptics"
import { Image } from "expo-image"
import { LinearGradient, type LinearGradientProps } from "expo-linear-gradient"
import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react"
import {
  Alert,
  Animated,
  Keyboard,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type GestureResponderEvent,
  type ImageStyle,
  type ScrollViewProps,
  type StyleProp,
  type TextInputProps,
  type TextProps,
  type TextStyle,
  type ViewProps,
  type ViewStyle,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import Svg, { type SvgProps } from "react-native-svg"

export type NativeStyle = ViewStyle & TextStyle
export type NativeStyleProp = StyleProp<NativeStyle>
const Typography = createContext<TextStyle>({
  color: palette.text,
  fontFamily: "Outfit",
  fontSize: 15,
  lineHeight: 21,
})
const textKeys = [
  "color",
  "fontFamily",
  "fontSize",
  "fontWeight",
  "fontStyle",
  "textAlign",
  "letterSpacing",
  "lineHeight",
  "textTransform",
  "textDecorationLine",
] as const
function split(style: NativeStyleProp) {
  const flat = StyleSheet.flatten(style) || {}
  const text: TextStyle = {},
    view: ViewStyle = { ...flat }
  for (const key of textKeys) {
    if (flat[key] !== undefined) Object.assign(text, { [key]: flat[key] })
    delete (view as Record<string, unknown>)[key]
  }
  return { text, view }
}
function font(style: TextStyle): TextStyle {
  const { fontWeight, ...rest } = style
  const family = style.fontFamily === "Fraunces" ? "Fraunces" : "Outfit"
  const weight = Number(fontWeight) || 400
  return {
    ...rest,
    includeFontPadding: false,
    fontFamily:
      family === "Fraunces"
        ? "Fraunces"
        : weight >= 600
          ? "Outfit-SemiBold"
          : weight >= 500
            ? "Outfit-Medium"
            : !fontWeight && ["Outfit-Medium", "Outfit-SemiBold"].includes(style.fontFamily || "")
              ? style.fontFamily
              : "Outfit",
  }
}
interface LayoutProps extends Omit<ViewProps, "style"> {
  style?: NativeStyleProp
  children?: ReactNode
  columns?: number
  glass?: boolean
  gradientDirection?: "up" | "down" | "right"
  gradient?: LinearGradientProps["colors"]
  enter?: boolean
}
function Content({
  children,
  columns,
  style,
}: {
  children: ReactNode
  columns?: number
  style: ViewStyle
}) {
  const gap = Number(style.columnGap ?? style.gap ?? 0)
  const rowGap = Number(style.rowGap ?? style.gap ?? 0)
  if (!columns)
    return (
      <>
        {React.Children.map(children, (c) =>
          typeof c === "string" || typeof c === "number" ? (
            <Label>{c}</Label>
          ) : (
            c
          ),
        )}
      </>
    )
  // Explicit rows of equal flex cells instead of a wrapping row: nothing can wrap, so device
  // pixel rounding (which pushed cells onto one per line on Android) cannot break the grid.
  const items = React.Children.toArray(children)
  const rows: ReactNode[][] = []
  for (let index = 0; index < items.length; index += columns) rows.push(items.slice(index, index + columns))
  return (
    <View style={{ width: "100%", gap: rowGap }}>
      {rows.map((row, rowIndex) => (
        <View key={rowIndex} style={{ flexDirection: "row", gap }}>
          {Array.from({ length: columns }, (_, cellIndex) => {
            const cell = row[cellIndex]
            return (
              <View
                key={React.isValidElement(cell) && cell.key != null ? cell.key : `cell-${cellIndex}`}
                style={{ flex: 1, minWidth: 0 }}
              >
                {cell ?? null}
              </View>
            )
          })}
        </View>
      ))}
    </View>
  )
}
function Paint({
  glass,
  gradient,
  gradientDirection,
  radius,
}: Pick<LayoutProps, "glass" | "gradient" | "gradientDirection"> & { radius?: number }) {
  if (!glass && !gradient) return null
  return (
    <View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        { borderRadius: radius || 0, overflow: "hidden" },
      ]}
    >
      {glass && (
        <>
          {/* Strong enough that copy scrolling behind glass buttons is blurred out. */}
          <SharedBlur intensity={70} tint="dark" style={StyleSheet.absoluteFill} />
          <LinearGradient
            colors={["rgba(183,197,255,.035)", "rgba(183,197,255,.01)", "rgba(146,125,255,.02)"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        </>
      )}
      {gradient && (
        <LinearGradient
          colors={gradient}
          start={gradientDirection==="up"?{x:.5,y:1}:gradientDirection==="down"?{x:.5,y:0}:{x:0,y:0}}
          end={gradientDirection==="up"?{x:.5,y:0}:gradientDirection==="down"?{x:.5,y:1}:gradientDirection==="right"?{x:1,y:0}:{x:1,y:1}}
          style={StyleSheet.absoluteFill}
        />
      )}
    </View>
  )
}
function useEntrance(enter?: boolean) {
  const a = useRef(new Animated.Value(enter ? 0 : 1)).current
  useEffect(() => {
    if (enter) {
      Animated.timing(a, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }).start()
      return () => a.stopAnimation()
    }
  }, [a, enter])
  return a
}
export function Box({
  style,
  children,
  columns,
  glass,
  gradient,
  gradientDirection,
  enter,
  ...props
}: LayoutProps) {
  const inherited = useContext(Typography),
    { text, view } = split(style),
    a = useEntrance(enter)
  return (
    <Typography.Provider value={{ ...inherited, ...text }}>
      <Animated.View {...props} style={[view, enter && { opacity: a }]}>
        <Paint
          glass={glass}
          gradient={gradient}
          gradientDirection={gradientDirection}
          radius={view.borderRadius as number}
        />
        <Content columns={columns} style={view}>
          {children}
        </Content>
      </Animated.View>
    </Typography.Provider>
  )
}
export function Label({
  style,
  enter: _,
  glass: __,
  gradient: ___,
  gradientDirection: ____,
  children,
  ...props
}: Omit<TextProps, "style"> & {
  style?: NativeStyleProp
  enter?: boolean
  glass?: boolean
  gradientDirection?: "up" | "down" | "right"
  gradient?: LinearGradientProps["colors"]
}) {
  const inherited = useContext(Typography)
  const flat = StyleSheet.flatten(style) || {}
  const ownTypography = split(style).text
  const typography = { ...inherited, ...ownTypography }
  // A larger font must not inherit the 15px body line height. That caused
  // display headings to be vertically clipped on smaller devices.
  if (ownTypography.fontSize !== undefined && ownTypography.lineHeight === undefined) {
    typography.lineHeight = Math.ceil(Number(ownTypography.fontSize) * 1.28)
  }
  // A size inherited from a parent box can still sit on the body line height; on Android
  // (no font padding) that cut descenders off. Never let the line be shorter than the type needs.
  const minimumLine = Math.ceil(Number(typography.fontSize ?? 0) * 1.28)
  if (typography.lineHeight !== undefined && Number(typography.lineHeight) < minimumLine) typography.lineHeight = minimumLine
  // Fixed type size keeps every device on the same layout regardless of system font scale.
  return <Typography.Provider value={typography}><Text allowFontScaling={false} {...props} style={[flat, font(typography)]}>{children}</Text></Typography.Provider>
}

export interface TouchProps extends LayoutProps {
  onPress?: (event: GestureResponderEvent) => void
  onLongPress?: (event: GestureResponderEvent) => void
  disabled?: boolean
  rippleColor?: string
  haptic?: boolean
  disabledOpacity?: number
}
let lastHapticAt = 0
const AnimatedPressable = Animated.createAnimatedComponent(Pressable)
export function Touch({
  style,
  children,
  onPress,
  disabled,
  columns,
  glass,
  gradient,
  gradientDirection,
  enter,
  rippleColor,
  haptic = true,
  disabledOpacity = 0.35,
  ...props
}: TouchProps) {
  const inherited = useContext(Typography),
    { text, view } = split(style)
  const { values: preferences } = usePreferences()
  const scale = useRef(new Animated.Value(1)).current
  const animate = (toValue: number) =>
    Animated.spring(scale, {
      toValue,
      speed: 35,
      bounciness: 8,
      useNativeDriver: true,
    }).start()
  return (
    <Typography.Provider
      value={{
        ...inherited,
        ...(typeof children === "string"
          ? { textAlign: "center" as const }
          : {}),
        ...text,
      }}
    >
      <AnimatedPressable
        {...props}
        accessibilityRole={props.accessibilityRole || "button"}
        accessibilityState={{ ...props.accessibilityState, disabled }}
        disabled={disabled}
        hitSlop={8}
        onPress={onPress ? (event) => {
          if (disabled) return
          const now = Date.now()
          if (haptic && preferences.haptics && now - lastHapticAt >= 80) {
            lastHapticAt = now
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
          }
          onPress(event)
        } : undefined}
        onPressIn={() => animate(0.97)}
        onPressOut={() => animate(1)}
        android_ripple={rippleColor ? { color: rippleColor } : undefined}
        style={[
          { minHeight: view.height ? undefined : 44, justifyContent: "center" },
          view,
          {
            transform: [
              ...(Array.isArray(view.transform) ? view.transform : []),
              { scale },
            ],
            opacity: disabled ? disabledOpacity : view.opacity,
          },
        ]}
      >
        <Paint
          glass={glass}
          gradient={gradient}
          gradientDirection={gradientDirection}
          radius={view.borderRadius as number}
        />
        <Content columns={columns} style={view}>
          {children}
        </Content>
      </AnimatedPressable>
    </Typography.Provider>
  )
}
/** Inside a `Scroll` with `keyboardReveal`: called by a focused `Field` so it is scrolled above the keyboard. */
const KeyboardRevealContext = createContext<((input: TextInput | null) => void) | null>(null)
const assignRef = <T,>(ref: React.Ref<T> | undefined, value: T | null) => {
  if (typeof ref === "function") ref(value)
  else if (ref) (ref as React.RefObject<T | null>).current = value
}
/** Space kept between the focused field and the top of the keyboard. */
const KEYBOARD_GAP = 24
/**
 * Scrolls the focused field above the keyboard once it is open: measures where the field sits on screen
 * and, if the keyboard would cover it, scrolls just enough to show it with a small gap.
 */
function useKeyboardReveal(enabled: boolean, scrollRef: React.RefObject<ScrollView | null>) {
  const offset = useRef(0)
  const keyboardTop = useRef<number | null>(null)
  const pending = useRef<TextInput | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const scrollAbove = (input: TextInput | null) => {
    const top = keyboardTop.current
    if (!input || top === null) return
    input.measureInWindow((_x, y, _width, height) => {
      const overlap = y + height + KEYBOARD_GAP - top
      if (overlap > 0) scrollRef.current?.scrollTo({ y: offset.current + overlap, animated: true })
    })
  }
  useEffect(() => {
    if (!enabled) return
    // The layout settles (resize / keyboard-avoiding padding) right after the keyboard opens.
    const shown = Keyboard.addListener("keyboardDidShow", event => {
      keyboardTop.current = event.endCoordinates.screenY
      const input = pending.current
      pending.current = null
      clearTimeout(timer.current)
      timer.current = setTimeout(() => scrollAbove(input), 60)
    })
    const hidden = Keyboard.addListener("keyboardDidHide", () => { keyboardTop.current = null })
    return () => { shown.remove(); hidden.remove(); clearTimeout(timer.current) }
  }, [enabled])
  const reveal = (input: TextInput | null) => {
    // Keyboard already open (moving to the next field): scroll now; otherwise once it has opened.
    if (keyboardTop.current !== null) { clearTimeout(timer.current); timer.current = setTimeout(() => scrollAbove(input), 60) }
    else pending.current = input
  }
  return { reveal: enabled ? reveal : null, offset }
}
export function Scroll({
  style,
  children,
  horizontal,
  ref,
  keyboardReveal = false,
  onScroll,
  enter: _,
  glass: __,
  ...props
}: Omit<ScrollViewProps, "style"> & {
  style?: NativeStyleProp
  enter?: boolean
  glass?: boolean
  ref?: React.Ref<ScrollView>
  /** Keep the focused text field above the keyboard (forms). */
  keyboardReveal?: boolean
}) {
  const scrollRef = useRef<ScrollView | null>(null)
  const { reveal, offset } = useKeyboardReveal(keyboardReveal, scrollRef)
  const inherited = useContext(Typography),
    { text, view } = split(style)
  const {
    padding,
    paddingTop,
    paddingBottom,
    paddingLeft,
    paddingRight,
    gap,
    rowGap,
    columnGap,
    justifyContent,
    alignItems,
    flexDirection,
    ...frame
  } = view
  return (
    <Typography.Provider value={{ ...inherited, ...text }}>
      <ScrollView
        {...props}
        ref={node => { scrollRef.current = node; assignRef(ref, node) }}
        onScroll={event => { offset.current = event.nativeEvent.contentOffset.y; onScroll?.(event) }}
        scrollEventThrottle={props.scrollEventThrottle ?? 16}
        horizontal={horizontal}
        style={[frame, horizontal ? { flexGrow: 0 } : { flex: 1 }]}
        contentContainerStyle={{
          padding,
          paddingTop,
          paddingBottom,
          paddingLeft,
          paddingRight,
          gap,
          rowGap,
          columnGap,
          justifyContent,
          alignItems,
          flexDirection: horizontal ? "row" : flexDirection || "column",
          flexGrow: horizontal ? 0 : 1,
        }}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        automaticallyAdjustKeyboardInsets={Platform.OS === "ios"}
      >
        <KeyboardRevealContext.Provider value={reveal}><Content style={view}>{children}</Content></KeyboardRevealContext.Provider>
      </ScrollView>
    </Typography.Provider>
  )
}
export function Picture({
  uri,
  style,
  accessibilityLabel,
}: {
  uri: string
  style?: NativeStyleProp
  accessibilityLabel?: string
}) {
  const sourceUri = photoUri(uri?.trim() || "")
  const [failedUri, setFailedUri] = useState<string | null>(null)
  const failed = !sourceUri || failedUri === sourceUri
  return failed ? (
    <View
      accessibilityLabel={accessibilityLabel}
      style={[
        split(style).view,
        {
          backgroundColor: palette.elevated,
          alignItems: "center",
          justifyContent: "center",
        },
      ]}
    >
      <Text allowFontScaling={false} style={{ color: palette.accent, fontFamily: "Outfit-Medium", fontSize: 16, lineHeight: 22, includeFontPadding: false }}>
        {accessibilityLabel?.slice(0, 1) || "✦"}
      </Text>
    </View>
  ) : (
    <Image
      source={{ uri: sourceUri }}
      recyclingKey={sourceUri}
      accessibilityLabel={accessibilityLabel}
      style={split(style).view as ImageStyle}
      contentFit="cover"
      transition={150}
      onError={() => setFailedUri(sourceUri)}
    />
  )
}
interface FieldProps extends Omit<TextInputProps, "style"> {
  style?: NativeStyleProp
  mode?: "email" | "tel" | "date" | "time" | string
  ref?: React.Ref<TextInput>
  glass?: boolean
}
export function Field({
  style,
  mode,
  value,
  onChangeText,
  ref,
  glass: _,
  ...props
}: FieldProps) {
  const inherited = useContext(Typography)
  const reveal = useContext(KeyboardRevealContext)
  const inputRef = useRef<TextInput | null>(null)
  const [open, setOpen] = useState(false)
  const dateMode = mode === "date" || mode === "time"
  if (dateMode)
    return (
      <>
        <Touch
          accessibilityLabel={
            props.accessibilityLabel || props.placeholder || mode
          }
          style={[{ minHeight: 52, paddingVertical: 12, justifyContent: "center" }, style]}
          // An open keyboard would cover the bottom picker panel (Android keeps it up over modals).
          onPress={() => { Keyboard.dismiss(); setOpen(true) }}
        >
          <Label>{(mode === "date" && value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value.split("-").reverse().join("/") : value) || (mode === "time" ? "Saat seç" : "Tarih seç")}</Label>
        </Touch>
        {/* defaultValue sets where the wheel starts while the field is still empty (e.g. a birth year). */}
        {open && <DateTimeWheel mode={mode as "date" | "time"} value={value || props.defaultValue} onConfirm={next => onChangeText?.(next)} onClose={() => setOpen(false)} />}
      </>
    )
  return (
    <TextInput
      allowFontScaling={false}
      {...props}
      ref={node => { inputRef.current = node; assignRef(ref, node) }}
      onFocus={event => { props.onFocus?.(event); reveal?.(inputRef.current) }}
      value={value}
      onChangeText={onChangeText}
      style={[
        { minHeight: 52, paddingVertical: 12, paddingHorizontal: 0, textAlignVertical: "center" },
        style,
        font({ ...inherited, ...split(style).text }),
        // A line height on a single-line input pushes the text (and placeholder) below the vertical
        // centre on iOS, out of line with icons next to it; only multi-line inputs keep it.
        !props.multiline && { lineHeight: undefined },
        props.multiline && { minHeight: 96, textAlignVertical: "top" },
      ]}
      keyboardType={
        mode === "email"
          ? "email-address"
          : mode === "tel"
            ? "phone-pad"
            : props.keyboardType
      }
      autoCapitalize={mode === "email" ? "none" : props.autoCapitalize}
      underlineColorAndroid="transparent"
      cursorColor={palette.accent}
      placeholderTextColor="rgba(226,232,240,.48)"
      selectionColor="#c7ceff"
    />
  )
}
export function Vector({
  style,
  ...props
}: Omit<SvgProps, "style"> & { style?: NativeStyleProp }) {
  const inherited = useContext(Typography),
    { text, view } = split(style)
  return <Svg {...props} color={text.color || inherited.color} style={view} />
}
export function Sheet({
  onClose,
  children,
  style,
}: LayoutProps & { onClose: () => void }) {
  return (
    <Modal
      transparent
      visible
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <Pressable style={{ flex: 1 }} onPress={onClose}>
        <SafeAreaView
          edges={["top", "bottom"]}
          style={{ flex: 1, justifyContent: "flex-end" }}
        >
          <Box
            style={[
              style,
              { position: "relative", flex: 1, justifyContent: "flex-end" },
            ]}
          >
            {children}
          </Box>
        </SafeAreaView>
      </Pressable>
    </Modal>
  )
}
export async function openExternal(url: string) {
  try {
    await Linking.openURL(url)
  } catch {
    Alert.alert("Bağlantı açılamadı", "Lütfen daha sonra tekrar dene.")
  }
}
export default Box

import { palette } from "../theme/palette";
import DateTimeWheel from "../components/DateTimeWheel"
import { SharedBlur } from "./SharedBlur"
import { usePreferences } from "./preferences"
import { notifyWalkthroughScroll, TargetRegistration, WalkthroughScrollContext } from "../walkthrough/targets"
import { useWalkthroughBlocker } from "../walkthrough/activity"
import { photoUri } from "../api/client"
import * as Haptics from "expo-haptics"
import { Image } from "expo-image"
import { LinearGradient, type LinearGradientProps } from "expo-linear-gradient"
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"
import { Alert, Animated, Keyboard, Linking, Modal, Platform, Pressable, FlatList, ScrollView, StyleSheet, Text, TextInput, View, type GestureResponderEvent, type ImageStyle, type FlatListProps, type ScrollViewProps, type StyleProp, type TextInputProps, type TextProps, type TextStyle, type ViewProps, type ViewStyle, type ScrollViewInstance, type TextInputInstance, type ViewInstance } from "react-native"
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context"
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
  walkthroughId?: string
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
  walkthroughId,
  style,
  children,
  columns,
  glass,
  gradient,
  gradientDirection,
  enter,
  ...props
}: LayoutProps) {
  const targetRef = useRef<ViewInstance | null>(null)
  const inherited = useContext(Typography),
    { text, view } = split(style),
    a = useEntrance(enter)
  return (
    <Typography.Provider value={{ ...inherited, ...text }}>
      <Animated.View {...props} ref={targetRef} collapsable={walkthroughId ? false : props.collapsable} style={[view, enter && { opacity: a }]}>
        {walkthroughId && <TargetRegistration id={walkthroughId} node={targetRef} />}
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
  walkthroughId,
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
  const targetRef = useRef<ViewInstance | null>(null)
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
        ref={targetRef}
        collapsable={walkthroughId ? false : props.collapsable}
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
        {walkthroughId && <TargetRegistration id={walkthroughId} node={targetRef} />}
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
const KeyboardRevealContext = createContext<((input: TextInputInstance | null) => void) | null>(null)

/**
 * Keyboard "next" between form fields, like Tab on a desktop: every editable field inside a Scroll
 * or Sheet registers here, and "next" moves to the field that follows it on screen (top to bottom,
 * then left to right); after the last one the keyboard closes.
 */
interface FieldChain { register: (input: TextInputInstance) => () => void; next: (from: TextInputInstance | null) => void }
const FieldChainContext = createContext<FieldChain | null>(null)
function useFieldChain(): FieldChain {
  const inputs = useRef(new Set<TextInputInstance>())
  return useMemo(() => ({
    register: input => { inputs.current.add(input); return () => { inputs.current.delete(input) } },
    next: from => {
      const place = (input: TextInputInstance) => new Promise<{ input: TextInputInstance; x: number; y: number } | null>(resolve => {
        try { input.measureInWindow((x, y, width, height) => resolve(width || height ? { input, x, y } : null)) } catch { resolve(null) }
      })
      void Promise.all([...inputs.current].map(place)).then(rows => {
        const order = rows.filter((row): row is NonNullable<typeof row> => !!row)
          .sort((a, b) => Math.abs(a.y - b.y) < 8 ? a.x - b.x : a.y - b.y)
        const index = order.findIndex(row => row.input === from)
        const target = index >= 0 ? order[index + 1] : undefined
        if (target) target.input.focus(); else Keyboard.dismiss()
      })
    },
  }), [])
}
/** A Box-sized space kept between an anchored block and the scroll area's top or bottom edge. */
const ANCHOR_GAP = 16
/**
 * Whether a vertical Scroll still has to clear the home indicator itself. The app's root leaves the
 * bottom inset to the screens (so backgrounds reach the edge); sheets and nested scrolls already did.
 */
const BottomInsetContext = createContext(true)
const ScrollAnchorContext = createContext<((target: ViewInstance | null) => void) | null>(null)
/** Scrolls the nearest Scroll so `target` is in view (used when a card or section opens). */
export const useScrollAnchor = () => useContext(ScrollAnchorContext)
/** Wraps content that appears on demand (an opened card, an extra field) and scrolls it into view. */
export function Reveal({ children, style }: { children: ReactNode; style?: NativeStyleProp }) {
  const anchor = useScrollAnchor()
  const ref = useRef<ViewInstance | null>(null)
  useEffect(() => { anchor?.(ref.current) }, [])
  return <View ref={ref} collapsable={false} style={split(style).view}>{children}</View>
}
const assignRef = <T,>(ref: React.Ref<T> | undefined, value: T | null) => {
  if (typeof ref === "function") ref(value)
  else if (ref) (ref as React.RefObject<T | null>).current = value
}
/** Space kept between the focused field and the top of the keyboard. */
const KEYBOARD_GAP = 24
/**
 * Scrolls the focused field above the keyboard once it is open: measures where the field sits on screen
 * and, if it would be hidden, scrolls just enough to show it with a small gap. "Hidden" means below the
 * keyboard or under what floats over the bottom of the scroll area (a sticky "Devam Et" bar rises with
 * the keyboard); `insetBottom` is that floating part, read from the Scroll's bottom padding.
 */
// Android has no automatic keyboard inset for scroll views (iOS: automaticallyAdjustKeyboardInsets) and the app
// draws edge to edge, so a page that fits the screen had nothing to scroll and its field stayed under the
// keyboard. While the keyboard is open, the content gets that much extra room at the bottom.
function useAndroidKeyboardSpace(enabled: boolean) {
  const [space, setSpace] = useState(0)
  useEffect(() => {
    if (!enabled || Platform.OS !== "android") return
    const shown = Keyboard.addListener("keyboardDidShow", event => setSpace(event.endCoordinates.height))
    const hidden = Keyboard.addListener("keyboardDidHide", () => setSpace(0))
    return () => { shown.remove(); hidden.remove() }
  }, [enabled])
  return space
}
function useKeyboardReveal(enabled: boolean, scrollRef: React.RefObject<ScrollViewInstance | null>, insetBottom = 0) {
  const offset = useRef(0)
  const keyboardTop = useRef<number | null>(null)
  const pending = useRef<TextInputInstance | null>(null)
  // The last field focused inside this scroll area.
  const last = useRef<TextInputInstance | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const scrollAbove = (input: TextInputInstance | null) => {
    const top = keyboardTop.current
    const scroll = scrollRef.current as unknown as ViewInstance | null
    if (!input || top === null) return
    const reveal = (visibleBottom: number) => input.measureInWindow((_x, y, _width, height) => {
      const overlap = y + height + KEYBOARD_GAP - visibleBottom
      if (overlap > 0) scrollRef.current?.scrollTo({ y: offset.current + overlap, animated: true })
    })
    // The scroll area may already end above the keyboard (resized by the keyboard-avoiding root).
    if (scroll?.measureInWindow) scroll.measureInWindow((_sx, sy, _sw, sh) => reveal(Math.min(top, sh ? sy + sh : top) - insetBottom))
    else reveal(top - insetBottom)
  }
  useEffect(() => {
    if (!enabled) return
    // The layout settles (resize / keyboard-avoiding padding) right after the keyboard opens.
    const shown = Keyboard.addListener("keyboardDidShow", event => {
      keyboardTop.current = event.endCoordinates.screenY
      // The field may still be focused from before (Android back closes the keyboard without blurring it):
      // tapping it again opens the keyboard but sends no focus event, so this area's last field is used while
      // it still has focus (other scroll areas, e.g. pages below, leave it alone).
      const focused = TextInput.State?.currentlyFocusedInput?.() as unknown as TextInputInstance | null
      const input = pending.current ?? (last.current && focused === last.current ? last.current : null)
      pending.current = null
      clearTimeout(timer.current)
      timer.current = setTimeout(() => scrollAbove(input), 60)
    })
    const hidden = Keyboard.addListener("keyboardDidHide", () => { keyboardTop.current = null })
    return () => { shown.remove(); hidden.remove(); clearTimeout(timer.current) }
  }, [enabled])
  const reveal = (input: TextInputInstance | null) => {
    last.current = input
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
  keyboardReveal = true,
  floatingBottom,
  onScroll,
  enter: _,
  glass: __,
  ...props
}: Omit<ScrollViewProps, "style"> & {
  style?: NativeStyleProp
  enter?: boolean
  glass?: boolean
  ref?: React.Ref<ScrollViewInstance>
  /** Keep the focused text field above the keyboard (on by default). */
  keyboardReveal?: boolean
  /**
   * Height of what floats over the bottom of the area (e.g. a tall sticky "Devam Et" bar). Without it the bottom
   * padding is used, capped at 120, which left content under taller bars when it was scrolled into view.
   */
  floatingBottom?: number
}) {
  const scrollRef = useRef<ScrollViewInstance | null>(null)
  const chain = useFieldChain()
  const inherited = useContext(Typography),
    { text, view } = split(style)
  // Bottom padding marks what floats over the bottom of the scroll area (sticky bars), capped like insetBottom below.
  const { reveal, offset } = useKeyboardReveal(keyboardReveal, scrollRef, floatingBottom ?? Math.min(Number(view.paddingBottom ?? view.padding ?? 0) || 0, 120))
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
  // Floating top bars and the bottom bar sit over the scroll area; its paddings mark how much.
  const insetTop = Math.min(Number(paddingTop ?? padding ?? 0) || 0, 140)
  const insetBottom = floatingBottom ?? Math.min(Number(paddingBottom ?? padding ?? 0) || 0, 120)
  const safeBottom = useSafeAreaInsets().bottom
  const clearsInset = useContext(BottomInsetContext) && !horizontal
  const keyboardSpace = useAndroidKeyboardSpace(keyboardReveal && !horizontal)
  const baseBottom = clearsInset ? (Number(paddingBottom ?? padding ?? 0) || 0) + safeBottom : paddingBottom
  const contentBottom = keyboardSpace ? (Number(baseBottom ?? 0) || 0) + keyboardSpace : baseBottom
  const anchor = (target: ViewInstance | null, animated = true) => {
    const scroll = scrollRef.current as unknown as ViewInstance | null
    if (!target || !scroll || horizontal) return
    // After the opened content has laid out: scroll the least needed to show it, top edge first.
    setTimeout(() => scroll.measureInWindow?.((_sx, sy, _sw, sh) => target.measureInWindow((_x, y, _w, h) => {
      const top = sy + insetTop + ANCHOR_GAP, bottom = sy + sh - insetBottom - ANCHOR_GAP
      const delta = y < top ? y - top : y + h > bottom ? Math.min(y + h - bottom, y - top) : 0
      if (delta) scrollRef.current?.scrollTo({ y: Math.max(0, offset.current + delta), animated })
    })), 120)
  }
  return (
    <Typography.Provider value={{ ...inherited, ...text }}>
      <ScrollView
        {...props}
        ref={node => { scrollRef.current = node; assignRef(ref, node) }}
        onScroll={event => { offset.current = event.nativeEvent.contentOffset.y; onScroll?.(event); notifyWalkthroughScroll() }}
        scrollEventThrottle={props.scrollEventThrottle ?? 16}
        horizontal={horizontal}
        // A Scroll with a maxHeight is a bounded list inside a content-sized panel (a sheet): it sizes to its
        // content up to that height. `flex: 1` there collapsed it to 0 px, so its rows never showed.
        style={[frame, horizontal ? { flexGrow: 0 } : frame.maxHeight !== undefined ? { flexGrow: 0, flexShrink: 1 } : { flex: 1 }]}
        // Paddings and gaps given in `style` go to the content; an explicit contentContainerStyle adds to them.
        contentContainerStyle={[{
          padding,
          paddingTop,
          paddingBottom: contentBottom,
          paddingLeft,
          paddingRight,
          gap,
          rowGap,
          columnGap,
          justifyContent,
          alignItems,
          flexDirection: horizontal ? "row" : flexDirection || "column",
          flexGrow: horizontal ? 0 : 1,
        }, props.contentContainerStyle]}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        automaticallyAdjustKeyboardInsets={Platform.OS === "ios"}
      >
        <KeyboardRevealContext.Provider value={reveal}><FieldChainContext.Provider value={chain}><ScrollAnchorContext.Provider value={anchor}><WalkthroughScrollContext.Provider value={anchor}>
          <BottomInsetContext.Provider value={false}><Content style={view}>{children}</Content></BottomInsetContext.Provider>
        </WalkthroughScrollContext.Provider></ScrollAnchorContext.Provider></FieldChainContext.Provider></KeyboardRevealContext.Provider>
      </ScrollView>
    </Typography.Provider>
  )
}
/**
 * Chat message list: a flipped (inverted) FlatList that opens at the newest message and renders only the
 * rows on screen. `data` is newest first. Where FlatList is unavailable (the host-mock test runner) the
 * same rows render oldest first in a plain Scroll.
 */
// `listRef` reaches the FlatList, e.g. to scroll to an answered message.
export function ChatList<T>({ listRef, ...props }: FlatListProps<T> & { listRef?: React.Ref<FlatList<T>> }) {
  if (FlatList) return <FlatList inverted ref={listRef} {...props} />
  const rows = [...(props.data as readonly T[] | null | undefined ?? [])]
  const footer = props.ListFooterComponent
  return <Scroll style={props.style as NativeStyleProp}>
    {footer ? (React.isValidElement(footer) ? footer : React.createElement(footer as React.ComponentType)) : null}
    {rows.map((item, index) => ({ item, index })).reverse().map(({ item, index }) => <React.Fragment key={props.keyExtractor ? props.keyExtractor(item, index) : String(index)}>
      {props.renderItem?.({ item, index, separators: { highlight() {}, unhighlight() {}, updateProps() {} } })}
    </React.Fragment>)}
  </Scroll>
}
export function Picture({
  uri,
  style,
  accessibilityLabel,
  fit = "cover",
}: {
  uri: string
  style?: NativeStyleProp
  accessibilityLabel?: string
  /** "cover" fills the box and crops what overflows; "contain" shows the whole photo inside it. */
  fit?: "cover" | "contain"
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
      style={[split(style).view as ImageStyle, fit === "contain" && { backgroundColor: palette.elevated }]}
      contentFit={fit}
      // Kept in memory too, so a page opened again (e.g. Discover from the bottom bar) shows covers at once.
      cachePolicy="memory-disk"
      transition={150}
      onError={() => setFailedUri(sourceUri)}
    />
  )
}
interface FieldProps extends Omit<TextInputProps, "style"> {
  style?: NativeStyleProp
  mode?: "email" | "tel" | "date" | "time" | string
  ref?: React.Ref<TextInputInstance>
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
  const chain = useContext(FieldChainContext)
  const inputRef = useRef<TextInputInstance | null>(null)
  const [open, setOpen] = useState(false)
  const dateMode = mode === "date" || mode === "time"
  // Every editable field is a stop for "next". Single-line fields also move on with their return key,
  // unless they have their own submit (search, sign in) or return key; multi-line fields keep Enter
  // for new lines.
  const inChain = !!chain && !dateMode && props.editable !== false
  const chained = inChain && !props.multiline && !props.onSubmitEditing && (props.returnKeyType === undefined || props.returnKeyType === "next")
  useEffect(() => {
    if (!inChain || !inputRef.current) return
    return chain!.register(inputRef.current)
  }, [chain, inChain])
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
      returnKeyType={chained ? "next" : props.returnKeyType}
      submitBehavior={chained ? "submit" : props.submitBehavior}
      onSubmitEditing={chained ? () => chain!.next(inputRef.current) : props.onSubmitEditing}
      value={value}
      onChangeText={onChangeText}
      style={[
        // Defaults only for what the field's own style leaves open: a default paddingHorizontal/Vertical
        // outranks a `padding` shorthand in React Native whatever the order, which pressed the text of
        // fields styled with `padding: 14` against the left edge.
        { minHeight: 52, textAlignVertical: "center", ...paddingDefaults(style) },
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
      cursorColor={props.cursorColor ?? palette.accent}
      placeholderTextColor={props.placeholderTextColor ?? "rgba(226,232,240,.48)"}
      selectionColor={props.selectionColor ?? (Platform.OS === "ios" ? palette.accent : "rgba(105,120,255,.35)")}
    />
  )
}
/** Field padding defaults (12 vertical, 0 horizontal) for the sides the style does not set itself. */
function paddingDefaults(style: NativeStyleProp) {
  const flat = (StyleSheet.flatten(style) || {}) as ViewStyle
  const has = (...keys: Array<keyof ViewStyle>) => keys.some(key => flat[key] !== undefined)
  return {
    ...(has("padding", "paddingVertical", "paddingTop", "paddingBottom") ? {} : { paddingVertical: 12 }),
    ...(has("padding", "paddingHorizontal", "paddingLeft", "paddingRight", "paddingStart", "paddingEnd") ? {} : { paddingHorizontal: 0 }),
  }
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
  useWalkthroughBlocker(true)
  const chain = useFieldChain()
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
            <BottomInsetContext.Provider value={false}><FieldChainContext.Provider value={chain}>{children}</FieldChainContext.Provider></BottomInsetContext.Provider>
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
    // System alert here: UI.tsx is imported by the app dialog itself.
    Alert.alert("Bağlantı açılamadı", "Lütfen daha sonra tekrar dene.")
  }
}
export default Box

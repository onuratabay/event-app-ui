import { useRef, type ReactNode } from "react"
import { Animated, PanResponder, StyleSheet, View } from "react-native"
import * as Haptics from "expo-haptics"
import { Box, Label, Touch } from "../native/UI"
import { usePreferences } from "../native/preferences"
import { palette } from "../theme/palette"
import { CloseIcon, ReplyIcon } from "./Icons"

/** How far a message is pulled right before letting go answers it. */
const TRIGGER = 56
const MAX_PULL = 84

/**
 * "Cevapla" like WhatsApp: pull a message to the right and let go to answer it. A short, mostly horizontal
 * pull takes the gesture, so vertical scrolling and long press keep working; the arrow fills in and the phone
 * ticks once the pull is far enough.
 */
export function SwipeToReply({ enabled, onReply, children }: { enabled: boolean; onReply: () => void; children: ReactNode }) {
  const { values: preferences } = usePreferences()
  const offset = useRef(new Animated.Value(0)).current
  const armed = useRef(false)
  // The latest props for the responder, which is created once.
  const latest = useRef({ enabled, onReply, haptics: preferences.haptics })
  latest.current = { enabled, onReply, haptics: preferences.haptics }
  const responder = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_event, { dx, dy }) => latest.current.enabled && dx > 12 && Math.abs(dx) > Math.abs(dy) * 1.6,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: () => { armed.current = false },
    onPanResponderMove: (_event, { dx }) => {
      const pull = Math.max(0, Math.min(MAX_PULL, dx))
      offset.setValue(pull)
      if (!armed.current && pull >= TRIGGER) {
        armed.current = true
        if (latest.current.haptics) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
      } else if (armed.current && pull < TRIGGER) armed.current = false
    },
    onPanResponderRelease: () => {
      if (armed.current) latest.current.onReply()
      armed.current = false
      Animated.spring(offset, { toValue: 0, useNativeDriver: true, bounciness: 6 }).start()
    },
    onPanResponderTerminate: () => {
      armed.current = false
      Animated.spring(offset, { toValue: 0, useNativeDriver: true }).start()
    },
  })).current
  const arrowOpacity = offset.interpolate({ inputRange: [0, TRIGGER], outputRange: [0, 1], extrapolate: "clamp" })
  const arrowScale = offset.interpolate({ inputRange: [0, TRIGGER], outputRange: [0.6, 1], extrapolate: "clamp" })
  return <View {...(enabled ? responder.panHandlers : {})}>
    <Animated.View pointerEvents="none" style={[s.arrow, { opacity: arrowOpacity, transform: [{ scale: arrowScale }] }]}>
      <ReplyIcon size={18} style={{ color: palette.accent }} />
    </Animated.View>
    <Animated.View style={{ transform: [{ translateX: offset }] }}>{children}</Animated.View>
  </View>
}

/** The answered message inside a reply's bubble: who wrote it and how it began. */
export function ReplyQuote({ author, text, deleted, mine, onPress }: { author: string; text: string; deleted?: boolean; mine: boolean; onPress?: () => void }) {
  const body = <>
    <Label style={[s.quoteAuthor, mine && s.quoteAuthorMine]} numberOfLines={1}>{author}</Label>
    <Label style={[s.quoteText, mine && s.quoteTextMine, deleted && s.quoteDeleted]} numberOfLines={2}>{deleted ? "Bu mesaj silindi" : text}</Label>
  </>
  return onPress
    ? <Touch accessibilityLabel={`${author} mesajına cevap: ${deleted ? "silinmiş mesaj" : text}`} accessibilityHint="Cevaplanan mesaja gider" haptic={false} onPress={onPress} style={[s.quote, mine ? s.quoteMine : s.quoteOther, { minHeight: 0 }]}>{body}</Touch>
    : <Box style={[s.quote, mine ? s.quoteMine : s.quoteOther]}>{body}</Box>
}

/** Above the composer while answering: whose message, its first line, and a button to drop the answer. */
export function ReplyBar({ author, text, onCancel }: { author: string; text: string; onCancel: () => void }) {
  return <Box style={s.bar} accessibilityLiveRegion="polite" accessibilityLabel={`Cevap veriyorsun: ${author}, ${text}`}>
    <ReplyIcon size={16} style={{ color: palette.accent }} />
    <Box style={s.barCopy}>
      <Label style={s.barAuthor} numberOfLines={1}>{author}</Label>
      <Label style={s.barText} numberOfLines={1}>{text}</Label>
    </Box>
    <Touch accessibilityLabel="Cevaplamayı iptal et" onPress={onCancel} style={s.barClose}><CloseIcon size={16} style={{ color: palette.text }} /></Touch>
  </Box>
}

const s = StyleSheet.create({
  arrow: { position: "absolute", left: 4, top: 0, bottom: 0, justifyContent: "center" },
  quote: { borderLeftWidth: 3, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5, marginBottom: 6, gap: 1 },
  quoteMine: { backgroundColor: "rgba(255,255,255,.14)", borderLeftColor: "rgba(255,255,255,.75)" },
  quoteOther: { backgroundColor: "rgba(255,255,255,.06)", borderLeftColor: palette.accent },
  quoteAuthor: { color: palette.accent, fontFamily: "Outfit-SemiBold", fontSize: 12, lineHeight: 16 },
  quoteAuthorMine: { color: "#ffffff" },
  quoteText: { color: "rgba(255,255,255,.65)", fontSize: 13, lineHeight: 17 },
  quoteTextMine: { color: "rgba(255,255,255,.8)" },
  quoteDeleted: { fontStyle: "italic" },
  bar: { flexDirection: "row", alignItems: "center", gap: 10, paddingLeft: 12, paddingRight: 4, paddingVertical: 6, borderRadius: 12, borderLeftWidth: 3, borderLeftColor: palette.accent, backgroundColor: "rgba(105,120,255,.14)" },
  barCopy: { flex: 1, minWidth: 0, gap: 1 },
  barAuthor: { color: palette.accent, fontFamily: "Outfit-SemiBold", fontSize: 12, lineHeight: 16 },
  barText: { color: "rgba(255,255,255,.7)", fontSize: 13, lineHeight: 17 },
  barClose: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
})

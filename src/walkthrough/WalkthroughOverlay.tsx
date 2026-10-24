import { useEffect, useRef, useState } from "react"
import { AccessibilityInfo, Animated, BackHandler, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions, type ViewInstance } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import Svg, { Path, Rect } from "react-native-svg"
import { SharedBlur } from "../native/SharedBlur"
import { layoutNotes, type Frame } from "./model"
import type { Guide } from "./config"

/** One screen's guide, shown at once: every step's target (null when it is not on screen). */
export interface Presentation { guide: Guide; frames: Array<Frame | null>; preview: boolean }

const CHALK = "#fff6e0"
const HAND = "Caveat"

/** A slightly bent arrow from the note to the target, with an open arrowhead. */
function arrowPath(from: { x: number; y: number }, to: { x: number; y: number }, bend: number) {
  const mx = (from.x + to.x) / 2, my = (from.y + to.y) / 2
  const dx = to.x - from.x, dy = to.y - from.y, length = Math.hypot(dx, dy) || 1
  const cx = mx - dy / length * bend, cy = my + dx / length * bend
  const angle = Math.atan2(to.y - cy, to.x - cx), head = 11
  const wing = (turn: number) => `M${to.x} ${to.y}L${to.x - head * Math.cos(angle + turn)} ${to.y - head * Math.sin(angle + turn)}`
  return `M${from.x} ${from.y}Q${cx} ${cy} ${to.x} ${to.y}${wing(0.45)}${wing(-0.45)}`
}

/**
 * The walkthrough as one annotated sheet: the screen sits under a light blur, each feature gets a
 * handwritten note with an arrow pointing at it, and a single "Anladım" closes it.
 */
export default function WalkthroughOverlay({ presentation, onDone, onClose }: { presentation: Presentation; onDone: () => void; onClose: () => void }) {
  // Drawn in the app's own window (not a Modal), so target positions and the sheet share one origin.
  const insets = useSafeAreaInsets()
  const root = useRef<ViewInstance | null>(null)
  const [box, setBox] = useState<{ x: number; y: number; width: number; height: number } | null>(null)
  const measureRoot = () => root.current?.measureInWindow((x, y, width, height) => setBox({ x, y, width, height }))
  useEffect(() => { const sub = BackHandler.addEventListener("hardwareBackPress", () => { onClose(); return true }); return () => sub.remove() }, [onClose])
  const [reduceMotion, setReduceMotion] = useState(true)
  const opacity = useRef(new Animated.Value(1)).current
  const { guide, preview } = presentation
  // Until the sheet has measured itself, assume it covers the window from its top-left corner.
  const windowSize = useWindowDimensions()
  const area = box ?? { x: 0, y: 0, width: windowSize.width, height: windowSize.height }
  const width = area.width, height = area.height
  const frames = presentation.frames.map(frame => frame ? { ...frame, x: frame.x - area.x, y: frame.y - area.y } : null)
  useEffect(() => {
    let active = true
    void AccessibilityInfo.isReduceMotionEnabled().then(value => { if (active) setReduceMotion(value) }).catch(() => {})
    const subscription = AccessibilityInfo.addEventListener?.("reduceMotionChanged", setReduceMotion)
    return () => { active = false; subscription?.remove() }
  }, [])
  useEffect(() => {
    opacity.setValue(reduceMotion ? 1 : 0)
    if (!reduceMotion) Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }).start()
    const timer = setTimeout(() => AccessibilityInfo.announceForAccessibility(`${guide.title}. ${guide.steps.map(step => `${step.title}. ${step.body}`).join(" ")}`), 120)
    return () => { clearTimeout(timer); opacity.stopAnimation() }
  }, [guide.id, reduceMotion])

  // Bottom band keeps the guide title and the button clear of every note.
  const footer = 112
  const pointed = preview ? [] : layoutNotes(guide.steps, frames, width, 56, height - footer)
  const listed = guide.steps.filter((_, index) => !pointed.some(note => note.index === index))

  return <Animated.View ref={root} onLayout={measureRoot} style={[s.root, { opacity }]} accessibilityViewIsModal onAccessibilityEscape={onClose} testID="walkthrough-sheet">
      <SharedBlur intensity={34} tint="dark" style={StyleSheet.absoluteFill} />
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, s.tint]} />
      <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
        {pointed.map(note => <Rect key={`frame-${note.index}`} x={note.target.x - 6} y={note.target.y - 6} width={note.target.width + 12} height={note.target.height + 12}
          rx={14} fill="none" stroke={CHALK} strokeOpacity={0.9} strokeWidth={2} strokeDasharray="7 6" strokeLinecap="round" />)}
        {pointed.map(note => <Path key={`arrow-${note.index}`} d={arrowPath(note.from, note.to, note.index % 2 ? -26 : 26)}
          fill="none" stroke={CHALK} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />)}
      </Svg>

      {pointed.map(note => <View key={`note-${note.index}`} pointerEvents="none" style={[s.note, { left: note.box.x, top: note.box.y, width: note.box.width }]}>
        <Text style={s.noteTitle}>{guide.steps[note.index].title}</Text>
      </View>)}

      {/* Steps whose target is not on screen (or the preview from the app guide) are read as a list. */}
      {listed.length > 0 && <ScrollView style={[s.list, { top: 56, maxHeight: Math.max(0, height - 56 - footer) }]} contentContainerStyle={s.listContent} showsVerticalScrollIndicator={false}>
        {listed.map((step, index) => <View key={step.target} style={s.listItem}>
          <Text style={s.listNumber}>{index + 1}.</Text>
          <View style={{ flex: 1 }}><Text style={s.noteTitle}>{step.title}</Text></View>
        </View>)}
      </ScrollView>}

      <Pressable accessibilityRole="button" accessibilityLabel="Rehberi geç" onPress={onClose} hitSlop={10} style={[s.skip, { top: 8 }]}>
        <Text style={s.skipText}>Geç ×</Text>
      </Pressable>
      <View style={[s.footer, { paddingBottom: Math.max(14, insets.bottom ? 6 : 14) }]}>
        <Text accessibilityRole="header" style={s.title}>{guide.title}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Anladım, rehberi kapat" onPress={onDone} style={s.done} testID="walkthrough-done">
          <Text style={s.doneText}>Anladım</Text>
          <Svg width={96} height={10} viewBox="0 0 96 10"><Path d="M3 6C24 2 52 9 93 3" fill="none" stroke={CHALK} strokeWidth={2.2} strokeLinecap="round" /></Svg>
        </Pressable>
      </View>
    </Animated.View>
}

const s = StyleSheet.create({
  root: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 1000, elevation: 1000 },
  tint: { backgroundColor: "rgba(4,7,20,.74)" },
  note: { position: "absolute", gap: 2 },
  noteTitle: { fontFamily: HAND, fontSize: 26, lineHeight: 29, color: CHALK, textShadowColor: "rgba(0,0,0,.6)", textShadowRadius: 6, textShadowOffset: { width: 0, height: 1 } },
  noteBody: { fontFamily: HAND, fontSize: 19, lineHeight: 21, color: "rgba(255,246,224,.86)" },
  list: { position: "absolute", left: 24, right: 24 },
  listContent: { gap: 18, paddingBottom: 8 },
  listItem: { flexDirection: "row", gap: 10 },
  listNumber: { fontFamily: HAND, fontSize: 26, lineHeight: 28, color: CHALK },
  skip: { position: "absolute", right: 18, minHeight: 44, minWidth: 56, alignItems: "flex-end", justifyContent: "center" },
  skipText: { fontFamily: HAND, fontSize: 22, color: "rgba(255,246,224,.8)" },
  footer: { position: "absolute", left: 24, right: 24, bottom: 0, alignItems: "center", gap: 2 },
  title: { fontFamily: HAND, fontSize: 32, lineHeight: 34, color: CHALK, textAlign: "center" },
  summary: { fontFamily: HAND, fontSize: 20, lineHeight: 22, color: "rgba(255,246,224,.8)", textAlign: "center" },
  done: { marginTop: 10, minHeight: 48, minWidth: 120, alignItems: "center", justifyContent: "center" },
  doneText: { fontFamily: HAND, fontSize: 30, lineHeight: 32, color: CHALK },
})

import { useEffect, useRef, type ReactNode } from "react"
import { Animated, Easing, StyleSheet, View } from "react-native"
import { LinearGradient } from "expo-linear-gradient"
import { useBottomNavInset } from "../components/BottomNav"
import { AtmoBackground, useReduceMotion } from "../components/GlassUI"
import { CalendarIcon, PlusIcon } from "../components/Icons"
import TopNavBar from "../components/TopNavBar"
import { Box, Label, Touch } from "../native/UI"
import { palette } from "../theme/palette"
import type { NavigateFn } from "../types"

/**
 * What the "Oluştur" tab opens: the two ways to start a plan, each filling half the screen. Hosting one
 * opens the create flow; sharing free time opens the availability screen, where organizers find and
 * invite you. Each card draws what it does (a group forming / a week with free days and an invite
 * arriving), so the choice reads without the walkthrough.
 */
export default function StartScreen({ navigate }: { navigate: NavigateFn }) {
  const inset = useBottomNavInset()
  const reduceMotion = useReduceMotion()
  const enter = useRef(new Animated.Value(0)).current
  useEffect(() => {
    if (reduceMotion) { enter.setValue(1); return }
    Animated.timing(enter, { toValue: 1, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start()
  }, [enter, reduceMotion])
  // Each card rises a little after the one above it.
  const rise = (delay: number) => ({
    opacity: enter.interpolate({ inputRange: [delay, Math.min(1, delay + 0.6)], outputRange: [0, 1], extrapolate: "clamp" }),
    transform: [{ translateY: enter.interpolate({ inputRange: [delay, Math.min(1, delay + 0.6)], outputRange: [28, 0], extrapolate: "clamp" }) }],
  })
  return <Box style={s.screen}>
    <AtmoBackground />
    <TopNavBar navigate={navigate} fallback="discover" title="Oluştur" subtitle="Yeni bir plan başlat" />
    <View style={[s.content, { paddingBottom: inset + 12 }]}>
      <Animated.View style={rise(0)}>
        <Label style={s.heading}>Ne yapmak istersin?</Label>
        <Label style={s.subheading}>Planı sen kur ya da boş zamanını paylaş, plan sana gelsin.</Label>
      </Animated.View>
      <Animated.View style={[s.slot, rise(0.1)]}>
        <ChoiceCard
          glow="rgba(105,120,255,.30)"
          tag="Sen organize et"
          title="Etkinlik oluştur"
          body="Aktiviteyi, zamanı ve yeri seç; katılmak isteyenler sana gelsin."
          cta="Plan kur"
          art={<HostArt />}
          onPress={() => navigate("create-event")}
        />
      </Animated.View>
      <Animated.View style={[s.slot, rise(0.22)]}>
        <ChoiceCard
          glow="rgba(146,125,255,.28)"
          tag="Sen davet al"
          title="Müsaitliğimi paylaş"
          body="Boş olduğun gün ve saatleri işaretle; uygun etkinliklerin organizatörleri seni davet etsin."
          cta="Zamanımı işaretle"
          art={<AvailabilityArt />}
          onPress={() => navigate("availability")}
        />
      </Animated.View>
    </View>
  </Box>
}

function ChoiceCard({ glow, tag, title, body, cta, art, onPress }: {
  glow: string; tag: string; title: string; body: string; cta: string; art: ReactNode; onPress: () => void
}) {
  return <Touch accessibilityRole="button" accessibilityLabel={`${title}. ${body}`} onPress={onPress} style={s.card}>
    {/* Dark glass like the app's cards, with one soft accent light from the art's corner and a lit top edge. */}
    <LinearGradient pointerEvents="none" colors={[glow, "rgba(105,120,255,0)"]} start={{ x: 1, y: 0 }} end={{ x: 0.2, y: 1 }} style={StyleSheet.absoluteFill} />
    <LinearGradient pointerEvents="none" colors={palette.glassHighlight} locations={[0, 0.4, 1]} style={StyleSheet.absoluteFill} />
    <View style={s.art} pointerEvents="none">{art}</View>
    <View style={s.cardText}>
      <View style={s.tag}><Label style={s.tagLabel}>{tag}</Label></View>
      <Label style={s.title}>{title}</Label>
      <Label style={s.body} numberOfLines={3}>{body}</Label>
      <View style={s.cta}><Label style={s.ctaLabel}>{cta}  →</Label></View>
    </View>
  </Touch>
}

/** A small group gathering around a plus: people joining the plan you start. */
function HostArt() {
  const people = [palette.accent, "#9aa6ff", "#b7a8ff"]
  return <View style={s.artBox}>
    <View style={s.glow} />
    <View style={s.hostCenter}><PlusIcon size={26} strokeWidth={2.2} style={{ color: palette.accent }} /></View>
    {people.map((color, i) => <View key={color} style={[s.person, { backgroundColor: color }, [s.p0, s.p1, s.p2][i]]}>
      <View style={s.personHead} /><View style={s.personBody} />
    </View>)}
  </View>
}

/** A week with free days marked and an invitation arriving for one of them. */
function AvailabilityArt() {
  const days = ["P", "S", "Ç", "P", "C", "C", "P"]
  const free = new Set([2, 5, 6])
  return <View style={s.artBox}>
    <View style={s.glow} />
    <View style={s.week}>
      <View style={s.weekHead}><CalendarIcon size={12} strokeWidth={2} style={{ color: palette.accent }} /><Label style={s.weekTitle}>Bu hafta</Label></View>
      <View style={s.days}>
        {days.map((d, i) => <View key={i} style={[s.day, free.has(i) && s.dayFree]}><Label style={[s.dayLabel, free.has(i) && s.dayLabelFree]}>{d}</Label></View>)}
      </View>
    </View>
    <View style={s.invite}><Label style={s.inviteLabel}>✉︎ Davet geldi</Label></View>
  </View>
}

const s = StyleSheet.create({
  screen: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: palette.background },
  content: { flex: 1, paddingTop: 84, paddingHorizontal: 16, gap: 14, width: "100%", maxWidth: 520, alignSelf: "center" },
  slot: { flex: 1, minHeight: 0 },
  heading: { color: palette.text, fontFamily: "Fraunces", fontSize: 28, lineHeight: 34, paddingHorizontal: 4 },
  subheading: { color: palette.muted, fontSize: 14, lineHeight: 20, paddingHorizontal: 4, marginTop: 2 },
  card: { flex: 1, borderRadius: 24, overflow: "hidden", backgroundColor: palette.glassCardStrong, borderWidth: 1, borderColor: "rgba(105,120,255,.38)",
    boxShadow: "0px 18px 32px -16px rgba(0,0,0,.75), 0px 0px 22px -8px rgba(105,120,255,.35)" },
  cardText: { padding: 18, paddingTop: 0, gap: 6 },
  tag: { alignSelf: "flex-start", paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999, backgroundColor: palette.selected, borderWidth: 1, borderColor: "rgba(105,120,255,.38)" },
  tagLabel: { color: palette.accent, fontSize: 11, fontFamily: "Outfit-SemiBold", letterSpacing: 0.4 },
  title: { color: palette.text, fontFamily: "Fraunces", fontSize: 23, lineHeight: 28 },
  body: { color: palette.muted, fontSize: 13, lineHeight: 18 },
  // Same treatment as ContinueButton's ready state, so the action matches the screen it opens.
  cta: { alignSelf: "flex-start", marginTop: 4, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: palette.selected, borderWidth: 1, borderColor: "rgba(105,120,255,.55)" },
  ctaLabel: { color: palette.accent, fontSize: 13, fontFamily: "Outfit-SemiBold", letterSpacing: 0.2 },
  // The drawing fills whatever height the card has above its text, drawn larger than the sheet version.
  art: { flex: 1, minHeight: 0, alignItems: "center", justifyContent: "center", transform: [{ scale: 1.35 }] },
  artBox: { width: 104, height: 104, alignItems: "center", justifyContent: "center" },
  glow: { position: "absolute", width: 92, height: 92, borderRadius: 46, backgroundColor: "rgba(105,120,255,.10)", borderWidth: 1, borderColor: "rgba(185,195,255,.08)" },
  hostCenter: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", backgroundColor: palette.selected, borderWidth: 1, borderColor: "rgba(105,120,255,.55)",
    boxShadow: "0px 0px 16px rgba(105,120,255,.45)" },
  person: { position: "absolute", width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "flex-end", overflow: "hidden", borderWidth: 2, borderColor: palette.surface },
  personHead: { width: 10, height: 10, borderRadius: 5, backgroundColor: "rgba(17,22,42,.55)", marginBottom: 2 },
  personBody: { width: 18, height: 8, borderTopLeftRadius: 9, borderTopRightRadius: 9, backgroundColor: "rgba(17,22,42,.55)" },
  p0: { top: 4, left: 10 },
  p1: { top: 14, right: 2 },
  p2: { bottom: 4, left: 30 },
  week: { width: 100, padding: 7, borderRadius: 12, backgroundColor: "rgba(8,11,24,.6)", borderWidth: 1, borderColor: palette.glassBorder, gap: 6 },
  weekHead: { flexDirection: "row", alignItems: "center", gap: 4 },
  weekTitle: { color: palette.accent, fontSize: 10, fontFamily: "Outfit-Medium" },
  days: { flexDirection: "row", justifyContent: "space-between" },
  day: { width: 11, height: 18, borderRadius: 4, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,.06)" },
  dayFree: { backgroundColor: palette.violet, boxShadow: "0px 0px 6px rgba(146,125,255,.7)" },
  dayLabel: { color: palette.muted, fontSize: 8, lineHeight: 10, fontFamily: "Outfit-SemiBold" },
  dayLabelFree: { color: palette.text },
  invite: { position: "absolute", bottom: 8, right: -2, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, backgroundColor: palette.elevated, borderWidth: 1, borderColor: "rgba(146,125,255,.55)",
    transform: [{ rotate: "-6deg" }], boxShadow: "0px 6px 14px rgba(0,0,0,.5)" },
  inviteLabel: { color: palette.accent, fontSize: 10, fontFamily: "Outfit-SemiBold" },
})

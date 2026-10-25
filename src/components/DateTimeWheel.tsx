import { useWalkthroughBlocker } from "../walkthrough/activity"
import { useEffect, useMemo, useRef, useState } from "react"
import { Modal, Pressable, ScrollView, StyleSheet, Text, View, type ScrollViewInstance } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { palette } from "../theme/palette"
import { GlassFill } from "./GlassFill"

const ROW = 44
const pad = (value: number) => String(value).padStart(2, "0")
const months = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"]
// Cyclic wheels (hours, minutes) repeat their values so they run on: 22 · 23 · 00 · 01 and 58 · 59 · 00 · 01.
// The list holds a few copies and, after each scroll, jumps back to the same value in the middle copy (unseen),
// so it never reaches an end.
const COPIES = 5
function Wheel({ values, labels, value, onChange, label, cyclic = false }: { values: number[]; labels?: string[]; value: number; onChange: (value: number) => void; label: string; cyclic?: boolean }) {
  const ref = useRef<ScrollViewInstance>(null)
  const count = values.length
  const base = cyclic ? Math.floor(COPIES / 2) * count : 0
  const rows = cyclic ? Array.from({ length: COPIES * count }, (_, i) => values[i % count]) : values
  const index = base + Math.max(0, values.indexOf(value))
  const initialOffset = useRef({ x: 0, y: index * ROW }).current
  // One exact stop per row. A single snap interval is rounded to whole pixels once (44pt is 115.5px on a
  // 2.625x phone) and the error grows with every row: far down the list (years, the middle copy of hours and
  // minutes) the wheel stopped half a row off the selection band.
  const stops = useMemo(() => rows.map((_, i) => i * ROW), [rows.length])
  // Keep February and short months in range when the month/year changes.
  useEffect(() => {
    if (!values.includes(value)) onChange(values[values.length - 1])
  }, [values.length, value])
  useEffect(() => { ref.current?.scrollTo({ y: index * ROW, animated: false }) }, [values.length])
  const settle = (offsetY: number) => {
    const row = Math.max(0, Math.min(rows.length - 1, Math.round(offsetY / ROW)))
    const position = row % count
    if (cyclic && row !== base + position) ref.current?.scrollTo({ y: (base + position) * ROW, animated: false })
    // Stopped between rows (pixel rounding): settle exactly on the chosen row.
    else if (Math.abs(offsetY - row * ROW) > 0.5) ref.current?.scrollTo({ y: row * ROW, animated: true })
    onChange(values[position])
  }
  return <View style={s.column}>
    <View pointerEvents="none" style={s.selection} />
    <ScrollView ref={ref} style={s.wheel} contentContainerStyle={{ paddingVertical: ROW * 2 }}
      contentOffset={initialOffset} snapToOffsets={stops} decelerationRate="fast" bounces={false}
      showsVerticalScrollIndicator={false} onScrollEndDrag={event => {
        if (Math.abs(event.nativeEvent.velocity?.y || 0) < .01) settle(event.nativeEvent.contentOffset.y)
      }} onMomentumScrollEnd={event => settle(event.nativeEvent.contentOffset.y)}>
      {rows.map((item, i) => {
        const text = labels?.[i % count] || pad(item)
        return <Pressable key={i} accessibilityRole="button" accessibilityLabel={`${label}: ${text}`}
          accessibilityState={{ selected: item === value }} onPress={() => {
            onChange(item); ref.current?.scrollTo({ y: i * ROW, animated: true })
            // After the scroll, the same value moves back to the middle copy (unseen).
            if (cyclic && i !== base + i % count) setTimeout(() => ref.current?.scrollTo({ y: (base + i % count) * ROW, animated: false }), 300)
          }} style={s.option}>
          <Text allowFontScaling={false}numberOfLines={1} style={[s.text, item === value && s.active]}>{text}</Text>
        </Pressable>
      })}
    </ScrollView>
  </View>
}
export default function DateTimeWheel({ mode, value, onConfirm, onClose }: { mode: "date" | "time"; value?: string; onConfirm: (value: string) => void; onClose: () => void }) {
  const initial = new Date()
  if (mode === "date" && value && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const parsed = new Date(`${value}T12:00:00`)
    if (!isNaN(parsed.getTime())) initial.setTime(parsed.getTime())
  } else if (mode === "time" && value && /^\d{2}:\d{2}$/.test(value)) {
    const [hour, minute] = value.split(":").map(Number); initial.setHours(hour, minute)
  }
  const [year, setYear] = useState(initial.getFullYear())
  const [month, setMonth] = useState(initial.getMonth() + 1)
  const [day, setDay] = useState(initial.getDate())
  const [hour, setHour] = useState(initial.getHours())
  const [minute, setMinute] = useState(initial.getMinutes())
  const dayCount = new Date(year, month, 0).getDate()
  useEffect(() => { if (day > dayCount) setDay(dayCount) }, [dayCount, day])
  const currentYear = new Date().getFullYear()
  const firstYear = Math.min(currentYear - 100, initial.getFullYear())
  const lastYear = Math.max(currentYear + 10, initial.getFullYear())
  useWalkthroughBlocker(true)
  return <Modal transparent visible animationType="slide" statusBarTranslucent onRequestClose={onClose}>
    <View style={s.backdrop}>
      <Pressable accessibilityLabel="Seçimi kapat" onPress={onClose} style={StyleSheet.absoluteFill} />
      <SafeAreaView edges={["bottom"]} style={s.panel}><GlassFill kind="sheet" topRadius={24} />
        <View style={s.toolbar}>
          <Pressable onPress={onClose} accessibilityRole="button" style={s.action}><Text allowFontScaling={false}style={s.cancel}>İptal</Text></Pressable>
          <Text allowFontScaling={false}style={s.title}>{mode === "time" ? "Saat seç" : "Tarih seç"}</Text>
          <Pressable accessibilityRole="button" onPress={() => {
            onConfirm(mode === "time" ? `${pad(hour)}:${pad(minute)}` : `${year}-${pad(month)}-${pad(Math.min(day, dayCount))}`); onClose()
          }} style={s.action}><Text allowFontScaling={false}style={s.done}>Tamam</Text></Pressable>
        </View>
        <View style={s.row}>
          {mode === "time" ? <>
            <Wheel label="Saat" cyclic values={Array.from({ length: 24 }, (_, i) => i)} value={hour} onChange={setHour} />
            <Text allowFontScaling={false}style={s.separator}>:</Text>
            <Wheel label="Dakika" cyclic values={Array.from({ length: 60 }, (_, i) => i)} value={minute} onChange={setMinute} />
          </> : <>
            <Wheel label="Gün" values={Array.from({ length: dayCount }, (_, i) => i + 1)} value={Math.min(day, dayCount)} onChange={setDay} />
            <Wheel label="Ay" values={Array.from({ length: 12 }, (_, i) => i + 1)} labels={months} value={month} onChange={setMonth} />
            <Wheel label="Yıl" values={Array.from({ length: lastYear - firstYear + 1 }, (_, i) => firstYear + i)} value={year} onChange={setYear} />
          </>}
        </View>
      </SafeAreaView>
    </View>
  </Modal>
}
const s = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,.55)" },
  panel: { backgroundColor: palette.glassSheet, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 16, paddingBottom: 16 },
  toolbar: { height: 60, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: palette.border },
  action: { minWidth: 60, height: 44, justifyContent: "center", alignItems: "center" },
  title: { fontFamily: "Outfit-SemiBold", fontSize: 16, lineHeight: 22, color: palette.text, includeFontPadding: false },
  cancel: { fontFamily: "Outfit", fontSize: 15, lineHeight: 21, color: palette.muted, includeFontPadding: false },
  done: { fontFamily: "Outfit-SemiBold", fontSize: 15, lineHeight: 21, color: palette.accent, includeFontPadding: false },
  row: { flexDirection: "row", alignItems: "center", gap: 4 }, column: { flex: 1 }, wheel: { height: ROW * 5 },
  selection: { position: "absolute", top: ROW * 2, height: ROW, left: 0, right: 0, borderRadius: 10, backgroundColor: palette.selected },
  option: { height: ROW, alignItems: "center", justifyContent: "center" },
  text: { fontFamily: "Outfit", fontSize: 16, lineHeight: 22, includeFontPadding: false, color: palette.muted },
  active: { fontFamily: "Outfit-SemiBold", color: palette.text }, separator: { fontFamily: "Outfit", fontSize: 22, includeFontPadding: false, color: palette.text },
})

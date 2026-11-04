import { useWalkthroughBlocker } from "../walkthrough/activity"
import { useEffect, useState } from "react"
import { Modal, Platform, Pressable, StyleSheet, Text, View } from "react-native"
import DateTimePicker, { DateTimePickerAndroid } from "@react-native-community/datetimepicker"
import { SafeAreaView } from "react-native-safe-area-context"
import { palette } from "../theme/palette"
import { GlassFill } from "./GlassFill"

const pad = (value: number) => String(value).padStart(2, "0")
/** The field's value ("YYYY-MM-DD" or "HH:mm") as a Date to start the picker on; now when empty or unreadable. */
function toDate(mode: "date" | "time", value?: string) {
  const date = new Date()
  if (mode === "date" && value && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const parsed = new Date(`${value}T12:00:00`)
    if (!isNaN(parsed.getTime())) return parsed
  } else if (mode === "time" && value && /^\d{2}:\d{2}$/.test(value)) {
    const [hour, minute] = value.split(":").map(Number); date.setHours(hour, minute, 0, 0)
  }
  return date
}
const format = (mode: "date" | "time", date: Date) =>
  mode === "time" ? `${pad(date.getHours())}:${pad(date.getMinutes())}` : `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`

/**
 * The phone's own date/time picker. Android opens the system dialog (its OK/Cancel confirm or cancel); iOS shows
 * Apple's picker (calendar for dates, wheels for times) in a bottom panel with İptal/Tamam, since iOS has no
 * picker dialog of its own. The custom scroll wheels it replaces stuck between rows on some phones.
 */
export default function DateTimeWheel({ mode, value, onConfirm, onClose }: { mode: "date" | "time"; value?: string; onConfirm: (value: string) => void; onClose: () => void }) {
  const [draft, setDraft] = useState(() => toDate(mode, value))
  useWalkthroughBlocker(true)
  useEffect(() => {
    if (Platform.OS !== "android") return
    DateTimePickerAndroid.open({
      value: draft, mode, is24Hour: true,
      onChange: (event, date) => { if (event.type === "set" && date) onConfirm(format(mode, date)); onClose() },
    })
    return () => { DateTimePickerAndroid.dismiss(mode) }
  }, [])
  if (Platform.OS === "android") return null
  return <Modal transparent visible animationType="slide" statusBarTranslucent onRequestClose={onClose}>
    <View style={s.backdrop}>
      <Pressable accessibilityLabel="Seçimi kapat" onPress={onClose} style={StyleSheet.absoluteFill} />
      <SafeAreaView edges={["bottom"]} style={s.panel}><GlassFill kind="sheet" topRadius={24} />
        <View style={s.toolbar}>
          <Pressable onPress={onClose} accessibilityRole="button" style={s.action}><Text allowFontScaling={false} style={s.cancel}>İptal</Text></Pressable>
          <Text allowFontScaling={false} style={s.title}>{mode === "time" ? "Saat seç" : "Tarih seç"}</Text>
          <Pressable accessibilityRole="button" onPress={() => { onConfirm(format(mode, draft)); onClose() }} style={s.action}><Text allowFontScaling={false} style={s.done}>Tamam</Text></Pressable>
        </View>
        <View style={s.picker}>
          <DateTimePicker value={draft} mode={mode} display={mode === "date" ? "inline" : "spinner"} locale="tr-TR" is24Hour
            themeVariant="dark" accentColor={palette.blue} textColor={palette.text} onChange={(_event, date) => { if (date) setDraft(date) }} />
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
  picker: { alignItems: "center", paddingTop: 8 },
})

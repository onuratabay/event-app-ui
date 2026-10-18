import { useWalkthroughBlocker } from "../walkthrough/activity"
import { useEffect, useState } from "react"
import { Keyboard, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import Svg, { Path } from "react-native-svg"
import { TURKISH_CITIES } from "../content/cities"
import { palette } from "../theme/palette"
import { GlassFill, INPUT_FROST } from "./GlassFill"

// Turkish-aware lowercasing so typing "izmir" finds "İzmir".
// Turkish-aware lowercasing plus folded letters, so "sanliurfa" finds "Şanlıurfa" and "izmir" finds "İzmir".
const FOLD: Record<string, string> = { ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u", â: "a", î: "i", û: "u" }
const normalize = (value: string) => value.toLocaleLowerCase("tr").replace(/[çğıöşüâîû]/g, letter => FOLD[letter])

/** Select-style city field: tapping opens a searchable list of the 81 provinces. */
export default function CityPicker({ value, onChange, label = "Şehir", compact = false, clearable = false }: {
  value: string
  onChange: (city: string) => void
  label?: string
  /** Inline text style (profile header) instead of a full form field. */
  compact?: boolean
  /** Offers a clear button on the field and in the sheet; leave off where a city is required. */
  clearable?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const cities = TURKISH_CITIES.filter(city => normalize(city).includes(normalize(query.trim())))
  const close = () => { setOpen(false); setQuery("") }
  // iOS lays the keyboard over the sheet; padding the list by its height keeps every city reachable.
  // Android resizes the window itself, so it needs nothing.
  useWalkthroughBlocker(open)
  const [keyboard, setKeyboard] = useState(0)
  useEffect(() => {
    if (!open || Platform.OS !== "ios") return
    const shown = Keyboard.addListener("keyboardWillShow", event => setKeyboard(event?.endCoordinates?.height || 0))
    const hidden = Keyboard.addListener("keyboardWillHide", () => setKeyboard(0))
    return () => { shown.remove(); hidden.remove(); setKeyboard(0) }
  }, [open])
  return <>
    {!compact && <Text style={s.label}>{label}</Text>}
    <Pressable accessibilityRole="button" accessibilityLabel={`${label}: ${value || "seçilmedi"}`} onPress={() => { Keyboard.dismiss(); setOpen(true) }} style={compact ? s.compact : s.field}>
      {!compact && <GlassFill radius={16} {...INPUT_FROST} />}
      <Text style={[compact ? s.compactText : s.value, !value && s.placeholder]} numberOfLines={1}>{value || "Şehir seç"}</Text>
      {!compact && clearable && !!value && <Pressable accessibilityRole="button" accessibilityLabel="Şehri temizle" hitSlop={8} onPress={() => onChange("")} style={s.clear}>
        <Svg width={14} height={14} viewBox="0 0 24 24"><Path d="M6 6l12 12M18 6 6 18" stroke={palette.text} strokeWidth={2.4} strokeLinecap="round" /></Svg>
      </Pressable>}
      {/* A drawn chevron (not the "⌄" glyph, which sits low in the font) centres on the text line.
          The compact (profile) variant shows only the city name. */}
      {!compact && <Svg width={18} height={18} viewBox="0 0 24 24" style={s.chevron}><Path d="M6 9l6 6 6-6" fill="none" stroke={palette.muted} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /></Svg>}
    </Pressable>
    {open && <Modal transparent visible animationType="slide" statusBarTranslucent onRequestClose={close}>
      <View style={s.backdrop}>
        <Pressable accessibilityLabel="Şehir seçimini kapat" onPress={close} style={StyleSheet.absoluteFill} />
        <SafeAreaView edges={["bottom"]} style={s.panel}><GlassFill kind="sheet" topRadius={24} />
          <View style={s.toolbar}>
            <Pressable accessibilityRole="button" onPress={close} style={s.action}><Text style={s.cancel}>İptal</Text></Pressable>
            <Text style={s.title}>Şehir seç</Text>
            {clearable && value ? <Pressable accessibilityRole="button" onPress={() => { onChange(""); close() }} style={s.action}><Text style={s.cancel}>Temizle</Text></Pressable> : <View style={s.action} />}
          </View>
          <TextInput value={query} onChangeText={setQuery} placeholder="Şehir ara" placeholderTextColor={palette.muted} style={s.search} autoCorrect={false} />
          <ScrollView style={s.list} contentContainerStyle={{ paddingBottom: keyboard }} keyboardShouldPersistTaps="handled">
            {cities.map(city => <Pressable key={city} accessibilityRole="button" accessibilityState={{ selected: city === value }} onPress={() => { onChange(city); close() }} style={[s.option, city === value && s.selected]}>
              <Text style={[s.optionText, city === value && s.selectedText]}>{city}</Text>
              {city === value && <Text style={s.selectedText}>✓</Text>}
            </Pressable>)}
            {!cities.length && <Text style={s.empty}>Eşleşen şehir yok.</Text>}
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>}
  </>
}

const s = StyleSheet.create({
  label: { fontSize: 13, color: "rgba(241,245,249,.72)", marginBottom: 6, letterSpacing: 1.2, textTransform: "uppercase", fontFamily: "Outfit" },
  field: { minHeight: 52, flexDirection: "row", alignItems: "center", borderRadius: 16, borderWidth: 1, borderColor: palette.glassBorder, backgroundColor: "transparent", paddingHorizontal: 16 },
  value: { flex: 1, color: palette.text, fontSize: 16, fontFamily: "Outfit", includeFontPadding: false },
  placeholder: { color: palette.muted },
  chevron: { marginLeft: 8 },
  clear: { width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,.12)", marginLeft: 8 },
  compact: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", minHeight: 32 },
  compactText: { color: "rgba(241,245,249,.45)", fontSize: 14, fontFamily: "Outfit" },
  // The sheet keeps one height and its top edge never moves, so the search field stays above the
  // keyboard whether the list is long or filtered down to a few cities.
  backdrop: { flex: 1, justifyContent: "flex-end", paddingTop: "25%", backgroundColor: "rgba(0,0,0,.55)" },
  panel: { flex: 1, backgroundColor: palette.glassSheet, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 16, paddingBottom: 16 },
  toolbar: { height: 60, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  action: { minWidth: 60, height: 44, justifyContent: "center", alignItems: "center" },
  title: { fontFamily: "Outfit-SemiBold", fontSize: 16, color: palette.text },
  cancel: { fontFamily: "Outfit", fontSize: 15, color: palette.muted },
  search: { minHeight: 44, borderRadius: 12, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.background, paddingHorizontal: 14, color: palette.text, fontFamily: "Outfit", fontSize: 15, marginBottom: 8 },
  list: { flex: 1 },
  option: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, borderRadius: 12 },
  selected: { backgroundColor: palette.selected },
  optionText: { fontFamily: "Outfit", fontSize: 16, color: palette.text },
  selectedText: { fontFamily: "Outfit-SemiBold", fontSize: 16, color: palette.accent },
  empty: { fontFamily: "Outfit", fontSize: 14, color: palette.muted, padding: 12 },
})

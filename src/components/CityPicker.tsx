import { useState } from "react"
import { Keyboard, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { TURKISH_CITIES } from "../content/cities"
import { palette } from "../theme/palette"

// Turkish-aware lowercasing so typing "izmir" finds "İzmir".
const normalize = (value: string) => value.toLocaleLowerCase("tr")

/** Select-style city field: tapping opens a searchable list of the 81 provinces. */
export default function CityPicker({ value, onChange, label = "Şehir", compact = false }: {
  value: string
  onChange: (city: string) => void
  label?: string
  /** Inline text style (profile header) instead of a full form field. */
  compact?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const cities = TURKISH_CITIES.filter(city => normalize(city).includes(normalize(query.trim())))
  const close = () => { setOpen(false); setQuery("") }
  return <>
    {!compact && <Text style={s.label}>{label}</Text>}
    <Pressable accessibilityRole="button" accessibilityLabel={`${label}: ${value || "seçilmedi"}`} onPress={() => { Keyboard.dismiss(); setOpen(true) }} style={compact ? s.compact : s.field}>
      <Text style={[compact ? s.compactText : s.value, !value && s.placeholder]} numberOfLines={1}>{value || "Şehir seç"}</Text>
      {/* The compact (profile) variant shows only the city name; the arrow did not line up with it. */}
      {!compact && <Text style={s.chevron}>⌄</Text>}
    </Pressable>
    {open && <Modal transparent visible animationType="slide" statusBarTranslucent onRequestClose={close}>
      <View style={s.backdrop}>
        <Pressable accessibilityLabel="Şehir seçimini kapat" onPress={close} style={StyleSheet.absoluteFill} />
        <SafeAreaView edges={["bottom"]} style={s.panel}>
          <View style={s.toolbar}>
            <Pressable accessibilityRole="button" onPress={close} style={s.action}><Text style={s.cancel}>İptal</Text></Pressable>
            <Text style={s.title}>Şehir seç</Text>
            <View style={s.action} />
          </View>
          <TextInput value={query} onChangeText={setQuery} placeholder="Şehir ara" placeholderTextColor={palette.muted} style={s.search} autoCorrect={false} />
          <ScrollView style={s.list} keyboardShouldPersistTaps="handled">
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
  field: { minHeight: 52, flexDirection: "row", alignItems: "center", borderRadius: 16, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.background, paddingHorizontal: 16 },
  value: { flex: 1, color: palette.text, fontSize: 16, fontFamily: "Outfit", includeFontPadding: false },
  placeholder: { color: palette.muted },
  chevron: { color: palette.muted, fontSize: 18, marginLeft: 8 },
  compact: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", minHeight: 32 },
  compactText: { color: "rgba(241,245,249,.45)", fontSize: 14, fontFamily: "Outfit" },
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,.55)" },
  panel: { maxHeight: "75%", backgroundColor: palette.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 16, paddingBottom: 16 },
  toolbar: { height: 60, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  action: { minWidth: 60, height: 44, justifyContent: "center", alignItems: "center" },
  title: { fontFamily: "Outfit-SemiBold", fontSize: 16, color: palette.text },
  cancel: { fontFamily: "Outfit", fontSize: 15, color: palette.muted },
  search: { minHeight: 44, borderRadius: 12, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.background, paddingHorizontal: 14, color: palette.text, fontFamily: "Outfit", fontSize: 15, marginBottom: 8 },
  list: { flexGrow: 0 },
  option: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, borderRadius: 12 },
  selected: { backgroundColor: palette.selected },
  optionText: { fontFamily: "Outfit", fontSize: 16, color: palette.text },
  selectedText: { fontFamily: "Outfit-SemiBold", fontSize: 16, color: palette.accent },
  empty: { fontFamily: "Outfit", fontSize: 14, color: palette.muted, padding: 12 },
})

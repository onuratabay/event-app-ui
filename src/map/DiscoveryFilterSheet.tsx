import { useWalkthroughBlocker } from "../walkthrough/activity"
import { palette } from "../theme/palette";
import { useRef, useState } from "react"
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, View } from "react-native"
import * as Location from "expo-location"
import { FilterChip, GlassInput } from "../components/GlassUI"
import { Box, Label, Scroll, Touch } from "../native/UI"
import { PlaceSuggestionList, usePlaceSuggestions } from "./PlaceSuggestions"
import type { PlaceSuggestion } from "../api/client"
import { categoryVisual, CITY_PRESETS, DEFAULT_FILTERS, filterError, localDate, type DiscoveryFilters, type MapPlace } from "./filters"

export default function DiscoveryFilterSheet({ value, categories, onApply, onClose }: {
  value: DiscoveryFilters
  categories: Array<{ id: string; name: string }>
  onApply: (value: DiscoveryFilters) => void
  onClose: () => void
}) {
  const [draft, setDraft] = useState<DiscoveryFilters>({ ...value, interestIds: [...value.interestIds] })
  const [query, setQuery] = useState(value.place?.name || "")
  const [results, setResults] = useState<MapPlace[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const searchVersion = useRef(0)
  const search = async () => {
    if (!query.trim() || busy) return
    const version = ++searchVersion.current
    setBusy(true); setError(null); setResults([])
    try {
      if (Platform.OS === "android") {
        const permission = await Location.requestForegroundPermissionsAsync()
        if (!permission.granted) throw new Error("Konum izni olmadan aşağıdaki şehirlerden seçim yapabilirsin.")
      }
      const locations = await Location.geocodeAsync(query.trim())
      const named = await Promise.all(locations.slice(0, 5).map(async (location) => {
        let name = query.trim()
        try {
          const [address] = await Location.reverseGeocodeAsync(location)
          if (address) name = [...new Set([address.name, address.district, address.city, address.region].filter(Boolean))].join(", ") || name
        } catch { /* The searched text still labels the returned coordinate. */ }
        return { name, latitude: location.latitude, longitude: location.longitude }
      }))
      if (version !== searchVersion.current) return
      setResults(named)
      if (!named.length) setError("Konum bulunamadı. Mekân adının yanına ilçe ve şehir ekleyerek tekrar dene.")
    } catch (cause) {
      if (version === searchVersion.current) setError(cause instanceof Error && cause.message.startsWith("Konum izni") ? cause.message : "Konum araması şu an kullanılamıyor. Şehir kısayollarını kullanabilirsin.")
    } finally { setBusy(false) }
  }
  // Suggestions while typing (venues, districts, cities); "Konumu bul" stays as the geocoder fallback.
  const suggestions = usePlaceSuggestions(draft.place ? "" : query, draft.place)
  const pickSuggestion = async (suggestion: PlaceSuggestion) => {
    try {
      const place = await suggestions.resolve(suggestion)
      choosePlace({ name: place.name || suggestion.title, latitude: place.latitude, longitude: place.longitude }, 5)
    } catch { setError("Bu yer seçilemedi. Bağlantını kontrol edip tekrar dene.") }
  }
  const choosePlace = (place: MapPlace, radiusKm = 30) => {
    searchVersion.current++
    setDraft(previous => ({ ...previous, place, radiusKm })); setQuery(place.name); setResults([]); setError(null)
  }
  useWalkthroughBlocker(true)
  return <Modal transparent visible animationType="slide" onRequestClose={onClose}>
    <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "#00000088", paddingTop: 48 }}><Pressable accessibilityLabel="Filtreyi kapat" style={StyleSheet.absoluteFill} onPress={onClose} />
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={s.keyboard}>
      <Box style={s.panel}>
        <Box style={s.heading}><Box><Label style={s.eyebrow}>PLANIN NEREDEYSE</Label><Label style={s.title}>Filtreler</Label></Box><Touch accessibilityLabel="Filtreyi kapat" onPress={onClose} style={s.close}><Label style={s.text}>✕</Label></Touch></Box>
        <Scroll style={s.scroll} keyboardShouldPersistTaps="handled">
          <Label style={s.section}>Ne zaman uygunsun?</Label>
          <Box style={s.wrap}>{([["all", "Yaklaşan"], ["today", "Bugün"], ["tomorrow", "Yarın"], ["week", "Haftaya"], ["custom", "Tarih seç"]] as const).map(([id, label]) => <FilterChip key={id} label={label} selected={draft.datePreset === id} onPress={() => setDraft(previous => ({ ...previous, datePreset: id, dateFrom: previous.dateFrom || localDate(new Date()), dateTo: previous.dateTo || localDate(new Date()) }))} />)}</Box>
          {draft.datePreset === "custom" && <Box style={s.row}><Box style={s.grow}><GlassInput label="Başlangıç tarihi" mode="date" value={draft.dateFrom} onChangeText={dateFrom => setDraft(previous => ({ ...previous, dateFrom }))} /></Box><Box style={s.grow}><GlassInput label="Bitiş tarihi" mode="date" value={draft.dateTo} onChangeText={dateTo => setDraft(previous => ({ ...previous, dateTo }))} /></Box></Box>}
          <Box style={s.row}><Box style={s.grow}><GlassInput label="Uygun olduğun saat" mode="time" value={draft.timeFrom} onChangeText={timeFrom => setDraft(previous => ({ ...previous, timeFrom }))} /></Box><Box style={s.grow}><GlassInput label="Bitiş saati" mode="time" value={draft.timeTo} onChangeText={timeTo => setDraft(previous => ({ ...previous, timeTo }))} /></Box></Box>
          <Touch onPress={() => setDraft(previous => ({ ...previous, timeFrom: "", timeTo: "" }))}><Label style={s.link}>Saat sınırı olmasın</Label></Touch>
          <Label style={s.hint}>Süresi belli etkinliklerin tamamı bu aralığa sığar. Bitiş saati daha erkense aralık ertesi güne uzanır.</Label>
          <Label style={s.section}>Nerede olacaksın?</Label>
          <GlassInput label="Şehir, semt veya mekân" placeholder="Örn. İzmir veya Eymir Gölü, Ankara" value={query} onChangeText={text => { searchVersion.current++; setQuery(text); setResults([]); setDraft(previous => ({ ...previous, place: null })) }} />
          <PlaceSuggestionList items={suggestions.items} onPick={item => void pickSuggestion(item)} />
          <Touch style={s.search} onPress={() => void search()} disabled={busy || !query.trim()}><Label style={s.text}>{busy ? "Konum aranıyor…" : "Konumu bul"}</Label></Touch>
          {results.map((place, index) => <Touch key={index} style={s.result} onPress={() => choosePlace(place, 1)}><Label style={s.text}>⌖ {place.name}</Label><Label style={s.hint}>Bu konumu seç</Label></Touch>)}
          <Box style={s.wrap}>{CITY_PRESETS.map(place => <FilterChip key={place.name} label={place.name} selected={draft.place?.name === place.name} onPress={() => choosePlace(place)} />)}<FilterChip label="Her yerde" selected={!draft.place && !query} onPress={() => { searchVersion.current++; setQuery(""); setResults([]); setDraft(previous => ({ ...previous, place: null })) }} /></Box>
          {draft.place && <><Label style={s.hint}>⌖ {draft.place.name} çevresinde</Label><Box style={s.wrap}>{[1, 5, 15, 30, 75].map(radiusKm => <FilterChip key={radiusKm} label={`${radiusKm} km`} selected={draft.radiusKm === radiusKm} onPress={() => setDraft(previous => ({ ...previous, radiusKm }))} />)}</Box></>}
          <Label style={s.section}>Ne yapmak istersin?</Label>
          <Box style={s.wrap}><FilterChip label="Tüm etkinlikler" selected={!draft.interestIds.length} onPress={() => setDraft(previous => ({ ...previous, interestIds: [] }))} />{categories.map(item => <FilterChip key={item.id} label={item.name} selected={draft.interestIds.includes(item.id)} onPress={() => setDraft(previous => ({ ...previous, interestIds: previous.interestIds.includes(item.id) ? previous.interestIds.filter(id => id !== item.id) : [...previous.interestIds, item.id] }))} />)}</Box>
          {!categories.length && <Label style={s.hint}>Etkinlik türleri yüklenemedi. Haritadan yenileyebilirsin.</Label>}
        </Scroll>
        {error && <Label style={s.error}>{error}</Label>}
        <Box style={s.row}><Touch style={s.reset} onPress={() => { searchVersion.current++; setDraft({ ...DEFAULT_FILTERS, interestIds: [] }); setQuery(""); setResults([]); setError(null) }}><Label style={s.text}>Sıfırla</Label></Touch><Touch style={s.apply} onPress={() => {
          const invalid = query.trim() && !draft.place ? "Önce arama sonucundan bir konum seç veya aramayı temizle." : filterError(draft)
          if (invalid) { setError(invalid); return }
          onApply(draft)
        }}><Label style={s.applyText}>Etkinlikleri göster →</Label></Touch></Box>
      </Box>
    </KeyboardAvoidingView>
    </View>
  </Modal>
}
const s = StyleSheet.create({
  keyboard: { maxHeight: "94%" }, panel: { backgroundColor: palette.background, borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 22, paddingBottom: 34, gap: 16, maxHeight: "100%" },
  heading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, eyebrow: { color: palette.accent, fontSize: 10, letterSpacing: 2 }, title: { fontFamily: "Fraunces", fontSize: 32, color: "#f4f5ff" },
  close: { padding: 15 }, scroll: { flexShrink: 1 }, section: { fontFamily: "Outfit-SemiBold", color: "#f4f5ff", fontSize: 17, marginTop: 16, marginBottom: 10 },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginVertical: 8 }, row: { flexDirection: "row", gap: 12, marginTop: 8 }, grow: { flex: 1 }, text: { color: "#f4f5ff", fontSize: 14 },
  hint: { color: "#9995ab", fontSize: 12, lineHeight: 18 }, link: { color: "#b9c3ff", fontSize: 12, paddingVertical: 8 }, search: { padding: 12, backgroundColor: "#ffffff0d", alignItems: "center", borderRadius: 12, marginVertical: 8 },
  result: { padding: 12, borderBottomWidth: 1, borderColor: "#ffffff15" }, error: { color: "#efaa91", fontSize: 12 }, reset: { padding: 14, justifyContent: "center" }, apply: { flex: 1, padding: 16, backgroundColor: "#4d5bcb", borderRadius: 18, alignItems: "center" }, applyText: { fontFamily: "Outfit-SemiBold", color: "#f4f5ff", fontSize: 14 },
})

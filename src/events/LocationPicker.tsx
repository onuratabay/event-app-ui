import * as Location from "expo-location"
import { showAlert } from "../components/AppDialog"
import { useRef, useState } from "react"
import { Platform, StyleSheet } from "react-native"
import MapView, { Marker } from "react-native-maps"
import CityPicker from "../components/CityPicker"
import { GlassInput } from "../components/GlassUI"
import { LocationIcon, SearchIcon } from "../components/Icons"
import { TURKISH_CITIES } from "../content/cities"
import { CITY_PRESETS } from "../map/filters"
import { MAP_PROVIDER } from "../map/provider"
import { PlaceSuggestionList, usePlaceSuggestions } from "../map/PlaceSuggestions"
import type { PlaceSuggestion } from "../api/client"
import { DARK_MAP_PROPS } from "../map/darkStyle"
import { BaseTiles, BaseTilesCredit } from "../map/BaseTiles"
import { Box, Field, Label, Touch } from "../native/UI"
import { palette } from "../theme/palette"

interface Point { latitude: number; longitude: number }
/** The meeting point chosen on the map; city and district come from reverse geocoding when available. */
export interface PickedPlace extends Point { city: string; district: string; address: string }

const TURKEY = { latitude: 39.0, longitude: 35.2, latitudeDelta: 11, longitudeDelta: 11 }
const CITY_DELTA = 0.25, POINT_DELTA = 0.012
const normalize = (value: string) => value.toLocaleLowerCase("tr-TR").replace(/\s+(province|ili|il)$/i, "").trim()
/** Maps a geocoder region ("İstanbul", "Istanbul Province") to one of the 81 province names. */
export function matchCity(value?: string | null) {
  if (!value) return ""
  const wanted = normalize(value)
  const plain = (text: string) => normalize(text).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ı/g, "i")
  return TURKISH_CITIES.find(city => normalize(city) === wanted) || TURKISH_CITIES.find(city => plain(city) === plain(value)) || ""
}
/** Text stored as the event's location: venue, district and city without repeats. */
export function placeLabel(venue: string, place: PickedPlace | null) {
  const parts = [venue.trim(), place?.district || place?.address || "", place?.city || ""].filter(Boolean)
  return parts.filter((part, index) => parts.findIndex(other => other.toLocaleLowerCase("tr-TR") === part.toLocaleLowerCase("tr-TR")) === index).join(", ")
}
const point = ({ latitude, longitude }: Point): Point => ({ latitude, longitude })
/** A readable line for a geocoder hit ("Moda Cd., Kadıköy, İstanbul"); empty when it cannot be named. */
async function describe(target: Point) {
  try {
    const [address] = await Location.reverseGeocodeAsync(target)
    if (!address) return ""
    const parts = [address.name || [address.street, address.streetNumber].filter(Boolean).join(" "), address.subregion || address.district, address.city || address.region]
    return parts.filter((part, index): part is string => !!part && parts.indexOf(part) === index).join(", ")
  } catch { return "" }
}
// Android's geocoder needs the location permission; iOS geocodes without it.
const canGeocode = async () => Platform.OS !== "android" || (await Location.requestForegroundPermissionsAsync()).granted

export default function LocationPicker({ value, venue, defaultCity, onChange, onVenueChange, onMapTouch }: {
  value: PickedPlace | null
  venue: string
  defaultCity?: string
  onChange: (place: PickedPlace | null) => void
  onVenueChange: (venue: string) => void
  /** Lets the surrounding scroll view pause while a finger is on the map. */
  onMapTouch?: (active: boolean) => void
}) {
  const map = useRef<MapView>(null)
  const latest = useRef(0)
  const [city, setCity] = useState(value?.city || matchCity(defaultCity))
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<(Point & { label: string })[]>([])
  const [busy, setBusy] = useState<"city" | "search" | "locate" | null>(null)
  const preset = CITY_PRESETS.find(place => place.name === city)
  const [initialRegion] = useState(() => value ? { ...point(value), latitudeDelta: POINT_DELTA, longitudeDelta: POINT_DELTA }
    : preset ? { ...point(preset), latitudeDelta: CITY_DELTA, longitudeDelta: CITY_DELTA } : TURKEY)
  const focus = (target: Point, delta: number) => map.current?.animateToRegion?.({ ...point(target), latitudeDelta: delta, longitudeDelta: delta }, 350)

  const pick = async (target: Point) => {
    const id = ++latest.current
    const coordinate = point(target)
    // The pin moves at once; the district label follows when the geocoder answers.
    onChange({ ...coordinate, city, district: "", address: "" })
    try {
      if (!await canGeocode()) return
      const [address] = await Location.reverseGeocodeAsync(coordinate)
      if (id !== latest.current || !address) return
      const found = matchCity(address.region) || matchCity(address.city) || city
      if (found !== city) setCity(found)
      onChange({ ...coordinate, city: found, district: address.subregion || address.district || "", address: [address.street, address.streetNumber].filter(Boolean).join(" ") || address.name || "" })
    } catch { /* The coordinates are enough; the district label is optional. */ }
  }
  const chooseCity = async (next: string) => {
    setCity(next); setResults([])
    if (value && value.city && value.city !== next) onChange(null)
    // Clearing the city also drops the meeting point and zooms back out to the whole country.
    if (!next) { onChange(null); map.current?.animateToRegion?.(TURKEY, 350); return }
    const known = CITY_PRESETS.find(place => place.name === next)
    if (known) { focus(known, CITY_DELTA); return }
    setBusy("city")
    try {
      if (!await canGeocode()) return
      const [found] = await Location.geocodeAsync(`${next}, Türkiye`)
      if (found) focus(found, CITY_DELTA)
    } catch { /* The user can still pan the map to the city. */ }
    finally { setBusy(null) }
  }
  const search = async () => {
    const text = query.trim()
    if (!text || busy) return
    setBusy("search")
    try {
      if (!await canGeocode()) { showAlert("Konum izni gerekli", "Adres aramak için konum izni ver ya da haritaya dokunarak noktayı kendin seç."); return }
      const found = (await Location.geocodeAsync(city ? `${text}, ${city}, Türkiye` : `${text}, Türkiye`)).slice(0, 3).map(point)
      if (!found.length) showAlert("Adres bulunamadı", "Farklı yazmayı dene ya da haritaya dokunarak noktayı seç.")
      else if (found.length === 1) choose(found[0], text)
      // Several hits are told apart by their street and district rather than raw coordinates.
      else setResults(await Promise.all(found.map(async hit => ({ ...hit, label: await describe(hit) }))))
    } catch { showAlert("Adres aranamadı", "Bağlantını kontrol et ya da haritaya dokunarak noktayı seç.") }
    finally { setBusy(null) }
  }
  // Suggestions appear from the first letter; when the server has no place search, "Ara" geocodes instead.
  const suggestions = usePlaceSuggestions(query, value ? point(value) : preset ? point(preset) : null)
  const pickSuggestion = async (suggestion: PlaceSuggestion) => {
    try {
      const place = await suggestions.resolve(suggestion)
      const target = { latitude: place.latitude, longitude: place.longitude }
      latest.current++
      const found = matchCity(place.city) || city
      if (found !== city) setCity(found)
      if (!venue.trim()) onVenueChange(place.name || suggestion.title)
      setQuery(""); setResults([])
      focus(target, POINT_DELTA)
      onChange({ ...target, city: found, district: place.district, address: place.address })
    } catch { showAlert("Yer seçilemedi", "Bağlantını kontrol et ya da haritaya dokunarak noktayı seç.") }
  }
  // Tapping a venue on the Google map picks it with its name (Apple Maps does not report venue taps).
  const pickVenue = (name: string, target: Point) => {
    const label = name.replace(/\s+/g, " ").trim()
    if (label) onVenueChange(label)
    setQuery(""); setResults([])
    focus(target, POINT_DELTA)
    void pick(target)
  }
  const choose = (target: Point, label = query.trim()) => {
    setResults([])
    if (!venue.trim() && label) onVenueChange(label)
    focus(target, POINT_DELTA)
    void pick(target)
  }
  const locate = async () => {
    if (busy) return
    setBusy("locate")
    try {
      if (!(await Location.requestForegroundPermissionsAsync()).granted) { showAlert("Konum izni verilmedi", "Sorun değil: haritaya dokunarak buluşma noktasını seçebilirsin."); return }
      const { coords } = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
      focus(coords, POINT_DELTA)
      await pick(coords)
    } catch { showAlert("Konum alınamadı", "Haritaya dokunarak buluşma noktasını seçebilirsin.") }
    finally { setBusy(null) }
  }

  const region = value ? [value.district, value.city].filter(Boolean).join(", ") : ""
  return <Box style={s.root}>
    <CityPicker clearable value={city} onChange={next => void chooseCity(next)} />
    <Box style={s.search}>
      <SearchIcon size={15} style={{ color: palette.muted }} />
      <Field accessibilityLabel="Adres veya mekân ara" placeholder={city ? `${city} içinde adres veya mekan ara…` : "Adres veya mekân ara…"} value={query}
        onChangeText={text => { setQuery(text); setResults([]) }} onSubmitEditing={() => void search()} returnKeyType="search" style={s.searchField} />
      <Touch accessibilityLabel="Ara" disabled={!query.trim() || !!busy} onPress={() => void search()} style={s.searchButton}><Label style={s.link}>{busy === "search" ? "…" : "Ara"}</Label></Touch>
    </Box>
    <PlaceSuggestionList items={suggestions.items} onPick={item => void pickSuggestion(item)} />
    {results.length > 1 && <Box style={s.results}>
      {results.map((result, index) => <Touch key={index} accessibilityLabel={`Sonuç ${index + 1}`} onPress={() => choose(result)} style={s.result}>
        <LocationIcon size={14} style={{ color: palette.accent }} />
        <Label style={s.resultText} numberOfLines={1}>{result.label || `${query.trim()} (${index + 1})`}</Label>
      </Touch>)}
    </Box>}
    <Box style={s.mapFrame} onTouchStart={() => onMapTouch?.(true)} onTouchEnd={() => onMapTouch?.(false)} onTouchCancel={() => onMapTouch?.(false)}>
      <MapView ref={map} provider={MAP_PROVIDER} testID="event-location-map" style={StyleSheet.absoluteFill} initialRegion={initialRegion} {...DARK_MAP_PROPS}
        showsUserLocation={false} toolbarEnabled={false} onPress={event => void pick(event.nativeEvent.coordinate)}
        onPoiClick={event => pickVenue(event.nativeEvent.name, event.nativeEvent.coordinate)}>
        <BaseTiles />
        {value && <Marker coordinate={point(value)} draggable pinColor={palette.blue} onDragEnd={event => void pick(event.nativeEvent.coordinate)} />}
      </MapView>
      <BaseTilesCredit />
    </Box>
    <Label style={value ? s.picked : s.hint}>
      {value ? `📍 ${region || "Seçilen nokta"}` : busy === "city" ? "Şehir bulunuyor…" : "Buluşma noktasını seçmek için haritada bir mekana ya da noktaya dokun."}
    </Label>
    {value && <Label style={s.hint}>Değiştirmek için haritada başka bir yere dokun ya da pini sürükle.</Label>}
    <Touch disabled={!!busy} onPress={() => void locate()} style={s.locate}>
      <Box style={s.row}><LocationIcon size={15} style={{ color: palette.accent }} /><Label style={s.link}>{busy === "locate" ? "Konum alınıyor…" : "Konumumu kullan"}</Label></Box>
    </Touch>
    <GlassInput label="Buluşma noktası (isteğe bağlı)" placeholder="Örn. Moda Sahili, iskele önü" value={venue} onChangeText={onVenueChange} maxLength={120} />
  </Box>
}

const s = StyleSheet.create({
  root: { gap: 12 },
  search: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 48, borderRadius: 14, paddingLeft: 14, borderWidth: 1, borderColor: palette.border, backgroundColor: "rgba(255,255,255,.05)" },
  searchField: { flex: 1, color: palette.text, fontSize: 14, paddingVertical: 12 },
  searchButton: { minHeight: 44, minWidth: 52, alignItems: "center", justifyContent: "center", paddingHorizontal: 12 },
  results: { gap: 6 },
  result: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12, borderRadius: 12, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border },
  resultText: { flex: 1, color: palette.text, fontSize: 13 },
  mapFrame: { height: 300, borderRadius: 20, overflow: "hidden", borderWidth: 1, borderColor: palette.border, backgroundColor: palette.surface },
  picked: { color: palette.text, fontFamily: "Outfit-Medium", fontSize: 14 },
  hint: { color: palette.muted, fontSize: 12, lineHeight: 18 },
  locate: { alignSelf: "flex-start", minHeight: 40, justifyContent: "center" },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  link: { color: palette.accent, fontFamily: "Outfit-Medium", fontSize: 14 },
})

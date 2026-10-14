import { useEffect, useRef, useState } from "react"
import { StyleSheet } from "react-native"
import { getPlace, searchPlaces, type PlaceDetail, type PlaceSuggestion } from "../api/client"
import { LocationIcon } from "../components/Icons"
import { Box, Label, Touch } from "../native/UI"
import { palette } from "../theme/palette"

const newSession = () => Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join("")

/**
 * Suggestions while typing (from the first letter): venues like "Kazım Büfe", districts and cities,
 * biased towards `near`. `unavailable` turns true when the server has no place search, so the screen
 * can fall back to its own geocoder search.
 */
export function usePlaceSuggestions(query: string, near?: { latitude: number; longitude: number } | null) {
  const [items, setItems] = useState<PlaceSuggestion[]>([])
  const [loading, setLoading] = useState(false)
  const [unavailable, setUnavailable] = useState(false)
  // One session per search, ended by picking a place (Google bills them together).
  const session = useRef(newSession())
  const latitude = near?.latitude, longitude = near?.longitude
  useEffect(() => {
    const text = query.trim()
    if (!text || unavailable) { setItems([]); setLoading(false); return }
    const controller = new AbortController()
    setLoading(true)
    const timer = setTimeout(() => {
      searchPlaces(text, { latitude, longitude, session: session.current }, controller.signal)
        .then(result => { if (!controller.signal.aborted) setItems(result.items) })
        .catch(cause => {
          if (controller.signal.aborted) return
          setItems([])
          if (cause instanceof Error && /^API (503|404):/.test(cause.message)) setUnavailable(true)
        })
        .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    }, 250)
    return () => { clearTimeout(timer); controller.abort() }
  }, [query, unavailable, latitude, longitude])
  const resolve = async (suggestion: PlaceSuggestion): Promise<PlaceDetail> => {
    const detail = await getPlace(suggestion.placeId, session.current)
    session.current = newSession()
    setItems([])
    return detail
  }
  return { items, loading, unavailable, resolve, clear: () => setItems([]) }
}

export function PlaceSuggestionList({ items, onPick }: { items: PlaceSuggestion[]; onPick: (item: PlaceSuggestion) => void }) {
  if (!items.length) return null
  return <Box style={s.list} accessibilityRole="list">
    {items.map(item => <Touch key={item.placeId} accessibilityLabel={`${item.title}${item.subtitle ? `, ${item.subtitle}` : ""}`} onPress={() => onPick(item)} style={s.row}>
      <LocationIcon size={15} style={{ color: palette.accent }} />
      <Box style={s.copy}>
        <Label style={s.title} numberOfLines={1}>{item.title}</Label>
        {item.subtitle ? <Label style={s.subtitle} numberOfLines={1}>{item.subtitle}</Label> : null}
      </Box>
    </Touch>)}
  </Box>
}

const s = StyleSheet.create({
  list: { borderRadius: 14, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.surface, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 52, paddingHorizontal: 14, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.border },
  copy: { flex: 1, minWidth: 0, gap: 2 },
  title: { color: palette.text, fontFamily: "Outfit-Medium", fontSize: 14 },
  subtitle: { color: palette.muted, fontSize: 12 },
})

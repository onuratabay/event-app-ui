import { StyleSheet, Text, View } from "react-native"
import { UrlTile } from "react-native-maps"
import { TILE_FALLBACK } from "./provider"

// CARTO "Dark Matter" basemap (OpenStreetMap data); no key needed. Used only for the Expo Go fallback.
const DARK_TILES = "https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png"

/** Goes inside a MapView: the dark basemap when Google's tiles are unavailable (see TILE_FALLBACK). */
export function BaseTiles() {
  return TILE_FALLBACK ? <UrlTile urlTemplate={DARK_TILES} maximumZ={19} tileSize={256} zIndex={-1} /> : null
}

/** Goes beside the MapView: the credit the fallback tiles require. */
export function BaseTilesCredit({ bottom = 8 }: { bottom?: number }) {
  if (!TILE_FALLBACK) return null
  return <View pointerEvents="none" style={[s.credit, { bottom }]}><Text style={s.text}>© OpenStreetMap © CARTO</Text></View>
}
const s = StyleSheet.create({
  credit: { position: "absolute", right: 8, paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4, backgroundColor: "rgba(0,0,0,.45)" },
  text: { color: "rgba(255,255,255,.7)", fontSize: 9 },
})

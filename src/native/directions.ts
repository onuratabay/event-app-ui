import { Linking, Platform } from "react-native"
import { showAlert } from "../components/AppDialog"

export interface Destination { name: string; latitude?: number; longitude?: number }

const hasPoint = (place: Destination): place is Destination & { latitude: number; longitude: number } =>
  Number.isFinite(place.latitude) && Number.isFinite(place.longitude) && !(place.latitude === 0 && place.longitude === 0)

/** Google Maps directions on the web: the fallback when an app is not installed. */
const webDirections = (place: Destination) => {
  const to = hasPoint(place) ? `${place.latitude},${place.longitude}` : place.name
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(to)}&travelmode=driving`
}
const openOrWeb = async (url: string, place: Destination) => {
  try { await Linking.openURL(url) } catch { await Linking.openURL(webDirections(place)).catch(() => {}) }
}

/** iOS has no system app chooser, so the common map and navigation apps are offered by name. */
export function iosNavigationApps(place: Destination) {
  const name = encodeURIComponent(place.name)
  const point = hasPoint(place) ? `${place.latitude},${place.longitude}` : null
  return [
    { name: "Apple Haritalar", url: point ? `maps://?daddr=${point}&q=${name}&dirflg=d` : `maps://?daddr=${name}&dirflg=d` },
    { name: "Google Haritalar", url: `comgooglemaps://?daddr=${point ?? name}&directionsmode=driving` },
    { name: "Yandex Navigasyon", url: point ? `yandexnavi://build_route_on_map?lat_to=${place.latitude}&lon_to=${place.longitude}` : `yandexnavi://map_search?text=${name}` },
    { name: "Waze", url: point ? `waze://?ll=${point}&navigate=yes` : `waze://?q=${name}&navigate=yes` },
  ]
}

/**
 * Starts directions to an event in the phone's own map or navigation app. Android hands a `geo:` link
 * to the system, which lists every installed map and navigation app; iOS offers the common apps.
 * An app that is not installed falls back to Google Maps on the web.
 */
export function openDirections(place: Destination) {
  if (Platform.OS === "android") {
    const label = encodeURIComponent(place.name)
    const url = hasPoint(place) ? `geo:${place.latitude},${place.longitude}?q=${place.latitude},${place.longitude}(${label})` : `geo:0,0?q=${label}`
    void openOrWeb(url, place)
    return
  }
  showAlert("Yol tarifi", place.name, [
    ...iosNavigationApps(place).map(app => ({ text: app.name, onPress: () => void openOrWeb(app.url, place) })),
    { text: "Vazgeç", style: "cancel" as const },
  ])
}

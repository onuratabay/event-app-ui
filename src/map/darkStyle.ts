import { Platform } from "react-native"
import { MAP_PROVIDER, TILE_FALLBACK } from "./provider"

/**
 * Dark Google Maps style, tuned to read like the iOS dark map: navy land, roads a step lighter, blue water,
 * green parks and legible place names. (The earlier near-black palette left land, roads and water almost
 * the same colour, so on Android the map looked empty.) Venues (cafés, restaurants, bars, museums, parks)
 * stay visible with desaturated icons so people can orient by real places; the event pins still stand out.
 * Transit stays hidden. Google renders it on Android and on iOS builds with the embedded key.
 */
export const DARK_MAP_STYLE = [
  { elementType: "geometry", stylers: [{ color: "#1b2030" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#8a93a8" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#141826" }] },
  // Icons are kept but desaturated and dimmed; only venue icons remain once transit is hidden.
  { elementType: "labels.icon", stylers: [{ saturation: -55 }, { lightness: -15 }] },
  { featureType: "administrative", elementType: "geometry", stylers: [{ color: "#3a4256" }] },
  { featureType: "administrative.country", elementType: "labels.text.fill", stylers: [{ color: "#a3abbe" }] },
  { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#b4bccd" }] },
  { featureType: "administrative.neighborhood", elementType: "labels.text.fill", stylers: [{ color: "#7f889c" }] },
  { featureType: "administrative.land_parcel", stylers: [{ visibility: "off" }] },
  { featureType: "landscape", elementType: "geometry", stylers: [{ color: "#1b2030" }] },
  { featureType: "landscape.man_made", elementType: "geometry", stylers: [{ color: "#20263a" }] },
  { featureType: "poi", elementType: "geometry", stylers: [{ color: "#1f2536" }] },
  { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#8f99b3" }] },
  { featureType: "poi", elementType: "labels.text.stroke", stylers: [{ color: "#141826" }] },
  { featureType: "poi.business", stylers: [{ visibility: "on" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#1c2e28" }] },
  { featureType: "poi.park", elementType: "labels.text.fill", stylers: [{ color: "#6f9384" }] },
  // Offices, clinics, schools and the like add clutter without being places to meet.
  { featureType: "poi.government", stylers: [{ visibility: "off" }] },
  { featureType: "poi.medical", stylers: [{ visibility: "off" }] },
  { featureType: "poi.school", stylers: [{ visibility: "off" }] },
  { featureType: "road", elementType: "geometry.fill", stylers: [{ color: "#2c3346" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#161a27" }] },
  { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#7c859a" }] },
  { featureType: "road.arterial", elementType: "geometry.fill", stylers: [{ color: "#323a4f" }] },
  { featureType: "road.highway", elementType: "geometry.fill", stylers: [{ color: "#3b4459" }] },
  { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#1a1f2d" }] },
  { featureType: "road.highway", elementType: "labels.text.fill", stylers: [{ color: "#a0a9bc" }] },
  { featureType: "road.local", elementType: "labels", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#0f1b33" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#4f6487" }] },
]

/**
 * Props every map in the app shares. Apple Maps (iOS without the Google key, e.g. Expo Go) cannot
 * take the Google style, so it gets its dark appearance with the muted, low-colour map type instead.
 */
export const DARK_MAP_PROPS = {
  customMapStyle: DARK_MAP_STYLE,
  userInterfaceStyle: "dark" as const,
  // With the tile fallback the Google base is switched off so only the drawn tiles show.
  mapType: (TILE_FALLBACK ? "none" : Platform.OS === "ios" && !MAP_PROVIDER ? "mutedStandard" : "standard") as "mutedStandard" | "standard" | "none",
}

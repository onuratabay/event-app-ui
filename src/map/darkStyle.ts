import { Platform } from "react-native"
import { MAP_PROVIDER } from "./provider"

/**
 * Darkest Google Maps style: near-black land, black water, dim grey roads and labels, no colour
 * accents (parks, POIs and transit are flattened or hidden) so only the event pins stand out.
 * Google renders it on Android and on iOS builds with the embedded key.
 */
export const DARK_MAP_STYLE = [
  { elementType: "geometry", stylers: [{ color: "#07090f" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#4d5568" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#07090f" }] },
  { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { featureType: "administrative", elementType: "geometry", stylers: [{ color: "#141822" }] },
  { featureType: "administrative.country", elementType: "labels.text.fill", stylers: [{ color: "#5d6578" }] },
  { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#6b7385" }] },
  { featureType: "administrative.neighborhood", stylers: [{ visibility: "off" }] },
  { featureType: "administrative.land_parcel", stylers: [{ visibility: "off" }] },
  { featureType: "landscape", elementType: "geometry", stylers: [{ color: "#07090f" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "road", elementType: "geometry.fill", stylers: [{ color: "#11141c" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#07090f" }] },
  { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#3e4556" }] },
  { featureType: "road.highway", elementType: "geometry.fill", stylers: [{ color: "#181c26" }] },
  { featureType: "road.highway", elementType: "labels.text.fill", stylers: [{ color: "#4d5568" }] },
  { featureType: "road.local", elementType: "labels", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#000000" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#2a2f3b" }] },
]

/**
 * Props every map in the app shares. Apple Maps (iOS without the Google key, e.g. Expo Go) cannot
 * take the Google style, so it gets its dark appearance with the muted, low-colour map type instead.
 */
export const DARK_MAP_PROPS = {
  customMapStyle: DARK_MAP_STYLE,
  userInterfaceStyle: "dark" as const,
  mapType: (Platform.OS === "ios" && !MAP_PROVIDER ? "mutedStandard" : "standard") as "mutedStandard" | "standard",
}

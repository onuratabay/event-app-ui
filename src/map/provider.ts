import Constants from "expo-constants"
import { Platform } from "react-native"
import { PROVIDER_GOOGLE } from "react-native-maps"

// Android always renders Google Maps. iOS switches from Apple Maps to Google only in builds that embed
// the project's key; Expo Go cannot use a custom key, so it keeps Apple Maps there.
const keyEmbedded = Constants.expoConfig?.extra?.googleMapsConfigured === true
const inExpoGo = Constants.executionEnvironment === "storeClient"
export const MAP_PROVIDER = Platform.OS === "ios" && keyEmbedded && !inExpoGo ? PROVIDER_GOOGLE : undefined
// Expo Go on Android ships its own Google Maps key, which does not load base tiles on every device (the
// map stays an empty grey). There the map draws a keyless dark basemap as tiles instead; builds keep Google.
export const TILE_FALLBACK = Platform.OS === "android" && inExpoGo

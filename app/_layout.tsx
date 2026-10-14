import { GuestProvider } from "../src/guest/GuestSession";
import GuestRouteBoundary from "../src/guest/GuestRouteBoundary";
import { BlurSurface } from "../src/native/SharedBlur";
import { palette } from "../src/theme/palette";
import { useFonts } from "expo-font"
import { Stack } from "expo-router"
import * as SplashScreen from "expo-splash-screen"
import { StatusBar } from "expo-status-bar"
import { useEffect } from "react"
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native"
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context"
import { StoreProvider } from "../src/native/Store"
import { PreferencesProvider } from "../src/native/preferences"
import { ErrorNoticeProvider } from "../src/components/ErrorNotice"
import ApiLoadingOverlay from "../src/components/ApiLoadingOverlay"
import AppBottomNav from "../src/components/AppBottomNav"
import AccessGuard from "../src/components/AccessGuard"
import LegalConsentGate from "../src/components/LegalConsentGate"
import PushOpenHandler from "../src/components/PushOpenHandler"
import HardwareBack from "../src/components/HardwareBack"
void SplashScreen.preventAutoHideAsync()
export default function RootLayout() {
  const [loaded, error] = useFonts({
    Outfit: require("../assets/fonts/Outfit.ttf"),
    "Outfit-Medium": require("../assets/fonts/Outfit-Medium.ttf"),
    "Outfit-SemiBold": require("../assets/fonts/Outfit-SemiBold.ttf"),
    Fraunces: require("../assets/fonts/Fraunces.ttf"),
  })
  useEffect(() => {
    if (loaded || error) void SplashScreen.hideAsync()
  }, [loaded, error])
  if (!loaded && !error) return null
  if (error)
    return (
      <View style={s.root}>
        <Text style={{ color: "#fff", padding: 30 }}>
          Fontlar yüklenemedi. Uygulamayı yeniden başlat.
        </Text>
      </View>
    )
  return (
    <SafeAreaProvider>
      <PreferencesProvider>
      <SafeAreaView style={s.root} edges={["top", "bottom"]}>
        <StatusBar style="light" />
        <ErrorNoticeProvider>
          <KeyboardAvoidingView
            style={s.root}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
          >
            <BlurSurface overlay={<ApiLoadingOverlay />}><GuestProvider><StoreProvider><GuestRouteBoundary>
              <Stack
                screenOptions={{
                  headerShown: false,
                  contentStyle: { backgroundColor: palette.background },
                  animation: "fade",
                  animationDuration: 100,
                }}
              />
              <AppBottomNav />
              <AccessGuard />
              <LegalConsentGate />
              <PushOpenHandler />
              <HardwareBack />
            </GuestRouteBoundary></StoreProvider></GuestProvider></BlurSurface>
          </KeyboardAvoidingView>
        </ErrorNoticeProvider>
      </SafeAreaView>
      </PreferencesProvider>
    </SafeAreaProvider>
  )
}
const s = StyleSheet.create({ root: { flex: 1, backgroundColor: palette.background } })

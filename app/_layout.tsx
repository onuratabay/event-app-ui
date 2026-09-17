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
      <SafeAreaView style={s.root} edges={["top", "bottom"]}>
        <StatusBar style="light" />
        <KeyboardAvoidingView
          style={s.root}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <StoreProvider>
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: "#06060e" },
                animation: "fade",
                animationDuration: 180,
              }}
            />
          </StoreProvider>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </SafeAreaProvider>
  )
}
const s = StyleSheet.create({ root: { flex: 1, backgroundColor: "#06060e" } })

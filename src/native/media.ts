import * as Clipboard from "expo-clipboard"
import { File, Paths } from "expo-file-system"
import * as ImagePicker from "expo-image-picker"
import { Alert, Share } from "react-native"
import type { AppEvent } from "../types"
export async function selectPhoto(camera = false): Promise<string | null> {
  try {
    if (camera) {
      const permission = await ImagePicker.requestCameraPermissionsAsync()
      if (!permission.granted) {
        Alert.alert(
          "Kamera izni gerekli",
          "Fotoğraf çekmek için Ayarlar’dan kamera iznini açabilirsin.",
        )
        return null
      }
    }
    const result = await (
      camera
        ? ImagePicker.launchCameraAsync
        : ImagePicker.launchImageLibraryAsync
    )({ mediaTypes: ["images"], allowsEditing: true, quality: 0.85 })
    if (result.canceled) return null
    const original = new File(result.assets[0].uri)
    const saved = new File(
      Paths.document,
      `photo-${Date.now()}.${original.extension.replace(".", "") || "jpg"}`,
    )
    original.copy(saved)
    return saved.uri
  } catch {
    Alert.alert("Fotoğraf eklenemedi", "Lütfen tekrar dene.")
    return null
  }
}
export function eventLink(event: AppEvent) {
  return `eventapp://event-detail?eventId=${encodeURIComponent(event.id)}`
}
export async function shareEvent(event: AppEvent) {
  try {
    await Share.share({
      title: event.title,
      message: `${event.title}\n${event.date} · ${event.time}\n${event.location}\n${eventLink(event)}`,
    })
  } catch {
    Alert.alert("Paylaşılamadı", "Lütfen tekrar dene.")
  }
}
export async function copyEvent(event: AppEvent) {
  try {
    await Clipboard.setStringAsync(eventLink(event))
    return true
  } catch {
    Alert.alert("Kopyalanamadı", "Lütfen tekrar dene.")
    return false
  }
}

import * as Clipboard from "expo-clipboard"

import * as ImagePicker from "expo-image-picker"
import { Alert } from "react-native"
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
    )({ mediaTypes: ["images"], allowsEditing: true, quality: 0.75, base64: true })
    if (result.canceled) return null
    const asset = result.assets[0]
    if (!asset.base64) throw new Error('Fotoğraf okunamadı')
    return `data:${asset.mimeType || 'image/jpeg'};base64,${asset.base64}`
  } catch {
    Alert.alert("Fotoğraf eklenemedi", "Lütfen tekrar dene.")
    return null
  }
}
export async function copyEvent(url: string) {
  await Clipboard.setStringAsync(url)
}

import { createEventShare, getApiErrorMessage } from "../api/client"
import * as Clipboard from "expo-clipboard"

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
export async function eventLink(event: AppEvent) {
  const result = await createEventShare(event.id)
  const url = new URL(result.url)
  if (!["https:", "http:"].includes(url.protocol)) throw new Error("Geçersiz paylaşım bağlantısı")
  return result.url
}
export async function shareEvent(event: AppEvent) {
  try {
    const url = await eventLink(event)
    await Share.share({
      title: event.title,
      message: `${event.title}\n${event.date} · ${event.time}\n${event.location}\n${url}`,
    })
  } catch (error) {
    Alert.alert("Paylaşılamadı", getApiErrorMessage(error))
  }
}
export async function copyEvent(event: AppEvent) {
  try {
    await Clipboard.setStringAsync(await eventLink(event))
    return true
  } catch (error) {
    Alert.alert("Kopyalanamadı", getApiErrorMessage(error))
    return false
  }
}

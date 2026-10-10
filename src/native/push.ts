import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { registerPushDevice, removePushDevice } from "../api/client";
export const PUSH_TOKEN_KEY = "event-app:push-token";
export async function enablePush() {
  const projectId =
    Constants.easConfig?.projectId ||
    Constants.expoConfig?.extra?.eas?.projectId;
  if (!projectId) throw new Error("Bildirim hizmeti henüz yapılandırılmamış.");
  if (Platform.OS === "android")
    await Notifications.setNotificationChannelAsync("events", {
      name: "Etkinlikler ve mesajlar",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  let permission = await Notifications.getPermissionsAsync();
  if (!permission.granted)
    permission = await Notifications.requestPermissionsAsync();
  if (!permission.granted)
    throw new Error(
      "Bildirim izni verilmedi. Telefon ayarlarından izin verebilirsin.",
    );
  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  await registerPushDevice(token);
  await AsyncStorage.setItem(PUSH_TOKEN_KEY, token);
}
export async function disablePush() {
  const token = await AsyncStorage.getItem(PUSH_TOKEN_KEY);
  if (token) await removePushDevice(token);
  await AsyncStorage.removeItem(PUSH_TOKEN_KEY);
}

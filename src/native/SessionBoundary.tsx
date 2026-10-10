import { useEffect } from "react";
import { Alert } from "react-native";
import { useRouter } from "expo-router";
import { onSessionExpired } from "../api/client";
export default function SessionBoundary() {
  const router = useRouter();
  useEffect(
    () =>
      onSessionExpired(() => {
        router.replace("/login");
        Alert.alert(
          "Oturum sona erdi",
          "Güvenliğin için yeniden giriş yapmalısın.",
        );
      }),
    [router],
  );
  return null;
}

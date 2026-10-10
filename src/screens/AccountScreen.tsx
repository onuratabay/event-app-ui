import AsyncStorage from "@react-native-async-storage/async-storage";
import { useState } from "react";
import { Alert } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import {
  changePassword,
  deleteAccount,
  exportAccount,
  logout,
  getApiErrorMessage,
} from "../api/client";
import { useStore } from "../native/Store";
import Screen from "../native/Screen";
import { Field, Label, Scroll, Touch } from "../native/UI";
import TopNavBar from "../components/TopNavBar";
import type { NavigateFn } from "../types";
import { palette } from "../theme/palette";
export default function AccountScreen({
  navigate,
  mode,
}: {
  navigate: NavigateFn;
  mode?: string;
}) {
  const action =
      mode === "delete" ? "delete" : mode === "export" ? "export" : "password",
    title =
      action === "delete"
        ? "Hesabımı sil"
        : action === "export"
          ? "Verilerimi indir"
          : "Şifremi değiştir";
  const { resetSession, data } = useStore(),
    [password, setPassword] = useState(""),
    [next, setNext] = useState(""),
    [confirm, setConfirm] = useState(""),
    [phrase, setPhrase] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [done, setDone] = useState(false);
  const valid =
    password.length > 0 &&
    (action !== "password" ||
      (next.length >= 8 && /[^A-Za-z0-9]/.test(next) && next === confirm)) &&
    (action !== "delete" || phrase === "HESABIMI SİL");
  const run = async () => {
    if (busy || !valid) return;
    setBusy(true);
    setError("");
    try {
      if (action === "password") {
        await changePassword(password, next);
        await logout();
        resetSession();
        navigate("login");
        Alert.alert("Şifren değişti", "Yeni şifrenle yeniden giriş yap.");
        return;
      }
      if (action === "delete") {
        await deleteAccount(password);
        await AsyncStorage.removeItem(
          `event-app:recent-searches:${data.user.id}`,
        ).catch(() => {});
        await logout();
        resetSession();
        navigate("welcome");
        return;
      }
      if (!(await Sharing.isAvailableAsync()))
        throw new Error("Bu cihazda dosya paylaşımı kullanılamıyor.");
      const result = await exportAccount(password),
        uri = `${FileSystem.cacheDirectory}ewent-account-export.json`;
      try {
        await FileSystem.writeAsStringAsync(
          uri,
          JSON.stringify(result, null, 2),
        );
        await Sharing.shareAsync(uri, {
          mimeType: "application/json",
          UTI: "public.json",
          dialogTitle: "Hesap verilerini kaydet",
        });
        setDone(true);
      } finally {
        await FileSystem.deleteAsync(uri, { idempotent: true });
      }
      setPassword("");
    } catch (e) {
      setError(
        getApiErrorMessage(
          e,
          "İşlem tamamlanamadı. Şifreni ve bağlantını kontrol et.",
        ),
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <Screen>
      <TopNavBar navigate={navigate} fallback="settings" title={title} />
      <Scroll
        style={{
          paddingTop: 84,
          paddingHorizontal: 24,
          paddingBottom: 32,
          gap: 18,
        }}
      >
        <Label>
          {action === "delete"
            ? "Bu işlem geri alınamaz. Hesabın, profil fotoğrafın, mesajların, düzenlediğin etkinlikler ve bu etkinliklere bağlı katılım kayıtları silinir. Önce verilerini indirebilirsin."
            : action === "export"
              ? "Hesap bilgilerin, kendi mesajların, tercihler ve etkinlik kayıtların JSON dosyası olarak hazırlanır. Dosya kişisel bilgiler içerir; paylaşacağın yeri dikkatle seç."
              : "Mevcut şifreni doğrula ve en az 8 karakter, bir özel karakter içeren yeni bir şifre belirle."}
        </Label>
        <Field
          accessibilityLabel="Mevcut şifre"
          placeholder="Mevcut şifre"
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="current-password"
          value={password}
          onChangeText={setPassword}
        />
        {action === "password" && (
          <>
            <Field
              accessibilityLabel="Yeni şifre"
              placeholder="Yeni şifre"
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="new-password"
              value={next}
              onChangeText={setNext}
            />
            <Field
              accessibilityLabel="Yeni şifre tekrar"
              placeholder="Yeni şifre tekrar"
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              value={confirm}
              onChangeText={setConfirm}
            />
          </>
        )}
        {action === "delete" && (
          <>
            <Label>Onaylamak için HESABIMI SİL yaz.</Label>
            <Field
              accessibilityLabel="Silme onayı"
              value={phrase}
              onChangeText={setPhrase}
              autoCorrect={false}
            />
          </>
        )}
        {error && (
          <Label accessibilityRole="alert" style={{ color: palette.error }}>
            {error}
          </Label>
        )}
        {done && <Label>Dosya paylaşım ekranına aktarıldı.</Label>}
        <Touch
          disabled={busy || !valid}
          onPress={() => {
            if (action === "delete")
              Alert.alert(
                "Hesabın kalıcı olarak silinsin mi?",
                "Düzenlediğin etkinlikler de silinecek.",
                [
                  { text: "Vazgeç", style: "cancel" },
                  {
                    text: "Kalıcı olarak sil",
                    style: "destructive",
                    onPress: () => void run(),
                  },
                ],
              );
            else void run();
          }}
          gradient={palette.actionGradient}
        >
          <Label>{busy ? "İşleniyor…" : title}</Label>
        </Touch>
      </Scroll>
    </Screen>
  );
}

import ScreenLayout from "../native/Screen";
import React, { useState } from "react";
import { Alert, Modal, StyleSheet } from "react-native";
import { getApiErrorMessage, joinEventAsGuest } from "../api/client";
import { useStore } from "../native/Store";
import { Scroll, Box, Field, Label, Touch } from "../native/UI";
import { palette, alpha } from "../theme/palette";
import { ui } from "../theme/styles";
import type { NavigateFn } from "../types";
import { CloseIcon, UsersIcon } from "./Icons";

interface Props {
  visible: boolean;
  initialCode?: string;
  onClose: () => void;
  navigate: NavigateFn;
}

export default function GuestCodeModal({ visible, onClose, navigate, initialCode = "" }: Props) {
  const { loginAsGuest } = useStore();
  const [code, setCode] = useState(initialCode);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    const cleanCode = code.trim().toUpperCase();
    const cleanName = name.trim();

    if (!cleanCode) {
      setError("Lütfen etkinlik kodunu gir.");
      return;
    }
    if (!cleanName || cleanName.length < 2) {
      setError("Lütfen adını ve soyadını gir (en az 2 karakter).");
      return;
    }

    setError(null);
    setBusy(true);

    try {
      const res = await joinEventAsGuest(cleanCode, cleanName);
      if (!res.event?.id) {
        throw new Error("Etkinlik bilgileri alınamadı.");
      }

      await loginAsGuest(
        {
          code: cleanCode,
          session: res.session,
          name: res.name,
          coupon: res.coupon,
          expiresAt: res.expiresAt,
          eventId: res.event.id,
          event: res.event,
        },
        res.event
      );

      onClose();
      setCode("");
      setName("");
      navigate("event-detail", { eventId: res.event.id });
    } catch (err) {
      setError(getApiErrorMessage(err, "Etkinliğe katılınamadı. Kodu kontrol edip tekrar dene."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent statusBarTranslucent navigationBarTranslucent animationType="fade" onRequestClose={onClose}>
      <ScreenLayout style={styles.backdrop}>
        <Scroll contentContainerStyle={{ flexGrow: 1, justifyContent: "flex-end" }}>
        <Touch onPress={e => e.stopPropagation()} style={styles.sheet} glass>
          <Box style={styles.header}>
            <Box style={{ flex: 1 }}>
              <Label style={styles.title}>Etkinlik Kodu ile Katıl</Label>
              <Label style={styles.subtitle}>
                Arkadaşının paylaştığı benzersiz kod ile doğrudan etkinliğe katıl ve mesajlaş.
              </Label>
            </Box>
            <Touch onPress={onClose} style={styles.closeBtn} accessibilityLabel="Kapat">
              <CloseIcon size={18} style={{ color: palette.muted }} />
            </Touch>
          </Box>

          {error && (
            <Box style={styles.errorBox}>
              <Label style={styles.errorText}>{error}</Label>
            </Box>
          )}

          <Box style={styles.fieldGroup}>
            <Label style={styles.label}>ETKİNLİK KODU</Label>
            <Field
              value={code}
              onChangeText={val => {
                setCode(val.toUpperCase());
                if (error) setError(null);
              }}
              placeholder="ÖRN: 7X9K2P"
              autoCapitalize="characters"
              autoCorrect={false}
              style={styles.codeInput}
              placeholderTextColor={alpha(palette.white, 0.25)}
            />
          </Box>

          <Box style={styles.fieldGroup}>
            <Label style={styles.label}>ADINIZ VE SOYADINIZ</Label>
            <Field
              value={name}
              onChangeText={val => {
                setName(val);
                if (error) setError(null);
              }}
              placeholder="Sohbette görünecek adınız"
              autoCapitalize="words"
              style={styles.nameInput}
              placeholderTextColor={alpha(palette.white, 0.25)}
            />
          </Box>

          <Touch
            disabled={busy || !code.trim() || !name.trim()}
            onPress={handleSubmit}
            style={[styles.submitBtn, (busy || !code.trim() || !name.trim()) && styles.disabledBtn]}
            gradient={busy || !code.trim() || !name.trim() ? undefined : palette.actionGradient}
          >
            <Label style={styles.submitText}>
              {busy ? "Etkinliğe Giriliyor…" : "Etkinliğe Gir →"}
            </Label>
          </Touch>
        </Touch>
        </Scroll>
      </ScreenLayout>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: alpha(palette.black, 0.72),
    justifyContent: "flex-end",
    padding: 12,
    paddingBottom: 24,
  },
  sheet: {
    backgroundColor: alpha(palette.surface, 0.96),
    borderRadius: 28,
    borderWidth: 1,
    borderColor: alpha(palette.accent, 0.16),
    padding: 22,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 18,
    gap: 12,
  },
  title: {
    fontSize: 20,
    fontFamily: "Outfit-SemiBold",
    color: palette.white,
  },
  subtitle: {
    fontSize: 13,
    color: alpha(palette.white, 0.55),
    marginTop: 4,
    lineHeight: 18,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: alpha(palette.white, 0.08),
    alignItems: "center",
    justifyContent: "center",
  },
  errorBox: {
    backgroundColor: alpha(palette.error, 0.14),
    borderWidth: 1,
    borderColor: alpha(palette.error, 0.32),
    borderRadius: 12,
    padding: 10,
    marginBottom: 14,
  },
  errorText: {
    color: palette.error,
    fontSize: 13,
    textAlign: "center",
  },
  fieldGroup: {
    marginBottom: 14,
  },
  label: {
    fontSize: 11,
    fontFamily: "Outfit-Medium",
    color: alpha(palette.accent, 0.7),
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  codeInput: {
    backgroundColor: alpha(palette.white, 0.06),
    borderWidth: 1,
    borderColor: alpha(palette.accent, 0.22),
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: palette.white,
    fontSize: 18,
    fontFamily: "Outfit-SemiBold",
    letterSpacing: 2,
    textAlign: "center",
  },
  nameInput: {
    backgroundColor: alpha(palette.white, 0.06),
    borderWidth: 1,
    borderColor: alpha(palette.white, 0.22),
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: palette.white,
    fontSize: 15,
  },
  submitBtn: {
    marginTop: 8,
    paddingVertical: 16,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  disabledBtn: {
    backgroundColor: alpha(palette.white, 0.08),
    borderWidth: 1,
    borderColor: alpha(palette.white, 0.1),
  },
  submitText: {
    color: palette.white,
    fontSize: 16,
    fontFamily: "Outfit-SemiBold",
  },
});


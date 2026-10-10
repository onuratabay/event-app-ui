import { useState } from "react";
import { Box, Field, Label, Scroll, Sheet, Touch } from "../native/UI";
import { getApiErrorMessage, reportTarget } from "../api/client";
import { palette } from "../theme/palette";
export default function ReportSheet({
  kind,
  id,
  onClose,
}: {
  kind: "events" | "users";
  id: string;
  onClose: () => void;
}) {
  const [description, setDescription] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [sent, setSent] = useState(false);
  return (
    <Sheet onClose={onClose}>
      <Box
        style={{
          backgroundColor: palette.surface,
          padding: 24,
          borderRadius: 24,
          maxHeight: "90%",
        }}
      >
        <Scroll>
          <Label style={{ fontSize: 24 }}>Şikâyet bildir</Label>
          {sent ? (
            <Label>
              Şikâyetin alındı. Durumunu Ayarlar → Şikâyetlerim bölümünden takip
              edebilirsin.
            </Label>
          ) : (
            <>
              <Label>
                İnceleyebilmemiz için durumu açıkla. Gereksiz kişisel bilgi
                paylaşma.
              </Label>
              <Field
                accessibilityLabel="Şikâyet açıklaması"
                multiline
                maxLength={2000}
                value={description}
                onChangeText={setDescription}
                placeholder="Ne oldu?"
              />
              {error && (
                <Label
                  accessibilityRole="alert"
                  style={{ color: palette.error }}
                >
                  {error}
                </Label>
              )}
              <Touch
                disabled={busy || description.trim().length < 10}
                onPress={async () => {
                  setBusy(true);
                  setError("");
                  try {
                    await reportTarget(kind, id, description.trim());
                    setSent(true);
                  } catch (e) {
                    setError(getApiErrorMessage(e, "Şikâyet gönderilemedi."));
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <Label>{busy ? "Gönderiliyor…" : "Şikâyeti gönder"}</Label>
              </Touch>
            </>
          )}
          <Touch onPress={onClose}>
            <Label>Kapat</Label>
          </Touch>
        </Scroll>
      </Box>
    </Sheet>
  );
}

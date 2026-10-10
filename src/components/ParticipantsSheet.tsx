import { useEffect, useState } from "react";
import { Box, Label, Scroll, Sheet, Touch } from "../native/UI";
import { getParticipants, getApiErrorMessage } from "../api/client";
import type { NavigateFn } from "../types";
import { palette } from "../theme/palette";
const statuses: Record<string, string> = {
  confirmed: "Katılımcı",
  invited: "Davet bekliyor",
  waitlisted: "Yedek liste",
  declined: "Ayrıldı / reddetti",
};
export default function ParticipantsSheet({
  eventId,
  ownerId,
  navigate,
  onClose,
}: {
  eventId: string;
  ownerId: string;
  navigate: NavigateFn;
  onClose: () => void;
}) {
  const [items, setItems] = useState<
      Awaited<ReturnType<typeof getParticipants>>
    >([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(true),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setBusy(true);
    setError("");
    getParticipants(eventId)
      .then((x) => {
        if (active) setItems(x);
      })
      .catch((e) => {
        if (active) setError(getApiErrorMessage(e));
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
    };
  }, [eventId, retry]);
  return (
    <Sheet onClose={onClose}>
      <Box
        style={{
          backgroundColor: palette.surface,
          padding: 24,
          maxHeight: "85%",
          borderRadius: 24,
        }}
      >
        <Scroll>
          <Label style={{ fontSize: 24 }}>Katılımcılar</Label>
          {busy && <Label>Yükleniyor…</Label>}
          {error && (
            <Touch onPress={() => setRetry((x) => x + 1)}>
              <Label>{error} · Yeniden dene</Label>
            </Touch>
          )}
          {!busy && !error && !items.length && (
            <Label>Henüz katılımcı yok.</Label>
          )}
          {items.map((p) => (
            <Touch
              key={p.user.id}
              onPress={() => {
                onClose();
                navigate("profile", { userId: p.user.id });
              }}
              style={{ paddingVertical: 14 }}
            >
              <Label>
                {p.user.firstName} {p.user.lastName}
              </Label>
              <Label style={{ color: palette.muted }}>
                {p.user.id === ownerId
                  ? "Düzenleyici"
                  : statuses[p.status] || p.status}
              </Label>
            </Touch>
          ))}
          <Touch onPress={onClose}>
            <Label>Kapat</Label>
          </Touch>
        </Scroll>
      </Box>
    </Sheet>
  );
}

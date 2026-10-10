import { useEffect, useState } from "react";
import { getReports, getApiErrorMessage, type UserReport } from "../api/client";
import Screen from "../native/Screen";
import { Label, Scroll, Touch } from "../native/UI";
import TopNavBar from "../components/TopNavBar";
import StoryNote from "../components/StoryNote";
import type { NavigateFn } from "../types";
export default function ReportsScreen({ navigate }: { navigate: NavigateFn }) {
  const [items, setItems] = useState<UserReport[]>([]),
    [page, setPage] = useState(1),
    [total, setTotal] = useState(0),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setBusy(true);
    setError("");
    getReports()
      .then((r) => {
        if (active) {
          setItems(r.items);
          setTotal(r.total);
          setPage(1);
        }
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
  }, [retry]);
  return (
    <Screen>
      <TopNavBar navigate={navigate} fallback="settings" title="Şikâyetlerim" />
      <Scroll
        style={{
          paddingTop: 84,
          paddingHorizontal: 24,
          paddingBottom: 24,
          gap: 16,
        }}
      >
        <StoryNote scene="reports" />
        {busy && <Label>Yükleniyor…</Label>}
        {error && (
          <Touch onPress={() => setRetry((x) => x + 1)}>
            <Label>{error} · Yeniden dene</Label>
          </Touch>
        )}
        {!busy && !error && !items.length && (
          <Label>Henüz bir şikâyetin yok.</Label>
        )}
        {items.map((x) => (
          <Label key={x.id}>
            {x.statusLabel} ·{" "}
            {new Date(x.createdAt).toLocaleDateString("tr-TR")}
            {"\n"}
            {x.description}
          </Label>
        ))}
        {items.length < total && (
          <Touch
            disabled={busy}
            onPress={async () => {
              setBusy(true);
              try {
                const r = await getReports(page + 1);
                setItems((old) => [...old, ...r.items]);
                setPage((p) => p + 1);
                setTotal(r.total);
              } catch (e) {
                setError(getApiErrorMessage(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            <Label>Daha fazla göster</Label>
          </Touch>
        )}
      </Scroll>
    </Screen>
  );
}

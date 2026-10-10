import { useEffect, useState } from "react";
import { getPublicProfile, getApiErrorMessage } from "../api/client";
import Screen from "../native/Screen";
import { Label, Picture, Scroll, Touch } from "../native/UI";
import TopNavBar from "../components/TopNavBar";
import ReportSheet from "../components/ReportSheet";
import { palette } from "../theme/palette";
import type { PublicProfile, NavigateFn } from "../types";
export default function PublicProfileScreen({
  userId,
  navigate,
}: {
  userId: string;
  navigate: NavigateFn;
}) {
  const [user, setUser] = useState<PublicProfile | null>(null),
    [error, setError] = useState(""),
    [retry, setRetry] = useState(0),
    [report, setReport] = useState(false);
  useEffect(() => {
    let active = true;
    setUser(null);
    setError("");
    getPublicProfile(userId)
      .then((x) => {
        if (active) setUser(x);
      })
      .catch((e) => {
        if (active) setError(getApiErrorMessage(e, "Profil yüklenemedi."));
      });
    return () => {
      active = false;
    };
  }, [userId, retry]);
  return (
    <Screen>
      <TopNavBar navigate={navigate} fallback="discover" title="Üye profili" />
      <Scroll
        style={{
          paddingTop: 84,
          paddingHorizontal: 24,
          paddingBottom: 32,
          gap: 16,
        }}
      >
        {error ? (
          <Touch onPress={() => setRetry((x) => x + 1)}>
            <Label>{error} · Yeniden dene</Label>
          </Touch>
        ) : !user ? (
          <Label>Profil yükleniyor…</Label>
        ) : (
          <>
            <Picture
              uri={user.avatar}
              accessibilityLabel={user.name}
              style={{ width: 88, height: 88, borderRadius: 44 }}
            />
            <Label style={{ fontSize: 28 }}>{user.name}</Label>
            <Label>{user.city}</Label>
            <Label>{user.bio || "Henüz kendinden bahsetmemiş."}</Label>
            <Label>
              {user.stats.attended} doğrulanmış katılım · {user.stats.organized}{" "}
              düzenlenen etkinlik · {user.stats.connections} bağlantı
            </Label>
            <Label style={{ color: palette.accent }}>
              {user.interests.join(" · ") || "Henüz ilgi alanı eklenmemiş."}
            </Label>
            <Touch onPress={() => setReport(true)}>
              <Label>Bu kullanıcıyı şikâyet et</Label>
            </Touch>
          </>
        )}
      </Scroll>
      {report && (
        <ReportSheet
          kind="users"
          id={userId}
          onClose={() => setReport(false)}
        />
      )}
    </Screen>
  );
}

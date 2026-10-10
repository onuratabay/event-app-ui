import Screen from "../native/Screen";
import { Label, Scroll, Touch, openExternal } from "../native/UI";
import TopNavBar from "../components/TopNavBar";
import StoryNote from "../components/StoryNote";
import { legalDocuments } from "../content/legal";
import type { NavigateFn } from "../types";
export default function LegalScreen({ navigate }: { navigate: NavigateFn }) {
  return (
    <Screen>
      <TopNavBar
        navigate={navigate}
        fallback="settings"
        title="Gizlilik ve koşullar"
      />
      <Scroll
        style={{
          paddingTop: 84,
          paddingHorizontal: 24,
          paddingBottom: 32,
          gap: 20,
        }}
      >
        <StoryNote scene="legal" />
        {Object.entries(legalDocuments).map(([key, doc]) => (
          <Touch
            key={key}
            disabled={!doc.url}
            onPress={() => doc.url && void openExternal(doc.url)}
          >
            <Label>{doc.title}</Label>
            <Label>
              {doc.url
                ? "Yayımlanmış belgeyi tarayıcıda aç"
                : "Onaylı belge henüz yayımlanmamış."}
            </Label>
          </Touch>
        ))}
        <Label>
          Hesap verilerinin kopyasını Ayarlar → Verilerimi indir bölümünden
          alabilir, hesabını Hesabımı sil bölümünden kaldırabilirsin.
        </Label>
      </Scroll>
    </Screen>
  );
}

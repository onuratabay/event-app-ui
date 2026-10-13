import { StyleSheet } from "react-native"
import { palette } from "../theme/palette"
import { Box, Label, Touch } from "../native/UI"
import { CategoryIcon } from "./Icons"

// Playful one-liners per activity; anything else gets a generic invitation.
const IDEAS: Record<string, { emoji: string; line: string }> = {
  Kahve: { emoji: "☕", line: "Bir kahve, yeni bir sohbet" },
  Padel: { emoji: "🎾", line: "Dörtlü padel maçı kur" },
  Tenis: { emoji: "🎾", line: "Kort senin, rakip bul" },
  Koşu: { emoji: "🏃", line: "Sabah koşusuna ekip topla" },
  Hiking: { emoji: "🥾", line: "Hafta sonu doğa yürüyüşü" },
  "Doğa Yürüyüşü": { emoji: "🥾", line: "Hafta sonu doğa yürüyüşü" },
  Bisiklet: { emoji: "🚴", line: "Sahil boyu bisiklet turu" },
  Konser: { emoji: "🎶", line: "Konsere birlikte gidelim" },
  Sanat: { emoji: "🎨", line: "Sergi gezisi planla" },
  Fotoğraf: { emoji: "📸", line: "Gün batımı fotoğraf yürüyüşü" },
  "Kutu Oyunu": { emoji: "🎲", line: "Kutu oyunu akşamı" },
}
const FALLBACK = ["Kahve", "Padel", "Hiking"]

export default function DiscoverEmptyState({
  interests,
  filterLabel,
  onClearFilter,
  onCreate,
}: {
  interests: string[]
  /** Set when a filter (not the whole feed) is what left the list empty. */
  filterLabel?: string
  onClearFilter: () => void
  onCreate: (activity?: string) => void
}) {
  const ideas = [...new Set([...interests, ...FALLBACK])].slice(0, 3)
  return (
    <Box style={s.wrap}>
      <Box style={s.orbit}>
        <Label style={[s.float, s.floatLeft]}>🎾</Label>
        <Box style={s.halo}>
          <CategoryIcon name={ideas[0]} size={40} strokeWidth={1.6} style={{ color: palette.accent }} />
        </Box>
        <Label style={[s.float, s.floatRight]}>☕</Label>
        <Label style={[s.float, s.floatBottom]}>✨</Label>
      </Box>

      {filterLabel ? (
        <>
          <Label style={s.title}>“{filterLabel}” şimdilik sessiz 🌙</Label>
          <Label style={s.body}>Bu filtrede açık etkinlik yok. Tüm akışa göz at ya da bu boşluğu ilk sen doldur.</Label>
          <Touch onPress={onClearFilter} style={s.secondary}>
            <Label style={s.secondaryLabel}>Tüm etkinlikleri göster</Label>
          </Touch>
        </>
      ) : (
        <>
          <Label style={s.title}>Sahne boş, ilk hamle senden! ✨</Label>
          <Label style={s.body}>Etrafta henüz etkinlik yok, ama bu iyi haber: ilk planı sen kurarsan herkes seninkine katılır.</Label>
        </>
      )}

      <Label style={s.heading}>Aklına ne geliyor?</Label>
      <Box style={s.ideas}>
        {ideas.map(activity => {
          const idea = IDEAS[activity] || { emoji: "✦", line: `${activity} buluşması ayarla` }
          return (
            <Touch key={activity} accessibilityLabel={`${activity} etkinliği oluştur`} onPress={() => onCreate(activity)} style={s.idea}>
              <Label style={s.ideaEmoji}>{idea.emoji}</Label>
              <Box style={{ flex: 1, minWidth: 0 }}>
                <Label style={s.ideaTitle} numberOfLines={1}>{idea.line}</Label>
                <Label style={s.ideaHint} numberOfLines={1}>{activity} · hemen oluştur</Label>
              </Box>
              <Label style={s.ideaArrow}>›</Label>
            </Touch>
          )
        })}
      </Box>

      <Touch onPress={() => onCreate()} style={s.primary} gradient={palette.actionGradient}>
        <Label style={s.primaryLabel}>Etkinlik Oluştur</Label>
      </Touch>
      <Label style={s.hint}>↓ Yeni etkinlikler için aşağı çekip yenileyebilirsin</Label>
    </Box>
  )
}

const s = StyleSheet.create({
  wrap: { paddingVertical: 24, alignItems: "stretch", gap: 12 },
  orbit: { alignSelf: "center", width: 160, height: 120, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  halo: { width: 84, height: 84, borderRadius: 42, alignItems: "center", justifyContent: "center", backgroundColor: palette.selected, borderWidth: 1, borderColor: palette.border },
  float: { position: "absolute", fontSize: 24, lineHeight: 30 },
  floatLeft: { left: 4, top: 14 },
  floatRight: { right: 6, top: 4 },
  floatBottom: { right: 22, bottom: 4, fontSize: 18, lineHeight: 24 },
  title: { textAlign: "center", fontFamily: "Fraunces", fontSize: 22, lineHeight: 30, color: palette.text },
  body: { textAlign: "center", fontFamily: "Outfit", fontSize: 14, lineHeight: 21, color: palette.muted, paddingHorizontal: 8 },
  heading: { marginTop: 8, fontFamily: "Outfit-SemiBold", fontSize: 12, lineHeight: 16, letterSpacing: 1, color: "rgba(244,245,255,.45)", textTransform: "uppercase" },
  ideas: { gap: 8 },
  idea: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 18, borderWidth: 1, borderColor: palette.border, backgroundColor: "rgba(17,22,42,.72)" },
  ideaEmoji: { fontSize: 22, lineHeight: 28 },
  ideaTitle: { fontFamily: "Outfit-SemiBold", fontSize: 14, lineHeight: 19, color: palette.text },
  ideaHint: { fontFamily: "Outfit", fontSize: 12, lineHeight: 16, color: palette.muted },
  ideaArrow: { fontSize: 22, lineHeight: 26, color: palette.accent },
  primary: { marginTop: 6, minHeight: 52, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  primaryLabel: { fontFamily: "Outfit-SemiBold", fontSize: 15, lineHeight: 20, color: palette.text },
  secondary: { alignSelf: "center", minHeight: 40, paddingHorizontal: 16, borderRadius: 14, justifyContent: "center", backgroundColor: palette.selected },
  secondaryLabel: { fontFamily: "Outfit-SemiBold", fontSize: 13, lineHeight: 18, color: palette.accent },
  hint: { textAlign: "center", fontFamily: "Outfit", fontSize: 12, lineHeight: 16, color: "rgba(146,157,184,.7)" },
})

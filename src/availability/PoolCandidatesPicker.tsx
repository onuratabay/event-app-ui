import { useEffect, useState } from "react"
import { ActivityIndicator, StyleSheet } from "react-native"
import { getApiErrorMessage, previewEventCandidates, type CandidateDraft, type EventCandidate } from "../api/client"
import { Avatar, GlassCard } from "../components/GlassUI"
import { CalendarIcon, CheckIcon } from "../components/Icons"
import { Box, Label, Touch } from "../native/UI"
import { palette } from "../theme/palette"

type State = { state: "loading" | "error" | "ready"; items: EventCandidate[]; error?: string }

// Creation preview: people from the private pool who fit this draft. Selected people are invited right after
// the event is created; the server re-checks that they still fit at that moment.
export default function PoolCandidatesPicker({ draft, selected, onChange }: { draft: CandidateDraft; selected: string[]; onChange: (ids: string[]) => void }) {
  const [result, setResult] = useState<State>({ state: "loading", items: [] })
  const [attempt, setAttempt] = useState(0)
  const key = JSON.stringify(draft)
  useEffect(() => {
    let active = true
    setResult({ state: "loading", items: [] })
    previewEventCandidates(draft)
      .then(response => {
        if (!active) return
        setResult({ state: "ready", items: response.items })
        // Drop selections that no longer fit the edited draft.
        onChange(selected.filter(id => response.items.some(item => item.user.id === id)))
      })
      .catch(error => { if (active) setResult({ state: "error", items: [], error: getApiErrorMessage(error, "Uygun kişiler yüklenemedi.") }) })
    return () => { active = false }
  }, [key, attempt])
  const toggle = (id: string) => onChange(selected.includes(id) ? selected.filter(item => item !== id) : [...selected, id])
  return <GlassCard style={s.card}>
    <Box style={s.head}>
      <CalendarIcon size={18} style={{ color: palette.accent }} />
      <Label style={s.title}>{selected.length ? `Uygun kişilerden davet et · ${selected.length} seçili` : "Uygun kişilerden davet et"}</Label>
    </Box>
    <Label style={s.muted}>Etkinlik Takvimim'de bu tarih, saat, bölge ve aktiviteye açık olan kişiler. Davet etkinlik oluşturulunca gönderilir; kişiyi otomatik eklemez ve yer ayırmaz.</Label>
    {result.state === "loading" && <Box style={s.row}><ActivityIndicator color={palette.accent} /><Label style={s.muted}>Uygun kişiler aranıyor…</Label></Box>}
    {result.state === "error" && <Box style={{ gap: 6 }}><Label style={s.error}>{result.error}</Label><Touch onPress={() => setAttempt(value => value + 1)} style={s.link}><Label style={s.linkText}>Tekrar dene</Label></Touch></Box>}
    {result.state === "ready" && !result.items.length && <Label style={s.muted}>Şu an bu taslağa uyan kimse yok. Etkinliği oluşturduktan sonra detay ekranındaki "+ Kişi ekle" ile yeniden bakabilirsin.</Label>}
    {result.items.map(candidate => {
      const name = `${candidate.user.firstName} ${candidate.user.lastName}`.trim(), chosen = selected.includes(candidate.user.id)
      return <Touch key={candidate.user.id} accessibilityLabel={`${name} davet et`} accessibilityState={{ selected: chosen }} onPress={() => toggle(candidate.user.id)} style={[s.candidate, chosen && s.chosen]}>
        <Avatar uri={candidate.user.profilePhoto || ""} name={name} size="sm" />
        <Box style={{ flex: 1, minWidth: 0 }}>
          <Label style={s.name} numberOfLines={1}>{name}</Label>
          <Label style={s.match}>{[candidate.match.level, `★ ${candidate.user.rank.toFixed(1)}`].filter(Boolean).join(" · ")}</Label>
        </Box>
        {chosen && <CheckIcon size={16} style={{ color: palette.accent }} />}
      </Touch>
    })}
  </GlassCard>
}

const s = StyleSheet.create({
  card: { padding: 16, gap: 10, marginBottom: 16 },
  head: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { color: palette.text, fontFamily: "Outfit-SemiBold", fontSize: 14, lineHeight: 19, flex: 1 },
  muted: { color: palette.muted, fontSize: 12, lineHeight: 17 },
  error: { color: palette.error, fontSize: 13, lineHeight: 18 },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  link: { alignSelf: "flex-start", paddingVertical: 4 },
  linkText: { color: palette.accent, fontFamily: "Outfit-SemiBold", fontSize: 13 },
  candidate: { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 14, borderWidth: 1, borderColor: palette.border, padding: 10 },
  chosen: { borderColor: "rgba(105,120,255,.5)", backgroundColor: palette.selected },
  name: { color: palette.text, fontFamily: "Outfit-SemiBold", fontSize: 14, lineHeight: 19 },
  match: { color: palette.accent, fontSize: 12, lineHeight: 17 },
})

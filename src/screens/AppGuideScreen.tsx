import { useState } from "react"
import { StyleSheet } from "react-native"
import TopNavBar from "../components/TopNavBar"
import { AtmoBackground, GlassCard } from "../components/GlassUI"
import { Box, Label, Scroll, Touch } from "../native/UI"
import { useStore } from "../native/Store"
import { palette } from "../theme/palette"
import type { NavigateFn } from "../types"
import { GUIDES, type Guide } from "../walkthrough/config"
import { useWalkthrough } from "../walkthrough/WalkthroughProvider"

export default function AppGuideScreen({ navigate }: { navigate: NavigateFn }) {
  const walkthrough = useWalkthrough(), { data } = useStore()
  const [filter, setFilter] = useState("Tümü")
  const guides = GUIDES.filter(guide => !guide.admin || data.user.role === "admin")
  const completed = guides.filter(guide => walkthrough?.state.completedGuides.includes(guide.id)).length
  const pendingAccount = !!data.user.status && data.user.status !== "approved"
  const canOpen = (guide: Guide) => !guide.context && (!pendingAccount || guide.applicant || guide.id === "interests") && (!guide.applicant || pendingAccount)
  const open = (guide: Guide) => {
    if (!canOpen(guide)) { walkthrough?.preview(guide.id); return }
    walkthrough?.replayOnNextScreen(guide.id)
    navigate(guide.screen)
  }
  const sections = ["Başlarken", "Keşfet ve planla", "Birlikte", "Hesabın"] as const
  return <Box style={s.root}>
    <AtmoBackground />
    <TopNavBar navigate={navigate} fallback="settings" title="Uygulama Rehberi" />
    <Scroll style={s.page}>
      <Box style={s.intro}>
        <Label style={s.eyebrow}>KENDİ HIZINDA KEŞFET</Label>
        <Label accessibilityRole="header" style={s.title}>{"Küçük ipuçları.\nYeni olasılıklar."}</Label>
        <Label style={s.body}>Her ekranın rehberi yalnızca ilk ziyaretinde açılır. Geçtiğin rehberler de tekrar gösterilmez. Buradan istediğin bölüme her zaman dönebilirsin.</Label>
        <Label style={s.meta}>{`${completed} rehber tamamlandı · Her biri 2–3 kısa adım`}</Label>
      </Box>
      <Box style={s.filters} accessibilityRole="tablist">
        {["Tümü", "İncelemediklerim"].map(label => <Touch key={label} accessibilityRole="tab" accessibilityState={{ selected: filter === label }} onPress={() => setFilter(label)} style={[s.filter, filter === label && s.selected]}><Label style={[s.filterLabel, filter === label && { color: palette.accent }]}>{label}</Label></Touch>)}
      </Box>
      {sections.map(section => {
        const rows = guides.filter(guide => guide.section === section && (filter === "Tümü" || !walkthrough?.state.completedGuides.includes(guide.id) && !walkthrough?.state.skippedGuides.includes(guide.id)))
        if (!rows.length) return null
        return <Box key={section} style={s.section}>
          <Label accessibilityRole="header" style={s.sectionTitle}>{section}</Label>
          {rows.map(guide => {
            const done = walkthrough?.state.completedGuides.includes(guide.id), skipped = walkthrough?.state.skippedGuides.includes(guide.id)
            const status = done ? "Tamamlandı" : skipped ? "Geçildi" : "Henüz incelenmedi"
            return <GlassCard key={guide.id} style={s.card}>
              <Touch accessibilityLabel={`${guide.title}, ${status}, ${canOpen(guide) ? "ekranda göster" : "adımlara göz at"}`} onPress={() => open(guide)} style={s.row}>
                <Box style={[s.symbol, done && s.done]}><Label style={s.symbolLabel}>{done ? "✓" : "✦"}</Label></Box>
                <Box style={s.copy}><Label style={s.rowTitle}>{guide.title}</Label><Label style={s.detail}>{guide.summary}</Label><Label style={s.status}>{`${status} · ${canOpen(guide) ? "Ekranda göster" : "Adımlara göz at"}`}</Label></Box>
                <Label style={s.chevron}>›</Label>
              </Touch>
            </GlassCard>
          })}
        </Box>
      })}
      {filter !== "Tümü" && guides.every(guide => walkthrough?.state.completedGuides.includes(guide.id) || walkthrough?.state.skippedGuides.includes(guide.id)) && <Label style={s.body}>Bütün rehberlere göz attın. Yeniden incelemek için Tümü’nü seçebilirsin.</Label>}
      <Label style={s.footnote}>Etkinlik ve kişi gerektiren rehberlere burada göz atabilirsin. İlgili ekranı ilk açışında, rehber doğrudan o ekran üzerinde görünür.</Label>
    </Scroll>
  </Box>
}
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.background }, page: { paddingTop: 92, paddingHorizontal: 20, paddingBottom: 120 }, intro: { gap: 14 }, eyebrow: { color: palette.accent, fontSize: 10, letterSpacing: 2, fontFamily: "Outfit-Medium" }, title: { fontFamily: "Fraunces", fontSize: 34, lineHeight: 42, color: palette.text }, body: { color: "#b3bed5", fontSize: 14, lineHeight: 22 }, meta: { color: palette.muted, fontSize: 12 }, filters: { flexDirection: "row", gap: 8, marginTop: 24, marginBottom: 8 }, filter: { paddingHorizontal: 14, borderRadius: 14, borderWidth: 1, borderColor: palette.border }, selected: { backgroundColor: palette.selected, borderColor: "rgba(185,195,255,.35)" }, filterLabel: { fontSize: 12, color: palette.muted }, section: { marginTop: 24, gap: 10 }, sectionTitle: { color: palette.accent, fontSize: 13, fontFamily: "Outfit-Medium", marginBottom: 2 }, card: { padding: 0, overflow: "hidden", borderRadius: 20 }, row: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16 }, symbol: { width: 36, height: 36, borderRadius: 12, backgroundColor: palette.selected, alignItems: "center", justifyContent: "center" }, done: { backgroundColor: "rgba(111,208,182,.1)" }, symbolLabel: { color: palette.accent, fontSize: 17 }, copy: { flex: 1, gap: 5 }, rowTitle: { color: palette.text, fontFamily: "Outfit-Medium", fontSize: 15 }, detail: { color: "#b3bed5", fontSize: 12, lineHeight: 18 }, status: { color: palette.muted, fontSize: 10, lineHeight: 15 }, chevron: { color: palette.accent, fontSize: 24 }, footnote: { marginTop: 28, color: palette.muted, fontSize: 12, lineHeight: 20 },
})

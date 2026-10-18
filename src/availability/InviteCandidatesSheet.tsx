import ActivityIndicator from "../components/LoadingSpinner";
import { useEffect, useState } from "react"
import { StyleSheet } from "react-native"
import { getApiErrorMessage, getEventCandidates, inviteEventCandidates, type EventCandidate } from "../api/client"
import { Avatar, Checkbox, GlassFill } from "../components/GlassUI"
import { CheckIcon, CloseIcon, UserPlusIcon } from "../components/Icons"
import { Box, Label, Scroll, Sheet, Touch } from "../native/UI"
import { palette } from "../theme/palette"

type Candidates = { state: "loading" | "error" | "ready"; items: EventCandidate[]; spotsLeft: number; error?: string }

// Opens straight on the availability pool (Etkinlik Takvimim). Organizer only; the server checks ownership and eligibility again.
export default function InviteCandidatesSheet({ eventId, onClose }: { eventId: string; onClose: () => void }) {
  const [candidates, setCandidates] = useState<Candidates>({ state: "loading", items: [], spotsLeft: 0 })
  const [selected, setSelected] = useState<string[]>([])
  const [sending, setSending] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [sendError, setSendError] = useState<string | null>(null)
  const load = () => {
    setCandidates(current => ({ ...current, state: "loading" }))
    getEventCandidates(eventId)
      .then(result => setCandidates({ state: "ready", items: result.items, spotsLeft: result.capacity.spotsLeft }))
      .catch(error => setCandidates({ state: "error", items: [], spotsLeft: 0, error: getApiErrorMessage(error, "Uygun kişiler yüklenemedi.") }))
  }
  useEffect(load, [eventId])
  const toggle = (id: string) => setSelected(ids => ids.includes(id) ? ids.filter(item => item !== id) : [...ids, id])
  const send = async () => {
    if (sending || !selected.length) return
    setSending(true); setSendError(null)
    try {
      const result = await inviteEventCandidates(eventId, selected)
      setCandidates(current => ({ ...current, items: current.items.filter(item => !selected.includes(item.user.id)) }))
      setSelected([])
      setNotice(`${result.invited} kişiye davet gönderildi. Yanıt vermeleri için 24 saatleri var (etkinlik daha erken başlıyorsa başlangıca kadar).`)
    } catch (error) { setSendError(getApiErrorMessage(error, "Davet gönderilemedi.")) }
    finally { setSending(false) }
  }
  return <Sheet onClose={() => !sending && onClose()}>
    <Touch haptic={false} onPress={() => {}} style={s.panel}><GlassFill kind="sheet" topRadius={24} />
      <Box style={s.head}>
        <Label style={s.title} accessibilityRole="header">Davet et</Label>
        <Touch accessibilityLabel="Kapat" onPress={onClose} style={s.close}><CloseIcon size={18} style={{ color: palette.muted }} /></Touch>
      </Box>
      <Label style={s.muted}>Etkinlik Takvimi'nde bu etkinliğin tarihi, saati ve yeri için uygun olduğunu işaretleyen kişiler (aynı aktivite ve uygun seviye).</Label>
      <Box style={{ gap: 10, flexShrink: 1 }}>
        {candidates.state === "loading" && <Box style={s.state}><ActivityIndicator color={palette.accent} /><Label style={s.muted}>Uygun kişiler aranıyor…</Label></Box>}
        {candidates.state === "error" && <Box style={s.state}><Label style={s.error}>{candidates.error}</Label><Touch onPress={load} style={s.link}><Label style={s.linkText}>Tekrar dene</Label></Touch></Box>}
        {notice && <Box style={s.success} accessibilityLiveRegion="polite"><CheckIcon size={16} style={{ color: palette.success }} /><Label style={s.successText}>{notice}</Label></Box>}
        {candidates.state === "ready" && <>
          <Label style={s.muted}>{`${candidates.spotsLeft} yer kaldı. Davet yer ayırmaz: kabul edenler o anda kontenjan uygunsa katılır.`}</Label>
          {!candidates.items.length && <Box style={s.state}><Label style={s.muted}>Şu an bu etkinliğe uygun kimse yok. Süresi dolan davetlerden sonra yeni adaylar burada görünebilir.</Label></Box>}
          <Scroll style={{ maxHeight: 360 }}>
            {candidates.items.map(candidate => {
              const name = `${candidate.user.firstName} ${candidate.user.lastName}`.trim(), chosen = selected.includes(candidate.user.id)
              return <Touch key={candidate.user.id} accessibilityRole="checkbox" accessibilityLabel={`${name} davet et`} accessibilityState={{ checked: chosen }} onPress={() => toggle(candidate.user.id)} style={[s.candidate, chosen && s.candidateChosen]}>
                <Checkbox checked={chosen} />
                <Avatar uri={candidate.user.profilePhoto || ""} name={name} size="md" />
                <Box style={{ flex: 1, minWidth: 0, gap: 2 }}>
                  <Label style={s.optionTitle} numberOfLines={1}>{name}</Label>
                  <Label style={s.matchLine}>{[candidate.match.activity, candidate.match.level, `★ ${candidate.user.rank.toFixed(1)}`].filter(Boolean).join(" · ")}</Label>
                  {candidate.match.summary.map(line => <Label key={line} style={s.muted}>{`✓ ${line}`}</Label>)}
                </Box>
              </Touch>
            })}
          </Scroll>
          {sendError && <Label style={s.error} accessibilityLiveRegion="polite">{sendError}</Label>}
          <Touch disabled={!selected.length || sending} onPress={() => void send()} gradient={palette.actionGradient} style={s.primary}>
            <Box style={s.row}><UserPlusIcon size={16} style={{ color: palette.text }} /><Label style={s.primaryText}>{sending ? "Gönderiliyor…" : selected.length ? `Davet gönder (${selected.length})` : "Kişi seç"}</Label></Box>
          </Touch>
          <Label style={s.muted}>Davet kişiyi etkinliğe otomatik eklemez; kabul ya da reddi kendisi seçer.</Label>
        </>}
      </Box>
    </Touch>
  </Sheet>
}

const s = StyleSheet.create({
  panel: { backgroundColor: palette.glassSheet, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, borderColor: palette.glassBorder, padding: 20, gap: 12, alignItems: "stretch", maxHeight: "88%" },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { color: palette.text, fontFamily: "Outfit-SemiBold", fontSize: 17, lineHeight: 23 },
  close: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  optionTitle: { color: palette.text, fontFamily: "Outfit-SemiBold", fontSize: 14, lineHeight: 19 },
  muted: { color: palette.muted, fontSize: 12, lineHeight: 17 },
  matchLine: { color: palette.accent, fontSize: 12, lineHeight: 17 },
  error: { color: palette.error, fontSize: 13, lineHeight: 18 },
  state: { borderRadius: 16, borderWidth: 1, borderColor: palette.border, padding: 14, gap: 8, alignItems: "flex-start" },
  success: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 14, borderWidth: 1, borderColor: "rgba(111,208,182,.32)", backgroundColor: "rgba(111,208,182,.08)", padding: 12 },
  successText: { flex: 1, color: palette.text, fontSize: 13, lineHeight: 18 },
  link: { alignSelf: "flex-start", paddingVertical: 4 },
  linkText: { color: palette.accent, fontFamily: "Outfit-SemiBold", fontSize: 13 },
  candidate: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 16, borderWidth: 1, borderColor: palette.border, padding: 12, marginBottom: 8 },
  candidateChosen: { borderColor: "rgba(105,120,255,.5)", backgroundColor: palette.selected },
  row: { flexDirection: "row", alignItems: "center", gap: 8, justifyContent: "center" },
  primary: { minHeight: 52, borderRadius: 16, borderWidth: 1, borderColor: "rgba(183,197,255,.24)", alignItems: "center", justifyContent: "center" },
  primaryText: { color: palette.text, fontFamily: "Outfit-SemiBold", fontSize: 15, lineHeight: 21 },
})

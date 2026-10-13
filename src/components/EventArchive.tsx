import { StyleSheet } from "react-native"
import { useState } from "react"
import { palette } from "../theme/palette"
import { ui } from "../theme/styles"
import { Box, Label, Picture, Touch } from "../native/UI"
import { GlassCard } from "./GlassUI"
import { getApiErrorMessage, getOwnedEvents } from "../api/client"
import { EVENT_PHASE_LABEL, eventPhase, mapApiEvent, participantCount, useStore } from "../native/Store"
import type { AppEvent, NavigateFn } from "../types"

const PHASE_COLOR = { cancelled: palette.error, closed: palette.muted, started: palette.success, active: palette.success, forming: palette.accent }

/**
 * Own profile only: every event the user created with its status (waiting, open, started, ended,
 * cancelled). The list comes from /events/mine, which never returns anyone else's events.
 */
export default function EventArchive({ navigate }: { navigate: NavigateFn }) {
  const { setData } = useStore()
  const [open, setOpen] = useState(false)
  const [events, setEvents] = useState<AppEvent[] | null>(null)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const load = async (next: number) => {
    if (loading) return
    setLoading(true); setError("")
    try {
      const result = await getOwnedEvents(next)
      const found = result.items.map(mapApiEvent)
      // The detail page opens events from the shared list.
      setData(p => ({ ...p, events: [...new Map([...p.events, ...found].map(event => [event.id, event])).values()] }))
      setEvents(current => next === 1 ? found : [...(current || []), ...found.filter(event => !(current || []).some(row => row.id === event.id))])
      setTotal(result.total); setPage(next)
    } catch (cause) { setError(getApiErrorMessage(cause, "Arşiv yüklenemedi.")) }
    finally { setLoading(false) }
  }
  const toggle = () => { const next = !open; setOpen(next); if (next) void load(1) }
  return <GlassCard style={[[ui.overflowHidden]]}>
    <Touch accessibilityLabel="Arşivi aç" onPress={toggle} style={[[ui.wFull, ui.flex, ui.itemsCenter, ui.justifyBetween, ui.p4]]}>
      <Box style={[[ui.flex, ui.itemsCenter, ui.gap3]]}>
        <Box style={s.icon}><Label style={{ fontSize: 15 }}>🗂</Label></Box>
        <Box style={[[ui.textLeft]]}>
          <Label style={[[ui.textSm, ui.fontMedium, ui.textWhite80]]}>Arşiv{events ? ` · ${total}` : ""}</Label>
          <Label style={[[ui.textXs, ui.textWhite35]]}>Oluşturduğun tüm etkinlikler</Label>
        </Box>
      </Box>
      <Label style={[[ui.textWhite30, ui.textSm, open ? [ui.rotate180] : []]]}>▾</Label>
    </Touch>
    {open && <Box style={{ paddingHorizontal: 16, paddingBottom: 16, gap: 10 }}>
      {error ? <Label style={s.note}>{error}</Label>
        : events === null ? <Label style={s.note}>Arşiv yükleniyor…</Label>
        : !events.length ? <Label style={s.note}>Henüz bir etkinlik oluşturmadın.</Label>
        : events.map(event => {
          const phase = eventPhase(event)
          return <Touch key={event.id} accessibilityLabel={`${event.title} ${event.date} etkinliğini aç`} onPress={() => navigate("event-detail", { eventId: event.id })} style={s.row}>
            <Picture uri={event.coverImage} accessibilityLabel="" style={[s.cover, phase === "cancelled" && { opacity: .45 }]} />
            <Box style={{ flex: 1, minWidth: 0, gap: 2 }}>
              <Label style={s.title} numberOfLines={1}>{event.roomName || event.title}</Label>
              <Label style={s.meta} numberOfLines={1}>{event.date} · {event.time} · {participantCount(event.currentParticipants, event.maxParticipants)} kişi</Label>
            </Box>
            <Box style={[s.badge, { borderColor: PHASE_COLOR[phase] }]}><Label style={[s.badgeLabel, { color: PHASE_COLOR[phase] }]}>{EVENT_PHASE_LABEL[phase].replace(/^[●◌] /, "")}</Label></Box>
          </Touch>
        })}
      {events && events.length < total ? <Touch disabled={loading} onPress={() => void load(page + 1)} style={s.more}><Label style={s.moreLabel}>{loading ? "Yükleniyor…" : "Daha fazla göster"}</Label></Touch> : null}
    </Box>}
  </GlassCard>
}

const s = StyleSheet.create({
  icon: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(105,120,255,0.12)", borderWidth: 1, borderColor: "rgba(105,120,255,0.2)" },
  note: { paddingVertical: 12, color: palette.muted, fontSize: 13, lineHeight: 18 },
  row: { minHeight: 60, flexDirection: "row", alignItems: "center", gap: 12, justifyContent: "flex-start" },
  cover: { width: 46, height: 46, borderRadius: 12 },
  title: { color: palette.text, fontFamily: "Outfit-SemiBold", fontSize: 14, lineHeight: 18 },
  meta: { color: palette.muted, fontFamily: "Outfit", fontSize: 12, lineHeight: 16 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, borderWidth: 1 },
  badgeLabel: { fontFamily: "Outfit-SemiBold", fontSize: 10, lineHeight: 13 },
  more: { minHeight: 40, alignItems: "center", justifyContent: "center" },
  moreLabel: { color: palette.accent, fontFamily: "Outfit-SemiBold", fontSize: 13 },
})

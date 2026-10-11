import { palette } from "../theme/palette";
import { onSocket } from "../services/socket"
import { useEffect, useState } from "react"
import { getApiErrorMessage, getInvitations, hasSession, participate, type ApiEvent } from "../api/client"
import { isUnlimitedCapacity, mapApiEvent, useStore } from "../native/Store"
import { Box, Label, Touch } from "../native/UI"
import { ui } from "../theme/styles"
import type { NavigateFn } from "../types"
import { ErrorNotice } from "./ErrorNotice"
import { formatDuration } from "../events/duration"
import { remainingLabel, useRemaining } from "../availability/countdown"

// One invitation. Pool invitations carry a server deadline; the countdown only mirrors it.
function InvitationCard({ event, busy, saving, onOpen, onRespond }: { event: ApiEvent; busy: boolean; saving: boolean; onOpen: () => void; onRespond: (accept: boolean) => void }) {
  const remaining = useRemaining(event.viewerInvitationExpiresAt)
  const expired = remaining !== null && remaining <= 0
  const spotsLeft = Math.max(0, event.maxParticipants - event.confirmedParticipantCount)
  const details = [event.interest.name, event.level?.name, event.durationMinutes ? formatDuration(event.durationMinutes) : null].filter(Boolean).join(" · ")
  return <Box style={{ padding: 16, borderRadius: 16, gap: 8, backgroundColor: "rgba(105,120,255,0.08)", borderColor: "rgba(105,120,255,0.2)", borderWidth: 1 }}>
    <Touch onPress={onOpen} style={{ alignItems: "flex-start" }}>
      <Label style={[[ui.textSm, ui.textWhite85, ui.fontMedium], { textAlign: "left" }]}>{`${event.owner.firstName} ${event.owner.lastName}`.trim()} seni {event.interest.name} etkinliğine davet etti</Label>
      <Label style={[[ui.textXs, ui.textWhite50], { textAlign: "left" }]}>{event.date} · {event.startTime.slice(0, 5)}{event.locationName ? ` · ${event.locationName}` : ""}</Label>
      <Label style={[[ui.textXs, ui.textWhite50], { textAlign: "left" }]}>{details}</Label>
    </Touch>
    {remaining !== null && <Label accessibilityLiveRegion="polite" style={[[ui.textXs, ui.fontMedium], { color: expired ? palette.error : palette.accent }]}>{expired ? "Bu davetin süresi doldu." : `Yanıt için ${remainingLabel(remaining)}`}</Label>}
    <Label style={[[ui.textXs, ui.textWhite40]]}>{isUnlimitedCapacity(event.maxParticipants) ? "Kontenjan sınırı yok." : `Davet yer ayırmaz: kabul ettiğinde kontenjan uygunsa katılırsın (${spotsLeft} yer kaldı).`}</Label>
    {event.viewerHasTimeConflict && <Label style={[[ui.textXs], { color: palette.error }]}>Aynı saatte katıldığın başka bir etkinlik var; bu daveti kabul edemezsin.</Label>}
    <Box style={{ flexDirection: "row", gap: 10 }}>
      <Touch disabled={busy || expired || !!event.viewerHasTimeConflict} onPress={() => onRespond(true)} style={[[ui.py3, ui.roundedXl, ui.textSm], { flex: 1, color: palette.text }]} gradient={["#4d5bcb", "#6651c9"]}>{saving ? "Kaydediliyor…" : "Kabul et"}</Touch>
      <Touch disabled={busy || expired} onPress={() => onRespond(false)} style={[[ui.py3, ui.roundedXl, ui.textSm, ui.textWhite60], { flex: 1, backgroundColor: "rgba(255,255,255,0.05)" }]}>Reddet</Touch>
    </Box>
  </Box>
}

// Pending invitations; accepting joins (after the server re-checks expiry, capacity and conflicts), declining marks the invite declined.
export function EventInvitations({ navigate }: { navigate: NavigateFn }) {
  const { setData } = useStore()
  const [invitations, setInvitations] = useState<ApiEvent[]>([])
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [reload, setReload] = useState(0)
  useEffect(() => {
    let active = true
    const refresh = async () => {
      if (!await hasSession()) return
      try { const result = await getInvitations(); if (active) setInvitations(result.items) }
      catch (cause) { if (active) setError(getApiErrorMessage(cause, "Davetler yüklenemedi.")) }
    }
    void refresh()
    const invited = onSocket("event:invited", () => { void refresh() })
    const reminder = onSocket("event:invite_reminder", () => { void refresh() })
    const sync = onSocket("sync:required", () => { void refresh() })
    return () => { active = false; invited(); reminder(); sync() }
  }, [reload])
  const remember = (event: ApiEvent) => setData(p => ({ ...p, events: [mapApiEvent(event), ...p.events.filter(e => e.id !== event.id)] }))
  const respond = async (event: ApiEvent, accept: boolean) => {
    if (busy) return
    setBusy(event.id)
    try {
      remember(await participate(event.id, accept))
      setInvitations(current => current.filter(row => row.id !== event.id))
    } catch (cause) { setError(getApiErrorMessage(cause, "Yanıtın kaydedilemedi. Tekrar dene.")); setReload(value => value + 1) }
    finally { setBusy(null) }
  }
  return <Box style={{ gap: 10 }}>
    {invitations.map(event => <InvitationCard key={event.id} event={event} busy={busy !== null} saving={busy === event.id} onOpen={() => { remember(event); navigate("event-detail", { eventId: event.id }) }} onRespond={accept => void respond(event, accept)} />)}
    {error && <ErrorNotice title="Davetler yüklenemedi" message={error} onDismiss={() => setError(null)} />}
  </Box>
}

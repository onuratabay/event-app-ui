import { palette } from "../theme/palette";
import { onSocket } from "../services/socket"
import { useEffect, useState } from "react"
import { getApiErrorMessage, getInvitations, hasSession, participate, type ApiEvent } from "../api/client"
import { mapApiEvent, useStore } from "../native/Store"
import { Box, Label, Touch } from "../native/UI"
import { ui } from "../theme/styles"
import type { NavigateFn } from "../types"
import { ErrorNotice } from "./ErrorNotice"

// Pending invitations to invite-only events; accepting joins, declining marks the invite declined.
export function EventInvitations({ navigate }: { navigate: NavigateFn }) {
  const { setData } = useStore()
  const [invitations, setInvitations] = useState<ApiEvent[]>([])
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    let active = true
    const refresh = async () => {
      if (!await hasSession()) return
      try { const result = await getInvitations(); if (active) setInvitations(result.items) }
      catch (cause) { if (active) setError(getApiErrorMessage(cause, "Davetler yüklenemedi.")) }
    }
    void refresh()
    const invited = onSocket("event:invited", () => { void refresh() })
    const sync = onSocket("sync:required", () => { void refresh() })
    return () => { active = false; invited(); sync() }
  }, [])
  const remember = (event: ApiEvent) => setData(p => ({ ...p, events: [mapApiEvent(event), ...p.events.filter(e => e.id !== event.id)] }))
  const respond = async (event: ApiEvent, accept: boolean) => {
    if (busy) return
    setBusy(event.id)
    try {
      remember(await participate(event.id, accept))
      setInvitations(current => current.filter(row => row.id !== event.id))
    } catch (cause) { setError(getApiErrorMessage(cause, "Yanıtın kaydedilemedi. Tekrar dene.")) }
    finally { setBusy(null) }
  }
  return <Box style={{ gap: 10 }}>
    {invitations.map(event => <Box key={event.id} style={{ padding: 16, borderRadius: 16, gap: 8, backgroundColor: "rgba(105,120,255,0.08)", borderColor: "rgba(105,120,255,0.2)", borderWidth: 1 }}>
      <Touch onPress={() => { remember(event); navigate("event-detail", { eventId: event.id }) }} style={{ alignItems: "flex-start" }}>
        <Label style={[[ui.textSm, ui.textWhite85, ui.fontMedium], { textAlign: "left" }]}>{`${event.owner.firstName} ${event.owner.lastName}`.trim()} seni {event.interest.name} etkinliğine davet etti</Label>
        <Label style={[[ui.textXs, ui.textWhite50], { textAlign: "left" }]}>{event.date} · {event.startTime.slice(0, 5)}{event.locationName ? ` · ${event.locationName}` : ""}</Label>
      </Touch>
      <Box style={{ flexDirection: "row", gap: 10 }}>
        <Touch disabled={busy !== null} onPress={() => void respond(event, true)} style={[[ui.py3, ui.roundedXl, ui.textSm], { flex: 1, color: palette.text }]} gradient={["#4d5bcb", "#6651c9"]}>{busy === event.id ? "Kaydediliyor…" : "Kabul et"}</Touch>
        <Touch disabled={busy !== null} onPress={() => void respond(event, false)} style={[[ui.py3, ui.roundedXl, ui.textSm, ui.textWhite60], { flex: 1, backgroundColor: "rgba(255,255,255,0.05)" }]}>Reddet</Touch>
      </Box>
    </Box>)}
    {error && <ErrorNotice title="Davetler yüklenemedi" message={error} onDismiss={() => setError(null)} />}
  </Box>
}

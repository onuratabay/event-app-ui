import { palette } from "../theme/palette";
import { onSocket } from '../services/socket'
import { useEffect, useState } from "react"
import { getApiErrorMessage, getReferenceRequests, hasSession, respondToReference, type ReferenceRequest } from "../api/client"
import { Box, Label, Touch } from "../native/UI"
import { ui } from "../theme/styles"
import { ErrorNotice } from "./ErrorNotice"

export function ReferenceNotifications({ onCount }: { onCount?: (count: number) => void } = {}) {
  const [requests, setRequests] = useState<ReferenceRequest[]>([])
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    let active = true
    const refresh = async () => {
      if (!await hasSession()) return
      try { const result = await getReferenceRequests(); if (active) setRequests(result.items) }
      catch (cause) { if (active) setError(getApiErrorMessage(cause, "Referans bildirimleri yüklenemedi.")) }
    }
    void refresh()
    const created = onSocket('reference:created', row => setRequests(current => [row, ...current.filter(r => r.id !== row.id)].slice(0, 100)))
    const updated = onSocket('reference:updated', patch => setRequests(current => current.map(row => row.id === patch.id ? { ...row, status: patch.status } : row)))
    const removed = onSocket('reference:deleted', patch => setRequests(current => current.filter(row => row.id !== patch.id)))
    const sync = onSocket('sync:required', () => { void refresh() })
    return () => { active = false; created(); updated(); removed(); sync() }
  }, [])
  const respond = async (request: ReferenceRequest, decision: "approved" | "declined") => {
    if (busy) return
    setBusy(request.id)
    try {
      const result = await respondToReference(request.id, decision)
      setRequests(current => current.map(row => row.id === request.id ? { ...row, status: result.status } : row))
    } catch (cause) { setError(getApiErrorMessage(cause, "Yanıtın kaydedilemedi. Tekrar dene.")) }
    finally { setBusy(null) }
  }
  // Only requests still waiting for this user's answer belong here. Answered and outgoing ones live
  // under the profile's "Referanslarım", so "Tümünü sil" (decline) or a reply clears the card at once.
  const waiting = requests.filter(request => request.direction === "incoming" && request.status === "pending")
  useEffect(() => { onCount?.(waiting.length) }, [waiting.length])
  return <Box style={{ gap: 10 }}>
    {waiting.map(request => <Box key={request.id} style={{ padding: 16, borderRadius: 16, gap: 8, backgroundColor: "rgba(105,120,255,0.08)", borderColor: "rgba(105,120,255,0.2)", borderWidth: 1 }}>
      <Label style={[[ui.textSm, ui.textWhite85, ui.fontMedium]]}>{request.direction === "incoming" ? `${request.requester.name} senden referans istiyor` : `${request.recipient.name} için referans isteğin`}</Label>
      {request.status === "pending" && request.direction === "incoming" ? <>
        <Label style={[[ui.textXs, ui.textWhite50]]}>Bu kişinin topluluğa katılması için referans olmak ister misin?</Label>
        <Box style={{ flexDirection: "row", gap: 10 }}>
          <Touch disabled={busy !== null} onPress={() => void respond(request, "approved")} style={[[ui.py3, ui.roundedXl, ui.textSm], { flex: 1, color: palette.text }]} gradient={["#4d5bcb", "#6651c9"]}>{busy === request.id ? "Kaydediliyor…" : "Onayla"}</Touch>
          <Touch disabled={busy !== null} onPress={() => void respond(request, "declined")} style={[[ui.py3, ui.roundedXl, ui.textSm, ui.textWhite60], { flex: 1, backgroundColor: "rgba(255,255,255,0.05)" }]}>Reddet</Touch>
        </Box>
      </> : <Label style={[[ui.textXs, ui.textWhite50]]}>{request.status === "approved" ? "Referans onaylandı" : request.status === "declined" ? "Referans isteği reddedildi" : "Onay bekleniyor"}</Label>}
    </Box>)}
    {error && <ErrorNotice title="Bildirimler yüklenemedi" message={error} onDismiss={() => setError(null)} />}
  </Box>
}

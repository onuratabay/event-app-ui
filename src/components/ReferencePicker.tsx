import ContextualTip from "../walkthrough/ContextualTip"
import { useWalkthroughScreenBlocker } from "../walkthrough/activity"
import { onSocket } from '../services/socket'
import { useEffect, useRef, useState } from "react"
import { Linking, Platform } from "react-native"
import * as Contacts from "expo-contacts/legacy"
import { deleteReferenceRequest, getApiErrorMessage, getReferenceRequests, matchReferenceContacts, sendReferenceRequest, type ReferenceMember, type ReferenceRequest } from "../api/client"
import { Box, Label, Touch } from "../native/UI"
import { ui } from "../theme/styles"
import { ErrorNotice } from "./ErrorNotice"

/**
 * Asks members for a reference. `onApproved` fires when a request that was pending on this screen
 * gets approved (live or after a refresh) — never for one already approved when the screen opened,
 * so going back to this step does not bounce forward again. `refreshSignal` reloads the requests
 * (pull to refresh) and `onRefreshed` reports when that reload ended.
 */
export function ReferencePicker({ onApproved, refreshSignal = 0, onRefreshed }: { onApproved?: () => void; refreshSignal?: number; onRefreshed?: () => void } = {}) {
  const [members, setMembers] = useState<ReferenceMember[]>([])
  const [requests, setRequests] = useState<ReferenceRequest[]>([])
  // Requests seen pending on this screen; only those can trigger `onApproved`.
  const seenPending = useRef(new Set<string>())
  const approvedRef = useRef(onApproved); approvedRef.current = onApproved
  const fired = useRef(false)
  const track = (rows: ReferenceRequest[]) => {
    for (const row of rows) if (row.status === "pending") seenPending.current.add(row.id)
    if (!fired.current && rows.some(row => row.status === "approved" && seenPending.current.has(row.id))) { fired.current = true; approvedRef.current?.() }
  }
  useEffect(() => { track(requests) }, [requests])
  const [busy, setBusy] = useState(false)
  const [sending, setSending] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)
  useWalkthroughScreenBlocker(busy || !!sending)
  const [limited, setLimited] = useState(false)
  const [denied, setDenied] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    let active = true
    const refresh = async () => { try { const result = await getReferenceRequests(); if (active) setRequests(result.items.filter(r => r.direction === "outgoing")) } catch {} }
    void refresh()
    const created = onSocket('reference:created', row => { if (row.direction !== 'outgoing') return; setRequests(current => [row, ...current.filter(r => r.id !== row.id)].slice(0, 100)) })
    const updated = onSocket('reference:updated', patch => setRequests(current => current.map(row => row.id === patch.id ? { ...row, status: patch.status } : row)))
    const removed = onSocket('reference:deleted', patch => setRequests(current => current.filter(row => row.id !== patch.id)))
    const sync = onSocket('sync:required', () => { void refresh() })
    return () => { active = false; created(); updated(); removed(); sync() }
  }, [])
  // Pull to refresh on the parent screen.
  useEffect(() => {
    if (!refreshSignal) return
    let active = true
    getReferenceRequests().then(result => { if (active) setRequests(result.items.filter(r => r.direction === "outgoing")) }).catch(() => {}).finally(() => { if (active) onRefreshed?.() })
    return () => { active = false }
  }, [refreshSignal])
  const loadContacts = async (edit = false) => {
    if (busy) return
    setBusy(true); setError(null); setMembers([]); setLoaded(false)
    try {
      let permission = await Contacts.getPermissionsAsync()
      if (!permission.granted && permission.canAskAgain) permission = await Contacts.requestPermissionsAsync()
      if (!permission.granted) { setDenied(true); return }
      setDenied(false)
      if (edit && permission.accessPrivileges === "limited" && Platform.OS === "ios") await Contacts.presentAccessPickerAsync()
      permission = await Contacts.getPermissionsAsync()
      setLimited(permission.accessPrivileges === "limited")
      const phones: string[] = []
      let offset = 0
      let more = true
      while (more) {
        const page = await Contacts.getContactsAsync({ fields: [Contacts.Fields.PhoneNumbers], pageSize: 300, pageOffset: offset })
        for (const contact of page.data) for (const phone of contact.phoneNumbers || []) if (phone.number) phones.push(phone.number)
        more = page.hasNextPage; offset += 300
      }
      setMembers(await matchReferenceContacts(phones)); setLoaded(true)
    } catch (cause) { setError(getApiErrorMessage(cause, "Üyeler yüklenemedi. Bağlantını kontrol edip tekrar dene.")) }
    finally { setBusy(false) }
  }
  const send = async (member: ReferenceMember) => {
    if (sending) return
    setSending(member.id); setError(null)
    try {
      const request = await sendReferenceRequest(member.id)
      setRequests(current => [...current.filter(r => r.id !== request.id), request])
    } catch (cause) { setError(getApiErrorMessage(cause, "Referans isteği gönderilemedi. Tekrar dene.")) }
    finally { setSending(null) }
  }
  const [removing, setRemoving] = useState<string | null>(null)
  const remove = async (request: ReferenceRequest) => {
    if (removing) return
    setRemoving(request.id); setError(null)
    try { await deleteReferenceRequest(request.id); setRequests(current => current.filter(r => r.id !== request.id)) }
    catch (cause) { setError(getApiErrorMessage(cause, "Kişi kaldırılamadı. Tekrar dene.")) }
    finally { setRemoving(null) }
  }
  const removeButton = (request: ReferenceRequest) => <Touch accessibilityLabel={`${request.recipient.name} kişisini kaldır`} onPress={() => void remove(request)} disabled={removing !== null} hitSlop={8} style={[[ui.textXs, ui.textWhite50]]}>{removing === request.id ? "Kaldırılıyor…" : "Kaldır"}</Touch>
  const statusText = (status: ReferenceRequest["status"]) => status === "approved" ? "Referans onaylandı" : status === "declined" ? "İstek kabul edilmedi" : "Onay bekleniyor"
  return <Box walkthroughId="reference-picker" style={{ gap: 12, marginTop: 14 }}>
    <ContextualTip id="references" when={loaded || requests.length > 0} />
    
    <Touch onPress={() => void loadContacts(limited)} disabled={busy} style={[[ui.py3, ui.roundedXl, ui.textSm, ui.textWhite80], { backgroundColor: "rgba(105,120,255,0.08)", borderWidth: 1, borderColor: "rgba(105,120,255,0.2)" }]}>
      {busy ? "Üyeler aranıyor…" : loaded ? limited ? "Paylaşılan kişileri değiştir" : "Rehberi yenile" : "Arkadaşını ekle"}
    </Touch>
    {denied && <Box style={{ gap: 8 }}><Label style={[[ui.textXs, ui.textWhite50]]}>Kişilerini görmek için rehber erişimine izin ver.</Label><Touch onPress={() => void Linking.openSettings()} style={[[ui.textSm, ui.textC8a44a]]}>Ayarları aç</Touch></Box>}
    {loaded && members.length === 0 && <Label style={[[ui.textXs, ui.textWhite50]]}>Paylaştığın kişiler arasında referans verebilecek bir üye bulunamadı.</Label>}
    {members.map(member => {
      const request = requests.find(r => r.recipient.id === member.id)
      return <Box key={member.id} style={{ padding: 12, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.04)", gap: 6 }}>
        <Label style={[[ui.textSm, ui.textWhite85]]}>{member.name}</Label>
        {request ? <Box style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}><Label style={[[ui.textXs, ui.textWhite50]]}>{statusText(request.status)}</Label>{removeButton(request)}</Box> : <Touch onPress={() => void send(member)} disabled={sending !== null} style={[[ui.py25, ui.textSm, ui.textC8a44a]]}>{sending === member.id ? "Gönderiliyor…" : "Referans iste"}</Touch>}
      </Box>
    })}
    {requests.filter(r => !members.some(m => m.id === r.recipient.id)).map(request => <Box key={request.id} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}><Box style={{ flex: 1, gap: 4 }}><Label style={[[ui.textSm, ui.textWhite85]]}>{request.recipient.name}</Label><Label style={[[ui.textXs, ui.textWhite50]]}>{statusText(request.status)}</Label></Box>{removeButton(request)}</Box>)}
    {error && <ErrorNotice title="Referans işlemi tamamlanamadı" message={error} onDismiss={() => setError(null)} />}
  </Box>
}

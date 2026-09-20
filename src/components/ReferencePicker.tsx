import { useEffect, useState } from "react"
import { AppState, Linking, Platform } from "react-native"
import * as Contacts from "expo-contacts/legacy"
import { getApiErrorMessage, getReferenceRequests, matchReferenceContacts, sendReferenceRequest, type ReferenceMember, type ReferenceRequest } from "../api/client"
import { Box, Label, Touch } from "../native/UI"
import { ui } from "../theme/styles"
import { ErrorNotice } from "./ErrorNotice"

export function ReferencePicker() {
  const [members, setMembers] = useState<ReferenceMember[]>([])
  const [requests, setRequests] = useState<ReferenceRequest[]>([])
  const [busy, setBusy] = useState(false)
  const [sending, setSending] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [limited, setLimited] = useState(false)
  const [denied, setDenied] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    let active = true
    const refresh = async () => { try { const result = await getReferenceRequests(); if (active) setRequests(result.items.filter(r => r.direction === "outgoing")) } catch {} }
    void refresh()
    const listener = AppState.addEventListener("change", state => { if (state === "active") void refresh() })
    const timer = setInterval(() => { if (AppState.currentState === "active") void refresh() }, 15000)
    return () => { active = false; listener.remove(); clearInterval(timer) }
  }, [])
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
  const statusText = (status: ReferenceRequest["status"]) => status === "approved" ? "Referans onaylandı" : status === "declined" ? "İstek kabul edilmedi" : "Onay bekleniyor"
  return <Box style={{ gap: 12, marginTop: 14 }}>
    <Label style={[[ui.textXs, ui.textWhite45]]}>Paylaşmayı seçtiğin kişiler arasındaki Vibeus üyelerinden referans iste. Eşleştirme için yalnızca telefon numaraları kullanılır.</Label>
    <Touch onPress={() => void loadContacts(limited)} disabled={busy} style={[[ui.py3, ui.roundedXl, ui.textSm, ui.textWhite80], { backgroundColor: "rgba(200,164,74,0.08)", borderWidth: 1, borderColor: "rgba(200,164,74,0.2)" }]}>
      {busy ? "Üyeler aranıyor…" : loaded ? limited ? "Paylaşılan kişileri değiştir" : "Rehberi yenile" : "Rehberden üye bul"}
    </Touch>
    {denied && <Box style={{ gap: 8 }}><Label style={[[ui.textXs, ui.textWhite50]]}>Kişilerini görmek için rehber erişimine izin ver.</Label><Touch onPress={() => void Linking.openSettings()} style={[[ui.textSm, ui.textC8a44a]]}>Ayarları aç</Touch></Box>}
    {loaded && members.length === 0 && <Label style={[[ui.textXs, ui.textWhite50]]}>Paylaştığın kişiler arasında referans verebilecek bir üye bulunamadı.</Label>}
    {members.map(member => {
      const request = requests.find(r => r.recipient.id === member.id)
      return <Box key={member.id} style={{ padding: 12, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.04)", gap: 6 }}>
        <Label style={[[ui.textSm, ui.textWhite85]]}>{member.name}</Label>
        {request ? <Label style={[[ui.textXs, ui.textWhite50]]}>{statusText(request.status)}</Label> : <Touch onPress={() => void send(member)} disabled={sending !== null} style={[[ui.py25, ui.textSm, ui.textC8a44a]]}>{sending === member.id ? "Gönderiliyor…" : "Referans iste"}</Touch>}
      </Box>
    })}
    {requests.filter(r => !members.some(m => m.id === r.recipient.id)).map(request => <Box key={request.id} style={{ gap: 4 }}><Label style={[[ui.textSm, ui.textWhite85]]}>{request.recipient.name}</Label><Label style={[[ui.textXs, ui.textWhite50]]}>{statusText(request.status)}</Label></Box>)}
    {error && <ErrorNotice title="Referans işlemi tamamlanamadı" message={error} onDismiss={() => setError(null)} />}
  </Box>
}

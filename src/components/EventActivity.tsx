import { useEffect, useState } from 'react'
import { Alert } from 'react-native'
import { getEventActivity } from '../api/client'
import { onSocket, socketAction } from '../services/socket'
import { AppEvent } from '../types'
import { Box, Field, Label, Touch } from '../native/UI'

export function EventActivity({ event, userId, active: screenActive }: { event: AppEvent; userId: string; active: boolean }) {
  const [open, setOpen] = useState(false)
  const owner = event.host.id === userId
  const [waiting, setWaiting] = useState<string[]>([])
  const [checked, setChecked] = useState<string[]>([])
  const [announcement, setAnnouncement] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    if (!open || !screenActive) return
    let active = true
    const load = () => getEventActivity(event.id).then(result => { if (active) { setWaiting(result.waitlist.map(row => row.userId)); setChecked(result.checkins.map(row => row.userId)) } }).catch(() => { if (active) setError('Etkinlik işlemleri yüklenemedi.') })
    void load()
    const cleanups = [onSocket('sync:required', () => { void load() }), onSocket('event:waitlist_updated', patch => {
      if (patch.eventId === event.id) setWaiting(previous => patch.status === 'waitlisted' ? [...new Set([...previous, patch.userId])] : previous.filter(id => id !== patch.userId))
    }), onSocket('event:checkin', patch => { if (patch.eventId === event.id) setChecked(previous => [...new Set([...previous, patch.userId])]) })]
    return () => { active = false; cleanups.forEach(cleanup => cleanup()) }
  }, [event.id, open, screenActive])
  const run = async (name: string, payload = {}) => {
    if (busy) return
    setBusy(true); setError('')
    try { await socketAction(name, { eventId: event.id, ...payload }); return true }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'İşlem başarısız.') }
    finally { setBusy(false) }
  }
  const button = { padding: 12, backgroundColor: '#302a20', borderRadius: 12 }
  return <Box style={{ padding: 16, gap: 10, backgroundColor: '#181522' }}>
    <Touch onPress={() => setOpen(value => !value)}><Label>{open ? 'Etkinlik işlemlerini kapat' : 'Duyurular ve giriş işlemleri'}</Label></Touch>
    {open && (owner ? <>
      <Label>Organizatör işlemleri</Label>
      <Field value={announcement} onChangeText={setAnnouncement} placeholder="Katılımcılara duyuru yaz" />
      <Touch style={button} disabled={busy || !announcement.trim()} onPress={async () => { if (await run('event:announcement', { text: announcement.trim() })) setAnnouncement('') }}><Label>Duyuru gönder</Label></Touch>
      {waiting.map(id => <Touch key={id} style={button} disabled={busy} onPress={async () => { if (await run('event:waitlist_promote', { participantId: id })) setWaiting(rows => rows.filter(row => row !== id)) }}><Label>Yedek üyeyi kabul et · {id.slice(0, 8)}</Label></Touch>)}
      {event.isActive && event.participants.map(person => <Touch key={person.id} style={button} disabled={busy || checked.includes(person.id)} onPress={async () => { if (await run('event:checkin', { participantId: person.id })) setChecked(rows => [...rows, person.id]) }}><Label>{person.name} · {checked.includes(person.id) ? 'Giriş yapıldı ✓' : 'Girişini onayla'}</Label></Touch>)}
      {event.isActive && <Touch style={button} disabled={busy} onPress={async () => {
        try { const result = await socketAction<{ token: string }>('event:checkin_code', { eventId: event.id }); setCode(result.token); Alert.alert('Giriş kodu', 'Kod 5 dakika geçerli. Katılımcılarla paylaşabilirsin.') }
        catch { setError('Giriş kodu oluşturulamadı.') }
      }}><Label>Geçici giriş kodu oluştur</Label></Touch>}
      {!!code && <Label selectable>{code}</Label>}
    </> : event.isActive && <>
      <Field value={code} onChangeText={setCode} placeholder="Organizatörün giriş kodu" />
      <Touch style={button} disabled={busy || !code || checked.includes(userId)} onPress={async () => { if (await run('event:checkin', { token: code.trim() })) setChecked(rows => [...rows, userId]) }}><Label>{checked.includes(userId) ? 'Girişin onaylandı ✓' : 'Girişimi onayla'}</Label></Touch>
    </>)}
    {!!error && <Label>{error}</Label>}
  </Box>
}

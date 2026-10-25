import type { Href } from 'expo-router'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'expo-router'
import { StyleSheet, View, type ViewInstance } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { getApiErrorMessage, getGuestMessages, sendGuestMessage, type GuestRoomMessage } from '../api/client'
import { useGuest } from '../guest/GuestSession'
import { AtmoBackground } from '../components/GlassUI'
import { SendIcon } from '../components/Icons'
import { useKeyboardVisible } from '../components/BottomNav'
import { ReplyBar, ReplyQuote, SwipeToReply } from '../components/ChatReply'
import TopNavBar from '../components/TopNavBar'
import LoadingSpinner from '../components/LoadingSpinner'
import { Box, ChatList, Field, Label, Touch } from '../native/UI'
import { useKeyboardOverlap } from '../native/useKeyboardOverlap'
import { useScreenActive } from '../native/useScreenActive'
import { palette } from '../theme/palette'
import { ui } from '../theme/styles'

const MAX_MESSAGE_LENGTH = 2000
// Guests have no live connection: the room is read again every few seconds while it is on screen.
const POLL_MS = 4000

const sameName = (a?: string, b?: string) => !!a && !!b && a.trim().toLocaleLowerCase('tr') === b.trim().toLocaleLowerCase('tr')
type Quote = NonNullable<GuestRoomMessage['replyTo']>
const sentKey = (code: string) => `event-app:guest-sent:${code}`

const timeOf = (iso: string) => new Date(iso).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
const dayKey = (iso: string) => { const date = new Date(Date.parse(iso) || 0); return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}` }
function dayLabel(iso: string) {
  const date = new Date(iso)
  if (isNaN(date.getTime())) return ''
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const day = new Date(date); day.setHours(0, 0, 0, 0)
  const diff = Math.round((today.getTime() - day.getTime()) / 86400000)
  if (diff === 0) return 'Bugün'
  if (diff === 1) return 'Dün'
  return date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })
}
// As in the member room: consecutive messages from the same person (same day) are grouped, and messages of
// the same minute share one time under the last of them.
type Row = GuestRoomMessage & { mine: boolean }
const sameSender = (a?: Row, b?: Row) => !!a && !!b && a.name === b.name && a.isGuest === b.isGuest && a.mine === b.mine && dayKey(a.createdAt) === dayKey(b.createdAt)
const sameMinute = (a?: Row, b?: Row) => sameSender(a, b) && timeOf(a!.createdAt) === timeOf(b!.createdAt)

/**
 * The event room for a guest who joined with an invite: the same conversation members see, with the guest's own
 * messages on the right. Members appear by name only (no photos or profiles), guests as "Ad · Misafir".
 */
export default function GuestRoomScreen() {
  const router = useRouter()
  const { guest } = useGuest()
  const code = guest?.code
  const session = guest?.session
  const screenRef = useRef<ViewInstance>(null)
  const { overlap: keyboardOverlap, onLayout } = useKeyboardOverlap(screenRef)
  // With the keyboard open the bar sits right on it: no home-indicator space under the composer then.
  const keyboardOpen = useKeyboardVisible()
  const insetBottom = useSafeAreaInsets().bottom
  const safeBottom = keyboardOpen ? 0 : insetBottom
  const active = useScreenActive()
  const [messages, setMessages] = useState<GuestRoomMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [closed, setClosed] = useState('')
  const [error, setError] = useState('')
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [replyTo, setReplyTo] = useState<GuestRoomMessage | null>(null)
  // The messages this device sent in this room with the message each one answered, kept across visits: a
  // server that does not keep answers yet (older backend) still shows the quote here.
  const [sent, setSent] = useState<Map<string, Quote | null>>(new Map())
  useEffect(() => {
    if (!code) return
    AsyncStorage.getItem(sentKey(code)).then(raw => {
      if (!raw) return
      const stored = JSON.parse(raw) as string[] | Array<[string, Quote | null]>
      setSent(new Map(stored.map(row => typeof row === 'string' ? [row, null] : row)))
    }).catch(() => {})
  }, [code])
  const remember = (id: string, quote: Quote | null) => setSent(previous => {
    const next = new Map(previous).set(String(id), quote)
    if (code) void AsyncStorage.setItem(sentKey(code), JSON.stringify([...next].slice(-200))).catch(() => {})
    return next
  })
  const back = () => router.replace({ pathname: '/guest-event', params: code ? { code } : {} } as Href)
  const load = async () => {
    if (!code || !session) return
    try {
      const result = await getGuestMessages(code, session)
      setMessages(result.items); setClosed(''); setError('')
    } catch (cause) {
      if (cause instanceof Error && /^API 403:/.test(cause.message)) setClosed(getApiErrorMessage(cause, 'Etkinlik odası şu anda kapalı.'))
      else if (cause instanceof Error && /^API 401:/.test(cause.message)) back()
      else setError(getApiErrorMessage(cause, 'Mesajlar yüklenemedi.'))
    } finally { setLoading(false) }
  }
  useEffect(() => {
    if (!code || !session) { back(); return }
    if (!active) return
    void load()
    const timer = setInterval(() => void load(), POLL_MS)
    return () => clearInterval(timer)
  }, [code, session, active])
  const send = async () => {
    const text = input.trim()
    if (!code || !session || !text || sending) return
    setSending(true); setError('')
    const quote = replyTo ? { id: replyTo.id, name: replyTo.name, isGuest: replyTo.isGuest, text: replyTo.text.slice(0, 300), deleted: false } : null
    try { const result = await sendGuestMessage(code, session, text, replyTo?.id); remember(result.id, quote); setInput(''); setReplyTo(null); await load() }
    catch (cause) { setError(getApiErrorMessage(cause, 'Mesaj gönderilemedi. Tekrar dene.')) }
    finally { setSending(false) }
  }
  // A server without the `mine` flag (older backend): own messages are the guest ones this device sent, or
  // guest messages under this guest's name.
  const newestFirst = useMemo(() => messages.slice().reverse().map(msg => ({
    ...msg, mine: msg.mine === true || (msg.mine === undefined && !!msg.isGuest && (sent.has(String(msg.id)) || sameName(msg.name, guest?.name))),
    replyTo: msg.replyTo ?? sent.get(String(msg.id)) ?? null,
  })), [messages, sent, guest?.name])
  return <View ref={screenRef} onLayout={onLayout} style={StyleSheet.absoluteFill}><Box style={[[ui.fixed, ui.inset0, ui.bg06060e, ui.flex, ui.flexCol, ui.overflowHidden]]}>
    <AtmoBackground />
    <TopNavBar navigate={() => {}} fallback="discover" onBack={back} title="Etkinlik Odası" subtitle={guest?.name ? `Misafir · ${guest.name}` : undefined} />
    <Box style={s.body}>
      {loading ? <Box style={s.closed}><LoadingSpinner size="large" /></Box>
      : closed ? <Box style={s.closed}>
        <Label style={s.closedIcon}>✦</Label>
        <Label style={s.closedTitle}>Oda henüz açık değil</Label>
        <Label style={s.closedText}>{closed}</Label>
        <Touch onPress={back} style={s.closedButton}><Label style={s.closedButtonLabel}>Etkinlik detayına dön</Label></Touch>
      </Box> : <>
        {error ? <Label accessibilityRole="alert" style={s.error}>{error}</Label> : null}
        {/* Empty state sits outside the flipped list (an inverted list would turn it upside down). */}
        {!messages.length ? <Box style={[s.empty, { flex: 1 }]}><Label style={s.emptyTitle}>Sohbet başladı</Label><Label style={s.emptyText}>İlk mesajı sen yaz; buluşma detaylarını burada konuşabilirsiniz.</Label></Box>
        : <ChatList
          data={newestFirst}
          keyExtractor={msg => `${msg.isGuest ? 'g' : 'm'}:${msg.id}`}
          style={{ flex: 1 }}
          contentContainerStyle={s.listContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          showsVerticalScrollIndicator={false}
          renderItem={({ item: msg, index }) => {
            // In the flipped list the older neighbour is the next item.
            const previous = newestFirst[index + 1]
            const following = newestFirst[index - 1]
            const newDay = !previous || dayKey(previous.createdAt) !== dayKey(msg.createdAt)
            const grouped = !newDay && sameSender(previous, msg)
            const endsGroup = !sameMinute(msg, following)
            const author = (name: string, isGuest: boolean, mine?: boolean) => mine ? 'Sen' : isGuest ? `${name} · Misafir` : name.split(' ')[0]
            const quotedMine = !!msg.replyTo && newestFirst.find(row => row.id === msg.replyTo!.id)?.mine
            return <View>{newDay ? <Label style={s.day}>{dayLabel(msg.createdAt)}</Label> : null}<SwipeToReply enabled onReply={() => setReplyTo(msg)}><Box style={[s.message, msg.mine && s.messageMine, grouped && s.messageGrouped]}>
              <Box style={[s.bubbleColumn, msg.mine ? s.alignEnd : s.alignStart]}>
                {!msg.mine && !grouped && <Label style={s.authorName}>{msg.isGuest ? `${msg.name} · Misafir` : msg.name.split(' ')[0]}</Label>}
                <Box style={[s.bubble, msg.mine ? s.bubbleMine : s.bubbleOther]}>
                  {msg.replyTo ? <ReplyQuote author={author(msg.replyTo.name, msg.replyTo.isGuest, quotedMine)} text={msg.replyTo.text} deleted={msg.replyTo.deleted} mine={!!msg.mine} /> : null}
                  <Label style={msg.mine ? s.textMine : s.textOther}>{msg.text}</Label>
                </Box>
                {endsGroup ? <Label style={s.time}>{timeOf(msg.createdAt)}</Label> : null}
              </Box>
            </Box></SwipeToReply></View>
          }}
        />}
        <Box style={[s.composerWrap, { paddingBottom: 12 + safeBottom + keyboardOverlap }]}>
          {replyTo ? <ReplyBar author={replyTo.mine ? 'Sen' : replyTo.isGuest ? `${replyTo.name} · Misafir` : replyTo.name.split(' ')[0]} text={replyTo.text} onCancel={() => setReplyTo(null)} /> : null}
          <Box style={s.composer} glass>
            <Field value={input} onChangeText={setInput} placeholder="Bir mesaj yaz…" placeholderTextColor="rgba(255,255,255,.35)" multiline maxLength={MAX_MESSAGE_LENGTH} style={s.input} />
            <Touch onPress={() => void send()} accessibilityLabel="Mesaj gönder" disabled={sending || !input.trim()} style={s.send} gradient={['#4d5bcb', '#6651c9']}>
              <SendIcon size={20} style={{ color: palette.text }} />
            </Touch>
          </Box>
        </Box>
      </>}
    </Box>
  </Box></View>
}
const s = StyleSheet.create({
  body: { flex: 1, paddingTop: 68 },
  listContent: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12 },
  empty: { alignItems: 'center', gap: 6, paddingVertical: 48, paddingHorizontal: 24 },
  emptyTitle: { color: palette.text, fontFamily: 'Fraunces', fontSize: 20, lineHeight: 26 },
  emptyText: { color: palette.muted, fontSize: 13, lineHeight: 19, textAlign: 'center' },
  day: { alignSelf: 'center', color: 'rgba(255,255,255,.45)', fontSize: 11, lineHeight: 14, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: 'rgba(255,255,255,.05)', marginVertical: 12 },
  message: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginTop: 10 },
  messageMine: { flexDirection: 'row-reverse' },
  messageGrouped: { marginTop: 3 },
  bubbleColumn: { maxWidth: '78%', gap: 3 },
  alignEnd: { alignItems: 'flex-end' }, alignStart: { alignItems: 'flex-start' },
  authorName: { color: 'rgba(255,255,255,.45)', fontSize: 12, lineHeight: 16, marginLeft: 4 },
  bubble: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 18 },
  bubbleMine: { backgroundColor: '#4d5bcb', borderBottomRightRadius: 6 },
  bubbleOther: { backgroundColor: 'rgba(255,255,255,.07)', borderWidth: 1, borderColor: 'rgba(255,255,255,.09)', borderBottomLeftRadius: 6 },
  textMine: { color: '#ffffff', fontSize: 15, lineHeight: 21 },
  textOther: { color: 'rgba(255,255,255,.85)', fontSize: 15, lineHeight: 21 },
  time: { color: 'rgba(255,255,255,.3)', fontSize: 10, lineHeight: 13, marginHorizontal: 4 },
  composerWrap: { paddingHorizontal: 16, paddingTop: 6, gap: 8 },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingLeft: 14, paddingRight: 6, paddingVertical: 6, borderRadius: 22, backgroundColor: 'rgba(255,255,255,.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,.1)' },
  input: { flex: 1, minHeight: 40, maxHeight: 120, paddingVertical: 9, color: palette.text, fontSize: 15, backgroundColor: 'transparent' },
  send: { width: 42, height: 42, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  error: { color: palette.error, fontSize: 13, lineHeight: 19, paddingHorizontal: 20, paddingTop: 8 },
  closed: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 32 },
  closedIcon: { color: '#f4d47d', fontFamily: 'Fraunces', fontSize: 32, lineHeight: 40 },
  closedTitle: { color: palette.text, fontFamily: 'Fraunces', fontSize: 22, lineHeight: 28, textAlign: 'center' },
  closedText: { color: palette.muted, fontSize: 14, lineHeight: 20, textAlign: 'center' },
  closedButton: { marginTop: 8, minHeight: 46, paddingHorizontal: 20, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(105,120,255,.16)', borderWidth: 1, borderColor: 'rgba(183,197,255,.35)' },
  closedButtonLabel: { color: palette.accent, fontFamily: 'Outfit-SemiBold', fontSize: 14 },
})

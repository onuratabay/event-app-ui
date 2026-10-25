import AsyncStorage from "@react-native-async-storage/async-storage"
import type { DirectConversation, DirectMessage, RoomSummary } from "../api/client"

/**
 * One cache for every chat, kept on the phone so chats open instantly, also after the app restarts
 * (like WhatsApp): the event room list ("Sohbetler"), the one-to-one chat list ("Mesajlar"), each
 * person's chat, and the newest messages of one-to-one chats and event rooms. Everything is per
 * signed-in account and removed on sign-out. The network only catches up.
 */
const PREFIX = "chat-cache:v1:"
const MAX_MESSAGES = 100
const MAX_THREADS = 40

/** Room messages are stored with only what the chat needs of the author. */
export type CachedRoomMessage = { id: string; createdAt?: string; text: string; time: string; user: { id: string; name: string }; system?: boolean; announcement?: boolean; deleted?: boolean; edited?: boolean; replyTo?: RoomQuote }
/** "Cevapla": the answered room message as its reply shows it. */
export type RoomQuote = { id: string; text: string; deleted?: boolean; userId: string; name: string }
/**
 * `syncedAt`: the newest message up to which the saved copy is known to be complete. Opening a chat asks the
 * server only for what came after it. Messages that arrive live while the app is connected move it forward;
 * after a lost connection (or an app restart) they are still shown at once but no longer move it, so the
 * next catch-up also fills whatever was missed in between.
 */
type DirectThread = { items: DirectMessage[]; cursor: string | null; otherReadAt: string | null; at: number; syncedAt?: string }
type RoomThread = { items: CachedRoomMessage[]; cursor: string | null; at: number; syncedAt?: string }
/** Threads caught up during the current connection: live messages may advance their `syncedAt`. */
const fresh = new Set<string>()
const newestAt = (rows: Array<{ createdAt?: string }>) => rows.reduce<string | undefined>((at, row) => row.createdAt && (!at || Date.parse(row.createdAt) > Date.parse(at)) ? row.createdAt : at, undefined)
/** The connection dropped: messages may be missed from now on, so live ones stop advancing `syncedAt`. */
export function markChatsStale() { fresh.clear() }
type Snapshot = { list: DirectConversation[]; roomList: RoomSummary[]; conversations: Record<string, DirectConversation>; direct: Record<string, DirectThread>; rooms: Record<string, RoomThread>; readUpTo: Record<string, number> }
const empty = (): Snapshot => ({ list: [], roomList: [], conversations: {}, direct: {}, rooms: {}, readUpTo: {} })

const snapshots = new Map<string, Snapshot>()
const loading = new Map<string, Promise<void>>()
const timers = new Map<string, ReturnType<typeof setTimeout>>()
const snapshot = (meId: string) => { let value = snapshots.get(meId); if (!value) { value = empty(); snapshots.set(meId, value) } return value }

/** Reads this account's saved chats once per app run (a few ms); screens wait for it before showing "empty". */
export function hydrateChatCache(meId: string): Promise<void> {
  if (!meId) return Promise.resolve()
  let pending = loading.get(meId)
  if (!pending) {
    pending = AsyncStorage.getItem(PREFIX + meId).then(raw => {
      if (!raw) return
      const saved = { ...empty(), ...(JSON.parse(raw) as Partial<Snapshot>) }
      const current = snapshots.get(meId)
      // Anything this run already learned (a fresher list, a new message) wins over the saved copy.
      snapshots.set(meId, current ? { list: current.list.length ? current.list : saved.list, roomList: current.roomList.length ? current.roomList : saved.roomList, conversations: { ...saved.conversations, ...current.conversations }, direct: { ...saved.direct, ...current.direct }, rooms: { ...saved.rooms, ...current.rooms }, readUpTo: { ...saved.readUpTo, ...current.readUpTo } } : saved)
    }).catch(() => { /* A broken or missing copy only means the chats load from the network. */ })
    loading.set(meId, pending)
  }
  return pending
}
export const isChatCacheReady = (meId: string) => !!meId && loading.has(meId) && snapshots.has(meId)

/** Writes are batched: many quick changes (incoming messages) become one save. */
function persist(meId: string) {
  clearTimeout(timers.get(meId))
  timers.set(meId, setTimeout(() => {
    const value = snapshots.get(meId)
    if (!value) return
    const keep = <T extends { at: number }>(threads: Record<string, T>) => Object.fromEntries(Object.entries(threads).sort((a, b) => b[1].at - a[1].at).slice(0, MAX_THREADS))
    const trimmed: Snapshot = { ...value, direct: keep(value.direct), rooms: keep(value.rooms) }
    snapshots.set(meId, trimmed)
    void AsyncStorage.setItem(PREFIX + meId, JSON.stringify(trimmed)).catch(() => {})
  }, 400))
}

/** Sign-out: every account's saved chats leave the phone. */
export async function clearChatCache() {
  for (const timer of timers.values()) clearTimeout(timer)
  timers.clear(); snapshots.clear(); loading.clear()
  try {
    const keys = (await AsyncStorage.getAllKeys()).filter(key => key.startsWith(PREFIX))
    if (keys.length) await AsyncStorage.multiRemove(keys)
  } catch { /* Storage without key listing (tests) or a failed removal: the next account still gets its own keys. */ }
}

// Event room list ("Sohbetler")
export const cachedRoomList = (meId: string) => (meId ? snapshot(meId).roomList : [])
export function rememberRoomList(meId: string, rows: RoomSummary[]) { snapshot(meId).roomList = rows; persist(meId) }
/** A room read on this phone: its saved row loses the unread badge too (so a restart never brings it back). */
export function markRoomListRead(meId: string, eventId: string) {
  const value = snapshot(meId)
  if (!value.roomList.some(row => row.id === eventId && row.unreadCount)) return
  value.roomList = value.roomList.map(row => row.id === eventId ? { ...row, unreadCount: 0 } : row)
  persist(meId)
}

// Chat list ("Mesajlar")
export const cachedChatList = (meId: string) => (meId ? snapshot(meId).list : [])
export function rememberChatList(meId: string, rows: DirectConversation[]) {
  const value = snapshot(meId)
  value.list = rows
  for (const row of rows) value.conversations[row.user.id] = row
  persist(meId)
}
export const cachedConversation = (meId: string, otherUserId: string) => (meId ? snapshot(meId).conversations[otherUserId] : undefined)
export function rememberConversation(meId: string, row: DirectConversation) { snapshot(meId).conversations[row.user.id] = row; persist(meId) }
/** Kept for callers that pass a whole list. */
export const rememberConversations = rememberChatList

// One-to-one messages
export const cachedMessages = (meId: string, conversationId: string) => (meId ? snapshot(meId).direct[conversationId] : undefined)
export function rememberMessages(meId: string, conversationId: string, items: DirectMessage[], cursor: string | null, otherReadAt: string | null) {
  const previous = snapshot(meId).direct[conversationId]
  // While caught up in this connection everything shown is complete; otherwise the old mark stays.
  const syncedAt = fresh.has(`d:${meId}:${conversationId}`) ? newestAt(items) ?? previous?.syncedAt : previous?.syncedAt
  snapshot(meId).direct[conversationId] = { items: items.slice(-MAX_MESSAGES), cursor, otherReadAt, at: Date.now(), syncedAt }
  persist(meId)
}
/** A chat screen caught up with the server up to `upTo`. */
export function markDirectSynced(meId: string, conversationId: string, upTo: string | undefined) {
  fresh.add(`d:${meId}:${conversationId}`)
  const thread = snapshot(meId).direct[conversationId]
  if (thread && upTo) { thread.syncedAt = upTo; persist(meId) }
}
/** A one-to-one message arriving live while the chat is closed: kept so the chat opens with it. */
export function appendLiveDirectMessage(meId: string, conversationId: string, message: DirectMessage) {
  const thread = snapshot(meId).direct[conversationId]
  if (!thread) return
  thread.items = [...thread.items.filter(row => row.id !== message.id), message].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt)).slice(-MAX_MESSAGES)
  thread.at = Date.now()
  if (fresh.has(`d:${meId}:${conversationId}`)) thread.syncedAt = newestAt(thread.items)
  persist(meId)
}
/** After "Sohbeti sil" nothing of the old messages may show again. */
export function forgetConversation(meId: string, conversationId: string) {
  const value = snapshot(meId)
  delete value.direct[conversationId]
  value.list = value.list.filter(row => row.id !== conversationId)
  for (const [userId, row] of Object.entries(value.conversations)) if (row.id === conversationId) delete value.conversations[userId]
  persist(meId)
}

// Event rooms
export const cachedRoom = (meId: string, eventId: string) => (meId ? snapshot(meId).rooms[eventId] : undefined)
export function rememberRoom(meId: string, eventId: string, items: CachedRoomMessage[], cursor: string | null) {
  const previous = snapshot(meId).rooms[eventId]
  const syncedAt = fresh.has(`r:${meId}:${eventId}`) ? newestAt(items) ?? previous?.syncedAt : previous?.syncedAt
  snapshot(meId).rooms[eventId] = { items: items.slice(-MAX_MESSAGES), cursor, at: Date.now(), syncedAt }
  persist(meId)
}
/** A room screen caught up with the server up to `upTo`. */
export function markRoomSynced(meId: string, eventId: string, upTo: string | undefined) {
  fresh.add(`r:${meId}:${eventId}`)
  const thread = snapshot(meId).rooms[eventId]
  if (thread && upTo) { thread.syncedAt = upTo; persist(meId) }
}
/** Room message as the server sends it (REST page or live signal). */
export type ApiRoomMessage = { id: string; text: string; kind?: string; createdAt: string; editedAt?: string | null; deleted?: boolean; user: { id: string; firstName: string; lastName: string } }
export const roomMessageForCache = (message: ApiRoomMessage): CachedRoomMessage => ({
  id: message.id, createdAt: message.createdAt, text: message.text,
  time: new Date(message.createdAt).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" }),
  user: { id: message.user.id, name: `${message.user.firstName} ${message.user.lastName}`.trim() },
  system: message.kind === "system", announcement: message.kind === "announcement", deleted: message.deleted === true, edited: Boolean(message.editedAt),
})
/** A room message arriving while the room is closed: kept so the room opens with it already there. */
export function appendLiveRoomMessage(meId: string, eventId: string, message: CachedRoomMessage) {
  const thread = snapshot(meId).rooms[eventId]
  if (!thread) return
  thread.items = [...thread.items.filter(row => row.id !== message.id), message].sort((a, b) => Date.parse(a.createdAt || "") - Date.parse(b.createdAt || "")).slice(-MAX_MESSAGES)
  thread.at = Date.now()
  if (fresh.has(`r:${meId}:${eventId}`)) thread.syncedAt = newestAt(thread.items)
  persist(meId)
}

/**
 * When this device last showed each chat (read up to then). The chat list applies it on top of what the
 * server says, so a read chat never shows its old unread badge again while the "read" request is on its way.
 */
export function noteRead(meId: string, conversationId: string, at = Date.now()) {
  const value = snapshot(meId)
  value.readUpTo[conversationId] = Math.max(value.readUpTo[conversationId] ?? 0, at)
  persist(meId)
}
export function applyLocalReads(meId: string, rows: DirectConversation[]): DirectConversation[] {
  const reads = snapshot(meId).readUpTo
  return rows.map(row => {
    const read = reads[row.id]
    const last = Date.parse(row.lastMessage?.createdAt || "") || 0
    return read && row.unreadCount && last <= read ? { ...row, unreadCount: 0 } : row
  })
}

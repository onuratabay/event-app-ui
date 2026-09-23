import { AppState } from 'react-native'
import { io, Socket } from 'socket.io-client'
import { API_URL, getSocketToken } from '../api/client'

type Listener = (payload: any) => void
const listeners = new Map<string, Set<Listener>>()
const rooms = new Map<string, number>()
const watches = new Map<string, number>()
let socket: Socket | undefined
let account = ''
let generation = 0
let background: { remove(): void } | undefined
let refreshing = false
let renewalAttempts = 0
let watchTimer: ReturnType<typeof setTimeout> | undefined
let connectedBefore = false
let unwatchTimer: ReturnType<typeof setTimeout> | undefined
const pendingUnwatch = new Set<string>()
const debug = (tag: string, value: string) => { if (__DEV__) console.debug(tag, value) }
function dispatch(name: string, payload: unknown) { listeners.get(name)?.forEach(fn => fn(payload)) }
export function onSocket(name: string, listener: Listener) {
  const set = listeners.get(name) ?? new Set<Listener>()
  set.add(listener); listeners.set(name, set)
  return () => { set.delete(listener); if (!set.size) listeners.delete(name) }
}
export function startSocket(userId: string) {
  if (account === userId && socket) return
  stopSocket(); if (!userId) return
  account = userId
  const version = generation
  const current = socket = io(API_URL, { autoConnect: false, transports: ['websocket'], reconnectionAttempts: 5, reconnectionDelay: 1500, reconnectionDelayMax: 15000,
    auth: callback => { void getSocketToken().then(token => { if (version === generation) callback({ token }) }).catch(() => {}) },
  })
  const renew = async () => {
    if (refreshing || renewalAttempts >= 1 || version !== generation || AppState.currentState !== 'active') return
    refreshing = true; renewalAttempts++
    try { if (await getSocketToken(true) && version === generation) current.connect() }
    catch { dispatch('connection:error', { message: 'Oturum yenilenemedi.' }) }
    finally { refreshing = false }
  }
  current.on('connect', () => {
    renewalAttempts = 0
    debug('[SOCKET CONNECT]', current.id || '')
    syncWatches()
    for (const eventId of rooms.keys()) void socketAction('event:join', { eventId }).catch(() => {})
    // Only mounted consumers synchronize their critical data after a real gap.
    if (connectedBefore) dispatch('sync:required', {})
    connectedBefore = true
  })
  current.on('disconnect', reason => debug('[SOCKET DISCONNECT]', reason))
  current.on('auth:expired', () => { current.disconnect(); void renew() })
  current.on('connect_error', error => { if (error.message === 'UNAUTHORIZED') void renew() })
  current.onAny((name, payload) => { if (version !== generation) return; debug('[SOCKET EVENT RECEIVED]', name); dispatch(name, payload) })
  background = AppState.addEventListener('change', state => { if (state === 'active') current.connect(); else current.disconnect() })
  if (AppState.currentState === 'active') current.connect()
}
export function stopSocket() {
  generation++; account = ''; background?.remove(); background = undefined
  socket?.removeAllListeners(); socket?.offAny(); socket?.disconnect(); socket = undefined
  clearTimeout(unwatchTimer); pendingUnwatch.clear()
  clearTimeout(watchTimer); watchTimer = undefined; renewalAttempts = 0
  rooms.clear(); watches.clear(); connectedBefore = false; refreshing = false
}
export function retainEvent(eventId: string) {
  rooms.set(eventId, (rooms.get(eventId) ?? 0) + 1)
  if (rooms.get(eventId) === 1 && socket?.connected) void socketAction('event:join', { eventId }).catch(() => {})
  return () => {
    const count = rooms.get(eventId) ?? 0
    if (count > 1) rooms.set(eventId, count - 1)
    else { rooms.delete(eventId); if (socket?.connected) void socketAction('event:leave', { eventId }).catch(() => {}) }
  }
}
export function socketAction<T = unknown>(name: string, payload: unknown): Promise<T> {
  const current = socket
  const version = generation
  if (!current?.connected) return Promise.reject(new Error('Gerçek zamanlı bağlantı hazır değil. Tekrar dene.'))
  debug('[SOCKET EVENT SENT]', name)
  // Never buffer/retry mutations: an acknowledgement timeout does not mean the DB write failed.
  return new Promise((resolve, reject) => current.timeout(10000).emit(name, payload, (error: Error | null, result: { ok: boolean; data: T; error?: string }) => {
    if (version !== generation) { reject(new Error('Oturum değişti.')); return }
    if (error) reject(new Error('Yanıt alınamadı. Yeniden göndermeden önce mesajları kontrol et.'))
    else if (!result?.ok) reject(new Error(result?.error || 'İşlem başarısız.'))
    else resolve(result.data)
  }))
}

function syncWatches() {
  clearTimeout(watchTimer)
  watchTimer = setTimeout(() => {
    if (!socket?.connected || !watches.size) return
    const ids = [...watches.keys()].slice(0, 1000)
    for (let index = 0; index < ids.length; index += 500) {
      void socketAction<Array<{ eventId: string }>>('event:watch_batch', { eventIds: ids.slice(index, index + 500) }).then(summaries => {
        if (Array.isArray(summaries)) summaries.forEach(summary => dispatch('event:summary', summary))
      }).catch(() => {})
    }
  }, 40)
}
export function watchEvent(eventId: string) {
  watches.set(eventId, (watches.get(eventId) ?? 0) + 1)
  if (watches.get(eventId) === 1 && socket?.connected) syncWatches()
  return () => {
    const count = watches.get(eventId) ?? 0
    if (count > 1) watches.set(eventId, count - 1)
    else {
      watches.delete(eventId); pendingUnwatch.add(eventId); clearTimeout(unwatchTimer)
      unwatchTimer = setTimeout(() => {
        const ids = [...pendingUnwatch].filter(id => !watches.has(id)); pendingUnwatch.clear()
        if (socket?.connected) for (let index = 0; index < ids.length; index += 500) void socketAction('event:unwatch_batch', { eventIds: ids.slice(index, index + 500) }).catch(() => {})
      }, 40)
    }
  }
}

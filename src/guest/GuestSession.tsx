import AsyncStorage from '@react-native-async-storage/async-storage'
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { claimGuestParticipation, getMemberForGuestReturn, hasSession, registerGuestAccountIsolation } from '../api/client'
import { GUEST_CODE } from './links'

export interface GuestSession { code: string; session?: string; name?: string; expiresAt?: string }
const KEY = 'event-app:guest-token'
const Context = createContext<{
  ready: boolean; guest: GuestSession | null;
  enter: (code: string) => Promise<void>; save: (session: GuestSession) => Promise<void>;
  clearParticipation: (code?: string) => Promise<void>; returnToMember: () => Promise<void>;
  /** Leaves guest mode without a member session (to sign up or sign in); the participation stays resumable. */
  exit: () => Promise<void>;
} | null>(null)
export function GuestProvider({ children }: { children: ReactNode }) {
  const [guest, setGuest] = useState<GuestSession | null>(null)
  const [ready, setReady] = useState(false)
  const current = useRef<GuestSession | null>(null)
  const saved = useRef<GuestSession | null>(null)
  const hydrated = useRef(false)
  const version = useRef(0)
  const queue = useRef(Promise.resolve())
  const blocked = useCallback(() => !hydrated.current || !!current.current, [])
  // Install before child screen effects; hidden member screens cannot send account requests.
  registerGuestAccountIsolation(blocked)
  useLayoutEffect(() => registerGuestAccountIsolation(blocked), [blocked])
  useEffect(() => {
    let active = true
    const captured = version.current
    AsyncStorage.getItem(KEY).then(raw => {
      if (!active || captured !== version.current || !raw) return
      const stored = JSON.parse(raw) as GuestSession & { active?: boolean }
      if (typeof stored.code === 'string' && GUEST_CODE.test(stored.code)) {
        const validSession = typeof stored.session === 'string' && /^[a-f0-9]{64}$/.test(stored.session)
          && typeof stored.expiresAt === 'string' && Date.parse(stored.expiresAt) > Date.now()
        const next = { code: stored.code, ...(validSession ? { session: stored.session, name: stored.name, expiresAt: stored.expiresAt } : {}) }
        saved.current = next
        if (stored.active !== false) { current.current = next; setGuest(next) }
      }
    }).catch(() => {}).finally(() => {
      if (active) { hydrated.current = true; setReady(true) }
    })
    return () => { active = false }
  }, [])
  const write = useCallback((next: GuestSession) => {
    version.current++
    current.current = next; saved.current = next; hydrated.current = true; setGuest(next); setReady(true)
    const job = queue.current.catch(() => {}).then(() => AsyncStorage.setItem(KEY, JSON.stringify(next)))
    queue.current = job
    return job
  }, [])
  const enter = useCallback(async (code: string) => {
    if (!GUEST_CODE.test(code)) throw new Error('Geçersiz davet kodu.')
    if (current.current?.code !== code) {
      const remembered = saved.current
      const resumable = remembered?.code === code && remembered.session && remembered.expiresAt && Date.parse(remembered.expiresAt) > Date.now()
      await write(resumable ? remembered : { code })
    }
  }, [write])
  const save = useCallback(async (next: GuestSession) => {
    if (!GUEST_CODE.test(next.code) || current.current?.code !== next.code) throw new Error('Davet değişti. Bu işlem eski davete ait.')
    await write(next)
  }, [write])
  const clearParticipation = useCallback(async (code?: string) => {
    const active = current.current
    if (active && (!code || active.code === code)) await write({ code: active.code })
  }, [write])
  const returnToMember = useCallback(async () => {
    const captured = version.current
    if (!await hasSession()) throw new Error('Kayıtlı bir üyelik oturumun yok.')
    const member = await getMemberForGuestReturn()
    if (member.status?.enum !== 'approved') throw new Error('Onaylı üyelik oturumuna dönülemedi.')
    if (captured !== version.current) throw new Error('Davet değişti. Tekrar dene.')
    const previous = current.current
    const job = queue.current.catch(() => {}).then(() => previous ? AsyncStorage.setItem(KEY, JSON.stringify({ ...previous, active: false })) : AsyncStorage.removeItem(KEY))
    queue.current = job
    await job
    if (captured !== version.current) throw new Error('Davet değişti. Tekrar dene.')
    version.current++; current.current = null; setGuest(null)
  }, [])
  const exit = useCallback(async () => {
    const previous = current.current
    const job = queue.current.catch(() => {}).then(() => previous ? AsyncStorage.setItem(KEY, JSON.stringify({ ...previous, active: false })) : AsyncStorage.removeItem(KEY))
    queue.current = job
    await job
    version.current++; current.current = null; setGuest(null)
  }, [])
  return <Context.Provider value={{ ready, guest, enter, save, clearParticipation, returnToMember, exit }}>{children}</Context.Provider>
}
export const useGuest = () => {
  const context = useContext(Context)
  if (!context) throw new Error('GuestProvider gerekli.')
  return context
}
export const useOptionalGuest = () => useContext(Context)

/**
 * After signing up: an event this device joined as a guest moves to the new account (the member takes the guest's
 * place). Returns that event's id, or null when there was nothing to move. The saved guest record is removed once
 * the server has taken it over or no longer knows it.
 */
export async function claimSavedGuestParticipation(): Promise<string | null> {
  const raw = await AsyncStorage.getItem(KEY).catch(() => null)
  if (!raw) return null
  const stored = JSON.parse(raw) as Partial<GuestSession>
  if (typeof stored.code !== 'string' || !GUEST_CODE.test(stored.code) || typeof stored.session !== 'string'
    || !stored.expiresAt || Date.parse(stored.expiresAt) <= Date.now()) return null
  try {
    const result = await claimGuestParticipation(stored.code, stored.session)
    await AsyncStorage.removeItem(KEY).catch(() => {})
    return result.eventId
  } catch (cause) {
    // Expired, already moved, event already started or not a new account: nothing left to claim with this record.
    if (cause instanceof Error && /^API (400|404):/.test(cause.message)) await AsyncStorage.removeItem(KEY).catch(() => {})
    return null
  }
}

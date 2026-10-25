import AsyncStorage from '@react-native-async-storage/async-storage'
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { claimGuestParticipation, getMemberForGuestReturn, hasSession, registerGuestAccountIsolation } from '../api/client'
import { GUEST_CODE } from './links'

export interface GuestSession { code: string; session?: string; name?: string; expiresAt?: string }
const KEY = 'event-app:guest-token'
// Every invite this device joined, by code: coming back to one of them resumes it, whichever invite was opened
// in between. An invite that was only opened (no name, no "Katıl") is never kept here.
const JOINED_KEY = 'event-app:guest-participations'
type Joined = Record<string, Required<Pick<GuestSession, 'session' | 'expiresAt'>> & { name?: string }>
const resumable = (entry?: Partial<GuestSession>): entry is GuestSession & { session: string; expiresAt: string } =>
  typeof entry?.session === 'string' && /^[a-f0-9]{64}$/.test(entry.session)
  && typeof entry.expiresAt === 'string' && Date.parse(entry.expiresAt) > Date.now()
const readJoined = async (): Promise<Joined> => {
  const raw = await AsyncStorage.getItem(JOINED_KEY).catch(() => null)
  const stored = raw ? JSON.parse(raw) as Joined : {}
  return Object.fromEntries(Object.entries(stored).filter(([code, entry]) => GUEST_CODE.test(code) && resumable(entry)))
}
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
  const joined = useRef<Joined>({})
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
    Promise.all([AsyncStorage.getItem(KEY), readJoined()]).then(([raw, remembered]) => {
      if (!active || captured !== version.current) return
      joined.current = remembered
      if (!raw) return
      const stored = JSON.parse(raw) as GuestSession & { active?: boolean }
      const suspended = stored.active === false
      if (typeof stored.code === 'string' && GUEST_CODE.test(stored.code)) {
        // A record from before the per-invite list still resumes its invite.
        if (resumable(stored) && !remembered[stored.code]) remember(stored)
        const entry = joined.current[stored.code]
        const next = { code: stored.code, ...(entry ? { session: entry.session, name: entry.name, expiresAt: entry.expiresAt } : {}) }
        if (!suspended) { current.current = next; setGuest(next) }
      }
    }).catch(() => {}).finally(() => {
      if (active) { hydrated.current = true; setReady(true) }
    })
    return () => { active = false }
  }, [])
  // Keeps (or, without a session, forgets) the participation of `entry.code` in the per-invite list.
  const remember = (entry: GuestSession) => {
    const { [entry.code]: _previous, ...others } = joined.current
    joined.current = resumable(entry) ? { ...others, [entry.code]: { session: entry.session, name: entry.name, expiresAt: entry.expiresAt } } : others
    const list = JSON.stringify(joined.current)
    queue.current = queue.current.catch(() => {}).then(() => AsyncStorage.setItem(JOINED_KEY, list))
  }
  const write = useCallback((next: GuestSession, keep = true) => {
    version.current++
    current.current = next; hydrated.current = true; setGuest(next); setReady(true)
    if (keep) remember(next)
    const job = queue.current.catch(() => {}).then(() => AsyncStorage.setItem(KEY, JSON.stringify(next)))
    queue.current = job
    return job
  }, [])
  const enter = useCallback(async (code: string) => {
    if (!GUEST_CODE.test(code)) throw new Error('Geçersiz davet kodu.')
    if (current.current?.code !== code) {
      // Only an invite this device joined comes back with its name and session; opening another one forgets nothing.
      const entry = joined.current[code]
      await write(entry && resumable(entry) ? { ...entry, code } : { code }, false)
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
  const forget = async (code: string) => {
    const { [code]: _claimed, ...others } = await readJoined()
    await Promise.all([AsyncStorage.removeItem(KEY), AsyncStorage.setItem(JOINED_KEY, JSON.stringify(others))]).catch(() => {})
  }
  try {
    const result = await claimGuestParticipation(stored.code, stored.session)
    await forget(stored.code)
    return result.eventId
  } catch (cause) {
    // Expired, already moved, event already started or not a new account: nothing left to claim with this record.
    if (cause instanceof Error && /^API (400|404):/.test(cause.message)) await forget(stored.code)
    return null
  }
}

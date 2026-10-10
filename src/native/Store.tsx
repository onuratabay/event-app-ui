import { defaultEventCover } from "./images"
import { startSocket, stopSocket, onSocket, watchEvent } from '../services/socket'
import AsyncStorage from "@react-native-async-storage/async-storage"
import React, {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react"
import { getEvents, getCurrentUser, getUserInterests, getPreferences, getMyEvents, hasSession, putPreference, archiveLegacyData } from "../api/client"
import { ErrorNotice } from "../components/ErrorNotice"
export const EMPTY_USER: AppUser = { id: '', name: '', avatar: '', city: '', bio: '', instagram: '', interests: [], score: 0, scores: { punctuality: 0, communication: 0, community: 0 }, stats: { attended: 0, connections: 0, organized: 0 } }
import type { AppEvent, AppUser, ChatMessage } from "../types"
interface Data {
  user: AppUser
  events: AppEvent[]
  messages: Record<string, ChatMessage[]>
  onboarding: Record<string, string>
}
const initial: Data = { user: EMPTY_USER, events: [], messages: {}, onboarding: {} }
export function updateStoreUser(user: Data["user"], remoteUser: unknown) {
  if (!remoteUser || typeof remoteUser !== "object") return user
  const remote = remoteUser as import('../api/client').ApiUser
  return { ...user, id: remote.id, name: `${remote.firstName || ''} ${remote.lastName || ''}`.trim(), avatar: remote.profilePhoto || '', city: remote.city || '', bio: remote.bio || '', instagram: remote.instagramUsername || '', score: remote.rank || 0, status: remote.status?.enum ?? user.status }

}
// Events without a participant cap are stored with the API's highest allowed capacity.
export const UNLIMITED_PARTICIPANTS = 100000
export const isUnlimitedCapacity = (max: number) => max >= UNLIMITED_PARTICIPANTS
export const participantCount = (current: number, max: number) => `${current}/${isUnlimitedCapacity(max) ? "∞" : max}`
// The event room (chat) opens once confirmed participants reach the minimum; the backend enforces the same rule.
export const isRoomReady = (event: AppEvent) => event.status !== "cancelled" && event.currentParticipants >= event.minParticipants
// The chat screen registers the room it shows so new messages there are not counted as unread.
let openRoomId: string | null = null
export const setOpenRoom = (eventId: string | null) => { openRoomId = eventId }
// Rooms are named after the activity plus the date, so two Padel events stay distinguishable.
export const roomTitle = (event: AppEvent) => `${event.title} · ${event.date}`
// Rooms with the newest message come first; rooms without messages keep their order at the end.
// Compare instants, not strings: REST sends "+03:00" offsets while socket payloads use UTC "Z".
export const byLatestMessage = (a: AppEvent, b: AppEvent) => (Date.parse(b.lastMessageAt || "") || 0) - (Date.parse(a.lastMessageAt || "") || 0)
export const isEventMember = (event: AppEvent, userId: string) => event.host.id === userId || !!event.joined || event.participants.some(person => person.id === userId)
export function mapApiEvent(event: Awaited<ReturnType<typeof getEvents>>["items"][number]): AppEvent {
  const host: AppUser = {
    id: event.owner.id,
    name: `${event.owner.firstName} ${event.owner.lastName}`.trim(),
    avatar: "",
    city: "",
    bio: "",
    instagram: "",
    interests: [event.interest.name],
    score: 0,
    scores: { punctuality: 0, communication: 0, community: 0 },
    stats: { attended: 0, connections: 0, organized: 0 },
  }
  return {
    id: event.id,
    title: event.interest.name,
    category: event.interest.name,
    categoryEmoji: "✨",
    date: event.date,
    time: event.startTime,
    location: event.locationName || "",
    latitude: event.latitude,
    longitude: event.longitude,
    distance: "",
    level: event.level?.name || "",
    currentParticipants: event.confirmedParticipantCount,
    maxParticipants: event.maxParticipants,
    minParticipants: event.minParticipants,
    host,
    participants: event.participants.map((participant) => ({
      ...host,
      id: participant.id,
      name: `${participant.firstName} ${participant.lastName}`.trim(),
      avatar: participant.profilePhoto || "",
    })),
    coverImage: event.coverPhoto || defaultEventCover(event.interest.name),
    description: event.description,
    requirements: event.requirements ? [event.requirements] : [],
    status: event.status.enum,
    isActive: event.status.enum === "started",
    isSaved: event.isFavorite,
    waitlisted: event.viewerParticipationStatus === 'waitlisted',
    invited: event.viewerParticipationStatus === 'invited',
    lastMessageAt: event.lastMessageAt || undefined,
    unreadCount: event.unreadCount || 0,
    joined: event.viewerParticipationStatus === "confirmed",
    duration: event.durationMinutes ? `${event.durationMinutes} dk` : undefined,
  }
}
/** Lightweight map/AI payloads omit photos; keep an already loaded real cover. */
export function mapApiEventPreservingCover(event: Parameters<typeof mapApiEvent>[0], previous?: AppEvent): AppEvent {
  const mapped = mapApiEvent(event)
  // List payloads carry no participant photos; keep ones already loaded on the detail screen.
  const avatars = new Map(previous?.participants.map(person => [person.id, person.avatar]) || [])
  return { ...mapped, coverImage: event.coverPhoto || previous?.coverImage || mapped.coverImage, participants: mapped.participants.map(person => ({ ...person, avatar: person.avatar || avatars.get(person.id) || "" })) }
}

const Context = createContext<{
  data: Data
  setData: React.Dispatch<React.SetStateAction<Data>>
  refreshEvents: () => Promise<void>
  loadMoreEvents: () => Promise<void>
  moreEvents: boolean
  loadMoreFeedEvents: () => Promise<void>
  moreFeedEvents: boolean
  resetSession: () => void
} | null>(null)
export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState(initial)
  const [storageError, setStorageError] = useState<string | null>(null)
  const [moreEvents, setMoreEvents] = useState(false)
  const [moreFeedEvents, setMoreFeedEvents] = useState(false)
  const page = useRef(1)
  const feedPage = useRef(1)
  const loadingMore = useRef(false)
  const loadingMoreFeed = useRef(false)
  const sessionGeneration = useRef(0)
  // A callback retained by an unmounted screen cannot write into the next account's view.
  const renderGeneration = sessionGeneration.current
  const setAccountData: React.Dispatch<React.SetStateAction<Data>> = update => {
    if (renderGeneration === sessionGeneration.current) setData(update)
  }
  const refreshEvents = async () => {
    const generation = sessionGeneration.current
    try {
      const [remote, interests, preferences, events, mine] = await Promise.all([getCurrentUser(), getUserInterests(), getPreferences(), getEvents(), getMyEvents()])
      if (generation !== sessionGeneration.current) return
      // Migrate only preferences belonging to this authenticated account, never demo events or users.
      const legacy = await AsyncStorage.getItem('event-app:v1')
      let old: { user?: { id?: string; recommendationProfile?: import('../recommendations/model').RecommendationProfile }; events?: unknown[]; messages?: Record<string, unknown> } | null = null
      try { old = legacy ? JSON.parse(legacy) : null } catch { /* A malformed legacy cache must not block server data. */ }
      if (generation !== sessionGeneration.current) return
      if (old?.user?.id === remote.id) {
        await archiveLegacyData({ user: old.user, events: old.events || [], messages: old.messages || {} })
        if (generation !== sessionGeneration.current) return
        if (!preferences.recommendationProfile && old.user.recommendationProfile) {
          await putPreference('recommendationProfile', old.user.recommendationProfile)
          if (generation !== sessionGeneration.current) return
          preferences.recommendationProfile = old.user.recommendationProfile
        }
        const oldFilters = await AsyncStorage.getItem('event-app:map-filters')
        if (generation !== sessionGeneration.current) return
        if (!preferences.mapFilters && oldFilters) await putPreference('mapFilters', JSON.parse(oldFilters))
      }
      if (generation !== sessionGeneration.current) return
      if (!old?.user?.id || old.user.id === 'me' || old.user.id === remote.id) await AsyncStorage.multiRemove(['event-app:v1', 'event-app:map-filters'])
      const all = [...new Map([...events.items, ...mine.items].map(event => [event.id, event])).values()]
      setData(current => ({ ...current, user: { ...updateStoreUser(EMPTY_USER, remote), interests: interests.map(i => i.name), recommendationProfile: preferences.recommendationProfile }, events: all.map(mapApiEvent) }))
      page.current = 1; setMoreEvents(mine.hasMore)
      feedPage.current = 1; setMoreFeedEvents(events.items.length < events.total)
      setStorageError(null)
    } catch (error) {
      if (generation === sessionGeneration.current) setStorageError('Hesap verileri sunucudan yüklenemedi. Bağlantını kontrol edip tekrar dene.')
      throw error
    }
  }
  const loadMoreEvents = async () => {
    if (loadingMore.current || !moreEvents) return
    loadingMore.current = true
    const generation = sessionGeneration.current
    try {
      const result = await getMyEvents(page.current + 1)
      if (generation !== sessionGeneration.current) return
      page.current++; setMoreEvents(result.hasMore)
      setData(current => ({ ...current, events: [...new Map([...current.events, ...result.items.map(mapApiEvent)].map(event => [event.id, event])).values()] }))
    } catch { setStorageError('Sonraki etkinlikler yüklenemedi.') }
    finally { loadingMore.current = false }
  }
  const loadMoreFeedEvents = async () => {
    if (loadingMoreFeed.current || !moreFeedEvents) return
    loadingMoreFeed.current = true
    const generation = sessionGeneration.current
    try {
      const nextPage = feedPage.current + 1
      const result = await getEvents(nextPage)
      if (generation !== sessionGeneration.current) return
      feedPage.current = nextPage
      setMoreFeedEvents(nextPage * 20 < result.total)
      setData(current => ({
        ...current,
        events: [...new Map([...current.events, ...result.items.map(mapApiEvent)].map(event => [event.id, event])).values()],
      }))
    } catch {
      setStorageError('Sonraki etkinlikler yüklenemedi.')
    } finally {
      loadingMoreFeed.current = false
    }
  }
  useEffect(() => { void hasSession().then(active => { if (active) return refreshEvents() }).catch(() => {}) }, [])
  useLayoutEffect(() => { if (data.user.id) startSocket(data.user.id); return stopSocket }, [data.user.id])
  const watchKey = data.events.map(e => e.id).sort().slice(0, 100).join(',')
  useEffect(() => { const releases = watchKey.split(',').filter(Boolean).map(watchEvent); return () => releases.forEach(release => release()) }, [watchKey, data.user.id])
  useEffect(() => {
    const patch = (name: string) => onSocket(name, delta => setData(current => ({ ...current, events: current.events.map(event => event.id !== delta.eventId ? event : {
      ...event,
      ...(name === 'event:participant_left' ? { participants: event.participants.filter(person => person.id !== delta.userId) } : {}),
      ...(name === 'event:participant_joined' && delta.participant ? { participants: [...event.participants.filter(person => person.id !== delta.userId), { ...EMPTY_USER, id: delta.userId, name: `${delta.participant.firstName} ${delta.participant.lastName}` }] } : {}),
      ...(name === 'event:waitlist_joined' && delta.userId === current.user.id ? { waitlisted: true } : {}),
      ...(typeof delta.participantCount === 'number' ? { currentParticipants: delta.participantCount } : {}),
      ...(typeof delta.joined === 'boolean' ? { joined: delta.joined } : {}),
      ...(delta.status ? { status: delta.status, isActive: delta.status === 'started' } : {}),
      ...(delta.userId === current.user.id && name === 'event:participant_joined' ? { joined: true, waitlisted: false } : {}),
      ...(delta.userId === current.user.id && name === 'event:participant_left' ? { joined: false, waitlisted: false } : {}),
    }) })))
    const cleanups = ['event:waitlist_joined', 'event:summary', 'event:participant_count_changed', 'event:participant_joined', 'event:participant_left', 'event:started', 'event:cancelled', 'event:ended', 'event:updated'].map(patch)
    // Sent to every room member on each new message, even when they are not inside the room.
    const roomMessage = onSocket('room:message', (delta: { eventId: string; at: string; userId?: string }) => setData(current => ({ ...current, events: current.events.map(event => event.id !== delta.eventId ? event : {
      ...event,
      lastMessageAt: delta.at,
      unreadCount: delta.userId === current.user.id || delta.eventId === openRoomId ? event.unreadCount || 0 : (event.unreadCount || 0) + 1,
    }) })))
    return () => { cleanups.forEach(cleanup => cleanup()); roomMessage() }
  }, [])
  return <Context.Provider value={{ data, loadMoreEvents, moreEvents, loadMoreFeedEvents, moreFeedEvents, setData: setAccountData, refreshEvents, resetSession: () => { stopSocket(); sessionGeneration.current++; setData(initial); setStorageError(null); setMoreEvents(false); setMoreFeedEvents(false); page.current = 1; feedPage.current = 1 } }}>
    {storageError && <ErrorNotice title="Veriler yüklenemedi" message={storageError} onDismiss={() => setStorageError(null)} onRetry={() => { setStorageError(null); void refreshEvents().catch(() => {}) }} />}
    {children}
  </Context.Provider>
}

export function useStore() {
  const store = useContext(Context)
  if (!store) throw new Error("StoreProvider missing")
  return store
}

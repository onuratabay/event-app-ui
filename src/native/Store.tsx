import { useOptionalGuest } from "../guest/GuestSession"
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
import { getEvent, getEvents, getCurrentUser, getReferenceRequests, getRooms, getUserInterests, getPreferences, getMyEvents, hasSession, putPreference, archiveLegacyData } from "../api/client"
import { ErrorNotice } from "../components/ErrorNotice"
export const EMPTY_USER: AppUser = { id: '', name: '', avatar: '', city: '', bio: '', instagram: '', interests: [], score: 0, scores: { punctuality: 0, communication: 0, community: 0 }, stats: { attended: 0, connections: 0, organized: 0 } }
import type { AppEvent, AppUser, ChatMessage } from "../types"
interface Data {
  user: AppUser
  events: AppEvent[]
  messages: Record<string, ChatMessage[]>
  onboarding: Record<string, string>
  /** Rooms the user silenced; their unread badge is hidden. Stored server-side (preference "mutedRooms"). */
  mutedRooms: string[]
  /** Ids of events that came from the Discover feed (/events). Discover shows only these;
   *  the shared `events` list also holds the user's own, joined and favourite events. */
  feedIds: string[]
  /** Reference requests, loaded once per session and kept current by socket events; null until loaded. */
  references: import('../api/client').ReferenceRequest[] | null
  /** Latest room summaries; re-applied after a full reload so whichever request finishes last cannot drop rooms. */
  rooms: import('../api/client').RoomSummary[]
  /** True once the first feed page has arrived, so Discover can tell "loading" from "empty". */
  feedLoaded: boolean
}
const initial: Data = { user: EMPTY_USER, events: [], messages: {}, onboarding: {}, mutedRooms: [], feedIds: [], references: null, rooms: [], feedLoaded: false }
// Incoming server copies replace older ones; events not in the response are kept.
// Feed and detail payloads carry no room state, so the cached last-message time and unread count survive.
const mergeEvents = (current: AppEvent[], incoming: AppEvent[]) => {
  const byId = new Map(current.map(event => [event.id, event]))
  for (const event of incoming) {
    const existing = byId.get(event.id)
    byId.set(event.id, existing ? { ...event, lastMessageAt: event.lastMessageAt ?? existing.lastMessageAt, unreadCount: event.unreadCount ?? existing.unreadCount } : event)
  }
  return [...byId.values()]
}
// Photo-less feed items keep a cover that is already loaded until the background covers arrive.
const mergeFeed = (current: AppEvent[], items: import('../api/client').ApiEvent[]) => {
  const byId = new Map(current.map(event => [event.id, event]))
  return mergeEvents(current, items.map(item => mapApiEventPreservingCover(item, byId.get(item.id))))
}
export function updateStoreUser(user: Data["user"], remoteUser: unknown) {
  if (!remoteUser || typeof remoteUser !== "object") return user
  const remote = remoteUser as import('../api/client').ApiUser
  return { ...user, id: remote.id, name: `${remote.firstName || ''} ${remote.lastName || ''}`.trim(), avatar: remote.profilePhoto || '', city: remote.city || '', bio: remote.bio || '', instagram: remote.instagramUsername || '', score: remote.rank || 0, status: remote.status?.enum ?? user.status }

}
// Events without a participant cap are stored with the API's highest allowed capacity.
export const UNLIMITED_PARTICIPANTS = 100000
export const isUnlimitedCapacity = (max: number) => max >= UNLIMITED_PARTICIPANTS
// No maximum set does not mean "unlimited": the stored placeholder is never shown, only the count.
export const participantCount = (current: number, max: number) => isUnlimitedCapacity(max) ? `${current}` : `${current}/${max}`
/** Seats to fill: up to the maximum when one is set, otherwise up to the minimum. */
export const capacityTarget = (event: { minParticipants: number; maxParticipants: number }) => isUnlimitedCapacity(event.maxParticipants) ? event.minParticipants : event.maxParticipants
// The event room (chat) opens once confirmed participants reach the minimum; the backend enforces the same rule.
export const isRoomReady = (event: AppEvent) => event.status !== "cancelled" && event.currentParticipants >= event.minParticipants
// One meaning of "aktif" everywhere: the minimum is reached and the room is open.
// A started event is shown separately as "Başladı".
export type EventPhase = "cancelled" | "closed" | "started" | "active" | "forming"
export function eventPhase(event: AppEvent): EventPhase {
  if (event.status === "cancelled") return "cancelled"
  if (event.status === "closed") return "closed"
  if (event.isActive) return "started"
  return isRoomReady(event) ? "active" : "forming"
}
export const EVENT_PHASE_LABEL: Record<EventPhase, string> = { cancelled: "İptal edildi", closed: "Sona erdi", started: "● Başladı", active: "● Aktif", forming: "◌ Katılımcı Bekleniyor" }
export const isLivePhase = (phase: EventPhase) => phase === "started" || phase === "active"
// The chat screen registers the room it shows so new messages there are not counted as unread.
let openRoomId: string | null = null
export const setOpenRoom = (eventId: string | null) => { openRoomId = eventId }
// Rooms are named after the activity plus the date, so two Padel events stay distinguishable.
export const defaultRoomTitle = (event: AppEvent) => `${event.title} · ${event.date}`
// The organizer may name the room; everyone then sees that name.
export const roomTitle = (event: AppEvent) => event.roomName || defaultRoomTitle(event)
// Rooms with the newest message come first; rooms without messages keep their order at the end.
// Compare instants, not strings: REST sends "+03:00" offsets while socket payloads use UTC "Z".
export const byLatestMessage = (a: AppEvent, b: AppEvent) => (Date.parse(b.lastMessageAt || "") || 0) - (Date.parse(a.lastMessageAt || "") || 0)
export const isEventMember = (event: AppEvent, userId: string) => event.host.id === userId || !!event.joined || event.participants.some(person => person.id === userId)
/**
 * Applies room summaries without wiping details the summary does not carry (description,
 * cover, coordinates). Rooms not loaded yet are added from the summary; their detail screen
 * fetches the full event when opened.
 */
export function mergeRoomSummaries(events: AppEvent[], rooms: import('../api/client').RoomSummary[]): AppEvent[] {
  const byId = new Map(events.map(event => [event.id, event]))
  for (const room of rooms) {
    const existing = byId.get(room.id)
    const avatars = new Map(existing?.participants.map(person => [person.id, person.avatar]) || [])
    const participants = room.participants.map(person => ({ ...EMPTY_USER, id: person.id, name: `${person.firstName} ${person.lastName}`.trim(), avatar: avatars.get(person.id) || "" }))
    const summary = {
      title: room.interest.name, category: room.interest.name, date: room.date, time: room.startTime, location: room.locationName, roomName: room.roomName || undefined,
      status: room.status, isActive: room.status === "started", minParticipants: room.minParticipants, maxParticipants: room.maxParticipants,
      currentParticipants: room.confirmedParticipantCount, participants, lastMessageAt: room.lastMessageAt || undefined, unreadCount: room.unreadCount,
      // Every room is one the user belongs to.
      joined: true,
    }
    byId.set(room.id, existing ? { ...existing, ...summary } : {
      ...mapApiEvent({
        id: room.id, owner: { id: room.ownerId, firstName: "", lastName: "" }, interest: { id: room.interest.id, slug: "", name: room.interest.name },
        level: null, date: room.date, startTime: room.startTime, durationMinutes: null, locationName: room.locationName,
        latitude: Number.NaN, longitude: Number.NaN, minParticipants: room.minParticipants, maxParticipants: room.maxParticipants,
        coverPhoto: null, description: "", requirements: null, confirmedParticipantCount: room.confirmedParticipantCount, participants: [],
        isFavorite: false, status: { enum: room.status, name: "" }, viewerParticipationStatus: "confirmed",
      }),
      ...summary,
    })
  }
  return [...byId.values()]
}
export function mapApiEvent(event: Awaited<ReturnType<typeof getEvents>>["items"][number]): AppEvent {
  const host: AppUser = {
    id: event.owner.id,
    name: `${event.owner.firstName} ${event.owner.lastName}`.trim(),
    // The organizer is also a participant; the server sends their photo there, and only when the viewer
    // has a profile photo of their own (otherwise it is null and the initial is shown).
    avatar: event.participants.find(participant => participant.id === event.owner.id)?.profilePhoto || "",
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
    roomName: event.roomName || undefined,
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
    invitationExpiresAt: event.viewerInvitationExpiresAt || undefined,
    createdAt: event.createdAt,
    lastMessageAt: event.lastMessageAt || undefined,
    unreadCount: event.unreadCount || 0,
    joined: event.viewerParticipationStatus === "confirmed",
    duration: event.durationMinutes ? `${event.durationMinutes} dk` : undefined,
  }
}
/** Lightweight map payloads omit photos; keep an already loaded real cover. */
export function mapApiEventPreservingCover(event: Parameters<typeof mapApiEvent>[0], previous?: AppEvent): AppEvent {
  const mapped = mapApiEvent(event)
  // List payloads carry no participant photos; keep ones already loaded on the detail screen.
  const avatars = new Map(previous?.participants.map(person => [person.id, person.avatar]) || [])
  return { ...mapped, coverImage: event.coverPhoto || previous?.coverImage || mapped.coverImage, host: { ...mapped.host, avatar: mapped.host.avatar || previous?.host.avatar || "" }, participants: mapped.participants.map(person => ({ ...person, avatar: person.avatar || avatars.get(person.id) || "" })) }
}

const Context = createContext<{
  data: Data
  setData: React.Dispatch<React.SetStateAction<Data>>
  refreshEvents: () => Promise<void>
  /** Discover pull-to-refresh: only the feed's first page (/events). */
  refreshFeed: () => Promise<void>
  /** Rooms: only the user's own, joined and favourite events. */
  refreshMyEvents: () => Promise<void>
  /**
   * Rooms: one light request (/events/rooms) per session. Later calls reuse the cached list, which
   * socket events keep current; pull-to-refresh passes force.
   */
  refreshRooms: (force?: boolean) => Promise<void>
  /** Resolves when the current account load finishes, or after timeoutMs, whichever comes first. */
  whenReady: (timeoutMs: number) => Promise<void>
  /** Loads reference requests once; later calls reuse the stored list unless forced. */
  loadReferences: (force?: boolean) => Promise<void>
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
  // Socket handlers read the newest state here; setData updaters may run later than the handler.
  const latestData = useRef(data)
  latestData.current = data
  const guestContext = useOptionalGuest()
  const guestMode = !!guestContext && (!guestContext.ready || !!guestContext.guest)
  const guestModeRef = useRef(guestMode)
  if (guestModeRef.current !== guestMode) { sessionGeneration.current++; guestModeRef.current = guestMode }
  // A callback retained by an unmounted screen cannot write into the next account's view.
  const renderGeneration = sessionGeneration.current
  const setAccountData: React.Dispatch<React.SetStateAction<Data>> = update => {
    if (renderGeneration === sessionGeneration.current && !guestModeRef.current) setData(update)
  }
  // The first feed page; the splash and login screens wait only on it, so Discover opens with its list ready
  // while the account, personal lists and covers keep loading in the background without a loader.
  const feedLoad = useRef<Promise<void> | null>(null)
  const whenReady = (timeoutMs: number) => {
    let timer: ReturnType<typeof setTimeout> | undefined
    return Promise.race([feedLoad.current ?? Promise.resolve(), new Promise<void>(resolve => { timer = setTimeout(resolve, timeoutMs) })]).finally(() => clearTimeout(timer))
  }
  // Covers arrive in a second, background request and replace the placeholders in place.
  const loadCovers = (page: number, generation: number) => getEvents(page, 20, { background: true }).then(result => {
    if (generation !== sessionGeneration.current) return
    const covers = new Map(result.items.filter(item => item.coverPhoto).map(item => [item.id, item.coverPhoto as string]))
    if (covers.size) setData(current => ({ ...current, events: current.events.map(event => covers.has(event.id) ? { ...event, coverImage: covers.get(event.id) as string } : event) }))
  }).catch(() => {})
  /** One feed page without photos (fast), then its covers in the background. */
  const loadFeedPage = (page: number, generation: number) => getEvents(page, 20, { photos: false }).then(result => {
    if (generation === sessionGeneration.current) void loadCovers(page, generation)
    return result
  })
  const refreshEvents = async () => {
    if (guestModeRef.current) return
    const generation = sessionGeneration.current
    try {
      // The feed is shown as soon as it arrives instead of waiting for the slower personal lists.
      const feed = loadFeedPage(1, generation).then(events => {
        if (generation === sessionGeneration.current) setData(current => ({ ...current, events: mergeFeed(current.events, events.items), feedIds: events.items.map(event => event.id), feedLoaded: true }))
        return events
      })
      feedLoad.current = feed.then(() => {}, () => {})
      // The account (id) and interests are stored as soon as they arrive. Screens compare against the user id
      // ("Sen", owner-only actions); waiting for the slow personal lists left it empty, so the signed-in user
      // also showed up by name next to "Sen" (and never at all if one of those lists failed).
      const me = getCurrentUser().then(remote => {
        // Interests may arrive first (on the still id-less user); they are dropped only for a different account.
        if (generation === sessionGeneration.current) setData(current => {
          const sameAccount = !current.user.id || current.user.id === remote.id
          return { ...current, user: { ...updateStoreUser(sameAccount ? current.user : EMPTY_USER, remote), interests: sameAccount ? current.user.interests : [] } }
        })
        return remote
      })
      const myInterests = getUserInterests().then(rows => {
        if (generation === sessionGeneration.current) setData(current => ({ ...current, user: { ...current.user, interests: rows.map(i => i.name) } }))
        return rows
      })
      const [remote, interests, preferences, events, mine] = await Promise.all([me, myInterests, getPreferences(), feed, getMyEvents(1, { background: true })])
      if (generation !== sessionGeneration.current) return
      // Migrate only preferences belonging to this authenticated account, never another account's data.
      const legacy = await AsyncStorage.getItem('event-app:v1')
      let old: { user?: { id?: string }; events?: unknown[]; messages?: Record<string, unknown> } | null = null
      try { old = legacy ? JSON.parse(legacy) : null } catch { /* A malformed legacy cache must not block server data. */ }
      if (generation !== sessionGeneration.current) return
      if (old?.user?.id === remote.id) {
        await archiveLegacyData({ user: old.user, events: old.events || [], messages: old.messages || {} })
        if (generation !== sessionGeneration.current) return
        const oldFilters = await AsyncStorage.getItem('event-app:map-filters')
        if (generation !== sessionGeneration.current) return
        if (!preferences.mapFilters && oldFilters) await putPreference('mapFilters', JSON.parse(oldFilters))
      }
      if (generation !== sessionGeneration.current) return
      if (!old?.user?.id || old.user.id === 'me' || old.user.id === remote.id) await AsyncStorage.multiRemove(['event-app:v1', 'event-app:map-filters'])
      const feedIds = new Set(events.items.map(event => event.id))
      const all = mine.items.filter(event => !feedIds.has(event.id))
      // Merge instead of replace: events a screen loaded meanwhile (an opened room, a search hit) must survive.
      setData(current => ({ ...current, user: { ...updateStoreUser(EMPTY_USER, remote), interests: interests.map(i => i.name) }, events: mergeRoomSummaries(mergeEvents(mergeFeed(current.events, events.items), all.map(mapApiEvent)), current.rooms), mutedRooms: preferences.mutedRooms?.ids || [], feedIds: events.items.map(event => event.id) }))
      page.current = 1; setMoreEvents(mine.hasMore)
      feedPage.current = 1; setMoreFeedEvents(events.items.length < events.total)
      setStorageError(null)
      // Rooms are fetched in the background too, so the Rooms page opens with its list ready.
      void refreshRooms(false, true).catch(() => {})
    } catch (error) {
      if (generation === sessionGeneration.current) setStorageError('Hesap verileri sunucudan yüklenemedi. Bağlantını kontrol edip tekrar dene.')
      throw error
    }
  }
  const refreshFeed = async () => {
    if (guestModeRef.current) return
    const generation = sessionGeneration.current
    try {
      const result = await loadFeedPage(1, generation)
      if (generation !== sessionGeneration.current) return
      setData(current => ({ ...current, events: mergeFeed(current.events, result.items), feedIds: result.items.map(event => event.id), feedLoaded: true }))
      feedPage.current = 1; setMoreFeedEvents(result.items.length < result.total)
      setStorageError(null)
    } catch (error) {
      if (generation === sessionGeneration.current) setStorageError('Etkinlikler yüklenemedi. Bağlantını kontrol edip tekrar dene.')
      throw error
    }
  }
  const refreshMyEvents = async () => {
    if (guestModeRef.current) return
    const generation = sessionGeneration.current
    try {
      const result = await getMyEvents(1)
      if (generation !== sessionGeneration.current) return
      setData(current => ({ ...current, events: mergeEvents(current.events, result.items.map(mapApiEvent)) }))
      page.current = 1; setMoreEvents(result.hasMore)
    } catch (error) {
      if (generation === sessionGeneration.current) setStorageError('Etkinliklerin yüklenemedi. Bağlantını kontrol edip tekrar dene.')
      throw error
    }
  }
  const roomsLoaded = useRef(false)
  const refreshRooms = async (force = false, silent = false) => {
    if (guestModeRef.current) return
    if (roomsLoaded.current && !force) return
    const generation = sessionGeneration.current
    roomsLoaded.current = true
    try {
      const rooms = await getRooms()
      if (generation !== sessionGeneration.current) return
      setData(current => ({ ...current, rooms, events: mergeRoomSummaries(current.events, rooms) }))
    } catch (error) {
      if (generation === sessionGeneration.current) { roomsLoaded.current = false; if (!silent) setStorageError('Odalar yüklenemedi. Bağlantını kontrol edip tekrar dene.') }
      throw error
    }
  }
  const referencesLoaded = useRef(false)
  const loadReferences = async (force = false) => {
    if (guestModeRef.current) return
    if (referencesLoaded.current && !force) return
    const generation = sessionGeneration.current
    referencesLoaded.current = true
    try {
      const result = await getReferenceRequests()
      if (generation === sessionGeneration.current) setData(current => ({ ...current, references: result.items }))
    } catch (error) {
      referencesLoaded.current = false
      throw error
    }
  }
  const loadMoreEvents = async () => {
    if (guestModeRef.current) return
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
    if (guestModeRef.current) return
    if (loadingMoreFeed.current || !moreFeedEvents) return
    loadingMoreFeed.current = true
    const generation = sessionGeneration.current
    try {
      const nextPage = feedPage.current + 1
      const result = await loadFeedPage(nextPage, generation)
      if (generation !== sessionGeneration.current) return
      feedPage.current = nextPage
      setMoreFeedEvents(nextPage * 20 < result.total)
      setData(current => ({
        ...current,
        events: mergeFeed(current.events, result.items),
        feedIds: [...new Set([...current.feedIds, ...result.items.map(event => event.id)])],
      }))
    } catch {
      setStorageError('Sonraki etkinlikler yüklenemedi.')
    } finally {
      loadingMoreFeed.current = false
    }
  }
  useEffect(() => { if (guestMode) return; void hasSession().then(active => { if (active && !guestModeRef.current) return refreshEvents() }).catch(() => {}) }, [guestMode])
  useLayoutEffect(() => { if (!guestMode && data.user.id) startSocket(data.user.id); else stopSocket(); return stopSocket }, [data.user.id, guestMode])
  // Member events are watched first so room openings and cancellations always reach the cached room list.
  const watchKey = [...data.events].sort((a, b) => Number(isEventMember(b, data.user.id)) - Number(isEventMember(a, data.user.id)) || a.id.localeCompare(b.id)).slice(0, 100).map(e => e.id).sort().join(',')
  useEffect(() => { if (guestMode) return; const releases = watchKey.split(',').filter(Boolean).map(watchEvent); return () => releases.forEach(release => release()) }, [watchKey, data.user.id, guestMode])
  useEffect(() => {
    if (guestMode) return
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
    // Both sides of a reference get these events, so the stored list never needs a refetch.
    const referenceCreated = onSocket('reference:created', (row: import('../api/client').ReferenceRequest) => setData(current => current.references ? { ...current, references: [row, ...current.references.filter(item => item.id !== row.id)] } : current))
    const referenceUpdated = onSocket('reference:updated', (patch: { id: string; status: import('../api/client').ReferenceRequest['status'] }) => setData(current => current.references ? { ...current, references: current.references.map(item => item.id === patch.id ? { ...item, status: patch.status } : item) } : current))
    const roomMessage = onSocket('room:message', (delta: { eventId: string; at: string; userId?: string }) => setData(current => ({ ...current, events: current.events.map(event => event.id !== delta.eventId ? event : {
      ...event,
      lastMessageAt: delta.at,
      unreadCount: delta.userId === current.user.id || delta.eventId === openRoomId || (current.mutedRooms || []).includes(delta.eventId) ? event.unreadCount || 0 : (event.unreadCount || 0) + 1,
    }) })))
    // The room list is built from cached events. Membership changes arrive on the user's own channel
    // (also from other devices), so an event missing from the cache is fetched once instead of /events/rooms.
    const fetching = new Set<string>()
    const ensureEvent = (eventId: string) => {
      if (!eventId || fetching.has(eventId) || latestData.current.events.some(event => event.id === eventId)) return
      fetching.add(eventId)
      const generation = sessionGeneration.current
      void getEvent(eventId, { background: true })
        .then(event => { if (generation === sessionGeneration.current) setData(current => ({ ...current, events: mergeEvents(current.events, [mapApiEvent(event)]) })) })
        .catch(() => {})
        .finally(() => fetching.delete(eventId))
    }
    const memberAdded = (name: string) => onSocket(name, (delta: { eventId: string; userId?: string; participantCount?: number }) => {
      if (delta.userId && delta.userId !== latestData.current.user.id) return
      setData(current => ({ ...current, events: current.events.map(event => event.id !== delta.eventId ? event : { ...event, joined: true, waitlisted: false, ...(typeof delta.participantCount === 'number' ? { currentParticipants: delta.participantCount } : {}) }) }))
      ensureEvent(delta.eventId)
    })
    // Renamed by the organizer: every member gets this on their own channel, inside the room or not.
    const renamed = onSocket('room:renamed', (delta: { eventId: string; roomName: string | null }) => setData(current => ({ ...current, events: current.events.map(event => event.id === delta.eventId ? { ...event, roomName: delta.roomName || undefined } : event) })))
    const promoted = memberAdded('event:waitlist_promoted')
    const joinedHere = memberAdded('event:participant_joined')
    const unknownRoom = onSocket('room:message', (delta: { eventId: string }) => ensureEvent(delta.eventId))
    // Events missed while offline: one rooms refresh after reconnecting, only if the list was ever loaded.
    const resync = onSocket('sync:required', () => { if (roomsLoaded.current) void refreshRooms(true).catch(() => {}) })
    return () => { cleanups.forEach(cleanup => cleanup()); roomMessage(); referenceCreated(); referenceUpdated(); promoted(); joinedHere(); unknownRoom(); resync(); renamed() }
  }, [guestMode])
  return <Context.Provider value={{ data: guestMode ? initial : data, loadMoreEvents, moreEvents, loadMoreFeedEvents, moreFeedEvents, setData: setAccountData, refreshEvents, refreshFeed, refreshMyEvents, refreshRooms, whenReady, loadReferences, resetSession: () => { referencesLoaded.current = false; roomsLoaded.current = false; feedLoad.current = null; stopSocket(); sessionGeneration.current++; setData(initial); setStorageError(null); setMoreEvents(false); setMoreFeedEvents(false); page.current = 1; feedPage.current = 1 } }}>
    {!guestMode && storageError && <ErrorNotice title="Veriler yüklenemedi" message={storageError} onDismiss={() => setStorageError(null)} onRetry={() => { setStorageError(null); void refreshEvents().catch(() => {}) }} />}
    {children}
  </Context.Provider>
}

export function useStore() {
  const store = useContext(Context)
  if (!store) throw new Error("StoreProvider missing")
  return store
}

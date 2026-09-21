import AsyncStorage from "@react-native-async-storage/async-storage"
import React, {
  createContext,
  useContext,
  useEffect,
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
  return { ...user, id: remote.id, name: `${remote.firstName || ''} ${remote.lastName || ''}`.trim(), avatar: remote.profilePhoto || '', city: remote.city || '', bio: remote.bio || '', instagram: remote.instagramUsername || '', score: remote.rank || 0 }

}
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
    level: event.level.name,
    currentParticipants: event.confirmedParticipantCount,
    maxParticipants: event.maxParticipants,
    minParticipants: event.minParticipants,
    host,
    participants: event.participants.map((participant) => ({
      ...host,
      id: participant.id,
      name: `${participant.firstName} ${participant.lastName}`.trim(),
    })),
    coverImage: event.coverPhoto || "",
    description: event.description,
    requirements: event.requirements ? [event.requirements] : [],
    isActive: event.status.enum === "started",
    isSaved: event.isFavorite,
    joined: event.viewerParticipationStatus === "confirmed",
    duration: event.durationMinutes ? `${event.durationMinutes} dk` : undefined,
  }
}
const Context = createContext<{
  data: Data
  setData: React.Dispatch<React.SetStateAction<Data>>
  refreshEvents: () => Promise<void>
  resetSession: () => void
} | null>(null)
export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState(initial)
  const [storageError, setStorageError] = useState<string | null>(null)
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
      const all = [...new Map([...events.items, ...mine].map(event => [event.id, event])).values()]
      setData(current => ({ ...current, user: { ...updateStoreUser(EMPTY_USER, remote), interests: interests.map(i => i.name), recommendationProfile: preferences.recommendationProfile }, events: all.map(mapApiEvent) }))
      setStorageError(null)
    } catch (error) {
      if (generation === sessionGeneration.current) setStorageError('Hesap verileri sunucudan yüklenemedi. Bağlantını kontrol edip tekrar dene.')
      throw error
    }
  }
  useEffect(() => { void hasSession().then(active => { if (active) return refreshEvents() }).catch(() => {}) }, [])
  return <Context.Provider value={{ data, setData: setAccountData, refreshEvents, resetSession: () => { sessionGeneration.current++; setData(initial); setStorageError(null) } }}>
    {storageError && <ErrorNotice title="Veriler yüklenemedi" message={storageError} onDismiss={() => setStorageError(null)} onRetry={() => { setStorageError(null); void refreshEvents().catch(() => {}) }} />}
    {children}
  </Context.Provider>
}

export function useStore() {
  const store = useContext(Context)
  if (!store) throw new Error("StoreProvider missing")
  return store
}

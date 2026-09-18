import AsyncStorage from "@react-native-async-storage/async-storage"
import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react"
import { getEvents } from "../api/client"
import { ErrorNotice } from "../components/ErrorNotice"
import { EVENTS, ME } from "../data"
import type { AppEvent, AppUser, ChatMessage } from "../types"
interface Data {
  user: AppUser
  events: AppEvent[]
  messages: Record<string, ChatMessage[]>
  onboarding: Record<string, string>
}
const initial: Data = { user: ME, events: EVENTS, messages: {}, onboarding: {} }
export function updateStoreUser(user: Data["user"], remoteUser: unknown) {
  if (!remoteUser || typeof remoteUser !== "object") return user
  const remote = remoteUser as { id?: string; firstName?: string; lastName?: string }
  return {
    ...user,
    id: remote.id || user.id,
    name: `${remote.firstName || ""} ${remote.lastName || ""}`.trim() || user.name,
  }
}
function mapApiEvent(event: Awaited<ReturnType<typeof getEvents>>["items"][number]): AppEvent {
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
    location: "",
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
    duration: event.durationMinutes ? `${event.durationMinutes} dk` : undefined,
  }
}
const Context = createContext<{
  data: Data
  setData: React.Dispatch<React.SetStateAction<Data>>
  refreshEvents: () => Promise<void>
} | null>(null)
export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState(initial),
    [ready, setReady] = useState(false),
    [storageError, setStorageError] = useState<string | null>(null)
  const queue = useRef(Promise.resolve())
  const refreshEvents = async () => {
    const remoteEvents = await getEvents()
    if (remoteEvents.items.length > 0) {
      setData((current) => ({
        ...current,
        events: remoteEvents.items.map(mapApiEvent),
      }))
    }
  }
  useEffect(() => {
    AsyncStorage.getItem("event-app:v1")
      .then((value) => {
        if (value) {
          const saved = JSON.parse(value)
          if (saved.user?.id === "me" && Array.isArray(saved.events))
            setData({ ...initial, ...saved })
        }
      })
      .then(async () => {
        try {
          await refreshEvents()
        } catch {
          // Demo data remains available until the user signs in and the API is reachable.
        }
      })
      .catch(() => setStorageError("Uygulama örnek verilerle açılacak."))
      .finally(() => setReady(true))
  }, [])
  useEffect(() => {
    if (ready)
      queue.current = queue.current
        .then(() => AsyncStorage.setItem("event-app:v1", JSON.stringify(data)))
        .catch(() => setStorageError("Değişiklikler bu oturumda kullanılabilir."))
  }, [data, ready])
  if (!ready) return null
  return (
    <Context.Provider value={{ data, setData, refreshEvents }}>
      {storageError && (
        <ErrorNotice
          title="Yerel kayıt kullanılamadı"
          message={storageError}
          onDismiss={() => setStorageError(null)}
        />
      )}
      {children}
    </Context.Provider>
  )
}
export function useStore() {
  const store = useContext(Context)
  if (!store) throw new Error("StoreProvider missing")
  return store
}

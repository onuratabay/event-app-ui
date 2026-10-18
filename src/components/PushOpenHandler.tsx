import { useEffect, useRef } from "react"
import { getEvent } from "../api/client"
import { useNavigate } from "../native/navigation"
import { mapApiEvent, useStore } from "../native/Store"
import { onPushOpened } from "../services/push"

// Tapping a push about an event ("Sana uygun bir etkinlik oluşturuldu") opens that event's detail;
// a room message opens the room, a direct message the chat with its sender.
type Target = { eventId: string; screen: "event-detail" | "event-room" | "rate-event" }
export default function PushOpenHandler() {
  const { data, setData } = useStore()
  const navigate = useNavigate()
  const ready = !!data.user.id && data.user.status === "approved"
  const pending = useRef<Target | null>(null)
  const pendingChat = useRef<string | null>(null)
  const open = async ({ eventId, screen }: Target) => {
    // "Etkinlik tamamlandı" opens the rating page instead of the event detail.
    if (screen === "rate-event") { navigate("rate-event", { eventId }); return }
    try {
      const event = await getEvent(eventId)
      setData(store => ({ ...store, events: [mapApiEvent(event), ...store.events.filter(row => row.id !== event.id)] }))
      navigate(screen, { eventId: event.id })
    } catch { /* The event may be gone; the notification list still has it. */ }
  }
  useEffect(() => onPushOpened(payload => {
    // A direct message opens the chat with its sender.
    if (payload.type === "direct_message" && typeof payload.userId === "string") {
      const userId = payload.userId
      if (ready) navigate("direct-chat", { userId }); else pendingChat.current = userId
      return
    }
    const eventId = typeof payload.eventId === "string" ? payload.eventId : null
    if (!eventId) return
    const target: Target = { eventId, screen: payload.type === "event_rating" ? "rate-event" : payload.type === "message" || payload.type === "announcement" ? "event-room" : "event-detail" }
    // A push can open the app before the session is loaded; it is opened once the member is in.
    if (ready) void open(target); else pending.current = target
  }), [ready])
  useEffect(() => {
    if (!ready || !pendingChat.current) return
    const userId = pendingChat.current
    pendingChat.current = null
    navigate("direct-chat", { userId })
  }, [ready])
  useEffect(() => {
    if (!ready || !pending.current) return
    const target = pending.current
    pending.current = null
    void open(target)
  }, [ready])
  return null
}

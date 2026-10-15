import { useEffect, useRef } from "react"
import { getEvent } from "../api/client"
import { useNavigate } from "../native/navigation"
import { mapApiEvent, useStore } from "../native/Store"
import { onPushOpened } from "../services/push"

// Tapping a push about an event ("Sana uygun bir etkinlik oluşturuldu") opens that event's detail.
export default function PushOpenHandler() {
  const { data, setData } = useStore()
  const navigate = useNavigate()
  const ready = !!data.user.id && data.user.status === "approved"
  const pending = useRef<{ eventId: string; rating: boolean } | null>(null)
  const open = async ({ eventId, rating }: { eventId: string; rating: boolean }) => {
    // "Etkinlik tamamlandı" opens the rating page instead of the event detail.
    if (rating) { navigate("rate-event", { eventId }); return }
    try {
      const event = await getEvent(eventId)
      setData(store => ({ ...store, events: [mapApiEvent(event), ...store.events.filter(row => row.id !== event.id)] }))
      navigate("event-detail", { eventId: event.id })
    } catch { /* The event may be gone; the notification list still has it. */ }
  }
  useEffect(() => onPushOpened(payload => {
    const eventId = typeof payload.eventId === "string" ? payload.eventId : null
    if (!eventId) return
    const target = { eventId, rating: payload.type === "event_rating" }
    // A push can open the app before the session is loaded; it is opened once the member is in.
    if (ready) void open(target); else pending.current = target
  }), [ready])
  useEffect(() => {
    if (!ready || !pending.current) return
    const target = pending.current
    pending.current = null
    void open(target)
  }, [ready])
  return null
}

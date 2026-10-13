import { useLocalSearchParams } from "expo-router"
import { useNavigate } from "../src/native/navigation"
import Screen from "../src/screens/CreateEventScreen"
export default function Route() {
  const navigate = useNavigate()
  // `eventId`: a cancelled event of the organizer, used to prefill the form for creating it again.
  const { activity, eventId } = useLocalSearchParams<{ activity?: string; eventId?: string }>()
  return <Screen navigate={navigate} initialActivity={activity} copyFromEventId={eventId} />
}

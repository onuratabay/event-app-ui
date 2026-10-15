import { useLocalSearchParams } from "expo-router"
import { useNavigate } from "../src/native/navigation"
import Screen from "../src/screens/RateEventScreen"
export default function Route() {
  const navigate = useNavigate()
  const { eventId } = useLocalSearchParams<{ eventId?: string }>()
  return <Screen key={eventId || "none"} navigate={navigate} eventId={eventId || ""} />
}

import { useLocalSearchParams } from "expo-router"
import { useNavigate } from "../src/native/navigation"
import Screen from "../src/screens/CreateEventScreen"
export default function Route() {
  const navigate = useNavigate()
  const { activity } = useLocalSearchParams<{ activity?: string }>()
  return <Screen navigate={navigate} initialActivity={activity} />
}

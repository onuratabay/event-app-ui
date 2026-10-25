import { useNavigate } from "../src/native/navigation"
import Screen from "../src/screens/ProfileScreen"
import { useLocalSearchParams } from "expo-router"
export default function Route() {
  const navigate = useNavigate()
  const { userId } = useLocalSearchParams<{ userId?: string }>()
  return <Screen key={userId || "me"} navigate={navigate} userId={userId} />
}

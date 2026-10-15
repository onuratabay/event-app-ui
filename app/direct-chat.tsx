import { useLocalSearchParams } from "expo-router"
import { useNavigate } from "../src/native/navigation"
import Screen from "../src/screens/DirectChatScreen"
export default function Route() {
  const navigate = useNavigate()
  const { userId } = useLocalSearchParams<{ userId?: string }>()
  return <Screen key={userId || "none"} navigate={navigate} userId={userId || ""} />
}

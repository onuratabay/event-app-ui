import { useNavigate } from "../src/native/navigation"
import Screen from "../src/screens/ProfileScreen"
import { useLocalSearchParams } from "expo-router"
// Another member's profile: a page on top of history, opened with navigate("profile", { userId }).
export default function Route() {
  const navigate = useNavigate()
  const { userId } = useLocalSearchParams<{ userId?: string }>()
  return <Screen key={userId || "me"} navigate={navigate} userId={userId} />
}

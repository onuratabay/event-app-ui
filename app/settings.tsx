import { useNavigate } from "../src/native/navigation"
import SettingsScreen from "../src/screens/SettingsScreen"
export default function Route() {
  const navigate = useNavigate()
  return <SettingsScreen navigate={navigate} />
}

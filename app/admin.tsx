import { useNavigate } from "../src/native/navigation"
import Screen from "../src/screens/AdminScreen"
export default function Route() {
  const navigate = useNavigate()
  return <Screen navigate={navigate} />
}

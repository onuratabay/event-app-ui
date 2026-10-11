import { useNavigate } from "../src/native/navigation"
import Screen from "../src/screens/AvailabilityScreen"
export default function Route() {
  const navigate = useNavigate()
  return <Screen navigate={navigate} />
}

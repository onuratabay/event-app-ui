import { useNavigate } from "../src/native/navigation"
import LoginScreen from "../src/screens/LoginScreen"

export default function Route() {
  return <LoginScreen navigate={useNavigate()} />
}
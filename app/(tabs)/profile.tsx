import { useNavigate } from "../../src/native/navigation"
import Screen from "../../src/screens/ProfileScreen"
// The member's own profile (bottom-bar tab). Another member's profile opens as its own page: app/member.tsx.
export default function Route() {
  const navigate = useNavigate()
  return <Screen key="me" navigate={navigate} />
}

import { useNavigate } from "../src/native/navigation"
import PhoneVerifyScreen from "../src/screens/PhoneVerifyScreen"
export default function Route() { return <PhoneVerifyScreen navigate={useNavigate()} /> }

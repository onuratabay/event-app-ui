import { useNavigate } from "../src/native/navigation"
import ForgotPasswordScreen from "../src/screens/ForgotPasswordScreen"
export default function Route() { return <ForgotPasswordScreen navigate={useNavigate()} /> }

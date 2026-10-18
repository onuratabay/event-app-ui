import { useNavigate } from "../src/native/navigation"
import AppGuideScreen from "../src/screens/AppGuideScreen"
export default function Route() { return <AppGuideScreen navigate={useNavigate()} /> }

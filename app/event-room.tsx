import { useLocalSearchParams } from "expo-router"
import { useNavigate } from "../src/native/navigation"
import { Box, Label, Touch } from "../src/native/UI"
import Screen from "../src/screens/EventRoomScreen"
export default function Route() {
  const navigate = useNavigate()
  const { eventId } = useLocalSearchParams<{ eventId?: string }>()
  if (!eventId)
    return (
      <Box style={{ flex: 1, padding: 24, justifyContent: "center", gap: 20 }}>
        <Label>Etkinlik bulunamadı.</Label>
        <Touch onPress={() => navigate("discover")}>
          <Label>Keşfet’e dön</Label>
        </Touch>
      </Box>
    )
  // Access is decided by the backend (confirmed member, minimum reached, not cancelled);
  // the screen loads the event if needed and shows the closed-room state on a 403.
  return <Screen navigate={navigate} eventId={eventId} />
}

import { useLocalSearchParams } from "expo-router"
import { useNavigate } from "../src/native/navigation"
import { useStore } from "../src/native/Store"
import { Box, Label, Touch } from "../src/native/UI"
import Screen from "../src/screens/EventRoomScreen"
export default function Route() {
  const navigate = useNavigate()
  const { eventId } = useLocalSearchParams<{ eventId?: string }>()
  const { data } = useStore()
  if (!eventId || !data.events.some((e) => e.id === eventId))
    return (
      <Box style={{ flex: 1, padding: 24, justifyContent: "center", gap: 20 }}>
        <Label>Etkinlik bulunamadı.</Label>
        <Touch onPress={() => navigate("discover")}>
          <Label>Keşfet’e dön</Label>
        </Touch>
      </Box>
    )
  const event = data.events.find((e) => e.id === eventId)!
  if (
    !event.isActive ||
    !(event.host.id === "me" || event.participants.some((p) => p.id === "me"))
  )
    return (
      <Box style={{ flex: 1, padding: 24, justifyContent: "center", gap: 20 }}>
        <Label>Etkinlik aktif olduğunda ve katıldığında oda açılacak.</Label>
        <Touch onPress={() => navigate("event-detail", { eventId })}>
          <Label>Etkinliğe dön</Label>
        </Touch>
      </Box>
    )
  return <Screen navigate={navigate} eventId={eventId} />
}

import { palette } from "../src/theme/palette";
import { Link } from "expo-router"
import { Box, Label } from "../src/native/UI"
export default function NotFound() {
  return (
    <Box style={{ flex: 1, padding: 24, justifyContent: "center", gap: 20 }}>
      <Label>Sayfa bulunamadı.</Label>
      <Link href="/discover" style={{ color: palette.accent }}>
        Keşfet’e dön
      </Link>
    </Box>
  )
}

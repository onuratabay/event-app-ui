import { StyleSheet } from "react-native"
import { ME } from "../data"
import { Box, Label, Picture, Touch } from "../native/UI"
import type { NavigateFn, Screen } from "../types"
import { MessageIcon, SearchIcon } from "./Icons"
const nav: [Screen, string][] = [
  ["discover", "Keşfet"],
  ["search", "Ara"],
  ["create-event", "Oluştur"],
  ["rooms", "Odalar"],
  ["profile", "Profil"],
]
export default function BottomNav({
  active,
  navigate,
}: {
  active: Screen
  navigate: NavigateFn
}) {
  return (
    <Box pointerEvents="box-none" style={s.frame}>
      <Box glass style={s.bar}>
        {nav.map(([screen, label]) => (
          <Touch
            key={screen}
            accessibilityLabel={label}
            accessibilityState={{ selected: active === screen }}
            onPress={() => navigate(screen)}
            gradient={
              screen === "create-event"
                ? ["#c8a44a", "#dab96e", "#c09038"]
                : undefined
            }
            style={[
              s.item,
              active === screen && { backgroundColor: "rgba(255,255,255,.1)" },
              screen === "create-event" && {
                backgroundColor: "#c8a44a",
                flex: 0,
                width: 52,
              },
            ]}
          >
            {screen === "search" ? (
              <SearchIcon
                size={20}
                style={{ color: active === screen ? "#c8a44a" : "#777582" }}
              />
            ) : screen === "rooms" ? (
              <MessageIcon
                size={20}
                style={{ color: active === screen ? "#c8a44a" : "#777582" }}
              />
            ) : screen === "profile" ? (
              <Picture
                uri={ME.avatar}
                style={{ width: 24, height: 24, borderRadius: 12 }}
              />
            ) : (
              <Label
                style={{
                  fontSize: screen === "create-event" ? 28 : 23,
                  color:
                    screen === "create-event"
                      ? "#1a1200"
                      : active === screen
                        ? "#c8a44a"
                        : "#777582",
                }}
              >
                {screen === "create-event" ? "+" : "◈"}
              </Label>
            )}
            {screen !== "create-event" && (
              <Label
                style={{
                  fontSize: 10,
                  color: active === screen ? "#c8a44a" : "#777582",
                }}
              >
                {label}
              </Label>
            )}
          </Touch>
        ))}
      </Box>
    </Box>
  )
}
const s = StyleSheet.create({
  frame: {
    position: "absolute",
    bottom: 8,
    left: 16,
    right: 16,
    alignItems: "center",
  },
  bar: {
    width: "100%",
    maxWidth: 420,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    padding: 8,
    borderRadius: 28,
    backgroundColor: "rgba(6,6,18,.9)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.1)",
  },
  item: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    borderRadius: 16,
    minHeight: 48,
  },
})

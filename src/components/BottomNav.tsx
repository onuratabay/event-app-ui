import { palette } from "../theme/palette";
import { StyleSheet } from "react-native"
import { useStore } from "../native/Store"
import { Box, Label, Picture, Touch } from "../native/UI"
import type { NavigateFn, Screen } from "../types"
import { MessageIcon, LocationIcon, CompassIcon, PlusIcon } from "./Icons"
const nav: [Screen, string][] = [
  ["discover", "Keşfet"],
  ["map", "Harita"],
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
  const { data } = useStore()
  const ME = data.user
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
                ? palette.actionGradient
                : undefined
            }
            style={[
              s.item,
              active === screen && { backgroundColor: "rgba(185,195,255,.12)", borderColor: "rgba(185,195,255,.20)" },
              screen === "create-event" && {
                backgroundColor: "#4d5bcb",
                flex: 0,
                width: 52,
              },
            ]}
          >
            {screen === "map" ? (
              <LocationIcon
                size={22}
                strokeWidth={1.75}
                style={{ color: active === screen ? palette.accent : palette.muted }}
              />
            ) : screen === "rooms" ? (
              <MessageIcon
                size={22}
                strokeWidth={1.75}
                style={{ color: active === screen ? palette.accent : palette.muted }}
              />
            ) : screen === "profile" ? (
              <Picture
                uri={ME.avatar}
                style={{ width: 24, height: 24, borderRadius: 12 }}
              />
            ) : (
              screen === "create-event" ? <PlusIcon size={22} strokeWidth={1.75} style={{ color: palette.text }} /> : <CompassIcon size={22} strokeWidth={1.75} style={{ color: active === screen ? "#c7ceff" : palette.muted }} />
            )}
            {screen !== "create-event" && (
              <Label
                style={{
                  fontSize: 11,
                  fontFamily: "Outfit-Medium",
                  color: active === screen ? "#c7ceff" : palette.muted,
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
    borderRadius: 24,
    backgroundColor: "rgba(11,16,32,.94)",
    borderWidth: 1,
    borderColor: "rgba(183,197,255,.12)",
    boxShadow: "0px 10px 22px rgba(0,0,0,.28)",
  },
  item: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    borderRadius: 16,
    minHeight: 48,
    borderWidth: 1,
    borderColor: "transparent",
  },
})

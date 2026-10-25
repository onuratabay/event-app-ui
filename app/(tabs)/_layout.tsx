import { Tabs } from "expo-router"
import { palette } from "../../src/theme/palette"

/**
 * The bottom-bar pages (Keşfet, Harita, Odalar, own Profil) as real tabs: each is built once, on its first visit,
 * and switching only shows another one. Pushing a new page for every tap rebuilt the feed, the map and the room
 * list each time and made switching stutter. The app's own bar (AppBottomNav) is drawn by the root layout, so
 * the built-in tab bar is hidden; back returns to the tab visited before, like the pages above it.
 */
export default function TabsLayout() {
  return <Tabs
    backBehavior="history"
    tabBar={() => null}
    screenOptions={{
      headerShown: false,
      sceneStyle: { backgroundColor: palette.background },
      animation: "fade",
      // Tabs out of sight do not re-render on every store/socket update until shown again.
      freezeOnBlur: true,
    }}
  >
    <Tabs.Screen name="discover" />
    <Tabs.Screen name="map" />
    <Tabs.Screen name="rooms" />
    <Tabs.Screen name="profile" />
  </Tabs>
}

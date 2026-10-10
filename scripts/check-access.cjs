// Pending accounts are routed to their own page and never reach in-app screens.
module.exports = async function ({ mount, tap, act, text, storage }) {
  const assert = require("node:assert/strict")
  const React = require("react")
  const { create } = require("react-test-renderer")
  const { gatedScreen } = require("../src/native/access.ts")
  assert.equal(gatedScreen("approved"), null)
  assert.equal(gatedScreen(undefined), null, "Unknown status waits for the account to load")
  assert.equal(gatedScreen("profile_incomplete"), "interests")
  assert.equal(gatedScreen("reference_pending"), "onboarding-3")
  assert.equal(gatedScreen("security_review"), "onboarding-3")

  const oldFetch = global.fetch
  const user = status => ({ id: "pending-user", firstName: "Bekleyen", lastName: "Üye", status: { enum: status } })
  let current = "reference_pending"
  const calls = []
  global.fetch = async (url, options = {}) => {
    const path = new URL(url).pathname
    calls.push(path)
    const body = path === "/auth/login" ? { user: user(current), tokens: { accessToken: "a", refreshToken: "r" } }
      : path === "/auth/me" ? user(current)
      : path === "/users/me/interests" || path === "/interests" ? []
      : path === "/users/me/preferences" ? {}
      : { items: [], total: 0 }
    return { ok: true, status: 200, json: async () => body }
  }

  // Login sends each pending status to its own page and never loads the feed.
  for (const [status, expected] of [["reference_pending", "onboarding-3"], ["profile_incomplete", "interests"], ["approved", "discover"]]) {
    storage.clear(); current = status; calls.length = 0
    let destination, options
    const login = await mount("Login", { navigate: (route, opts) => { destination = route; options = opts } })
    const [email, password] = login.root.findAllByType("TextInput")
    await act(async () => email.props.onChangeText("bekleyen@example.com"))
    await act(async () => password.props.onChangeText("Password1!"))
    await tap(login, "Giriş Yap")
    assert.equal(destination, expected, `${status} logs in to ${expected}`)
    assert.equal(options?.reset, true, "Signing in clears history so back cannot return to login")
    if (status !== "approved") assert(!calls.includes("/events"), `${status} never loads the in-app feed`)
    await act(async () => login.unmount())
  }

  // A reset navigation dismisses the whole stack before replacing it.
  const { useNavigate } = require("../src/native/navigation.ts")
  global.__testNavigations = []
  let go
  function Probe() { go = useNavigate(); return null }
  let probe
  await act(async () => { probe = create(React.createElement(Probe)) })
  go("discover", { reset: true })
  assert.deepEqual(global.__testNavigations, ["dismissAll", "/discover"], "Reset clears history, then shows the target")
  global.__testNavigations = []
  go("event-detail", { eventId: "x" })
  assert.deepEqual(global.__testNavigations, ["/event-detail"], "Normal navigation keeps history")
  await act(async () => probe.unmount())

  // Back: allowed pages pop normally; sign-in pages and a finished creation flow are skipped for home.
  const backFrom = async (routes, opts = { back: true }) => {
    global.__testRootState = { index: routes.length - 1, routes: routes.map(name => ({ name })) }
    global.__testNavigations = []
    await act(async () => { probe = create(React.createElement(Probe)) })
    go("discover", opts)
    await act(async () => probe.unmount())
    return global.__testNavigations
  }
  assert.deepEqual(await backFrom(["discover", "event-detail"]), ["back"], "Back returns to a normal previous page")
  assert.deepEqual(await backFrom(["create-event", "event-detail"]), ["dismissAll", "/discover"], "Back never returns to the event-creation flow")
  assert.deepEqual(await backFrom(["login", "discover", "search"].slice(0, 2).concat("search")), ["back"])
  assert.deepEqual(await backFrom(["login", "search"]), ["dismissAll", "/discover"], "Back never returns to login")
  assert.deepEqual(await backFrom(["search"]), ["/discover"], "With nowhere to go, back lands on home")
  global.__testRootState = undefined
  global.__testNavigations = []
  await act(async () => { probe = create(React.createElement(Probe)) })
  go("event-detail", { eventId: "new", aboveHome: true })
  assert.deepEqual(global.__testNavigations, ["dismissAll", "/discover", "/event-detail"], "Created event detail sits directly above home")
  await act(async () => probe.unmount())

  // Android back follows the same rules and goes home instead of closing the app.
  if (require("react-native").Platform.OS === "android") {
    const HardwareBack = require("../src/components/HardwareBack.tsx").default
    const press = async (pathname, routes) => {
      global.__testPathname = pathname
      global.__testRootState = { index: routes.length - 1, routes: routes.map(name => ({ name })) }
      global.__testNavigations = []
      let tree
      await act(async () => { tree = create(React.createElement(HardwareBack)) })
      const handled = global.__testBackHandler()
      await act(async () => tree.unmount())
      return { handled, navigations: global.__testNavigations }
    }
    assert.deepEqual(await press("/search", ["search"]), { handled: true, navigations: ["dismissAll", "/discover"] }, "Nowhere to go: Android back opens home")
    assert.deepEqual(await press("/event-detail", ["create-event", "event-detail"]), { handled: true, navigations: ["dismissAll", "/discover"] }, "Android back skips the creation flow")
    assert.deepEqual(await press("/event-detail", ["discover", "event-detail"]), { handled: false, navigations: [] }, "Normal pages pop natively")
    assert.equal((await press("/discover", ["discover"])).handled, false, "Home itself lets Android close the app")
    global.__testPathname = undefined
    global.__testRootState = undefined
  }

  // Saved sessions resolve the same way on startup.
  storage.set("event-app:access-token", "a"); current = "profile_incomplete"
  let splashRoute
  const splash = await mount("Splash", { navigate: route => { splashRoute = route } })
  await act(() => new Promise(resolve => setTimeout(resolve, 2900)))
  assert.equal(splashRoute, "interests")
  await act(async () => splash.unmount())

  // The global guard bounces a pending account off any in-app route, but not off its own page.
  const { StoreProvider } = require("../src/native/Store.tsx")
  const AccessGuard = require("../src/components/AccessGuard.tsx").default
  current = "reference_pending"
  for (const [pathname, bounced] of [["/discover", true], ["/event-detail", true], ["/approval", true], ["/onboarding-3", false], ["/onboarding-2", false]]) {
    global.__testPathname = pathname
    global.__testNavigations = []
    let guard
    await act(async () => { guard = create(React.createElement(StoreProvider, null, React.createElement(AccessGuard))) })
    await act(() => new Promise(resolve => setTimeout(resolve, 50)))
    assert.equal(global.__testNavigations.includes("/onboarding-3"), bounced, `${pathname} ${bounced ? "bounces" : "stays"} for reference_pending`)
    await act(async () => guard.unmount())
  }
  global.__testPathname = undefined
  global.__testNavigations = undefined
  storage.clear()
  global.fetch = oldFetch
  console.log("PASS: pending accounts route to profile completion / reference wait and never enter the app.")
}

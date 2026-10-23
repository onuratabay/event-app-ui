module.exports = async function ({ mount, tap, act, text, storage }) {
  const assert = require("node:assert/strict")
  const waitForSplash = () => new Promise(resolve => setTimeout(resolve, 2900))
  const api = require("../src/api/client.ts")
  const oldFetch = global.fetch
  const ok = body => ({ ok: true, status: 200, json: async () => body })
  const unauthorized = () => ({ ok: false, status: 401, text: async () => '{"errors":[{"message":"Expired"}]}' })
  storage.clear()
  global.fetch = oldFetch
  let route
  let tree = await mount("Splash", { navigate: next => { route = next } })
  await act(waitForSplash)
  assert.equal(route, "welcome")
  await act(async () => tree.unmount())
  storage.set("event-app.access-token", "old-access")
  storage.set("event-app.refresh-token", "refresh")
  tree = await mount("Splash", { navigate: next => { route = next } })
  await act(waitForSplash)
  assert.equal(route, "discover")
  await act(async () => tree.unmount())
  {
    // Discover opens with its feed ready: the splash waits for a slow /events instead of opening an empty list.
    let releaseFeed
    const feedGate = new Promise(resolve => { releaseFeed = resolve })
    global.fetch = async (url, options) => {
      if (new URL(url).pathname === "/events") await feedGate
      return oldFetch(url, options)
    }
    route = undefined
    tree = await mount("Splash", { navigate: next => { route = next } })
    await act(waitForSplash)
    assert.equal(route, undefined, "The splash keeps waiting while the feed is still loading")
    await act(async () => { releaseFeed(); await new Promise(resolve => setTimeout(resolve, 50)) })
    assert.equal(route, "discover", "Discover opens once the feed has arrived")
    await act(async () => tree.unmount())
    // Discover itself shows a loader, not the empty state, until the first feed page arrives.
    let releaseLate
    const lateGate = new Promise(resolve => { releaseLate = resolve })
    global.fetch = async (url, options) => {
      if (new URL(url).pathname === "/events") await lateGate
      return oldFetch(url, options)
    }
    tree = await mount("Discover")
    await act(() => new Promise(resolve => setTimeout(resolve, 50)))
    assert(!text(tree.toJSON()).includes("Sahne boş"), "No empty state while the feed is loading")
    await act(async () => { releaseLate(); await new Promise(resolve => setTimeout(resolve, 50)) })
    await act(async () => tree.unmount())
    global.fetch = oldFetch
  }
  {
    // Startup: only the event list matters. The personal lists may still be loading (no global loader)
    // when Discover opens; the list comes without covers and the covers follow in the background.
    const { apiLoading } = require("../src/api/loading.ts")
    let pending = 0
    const unsubscribe = apiLoading.subscribe(count => { pending = count })
    let releaseMine
    const mineGate = new Promise(resolve => { releaseMine = resolve })
    global.fetch = async (url, options) => {
      const parsed = new URL(url)
      if (parsed.pathname === "/events/mine") await mineGate
      const response = await oldFetch(url, options)
      if (parsed.pathname !== "/events" || parsed.searchParams.get("includePhotos") === "false") return response
      const body = await response.json()
      return { ...response, json: async () => ({ ...body, items: body.items.map(item => ({ ...item, coverPhoto: "data:image/png;base64,REALCOVER" })) }) }
    }
    route = undefined
    tree = await mount("Splash", { navigate: next => { route = next } })
    await act(waitForSplash)
    assert.equal(route, "discover", "Discover opens without waiting for the personal lists")
    assert.equal(pending, 0, "No global loader while the personal lists keep loading")
    await act(async () => tree.unmount())
    const home = await mount("Discover")
    await act(() => new Promise(resolve => setTimeout(resolve, 80)))
    assert(home.root.findAll(n => n.props.uri === "data:image/png;base64,REALCOVER").length > 0, "Covers replace the placeholders once they arrive")
    await act(async () => { releaseMine(); await new Promise(resolve => setTimeout(resolve, 30)) })
    await act(async () => home.unmount())
    unsubscribe()
    global.fetch = oldFetch
  }
  {
    // Reported: "Burak · Tuğçe · Sen/Katıldın" with 2 participants. While the slow personal lists load,
    // the signed-in user must already be known, so they appear once (as "Sen"), never also by name.
    storage.set("event-app.access-token", "duo-test")
    let releaseMine
    const mineGate = new Promise(resolve => { releaseMine = resolve })
    const duo = { id: "duo-1", owner: { id: "host", firstName: "Burak", lastName: "D" }, interest: { id: "padel", slug: "padel", name: "Padel" }, level: null, date: "01/10/2030", startTime: "18:30", durationMinutes: 60, latitude: 39.9, longitude: 32.8, locationName: "Kort", minParticipants: 2, maxParticipants: 100000, confirmedParticipantCount: 2, participants: [{ id: "host", firstName: "Burak", lastName: "D", profilePhoto: null }, { id: "tugce", firstName: "Tuğçe", lastName: "Y", profilePhoto: null }], coverPhoto: null, description: "", requirements: null, status: { enum: "waiting_participants" }, isFavorite: false, viewerParticipationStatus: "confirmed" }
    global.fetch = async (url, options) => {
      const path = new URL(url).pathname
      if (path === "/auth/me") return ok({ id: "tugce", firstName: "Tuğçe", lastName: "Y", status: { enum: "approved" } })
      if (path === "/events/mine") await mineGate
      if (path === "/events/duo-1") return ok(duo)
      return oldFetch(url, options)
    }
    api.clearSessionCache?.()
    const detail = await mount("EventDetail", { eventId: "duo-1" })
    await act(() => new Promise(resolve => setTimeout(resolve, 80)))
    const shown = text(detail.toJSON()).replace(/\s+/g, " ")
    assert(shown.includes("Burak") && shown.includes("Katıldın"), "The other participant and my own badge are shown")
    assert(!shown.includes("Tuğçe"), "I am not listed by name next to my own badge")
    await act(async () => { releaseMine(); await new Promise(resolve => setTimeout(resolve, 20)) })
    await act(async () => detail.unmount())
    global.fetch = oldFetch
  }
  for (const name of ["Login", "Welcome"]) {
    route = undefined
    tree = await mount(name, { navigate: next => { route = next } })
    assert.equal(route, "discover")
    assert(!text(tree.toJSON()).includes("Şifremi unuttum"), "Signed-in users must not see auth screens")
    await act(async () => tree.unmount())
  }
  let refreshCount = 0
  global.fetch = async (url, options) => {
    if (url.endsWith("/auth/refresh")) {
      refreshCount++
      assert.equal(JSON.parse(options.body).refreshToken, "refresh")
      return ok({ accessToken: "new-access", refreshToken: "new-refresh" })
    }
    return options.headers.Authorization === "Bearer new-access" ? ok({ items: [], total: 0 }) : unauthorized()
  }
  await Promise.all([api.getEvents(), api.getEvents()])
  assert.equal(refreshCount, 1, "Concurrent 401s share a refresh")
  assert.equal(storage.get("event-app.access-token"), "new-access")
  // A refresh completing after explicit logout must not recreate the session.
  let releaseRefresh, startedRefresh
  const started = new Promise(resolve => { startedRefresh = resolve })
  global.fetch = async url => {
    if (url.endsWith("/auth/refresh")) {
      startedRefresh()
      return new Promise(resolve => { releaseRefresh = () => resolve(ok({ accessToken: "late-access", refreshToken: "late-refresh" })) })
    }
    return unauthorized()
  }
  const pending = api.getEvents().catch(() => null)
  await started
  await api.logout()
  releaseRefresh()
  await pending
  assert.equal(await api.hasSession(), false)
  global.fetch = oldFetch
  tree = await mount("Splash", { navigate: next => { route = next } })
  await act(waitForSplash)
  assert.equal(route, "welcome")
  await act(async () => tree.unmount())
  tree = await mount("Discover", { navigate: next => { route = next } })
  const search = tree.root.findAllByType("Pressable").filter(node => node.props.accessibilityLabel === "Ara")
  assert.equal(search.length, 1, "Only the header has the search action")
  await act(async () => search[0].props.onPress())
  assert.equal(route, "search")
  await act(async () => tree.unmount())
  // The bar lives in the root layout: shown on app screens, hidden on sign-in/onboarding routes.
  const React = require("react")
  const { create } = require("react-test-renderer")
  const { StoreProvider } = require("../src/native/Store.tsx")
  const BottomNav = require("../src/components/BottomNav.tsx").default
  const AppBottomNav = require("../src/components/AppBottomNav.tsx").default
  let nav
  await act(async () => { nav = create(React.createElement(StoreProvider, null, React.createElement(BottomNav, { active: "discover", navigate: next => { route = next } }))) })
  await tap(nav, "Harita")
  assert.equal(route, "map")
  await act(async () => nav.unmount())
  for (const [pathname, shown] of [["/event-detail", true], ["/search", true], ["/notifications", true], ["/event-room", true], ["/login", false], ["/onboarding-2", false], ["/", false]]) {
    global.__testPathname = pathname
    await act(async () => { nav = create(React.createElement(StoreProvider, null, React.createElement(AppBottomNav))) })
    assert.equal(text(nav.toJSON()).includes("Keşfet"), shown, `Bottom bar on ${pathname} should be ${shown ? "shown" : "hidden"}`)
    await act(async () => nav.unmount())
  }
  global.__testPathname = undefined
  storage.clear()
  global.fetch = oldFetch
  console.log("PASS: saved-session startup, hidden auth screens, refresh single-flight, logout race and navigation placement.")
}

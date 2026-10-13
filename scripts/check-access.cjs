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
  const user = status => ({ id: "pending-user", firstName: "Bekleyen", lastName: "Üye", status: { enum: status }, profilePhoto: global.__testProfilePhoto || null })
  let current = "reference_pending"
  const calls = []
  const urls = []
  const bodies = []
  global.fetch = async (url, options = {}) => {
    const path = new URL(url).pathname
    calls.push(path)
    urls.push(url)
    if (options.body) bodies.push({ path, body: JSON.parse(options.body) })
    const body = path === "/auth/login" || path === "/auth/register" ? { user: user(current), tokens: { accessToken: "a", refreshToken: "r" } }
      : path === "/auth/me" ? user(current)
      : path === "/users/me/profile/complete" ? (current = "approved", user(current))
      : path === "/interests" ? [{ id: "padel", name: "Padel", slug: "padel", levels: [] }]
      : path === "/users/me/interests" ? (options.body ? [{ id: "padel", name: "Padel" }] : [])
      : path === "/users/me/preferences" ? {}
      : path === "/legal/documents" ? { items: [{ type: "terms", version: 1, required: true }, { type: "privacy", version: 1, required: true }, { type: "marketing", version: 3, required: false }] }
      : path === "/users/me/profile" ? { ...user(current), ...JSON.parse(options.body || "{}") }
      : path === "/events/participating" && global.__testJoinedEvent ? { items: [global.__testJoinedEvent], total: 1 }
      : path === "/events" && global.__testFeedEvents ? { items: global.__testFeedEvents, total: global.__testFeedEvents.length }
      : path === "/events" && new URL(url).searchParams.get("dateFrom") && global.__testDateEvents ? { items: global.__testDateEvents, total: global.__testDateEvents.length }
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

  // Registration: a profile_incomplete account goes straight to photo + interests.
  storage.clear(); current = "profile_incomplete"
  let registered
  const registration = await mount("Onboarding", { step: 1, navigate: route => { registered = route } })
  const inputs = registration.root.findAllByType("TextInput")
  for (const [index, value] of ["Ada", "Yeni", "ada@example.com", "+90 532 000 00 00", "Password1!"].entries()) await act(async () => inputs[index].props.onChangeText(value))
  await act(async () => registration.root.findAll(n => n.props.mode === "date" && typeof n.props.onChangeText === "function")[0].props.onChangeText("1995-06-15"))
  await act(async () => registration.root.findAllByType("Pressable").find(n => String(n.props.accessibilityLabel).startsWith("Şehir:")).props.onPress())
  await act(async () => registration.root.findAllByType("Pressable").find(n => n.props.accessibilityState && "selected" in n.props.accessibilityState && text(n).includes("Ankara")).props.onPress())
  await tap(registration, "Topluluk Kuralları")
  await tap(registration, "KVKK Aydınlatma Metni")
  await tap(registration, "ticari elektronik ileti")
  await tap(registration, "Devam Et")
  assert.equal(registered, "interests", "profile_incomplete registration opens profile completion")
  const signUp = bodies.find(row => row.path === "/auth/register").body
  assert.deepEqual(signUp.acceptedDocuments, [{ type: "terms", version: 1 }, { type: "privacy", version: 1 }, { type: "marketing", version: 3 }], "Opting in records the marketing text version too")
  assert.equal(signUp.marketingConsent, true)
  await act(async () => registration.unmount())

  // Profile completion: an interest is required, the photo is not; saving approves and opens the app.
  storage.set("event-app:access-token", "a"); current = "profile_incomplete"; calls.length = 0
  let completed
  const profile = await mount("Interests", { navigate: (route, opts) => { completed = { route, opts } } })
  await act(() => new Promise(resolve => setTimeout(resolve, 50)))
  const finish = () => profile.root.findAllByType("Pressable").find(n => text(n).includes("Kurulumu Tamamla"))
  assert.equal(finish().props.disabled, true, "Interests are required before finishing")
  await tap(profile, "Padel")
  assert.equal(finish().props.disabled, false, "One interest is enough; the photo is optional")
  await tap(profile, "Kurulumu Tamamla")
  await act(() => new Promise(resolve => setTimeout(resolve, 20)))
  assert(calls.includes("/users/me/profile/complete"), "Saving asks the server to approve the completed profile")
  assert.equal(current, "approved")
  assert.deepEqual(completed, { route: "discover", opts: { reset: true } }, "Approved account enters the app with a clean history")
  await act(async () => profile.unmount())

  // With a photo, "Değiştir" lines up with the texts beside the photo instead of being centred.
  storage.set("event-app:access-token", "a"); current = "profile_incomplete"; global.__testProfilePhoto = "data:image/png;base64,iVBORw0KGgo="
  const withPhoto = await mount("Interests")
  await act(() => new Promise(resolve => setTimeout(resolve, 50)))
  const change = withPhoto.root.findAllByType("Pressable").find(n => n.props.accessibilityLabel === "Fotoğrafı değiştir")
  assert(change, "With a photo the change button is shown")
  const changeStyle = Object.assign({}, ...[].concat(change.props.style).filter(Boolean))
  assert.equal(changeStyle.alignSelf, "flex-start", "Değiştir is left-aligned with the texts above it")
  assert.equal(changeStyle.minHeight, 0, "Değiştir does not stretch the text block taller than the photo")
  await act(async () => withPhoto.unmount())
  global.__testProfilePhoto = undefined

  // Session cache: rarely changing data is fetched once; account data stays fresh.
  {
    const api = require("../src/api/client.ts")
    api.clearSessionCache()
    storage.set("event-app:access-token", "a"); current = "approved"; calls.length = 0
    const count = path => calls.filter(item => item === path).length
    await Promise.all([api.getMapInterests(), api.getMapInterests()])
    await api.getMapInterests()
    assert.equal(count("/interests"), 1, "Interest catalog is fetched once and reused")
    await api.getEnums("event_visibility"); await api.getEnums("event_visibility")
    assert.equal(count("/enum-values"), 1, "Option lists are fetched once per group")
    await Promise.all([api.getCurrentUser(), api.getCurrentUser()])
    assert.equal(count("/auth/me"), 1, "Simultaneous account requests share one call")
    await api.getCurrentUser()
    assert.equal(count("/auth/me"), 2, "A later account request fetches fresh data")
    await api.getUserSettings(); await api.getUserSettings()
    assert.equal(count("/users/me/settings"), 1, "Account settings are cached")
    await api.logout()
    storage.set("event-app:access-token", "a")
    await api.getUserSettings()
    assert.equal(count("/users/me/settings"), 2, "Signing out drops the account's cached settings")
    await api.getMapInterests()
    assert.equal(count("/interests"), 1, "The shared catalog survives sign-out")
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
  // Profile: the city is changed with the same select and saved to the account.
  storage.set("event-app:access-token", "a"); current = "approved"; bodies.length = 0
  const ownProfile = await mount("Profile")
  await act(() => new Promise(resolve => setTimeout(resolve, 50)))
  const profileCity = ownProfile.root.findAllByType("Pressable").find(n => String(n.props.accessibilityLabel).startsWith("Şehir:"))
  assert(profileCity, "Profile shows the city select")
  await act(async () => profileCity.props.onPress())
  await act(async () => ownProfile.root.findAllByType("Pressable").find(n => n.props.accessibilityState && "selected" in n.props.accessibilityState && text(n).trim() === "Bursa").props.onPress())
  await act(() => new Promise(resolve => setTimeout(resolve, 20)))
  assert(bodies.some(row => row.path === "/users/me/profile" && row.body.city === "Bursa"), "Choosing a city saves it to the profile")
  const nameField = ownProfile.root.findAllByType("Pressable").find(n => n.props.accessibilityLabel === "Düzenle")
  assert.equal([].concat(nameField.props.style).reduce((value, part) => part?.justifyContent ?? value, undefined), "flex-start", "The name starts at the same left edge as the city")
  // Instagram: an empty handle invites adding one; the saved handle is sent without "@".
  assert(text(ownProfile.toJSON()).includes("@ kullanıcı adını ekle"), "Empty Instagram handle shows an add prompt")
  await act(async () => ownProfile.root.findAllByType("Pressable").find(n => n.props.accessibilityLabel === "Instagram kullanıcı adı ekle").props.onPress())
  await act(async () => ownProfile.root.findAllByType("TextInput").find(n => n.props.accessibilityLabel === "Instagram kullanıcı adı").props.onChangeText("@ada_yeni"))
  await act(async () => ownProfile.root.findAllByType("Pressable").filter(n => text(n).trim() === "Kaydet").pop().props.onPress())
  await act(() => new Promise(resolve => setTimeout(resolve, 20)))
  assert(bodies.some(row => row.path === "/users/me/profile" && row.body.instagramUsername === "ada_yeni"), "Instagram handle is saved without the @")
  assert(text(ownProfile.toJSON()).includes("@ada_yeni"), "Saved handle is shown after the @")
  const instagramLink = ownProfile.root.findAllByType("Pressable").find(n => n.props.accessibilityLabel === "Instagram profilini aç: @ada_yeni")
  assert(instagramLink, "A saved handle becomes a link to Instagram")
  assert(!ownProfile.root.findAllByType("Pressable").some(n => /düzenle|ekle/i.test(String(n.props.accessibilityLabel)) && String(n.props.accessibilityLabel).includes("Instagram")), "A saved handle cannot be edited")
  global.__openedUrl = undefined
  await act(async () => instagramLink.props.onPress())
  await act(() => new Promise(resolve => setTimeout(resolve, 10)))
  assert.equal(global.__openedUrl, "https://instagram.com/ada_yeni", "Tapping the handle opens the Instagram profile")
  // About me: an empty bio invites writing; the text is saved as bio and shown to others.
  assert(text(ownProfile.toJSON()).includes("Benimle Tanışmadan Önce Bil"), "Profile has the About me section")
  await act(async () => ownProfile.root.findAllByType("Pressable").find(n => n.props.accessibilityLabel === "Hakkımda yazısı ekle").props.onPress())
  await act(async () => ownProfile.root.findAllByType("TextInput").find(n => n.props.accessibilityLabel === "Hakkımda").props.onChangeText("Pazar kahvaltısı uzmanıyım."))
  // Quick emoji row adds an emoji in one tap (keyboards often hide the emoji key).
  await act(async () => ownProfile.root.findAllByType("Pressable").find(n => n.props.accessibilityLabel === "☕ ekle").props.onPress())
  await act(async () => ownProfile.root.findAllByType("Pressable").filter(n => text(n).trim() === "Kaydet").pop().props.onPress())
  await act(() => new Promise(resolve => setTimeout(resolve, 20)))
  assert(bodies.some(row => row.path === "/users/me/profile" && row.body.bio === "Pazar kahvaltısı uzmanıyım.☕"), "About me (with emoji) is saved to the bio field")
  assert(text(ownProfile.toJSON()).includes("Pazar kahvaltısı uzmanıyım.☕"), "Saved About me text is shown")
  assert(!ownProfile.root.findAllByType("Pressable").some(n => text(n).trim() === "Düzenle"), "No separate edit button")
  await act(async () => ownProfile.root.findAllByType("Pressable").find(n => n.props.accessibilityLabel === "Hakkımda yazısını düzenle").props.onPress())
  assert.equal(ownProfile.root.findAllByType("TextInput").find(n => n.props.accessibilityLabel === "Hakkımda").props.value, "Pazar kahvaltısı uzmanıyım.☕", "Tapping the text opens it for editing")
  await act(async () => ownProfile.unmount())

  // Discover lists only feed events; a joined event that is not in the feed shows up in Rooms instead.
  global.__testJoinedEvent = { id: "joined-only", owner: { id: "host", firstName: "Ev", lastName: "Sahibi" }, interest: { id: "kahve", slug: "kahve", name: "Kahve" }, level: null, date: "01/12/2030", startTime: "10:00", durationMinutes: 60, locationName: "Kadıköy", latitude: 41, longitude: 29, minParticipants: 3, maxParticipants: 6, coverPhoto: null, description: "Sadece katıldığım", requirements: null, confirmedParticipantCount: 2, participants: [], isFavorite: false, status: { enum: "waiting_participants", name: "Katılımcı bekleniyor" }, viewerParticipationStatus: "confirmed" }
  storage.set("event-app:access-token", "a"); current = "approved"
  const feedOnly = await mount("Discover")
  await act(() => new Promise(resolve => setTimeout(resolve, 50)))
  assert(!text(feedOnly.toJSON()).includes("Kadıköy"), "Discover does not show events that only come from the personal lists")
  await act(async () => feedOnly.unmount())
  const joinedRooms = await mount("Rooms")
  await act(() => new Promise(resolve => setTimeout(resolve, 50)))
  assert(text(joinedRooms.toJSON()).includes("Kahve · 01/12/2030"), "Rooms lists the joined event")
  await act(async () => joinedRooms.unmount())
  global.__testJoinedEvent = undefined

  // Feed cards: "X kişi daha" only while below the minimum, never negative.
  const feedEvent = (id, name, location, confirmed, min) => ({ ...cardBase, id, interest: { id: name, slug: name, name }, locationName: location, confirmedParticipantCount: confirmed, minParticipants: min, viewerParticipationStatus: null })
  const cardBase = { id: "x", owner: { id: "host", firstName: "Ev", lastName: "Sahibi" }, level: null, date: "22/10/2030", startTime: "20:30", durationMinutes: 120, latitude: 41, longitude: 29, maxParticipants: 8, coverPhoto: null, description: "Kart testi", requirements: null, participants: [], isFavorite: false, status: { enum: "waiting_participants", name: "Katılımcı bekleniyor" } }
  global.__testFeedEvents = [feedEvent("full", "Film", "Sinema", 3, 2)]
  let cards = await mount("Discover")
  await act(() => new Promise(resolve => setTimeout(resolve, 50)))
  assert(text(cards.toJSON()).includes("Sinema") && !text(cards.toJSON()).includes("kişi daha"), "A card past its minimum shows no 'X kişi daha' (was -1)")
  await act(async () => cards.unmount())
  global.__testFeedEvents = [feedEvent("short", "Film", "Sinema", 1, 4)]
  cards = await mount("Discover")
  await act(() => new Promise(resolve => setTimeout(resolve, 50)))
  assert(text(cards.toJSON()).replace(/\s+/g, " ").includes("3 kişi daha"), "A card below its minimum shows how many are missing")
  await act(async () => cards.unmount())
  global.__testFeedEvents = undefined

  // Profile: references are fetched on the first visit only and then kept current by socket events.
  {
    storage.set("event-app:access-token", "a"); current = "approved"
    const { StoreProvider } = require("../src/native/Store.tsx")
    const ProfileScreen = require("../src/screens/ProfileScreen.tsx").default
    let showProfile = true, root
    const App = () => React.createElement(StoreProvider, null, showProfile ? React.createElement(ProfileScreen, { navigate: () => {} }) : null)
    calls.length = 0
    await act(async () => { root = create(React.createElement(App)) })
    await act(() => new Promise(resolve => setTimeout(resolve, 50)))
    showProfile = false; await act(async () => root.update(React.createElement(App)))
    showProfile = true; await act(async () => root.update(React.createElement(App)))
    await act(() => new Promise(resolve => setTimeout(resolve, 50)))
    assert.equal(calls.filter(path => path === "/references/requests").length, 1, "Reopening the profile reuses stored references")
    const socket = require("./mock-socket.cjs").instances.at(-1)
    await act(async () => socket.receive("reference:created", { id: "ref-1", status: "pending", direction: "outgoing", createdAt: new Date().toISOString(), requester: { id: "pending-user", name: "Bekleyen Üye" }, recipient: { id: "ece", name: "Ece Referans" } }))
    await act(async () => socket.receive("reference:updated", { id: "ref-1", status: "approved" }))
    await act(async () => root.root.findAllByType("Pressable").find(n => text(n).includes("Referans")).props.onPress())
    assert(text(root.toJSON()).replace(/\s+/g, " ").includes("Bekleyen Üye · Onaylandı"), "A reference approved over the socket appears without refetching")
    assert.equal(calls.filter(path => path === "/references/requests").length, 1)
    await act(async () => root.unmount())
  }

  // Search: date range filter asks the server; the start can never be before today.
  {
    storage.set("event-app:access-token", "a"); current = "approved"
    global.__testDateEvents = [{ ...cardBase, id: "dated", interest: { id: "yoga", slug: "yoga", name: "Yoga" }, locationName: "Moda Sahili", confirmedParticipantCount: 1, minParticipants: 2, date: "05/11/2030" }]
    const search = await mount("Search")
    await act(() => new Promise(resolve => setTimeout(resolve, 50)))
    const dateField = label => search.root.findAll(n => n.props.mode === "date" && n.props.accessibilityLabel === label && typeof n.props.onChangeText === "function")[0]
    const pad = n => String(n).padStart(2, "0")
    const iso = date => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
    const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1)
    urls.length = 0
    await act(async () => dateField("Başlangıç").props.onChangeText(iso(yesterday)))
    assert(text(search.toJSON()).includes("Başlangıç tarihi bugünden önce olamaz"), "A past start date is rejected")
    assert(!urls.some(url => url.includes("dateFrom")), "A rejected start date sends no request")
    await act(async () => dateField("Başlangıç").props.onChangeText("2030-11-01"))
    await act(() => new Promise(resolve => setTimeout(resolve, 50)))
    assert(urls.some(url => decodeURIComponent(url).includes("dateFrom=01/11/2030")), "The chosen start is sent as dd/mm/yyyy")
    assert(text(search.toJSON()).includes("Moda Sahili"), "Events in the date range are listed")
    await act(async () => dateField("Bitiş").props.onChangeText("2030-10-20"))
    assert(text(search.toJSON()).includes("Bitiş tarihi başlangıçtan önce olamaz"), "End date cannot be before the start")
    await act(async () => dateField("Bitiş").props.onChangeText("2030-11-30"))
    await act(() => new Promise(resolve => setTimeout(resolve, 50)))
    assert(urls.some(url => decodeURIComponent(url).includes("dateTo=30/11/2030")), "A valid end date narrows the range")
    await act(async () => search.unmount())
    global.__testDateEvents = undefined
  }

  // Favourites run in the background: no global loader, taps never blocked, the last tap wins on the server.
  {
    const api = require("../src/api/client.ts")
    const { apiLoading } = require("../src/api/loading.ts")
    let busy = 0
    const unsubscribe = apiLoading.subscribe(count => { busy = Math.max(busy, count) })
    busy = 0
    const order = []
    const previousFetch = global.fetch
    let release
    const gate = new Promise(resolve => { release = resolve })
    global.fetch = async (url, options = {}) => {
      if (new URL(url).pathname.endsWith("/favorite")) { order.push(options.method); if (order.length === 1) await gate; return { ok: true, status: 204, json: async () => ({}) } }
      return previousFetch(url, options)
    }
    storage.set("event-app:access-token", "a")
    const first = api.setFavorite("fav-1", true)
    const second = api.setFavorite("fav-1", false)
    await new Promise(resolve => setTimeout(resolve, 20))
    assert.deepEqual(order, ["PUT"], "The second tap waits for the first request instead of racing it")
    assert.equal(first.isLatest(), false); assert.equal(second.isLatest(), true)
    release()
    await second.done
    assert.deepEqual(order, ["PUT", "DELETE"], "Requests are sent in tap order, so the last tap wins")
    assert.equal(busy, 0, "Favourite requests never show the global loading overlay")
    unsubscribe()
    global.fetch = previousFetch
  }

  // Rooms reloads only the user's own, joined and favourite events (on open and on pull).
  storage.set("event-app:access-token", "a"); current = "approved"
  const roomsTree = await mount("Rooms")
  await act(() => new Promise(resolve => setTimeout(resolve, 50)))
  calls.length = 0
  await act(async () => { roomsTree.root.findAll(n => n.props.refreshControl)[0].props.refreshControl.props.onRefresh() })
  await act(() => new Promise(resolve => setTimeout(resolve, 50)))
  assert.deepEqual([...calls].sort(), ["/events/favorites", "/events/mine", "/events/participating"], "Rooms refresh loads only the personal event lists")
  await act(async () => roomsTree.unmount())

  // Pulling the home feed down reloads it from the server.
  storage.set("event-app:access-token", "a"); current = "approved"
  const home = await mount("Discover")
  await act(() => new Promise(resolve => setTimeout(resolve, 50)))
  const pull = () => home.root.findAll(n => n.props.refreshControl)[0].props.refreshControl
  assert(pull(), "Home feed supports pull-to-refresh")
  calls.length = 0
  await act(async () => { pull().props.onRefresh() })
  await act(() => new Promise(resolve => setTimeout(resolve, 50)))
  assert.deepEqual(calls, ["/events"], "Discover pull-to-refresh reloads only the feed")
  assert.equal(pull().props.refreshing, false, "Spinner stops once the reload finishes")
  // Distance sorts ask for the device location; without permission the order is unchanged.
  // Innermost pressable showing the text (the sheet backdrop also contains every option's text).
  const pressText = async (tree, label) => {
    const node = tree.root.findAllByType("Pressable").filter(n => text(n).includes(label)).sort((a, b) => text(a).length - text(b).length)[0]
    assert(node, `Missing button: ${label}`)
    await act(async () => node.props.onPress?.({ stopPropagation() {} }))
  }
  const pressLabel = async (tree, label) => {
    const node = tree.root.findAllByType("Pressable").find(n => n.props.accessibilityLabel === label)
    assert(node, `Missing button: ${label}`)
    await act(async () => node.props.onPress?.({ stopPropagation() {} }))
  }
  global.__testLocationPermission = false
  await pressLabel(home, "Sıralama ve filtre")
  await pressText(home, "En Yakın Mesafe")
  assert(!text(home.toJSON()).includes("Temizle"), "Without location permission the distance sort is not applied")
  global.__testLocationPermission = true
  await pressLabel(home, "Sıralama ve filtre")
  await pressText(home, "En Yakın Mesafe")
  await act(() => new Promise(resolve => setTimeout(resolve, 20)))
  assert(home.root.findAllByType("Pressable").find(node => node.props.accessibilityLabel === "Sıralama ve filtre").props.accessibilityState.selected, "With permission the distance sort is applied; the selected option is shown in the sorting menu")
  global.__testLocationPermission = undefined
  await act(async () => home.unmount())

  global.__testPathname = undefined
  global.__testNavigations = undefined
  storage.clear()
  global.fetch = oldFetch
  console.log("PASS: pending accounts route to profile completion / reference wait and never enter the app.")
}

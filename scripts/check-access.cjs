// Pending accounts are routed to their own page and never reach in-app screens.
module.exports = async function ({ mount, tap, act, text, storage }) {
  const assert = require("node:assert/strict")
  const React = require("react")
  const { create } = require("react-test-renderer")
  const { gatedScreen } = require("../src/native/access.ts")
  assert.equal(gatedScreen("approved"), null)
  assert.equal(gatedScreen(undefined), null, "Unknown status waits for the account to load")
  assert.equal(gatedScreen("profile_incomplete"), "onboarding-2")
  assert.equal(gatedScreen("reference_pending"), "onboarding-3")
  assert.equal(gatedScreen("security_review"), "onboarding-3")

  const oldFetch = global.fetch
  const user = status => ({ id: "pending-user", firstName: "Bekleyen", lastName: "Üye", status: { enum: status }, profilePhoto: global.__testProfilePhoto || null })
  let current = "reference_pending"
  const calls = []
  const urls = []
  const bodies = []
  let registerConflict = false, loginFails = false
  global.fetch = async (url, options = {}) => {
    const path = new URL(url).pathname
    calls.push(path)
    urls.push(url)
    if (options.body) bodies.push({ path, body: JSON.parse(options.body) })
    if (path === "/auth/register" && registerConflict) return { ok: false, status: 409, text: async () => JSON.stringify({ statusCode: 409, errors: [{ field: "phoneNumber", message: "Bu telefon numarası zaten kayıtlı" }] }) }
    // A taken email/phone is caught before any code is sent.
    if (path === "/auth/register/email-code" && registerConflict) return { ok: false, status: 409, text: async () => JSON.stringify({ statusCode: 409, errors: [{ field: "phoneNumber", message: "Bu telefon numarası zaten kayıtlı" }] }) }
    if (path === "/auth/register/email-code") return { ok: true, status: 200, json: async () => ({ sent: true, expiresAt: new Date(Date.now() + 120000).toISOString(), resendAfter: 60 }) }
    if (path === "/auth/register/verify-email") return { ok: true, status: 200, json: async () => ({ emailVerificationToken: "email-proof" }) }
    if (path === "/access-codes/redeem") {
      const code = JSON.parse(options.body).code.toUpperCase()
      if (code === "REF-ABC123") return { ok: true, status: 200, json: async () => ({ target: "reference", status: "profile_incomplete" }) }
      return code === "EVENT2026" ? { ok: true, status: 200, json: async () => ({ target: "discover", status: "approved" }) }
        : { ok: false, status: 404, text: async () => JSON.stringify({ statusCode: 404, errors: [{ field: null, message: "Bu kod geçerli değil veya süresi dolmuş." }] }) }
    }
    if (path === "/auth/login" && loginFails) return { ok: false, status: 401, text: async () => JSON.stringify({ statusCode: 401, errors: [{ field: null, message: "Telefon numarası veya şifre hatalı" }] }) }
    const body = path === "/auth/login" || path === "/auth/register" ? { user: user(current), tokens: { accessToken: "a", refreshToken: "r" } }
      : path === "/auth/me" ? user(current)
      : path === "/users/me/profile/complete" ? (current = "approved", user(current))
      : path === "/interests" ? [{ id: "padel", name: "Padel", slug: "padel", levels: [] }, { id: "kahve", name: "Kahve", slug: "kahve", levels: [] }, { id: "yoga", name: "Yoga", slug: "yoga", levels: [] }]
      : path === "/users/me/interests" ? (options.body ? [{ id: "padel", name: "Padel" }] : [])
      : path === "/users/me/preferences" ? {}
      : path === "/legal/documents" ? { items: [{ type: "terms", version: 1, required: true }, { type: "privacy", version: 1, required: true }, { type: "marketing", version: 3, required: false }] }
      : path === "/users/me/profile" ? { ...user(current), ...JSON.parse(options.body || "{}") }
      : /^\/users\/[^/]+\/profile$/.test(path) && global.__testOtherProfile ? global.__testOtherProfile
      : path === "/events/participating" && global.__testJoinedEvent ? { items: [global.__testJoinedEvent], total: 1 }
      : path === "/events/rooms" ? (global.__testRooms || [])
      : path === "/events" && global.__testFeedEvents ? { items: global.__testFeedEvents, total: global.__testFeedEvents.length }
      : path === "/events" && new URL(url).searchParams.get("dateFrom") && global.__testDateEvents ? { items: global.__testDateEvents, total: global.__testDateEvents.length }
      : { items: [], total: 0 }
    return { ok: true, status: 200, json: async () => body }
  }

  // Login sends each pending status to its own page and never loads the feed.
  for (const [status, expected] of [["reference_pending", "onboarding-3"], ["profile_incomplete", "onboarding-2"], ["approved", "discover"]]) {
    storage.clear(); current = status; calls.length = 0
    let destination, options
    const login = await mount("Login", { navigate: (route, opts) => { destination = route; options = opts } })
    const [phone, password] = login.root.findAllByType("TextInput")
    assert.equal(phone.props.accessibilityLabel, "Telefon numarası", "Members sign in with their phone number")
    assert(text(login.toJSON()).includes("+90"), "The country code is shown in its own box")
    await act(async () => phone.props.onChangeText("05321234567"))
    assert.equal(login.root.findAllByType("TextInput")[0].props.value, "532 123 45 67", "The number is formatted as typed, without the country code")
    await act(async () => password.props.onChangeText("Password1!"))
    await tap(login, "Giriş Yap")
    assert.deepEqual(bodies.filter(row => row.path === "/auth/login").at(-1).body, { phoneNumber: "+905321234567", password: "Password1!", language: "tr" }, "The phone number is sent in one format")
    assert.equal(destination, expected, `${status} logs in to ${expected}`)
    assert.equal(options?.reset, true, "Signing in clears history so back cannot return to login")
    if (status !== "approved") assert(!calls.includes("/events"), `${status} never loads the in-app feed`)
    await act(async () => login.unmount())
  }
  // Under the sign-in form, "veya" offers an Ewent invite code; anything else is explained under the input.
  storage.clear()
  const inviteLogin = await mount("Login", { navigate: () => {} })
  assert(text(inviteLogin.toJSON()).includes("veya") && text(inviteLogin.toJSON()).includes("Ewent davet kodum var"))
  assert(!inviteLogin.root.findAll(n => n.props.accessibilityLabel === "Ewent davet kodu").length, "The invite field stays folded until asked for")
  await tap(inviteLogin, "Ewent davet kodum var")
  await act(async () => inviteLogin.root.findAll(n => n.props.accessibilityLabel === "Ewent davet kodu" && typeof n.props.onChangeText === "function")[0].props.onChangeText("REF-ABC"))
  await tap(inviteLogin, "Aç")
  assert(text(inviteLogin.toJSON()).includes("Geçerli bir Ewent davet kodu"), "Only invite codes open from the login screen")
  await act(async () => inviteLogin.unmount())

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
    global.__testRootState = { index: 0, routes: [{ name: "__root", state: { index: routes.length - 1, routes: routes.map(name => ({ name })) } }] }
    global.__testNavigations = []
    await act(async () => { probe = create(React.createElement(Probe)) })
    go("discover", opts)
    await act(async () => probe.unmount())
    return global.__testNavigations
  }
  assert.deepEqual(await backFrom(["discover", "event-detail"]), ["back"], "Back returns to a normal previous page")
  // Reported: Rooms → room → participant profile; back must return to the room, not home.
  assert.deepEqual(await backFrom(["discover", "rooms", "event-room", "profile"]), ["back"], "Back from a member profile returns to the room it was opened from")
  {
    const { previousRouteIn } = require("../src/native/navigation.ts")
    assert.equal(previousRouteIn({ index: 0, routes: [{ name: "__root", state: { index: 2, routes: [{ name: "rooms" }, { name: "event-room" }, { name: "profile" }] } }] }), "event-room", "The previous page is read from the stack nested under __root")
    assert.equal(previousRouteIn({ index: 0, routes: [{ name: "__root", state: { index: 0, routes: [{ name: "discover" }] } }] }), null, "A single page has no previous page")
    // Tabs: the previous page is the tab visited before, else the page below the tabs.
    const tabs = (history) => ({ type: "tab", index: 1, routes: [{ key: "d", name: "discover" }, { key: "m", name: "map" }, { key: "r", name: "rooms" }], history: history.map(key => ({ type: "route", key })) })
    assert.equal(previousRouteIn({ index: 0, routes: [{ name: "__root", state: { index: 0, routes: [{ name: "(tabs)", state: tabs(["r", "m"]) }] } }] }), "rooms", "Back from a tab returns to the tab visited before")
    assert.equal(previousRouteIn({ index: 0, routes: [{ name: "__root", state: { index: 1, routes: [{ name: "login" }, { name: "(tabs)", state: tabs(["m"]) }] } }] }), "login", "On the first tab, the page below the tabs is the previous one")
  }
  assert.deepEqual(await backFrom(["create-event", "profile"]), ["back"], "An unfinished creation flow is a normal previous page")
  assert.deepEqual(await backFrom(["login", "discover", "search"].slice(0, 2).concat("search")), ["back"])
  assert.deepEqual(await backFrom(["login", "search"]), ["dismissAll", "/discover"], "Back never returns to login")
  assert.deepEqual(await backFrom(["search"]), ["/discover"], "With nowhere to go, back lands on home")
  global.__testRootState = undefined
  global.__testNavigations = []
  await act(async () => { probe = create(React.createElement(Probe)) })
  go("event-detail", { eventId: "new", aboveHome: true })
  assert.deepEqual(global.__testNavigations, ["dismissAll", "/discover", "/event-detail"], "Created event detail sits directly above home")
  await act(async () => probe.unmount())
  // Bottom-bar tabs are switched (each is built once); every other page goes on top of history.
  for (const [screen, method] of [["rooms", "navigate"], ["profile", "navigate"], ["map", "navigate"], ["discover", "navigate"], ["search", "push"], ["create-event", "push"]]) {
    global.__testNavigations = []; global.__testMethods = []
    await act(async () => { probe = create(React.createElement(Probe)) })
    go(screen)
    assert.deepEqual(global.__testMethods, [method], `Opening ${screen} uses ${method}`)
    await act(async () => probe.unmount())
  }
  // Another member's profile is a page of its own, not the profile tab.
  global.__testNavigations = []; global.__testMethods = []
  await act(async () => { probe = create(React.createElement(Probe)) })
  go("profile", { userId: "member-2" })
  assert.deepEqual(global.__testMethods, ["push"], "Another member's profile is pushed")
  assert.deepEqual(global.__testNavigations, ["/member"], "Another member's profile opens at /member")
  await act(async () => probe.unmount())
  global.__testMethods = undefined

  // Android back follows the same rules and goes home instead of closing the app.
  if (require("react-native").Platform.OS === "android") {
    const HardwareBack = require("../src/components/HardwareBack.tsx").default
    const press = async (pathname, routes) => {
      global.__testPathname = pathname
      global.__testRootState = { index: 0, routes: [{ name: "__root", state: { index: routes.length - 1, routes: routes.map(name => ({ name })) } }] }
      global.__testNavigations = []
      let tree
      await act(async () => { tree = create(React.createElement(HardwareBack)) })
      const handled = global.__testBackHandler()
      await act(async () => tree.unmount())
      return { handled, navigations: global.__testNavigations }
    }
    assert.deepEqual(await press("/search", ["search"]), { handled: true, navigations: ["dismissAll", "/discover"] }, "Nowhere to go: Android back opens home")
    assert.deepEqual(await press("/event-detail", ["discover", "event-detail"]), { handled: false, navigations: [] }, "After creating, Android back from the new event goes home (only home is below it)")
    assert.deepEqual(await press("/profile", ["create-event", "profile"]), { handled: false, navigations: [] }, "Android back returns to an unfinished creation flow")
    assert.deepEqual(await press("/discover", ["login", "discover"]), { handled: true, navigations: ["dismissAll", "/discover"] }, "Android back never returns to login")
    assert.deepEqual(await press("/event-detail", ["discover", "event-detail"]), { handled: false, navigations: [] }, "Normal pages pop natively")
    assert.equal((await press("/discover", ["discover"])).handled, false, "Home itself lets Android close the app")
    global.__testPathname = undefined
    global.__testRootState = undefined
  }

  // "Devam Et" first sends a 6-digit code to the email; the right code creates the account.
  const confirmEmail = async (tree) => {
    const field = tree.root.findAllByType("TextInput").find(n => n.props.accessibilityLabel === "E-posta doğrulama kodu")
    assert(field, "The email code step appears before the account is created")
    await act(async () => field.props.onChangeText("123456"))
    await tap(tree, "Doğrula ve devam et")
  }
  // Registration: a profile_incomplete account continues with the reference step, then the profile.
  storage.clear(); current = "profile_incomplete"
  let registered
  const registration = await mount("Onboarding", { step: 1, navigate: route => { registered = route } })
  const inputs = registration.root.findAllByType("TextInput")
  for (const [index, value] of ["Ada", "Yeni", "ada@example.com", "+90 532 000 00 00", "Password1!"].entries()) await act(async () => inputs[index].props.onChangeText(value))
  await act(async () => registration.root.findAll(n => n.props.mode === "date" && typeof n.props.onChangeText === "function")[0].props.onChangeText("1995-06-15"))
  await act(async () => registration.root.findAllByType("Pressable").find(n => String(n.props.accessibilityLabel).startsWith("Şehir:")).props.onPress())
  await act(async () => registration.root.findAllByType("Pressable").find(n => n.props.accessibilityState && "selected" in n.props.accessibilityState && text(n).includes("Ankara")).props.onPress())
  await tap(registration, "Topluluk İlkeleri ve Sözleşmeler")
  await tap(registration, "Topluluk Kuralları")
  await tap(registration, "KVKK Aydınlatma Metni")
  await tap(registration, "ticari elektronik ileti")
  await tap(registration, "Devam Et")
  await confirmEmail(registration)
  assert.equal(registered, "onboarding-2", "Registration continues with the reference step")
  const signUp = bodies.find(row => row.path === "/auth/register").body
  assert.deepEqual(signUp.acceptedDocuments, [{ type: "terms", version: 1 }, { type: "privacy", version: 1 }, { type: "marketing", version: 3 }], "Opting in records the marketing text version too")
  assert.equal(signUp.marketingConsent, true)
  await act(async () => registration.unmount())

  // A half-finished registration (account saved, app never heard back) resumes with the same phone and password.
  const fillAndSubmit = async (tree) => {
    const fields = tree.root.findAllByType("TextInput")
    for (const [index, value] of ["Ada", "Yeni", "ada@example.com", "+90 532 000 00 00", "Password1!"].entries()) await act(async () => fields[index].props.onChangeText(value))
    await act(async () => tree.root.findAll(n => n.props.mode === "date" && typeof n.props.onChangeText === "function")[0].props.onChangeText("1995-06-15"))
    await act(async () => tree.root.findAllByType("Pressable").find(n => String(n.props.accessibilityLabel).startsWith("Şehir:")).props.onPress())
    const search = tree.root.findAllByType("TextInput").find(n => n.props.placeholder === "Şehir ara")
    await act(async () => search.props.onChangeText("sanliurfa"))
    const cityOption = tree.root.findAllByType("Pressable").find(n => n.props.accessibilityState && "selected" in n.props.accessibilityState && text(n).includes("Şanlıurfa"))
    assert(cityOption, "City search ignores Turkish letters: sanliurfa finds Şanlıurfa")
    await act(async () => cityOption.props.onPress())
    await tap(tree, "Topluluk İlkeleri ve Sözleşmeler")
    await tap(tree, "Topluluk Kuralları")
    await tap(tree, "KVKK Aydınlatma Metni")
    await tap(tree, "Devam Et")
  }
  storage.clear(); current = "profile_incomplete"; registered = undefined; registerConflict = true
  let resumed = await mount("Onboarding", { step: 1, navigate: route => { registered = route } })
  await fillAndSubmit(resumed)
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 30)) })
  assert.equal(registered, "onboarding-2", "The existing unfinished application continues after a sign-in with the same password")
  assert.deepEqual(bodies.filter(row => row.path === "/auth/login").at(-1).body, { phoneNumber: "+905320000000", password: "Password1!", language: "tr" })
  await act(async () => resumed.unmount())
  storage.clear(); registered = undefined; loginFails = true
  resumed = await mount("Onboarding", { step: 1, navigate: route => { registered = route } })
  await fillAndSubmit(resumed)
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 30)) })
  assert.equal(registered, undefined, "A different password does not open someone else's application")
  assert.equal(calls.at(-1), "/auth/login", "With a wrong password the sign-in attempt is the last request")
  await act(async () => resumed.unmount())
  registerConflict = false; loginFails = false
  // The application's second step has no general code field any more; event invites start from the login screen.
  storage.set("event-app.access-token", "a"); current = "profile_incomplete"
  const stepTwo = await mount("Onboarding", { step: 2, navigate: () => {} })
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 30)) })
  assert(!stepTwo.root.findAll(n => n.props.accessibilityLabel === "Etkinlik veya davet kodu").length && !text(stepTwo.toJSON()).includes("veya"), "No divider or invite code field on step two")
  await act(async () => stepTwo.unmount())
  // The reference card takes a member's REF- code: other text is explained, a valid code waits for Devam Et.
  const refVisited = []
  const refStep = await mount("Onboarding", { step: 2, navigate: route => refVisited.push(route) })
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 30)) })
  const enterReference = async value => {
    await act(async () => refStep.root.findAll(n => n.props.accessibilityLabel === "Referans kodu" && typeof n.props.onChangeText === "function")[0].props.onChangeText(value))
    await act(async () => { refStep.root.findAllByType("Pressable").find(n => n.props.accessibilityLabel === "Referans kodunu ekle").props.onPress?.({ stopPropagation() {} }); await new Promise(resolve => setTimeout(resolve, 20)) })
  }
  await enterReference("EWT-123")
  assert(text(refStep.toJSON()).includes("REF- ile başlar"), "Only reference codes go in the reference card")
  await enterReference("ref-abc123")
  assert.deepEqual(bodies.filter(row => row.path === "/access-codes/redeem").at(-1).body, { code: "REF-ABC123" })
  assert(text(refStep.toJSON()).includes("Referansın eklendi"))
  await tap(refStep, "Devam Et")
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 20)) })
  assert(refVisited.includes("interests"), "After a reference code, an incomplete profile goes on to its interests")
  await act(async () => refStep.unmount())

  // Profile completion: three interests are required, the photo is not; saving approves and opens the app.
  storage.set("event-app.access-token", "a"); current = "profile_incomplete"; calls.length = 0
  let completed
  const profile = await mount("Interests", { navigate: (route, opts) => { completed = { route, opts } } })
  await act(() => new Promise(resolve => setTimeout(resolve, 50)))
  const finish = () => profile.root.findAllByType("Pressable").find(n => text(n).includes("Kurulumu Tamamla"))
  assert.equal(finish().props.disabled, true, "Interests are required before finishing")
  await tap(profile, "Padel")
  await tap(profile, "Kahve")
  assert.equal(finish().props.disabled, true, "Two interests are not enough")
  await tap(profile, "Yoga")
  assert.equal(finish().props.disabled, false, "Three interests are enough; the photo is optional")
  await tap(profile, "Kurulumu Tamamla")
  await act(() => new Promise(resolve => setTimeout(resolve, 20)))
  assert(calls.includes("/users/me/profile/complete"), "Saving asks the server to approve the completed profile")
  assert.equal(current, "approved")
  assert.deepEqual(completed, { route: "discover", opts: { reset: true } }, "Approved account enters the app with a clean history")
  await act(async () => profile.unmount())

  // With a photo, "Değiştir" lines up with the texts beside the photo instead of being centred.
  storage.set("event-app.access-token", "a"); current = "profile_incomplete"; global.__testProfilePhoto = "data:image/png;base64,iVBORw0KGgo="
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
    storage.set("event-app.access-token", "a"); current = "approved"; calls.length = 0
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
    storage.set("event-app.access-token", "a")
    await api.getUserSettings()
    assert.equal(count("/users/me/settings"), 2, "Signing out drops the account's cached settings")
    await api.getMapInterests()
    assert.equal(count("/interests"), 1, "The shared catalog survives sign-out")
  }

  // Saved sessions resolve the same way on startup.
  storage.set("event-app.access-token", "a"); current = "profile_incomplete"
  let splashRoute
  const splash = await mount("Splash", { navigate: route => { splashRoute = route } })
  await act(() => new Promise(resolve => setTimeout(resolve, 2900)))
  assert.equal(splashRoute, "onboarding-2")
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
  storage.set("event-app.access-token", "a"); current = "approved"; bodies.length = 0
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
  // Interests: taps only change a draft; one "Kaydet" sends the whole list in a single request.
  {
    const before = bodies.filter(row => row.path === "/users/me/interests").length
    await act(async () => ownProfile.root.findAllByType("Pressable").find(n => n.props.accessibilityLabel === "İlgi alanı ekle").props.onPress())
    await act(() => new Promise(resolve => setTimeout(resolve, 20)))
    await tap(ownProfile, "Padel")
    assert.equal(bodies.filter(row => row.path === "/users/me/interests").length, before, "Choosing an interest does not call the server")
    assert(ownProfile.root.findAllByType("Pressable").some(n => n.props.accessibilityLabel === "İlgi alanlarını kaydet"), "A save button appears after a change")
    await tap(ownProfile, "Padel")
    assert(!ownProfile.root.findAllByType("Pressable").some(n => n.props.accessibilityLabel === "İlgi alanlarını kaydet"), "Undoing the change hides the save button")
    await tap(ownProfile, "Padel")
    await act(async () => ownProfile.root.findAllByType("Pressable").find(n => n.props.accessibilityLabel === "İlgi alanlarını kaydet").props.onPress())
    await act(() => new Promise(resolve => setTimeout(resolve, 20)))
    const sent = bodies.filter(row => row.path === "/users/me/interests")
    assert.equal(sent.length, before + 1, "Saving sends exactly one request")
    assert.deepEqual(sent.at(-1).body, { interestIds: ["padel"] }, "The whole chosen list is sent")
  }
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
  storage.set("event-app.access-token", "a"); current = "approved"
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
  // No status or energy labels on cards and one border colour for every state.
  const cardStyle = node => Object.assign({}, ...[].concat(node.props.style).flat(Infinity).filter(Boolean))
  const cardFor = tree => tree.root.findAllByType("Pressable").find(node => /^Film, /.test(String(node.props.accessibilityLabel)))
  assert(!/Sakin akış|Canlanıyor|Yüksek enerji|Katılımcı Bekleniyor|● Aktif/.test(text(cards.toJSON())), "Feed cards carry no status or energy labels")
  assert.equal(cardStyle(cardFor(cards)).borderColor, "rgba(205,214,255,.15)", "Every card has the same single-colour border")
  await act(async () => cards.unmount())
  global.__testFeedEvents = [feedEvent("short", "Film", "Sinema", 1, 4)]
  cards = await mount("Discover")
  await act(() => new Promise(resolve => setTimeout(resolve, 50)))
  assert(text(cards.toJSON()).replace(/\s+/g, " ").includes("3 kişi daha"), "A card below its minimum shows how many are missing")
  assert(text(cards.toJSON()).replace(/\s+/g, " ").includes("Ev Sahibi düzenliyor"), "Someone else's event names its organizer")
  assert.equal(cardStyle(cardFor(cards)).borderColor, "rgba(205,214,255,.15)", "A waiting event uses the same border colour")
  await act(async () => cards.unmount())
  // My own event: "Sen düzenliyorsun" instead of my name.
  global.__testFeedEvents = [{ ...feedEvent("mine", "Film", "Sinema", 1, 4), owner: { id: "pending-user", firstName: "Bekleyen", lastName: "Üye" } }]
  cards = await mount("Discover")
  await act(() => new Promise(resolve => setTimeout(resolve, 50)))
  assert(text(cards.toJSON()).includes("Sen düzenliyorsun") && !text(cards.toJSON()).includes("Bekleyen Üye düzenliyor"), "My own events say Sen")
  await act(async () => cards.unmount())
  // Empty feed: an inviting state with ideas that open the create flow, never a bare "Yenile".
  global.__testFeedEvents = []
  let createdWith
  const empty = await mount("Discover", { navigate: (route, opts) => { createdWith = { route, opts } } })
  await act(() => new Promise(resolve => setTimeout(resolve, 50)))
  assert(text(empty.toJSON()).includes("Sahne boş, ilk hamle senden!") && !/Yenile$/m.test(text(empty.toJSON())), "Empty feed shows the inviting empty state")
  await act(async () => empty.root.findAll(n => n.props.accessibilityLabel === "Kahve etkinliği oluştur" && typeof n.props.onPress === "function")[0].props.onPress())
  assert.deepEqual(createdWith, { route: "create-event", opts: { activity: "Kahve" } }, "An idea opens the create flow with that activity")
  await act(async () => empty.unmount())
  // A filter that hides every open event offers to clear it.
  global.__testFeedEvents = [feedEvent("later", "Film", "Sinema", 1, 4)]
  const filtered = await mount("Discover")
  await act(() => new Promise(resolve => setTimeout(resolve, 50)))
  await act(async () => filtered.root.findAll(n => typeof n.props.onPress === "function" && text(n).trim() === "Bugün")[0].props.onPress())
  assert(text(filtered.toJSON()).replace(/\s+/g, " ").includes("“ Bugün ” şimdilik sessiz"), "Empty filter names the filter")
  await act(async () => filtered.root.findAll(n => typeof n.props.onPress === "function" && text(n).trim() === "Tüm etkinlikleri göster")[0].props.onPress())
  assert(text(filtered.toJSON()).includes("Sinema"), "Clearing the filter shows the feed again")
  await act(async () => filtered.unmount())
  global.__testFeedEvents = undefined

  // Profile: references are fetched on the first visit only and then kept current by socket events.
  {
    storage.set("event-app.access-token", "a"); current = "approved"
    const { StoreProvider } = require("../src/native/Store.tsx")
    const ProfileScreen = require("../src/screens/ProfileScreen.tsx").default
    let showProfile = true, root
    let profileOpened
    const App = () => React.createElement(StoreProvider, null, showProfile ? React.createElement(ProfileScreen, { navigate: (route, opts) => { profileOpened = { route, opts } } }) : null)
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
    // Someone asked me and I approved: they are listed under the people I approved (never my own name).
    await act(async () => socket.receive("reference:created", { id: "ref-2", status: "approved", direction: "incoming", createdAt: new Date().toISOString(), requester: { id: "ali-onay", name: "Ali Onaylı" }, recipient: { id: "pending-user", name: "Bekleyen Üye" } }))
    await act(async () => root.root.findAllByType("Pressable").find(n => text(n).includes("Referanslarım")).props.onPress())
    const refs = text(root.toJSON()).replace(/\s+/g, " ")
    assert(refs.includes("Bana referans olanlar · 1") && refs.includes("Ece Referans"), "A reference approved over the socket appears without refetching, showing who approved")
    assert(refs.includes("Onay verdiklerim · 1") && refs.includes("Ali Onaylı"), "People I approved are listed by name")
    assert.deepEqual([...new Set(root.root.findAll(n => / profilini aç$/.test(String(n.props.accessibilityLabel)) && typeof n.props.onPress === "function").map(n => n.props.accessibilityLabel))].sort(), ["Ali Onaylı profilini aç", "Ece Referans profilini aç"], "My own name is never listed as a reference")
    await act(async () => root.root.findAll(n => n.props.accessibilityLabel === "Ali Onaylı profilini aç" && typeof n.props.onPress === "function")[0].props.onPress())
    assert.deepEqual(profileOpened, { route: "profile", opts: { userId: "ali-onay" } }, "Tapping a reference opens their profile")
    assert.equal(calls.filter(path => path === "/references/requests").length, 1)
    await act(async () => root.unmount())
  }

  // Search: date range filter asks the server; the start can never be before today.
  {
    storage.set("event-app.access-token", "a"); current = "approved"
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
    // Interest filter, below the dates: works alone (upcoming events from today) and together with dates.
    await act(async () => search.root.findAll(n => n.props.accessibilityLabel === "Tarih filtresini temizle" && typeof n.props.onPress === "function")[0].props.onPress())
    await act(() => new Promise(resolve => setTimeout(resolve, 20)))
    urls.length = 0
    const chip = () => search.root.findAll(n => typeof n.props.onPress === "function" && text(n).trim() === "Padel")[0]
    assert(chip(), "Interests are offered as chips")
    await act(async () => chip().props.onPress())
    await act(() => new Promise(resolve => setTimeout(resolve, 50)))
    const sent = urls.map(url => new URL(url)).find(url => url.pathname === "/events" && url.searchParams.get("interestId"))
    assert(sent && sent.searchParams.getAll("interestId").join() === "padel" && sent.searchParams.get("dateFrom") === iso(new Date()).split("-").reverse().join("/"), "Picking an interest searches upcoming events in it")
    assert(text(search.toJSON()).includes("Moda Sahili"), "Interest results are listed")
    await act(async () => dateField("Başlangıç").props.onChangeText("2030-11-01"))
    await act(() => new Promise(resolve => setTimeout(resolve, 50)))
    assert(urls.some(url => { const u = new URL(url); return u.searchParams.get("interestId") === "padel" && u.searchParams.get("dateFrom") === "01/11/2030" }), "Dates and interests combine in one request")
    await act(async () => search.root.findAll(n => n.props.accessibilityLabel === "İlgi alanı filtresini temizle" && typeof n.props.onPress === "function")[0].props.onPress())
    assert(!search.root.findAll(n => n.props.accessibilityLabel === "İlgi alanı filtresini temizle").length, "The interest filter can be cleared")
    await act(async () => search.unmount())
    global.__testDateEvents = undefined
  }

  // Search by interest: the user's own interests come first, and picking one never flashes the unfiltered list.
  {
    storage.set("event-app.access-token", "a"); current = "approved"
    const previousFetch = global.fetch
    let release
    const gate = new Promise(resolve => { release = resolve })
    global.fetch = async (url, options = {}) => {
      const parsed = new URL(url)
      if (parsed.pathname === "/interests") return { ok: true, status: 200, json: async () => [{ id: "kahve", name: "Kahve", slug: "kahve" }, { id: "padel", name: "Padel", slug: "padel" }, { id: "yoga", name: "Yoga", slug: "yoga" }] }
      if (parsed.pathname === "/users/me/interests") return { ok: true, status: 200, json: async () => [{ id: "yoga", name: "Yoga (EN)" }] }
      if (parsed.pathname === "/events" && parsed.searchParams.get("interestId")) { await gate; return { ok: true, status: 200, json: async () => ({ items: [{ ...cardBase, id: "yoga-1", interest: { id: "yoga", slug: "yoga", name: "Yoga" }, locationName: "Yoga Bahçesi", confirmedParticipantCount: 1, minParticipants: 2 }], total: 1 }) } }
      if (parsed.pathname === "/events") return { ok: true, status: 200, json: async () => ({ items: [{ ...cardBase, id: "feed-1", interest: { id: "film", slug: "film", name: "Film" }, locationName: "Akış Sineması", confirmedParticipantCount: 1, minParticipants: 2 }], total: 1 }) }
      return previousFetch(url, options)
    }
    require("../src/api/client.ts").clearSessionCache?.()
    const search = await mount("Search")
    await act(() => new Promise(resolve => setTimeout(resolve, 60)))
    const chips = [...new Set(search.root.findAll(n => typeof n.props.onPress === "function" && ["Kahve", "Padel", "Yoga"].includes(text(n).trim())).map(n => text(n).trim()))]
    assert.equal(chips[0], "Yoga", "The user's own interest is listed first (matched by id, even when names differ)")
    await act(async () => search.root.findAll(n => typeof n.props.onPress === "function" && text(n).trim() === "Yoga")[0].props.onPress())
    await act(() => new Promise(resolve => setTimeout(resolve, 30)))
    const pending = text(search.toJSON())
    assert(!pending.includes("Akış Sineması"), "The unfiltered list never shows while the interest search runs")
    assert(pending.includes("Etkinlikler aranıyor") && !pending.includes("yaklaşan etkinlik yok"), "A loader shows instead of an empty message")
    await act(async () => { release(); await new Promise(resolve => setTimeout(resolve, 30)) })
    assert(text(search.toJSON()).includes("Yoga Bahçesi") && !text(search.toJSON()).includes("Akış Sineması"), "Only the interest's events are listed")
    await act(async () => search.unmount())
    global.fetch = previousFetch
  }

  // Friends: send from a member's profile, never twice but withdrawable; approve/decline incoming; count under "Bağlantı".
  {
    storage.set("event-app.access-token", "a"); current = "approved"
    const previousFetch = global.fetch
    let relation = { status: "none", canRequest: true, friendCount: 4 }
    const sent = []
    global.fetch = async (url, options = {}) => {
      const parsed = new URL(url)
      if (parsed.pathname === "/users/ali/profile") return { ok: true, status: 200, json: async () => ({ id: "ali", firstName: "Ali", lastName: "Kaya", city: "Ankara", bio: "", rank: 4, interests: [] }) }
      if (parsed.pathname === "/friends/status/ali") return { ok: true, status: 200, json: async () => relation }
      if (parsed.pathname === "/friends/status/pending-user") return { ok: true, status: 200, json: async () => ({ status: "self", canRequest: false, friendCount: 7 }) }
      if (parsed.pathname === "/events/stats") return { ok: true, status: 200, json: async () => ({ attended: 5, organized: 2 }) }
      if (parsed.pathname === "/events/mine") return { ok: true, status: 200, json: async () => ({ items: [
        { ...cardBase, id: "own-wait", interest: { id: "padel", slug: "padel", name: "Padel" }, owner: { id: "pending-user", firstName: "Bekleyen", lastName: "Üye" }, confirmedParticipantCount: 1, minParticipants: 3, status: { enum: "waiting_participants", name: "" } },
        { ...cardBase, id: "own-cancel", interest: { id: "yoga", slug: "yoga", name: "Yoga" }, owner: { id: "pending-user", firstName: "Bekleyen", lastName: "Üye" }, status: { enum: "cancelled", name: "" } },
        { ...cardBase, id: "own-done", interest: { id: "film", slug: "film", name: "Film" }, owner: { id: "pending-user", firstName: "Bekleyen", lastName: "Üye" }, status: { enum: "closed", name: "" } },
      ], total: 3 }) }
      if (parsed.pathname === "/events/organized") return { ok: true, status: 200, json: async () => ({ items: [{ ...cardBase, id: "own-done", interest: { id: "film", slug: "film", name: "Film" }, locationName: "Yazlık Sinema", owner: { id: "pending-user", firstName: "Bekleyen", lastName: "Üye" }, status: { enum: "closed", name: "" } }], total: 2 }) }
      if (parsed.pathname === "/events/attended") return { ok: true, status: 200, json: async () => ({ items: parsed.searchParams.get("limit") === "1" ? [] : [{ ...cardBase, id: "done-1", interest: { id: "film", slug: "film", name: "Film" }, locationName: "Eski Sinema", status: { enum: "closed", name: "Bitti" }, viewerParticipationStatus: "confirmed" }], total: 3 }) }
      if (parsed.pathname === "/friends/of/ali") return { ok: true, status: 200, json: async () => ({ items: [{ user: { id: "zeynep", firstName: "Zeynep", lastName: "Aydın", profilePhoto: null }, friendsSince: new Date().toISOString() }], total: 1 }) }
      if (parsed.pathname === "/friends/of/pending-user") return { ok: true, status: 200, json: async () => ({ items: [{ user: { id: "ali", firstName: "Ali", lastName: "Kaya", profilePhoto: null }, friendsSince: new Date().toISOString() }], total: 1 }) }
      if (parsed.pathname === "/friends/ali" && options.method === "DELETE") { sent.push("DELETE /friends/ali"); return { ok: true, status: 200, json: async () => ({ message: "ok" }) } }
      if (parsed.pathname.startsWith("/friends/requests")) { sent.push(`${options.method} ${parsed.pathname}${options.body ? " " + options.body : ""}`); return { ok: true, status: 200, json: async () => ({ message: "ok" }) } }
      return previousFetch(url, options)
    }
    const press = async (tree, label) => { const node = tree.root.findAll(n => n.props.accessibilityLabel === label && typeof n.props.onPress === "function")[0]; assert(node, `Missing ${label}`); await act(async () => node.props.onPress()) }
    const settle = () => act(() => new Promise(resolve => setTimeout(resolve, 40)))
    const profile = await mount("Profile", { userId: "ali", isOwn: false })
    await settle()
    assert(text(profile.toJSON()).replace(/\s+/g, " ").includes("4 bağlantı"), "A member's profile shows their friend count")
    await press(profile, "Arkadaşlık isteği gönder")
    await settle()
    assert.deepEqual(sent, ['POST /friends/requests {"userId":"ali"}'], "A friend request is sent from the profile")
    assert(!profile.root.findAll(n => n.props.accessibilityLabel === "Arkadaşlık isteği gönder").length, "A second request cannot be sent")
    assert(text(profile.toJSON()).includes("İstek gönderildi"), "The sent state is shown")
    await press(profile, "Arkadaşlık isteğini geri çek")
    await settle()
    assert.equal(sent.at(-1), "DELETE /friends/requests/ali", "A sent request can be withdrawn")
    // Ali sends a request: the open profile updates live and offers approve/decline.
    relation = { status: "incoming", canRequest: false, friendCount: 4 }
    await act(async () => require("./mock-socket.cjs").instances.at(-1).receive("friend:changed", { userId: "ali" }))
    await settle()
    assert(text(profile.toJSON()).replace(/\s+/g, " ").includes("Ali sana arkadaşlık isteği gönderdi"), "An incoming request shows on the sender's profile")
    await press(profile, "Arkadaşlık isteğini kabul et")
    await settle()
    assert.equal(sent.at(-1), "POST /friends/requests/ali/accept", "An incoming request can be approved")
    assert(text(profile.toJSON()).includes("Arkadaşsınız") && text(profile.toJSON()).replace(/\s+/g, " ").includes("5 bağlantı"), "Approval shows at once and the count goes up")
    // A friend's connections open from "N bağlantı"; tapping one opens their profile.
    let opened
    await act(async () => profile.update(React.createElement(require("../src/native/Store.tsx").StoreProvider, null, React.createElement(require("../src/screens/ProfileScreen.tsx").default, { userId: "ali", isOwn: false, navigate: (route, opts) => { opened = { route, opts } } }))))
    await settle()
    await press(profile, "Ali Kaya bağlantılarını göster")
    await settle()
    assert(text(profile.toJSON()).includes("Zeynep Aydın"), "A friend's connections are listed")
    assert(!profile.root.findAll(n => n.props.accessibilityLabel === "Zeynep Aydın arkadaşlıktan çıkar").length, "A friend's list is read-only")
    await press(profile, "Zeynep Aydın profilini aç")
    assert.deepEqual(opened, { route: "profile", opts: { userId: "zeynep" } }, "Tapping a connection opens their profile")
    // Removing a friend asks first, then shows the non-friend state.
    global.__testAlert = (_title, _message, buttons) => buttons?.find(button => button.style === "destructive")?.onPress?.()
    await settle()
    await press(profile, "Arkadaşlıktan çıkar")
    await settle()
    assert.equal(sent.at(-1), "DELETE /friends/ali", "A friend can be removed")
    assert(!text(profile.toJSON()).includes("Arkadaşsınız") && !profile.root.findAll(n => n.props.accessibilityLabel === "Ali Kaya bağlantılarını göster").length, "After removing, their connections are no longer open")
    global.__testAlert = undefined
    await act(async () => profile.unmount())
    // Without a shared event there is no button, only a hint.
    relation = { status: "none", canRequest: false, friendCount: 0 }
    const stranger = await mount("Profile", { userId: "ali", isOwn: false })
    await settle()
    assert(!stranger.root.findAll(n => n.props.accessibilityLabel === "Arkadaşlık isteği gönder").length && text(stranger.toJSON()).includes("Birlikte bir etkinliğe katıldığınızda"), "Without a shared event a hint replaces the button")
    assert(!stranger.root.findAll(n => n.props.accessibilityLabel === "Arşivi aç").length, "Another member's archive is never shown")
    await act(async () => stranger.unmount())
    // Own profile: "Bağlantı" is the friend count.
    const own = await mount("Profile")
    await settle()
    const stat = own.root.findAll(n => typeof n.props.children === "string" && n.props.children === "Bağlantı")[0]
    assert(stat, "Own profile has the Bağlantı stat")
    assert(text(own.toJSON()).replace(/\s+/g, " ").includes("7 Bağlantı"), "Own profile shows the friend count under Bağlantı")
    await press(own, "Bağlantılarımı göster")
    await settle()
    assert(text(own.toJSON()).includes("Ali Kaya") && own.root.findAll(n => n.props.accessibilityLabel === "Ali Kaya arkadaşlıktan çıkar").length, "Own connections are listed, each removable")
    await press(own, "Bağlantıları kapat")
    // "Katıldığı": the number of ended events joined; tapping lists them and opens one.
    assert(text(own.toJSON()).replace(/\s+/g, " ").includes("5 Katıldığı"), "Katıldığı = joined-and-ended + organized")
    assert(text(own.toJSON()).replace(/\s+/g, " ").includes("2 Düzenlediğim"), "Düzenlediğim = own events that started")
    await press(own, "Katıldığım etkinlikleri göster")
    await settle()
    assert(text(own.toJSON()).includes("Eski Sinema"), "Tapping Katıldığı lists those events")
    await press(own, "Listeyi kapat")
    // "Düzenlediği" opens its list the same way.
    await press(own, "Düzenlediğim etkinlikleri göster")
    await settle()
    assert(text(own.toJSON()).includes("Düzenlediğim etkinlikler") && text(own.toJSON()).includes("Yazlık Sinema"), "Tapping Düzenlediği lists the events you organized")
    await press(own, "Listeyi kapat")
    // Archive: every event I created, with its status; only on my own profile.
    await press(own, "Arşivi aç")
    await settle()
    const archive = text(own.toJSON()).replace(/\s+/g, " ")
    assert(archive.includes("Arşiv · 3") && archive.includes("Katılımcı Bekleniyor") && archive.includes("İptal edildi") && archive.includes("Sona erdi"), "The archive lists my events with their status")
    await act(async () => own.unmount())
    global.fetch = previousFetch
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
    storage.set("event-app.access-token", "a")
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

  // Another member's profile always shows "Benimle Tanışmadan Önce Bil", filled or empty.
  {
    storage.set("event-app.access-token", "a"); current = "approved"
    const other = { id: "other-user", firstName: "Ece", lastName: "Kaya", city: "İzmir", bio: "Hafta sonu tırmanışçısı 🧗", instagramUsername: null, rank: 4, profilePhoto: null, interests: [{ id: "padel", name: "Padel" }] }
    for (const [bio, expected] of [[other.bio, "Hafta sonu tırmanışçısı 🧗"], ["", "Ece henüz kendinden bahsetmemiş."]]) {
      global.__testOtherProfile = { ...other, bio }
      const theirs = await mount("Profile", { userId: "other-user" })
      await act(() => new Promise(resolve => setTimeout(resolve, 50)))
      assert(text(theirs.toJSON()).includes("Benimle Tanışmadan Önce Bil"), "The section is visible on another member's profile")
      assert(text(theirs.toJSON()).includes(expected), `Another member's profile shows: ${expected}`)
      assert(!theirs.root.findAllByType("Pressable").some(n => /Hakkımda yazısı/.test(String(n.props.accessibilityLabel))), "Nobody else can edit it")
      await act(async () => theirs.unmount())
    }
    global.__testOtherProfile = undefined
  }

  // Opening a room starts messages, seen-by and activity together; none waits for another.
  {
    storage.set("event-app.access-token", "a"); current = "approved"
    const previousFetch = global.fetch
    const started = []
    let releaseMessages
    const messagesGate = new Promise(resolve => { releaseMessages = resolve })
    global.fetch = async (url, options = {}) => {
      const path = new URL(url).pathname
      if (/\/events\/room-x\/(messages|messages\/reads|activity)$/.test(path)) {
        started.push(path.split("/room-x/")[1])
        if (path.endsWith("/messages")) await messagesGate
        const body = path.endsWith("/messages") ? { items: [], nextCursor: null } : path.endsWith("/reads") ? { items: [] } : { waitlist: [], checkins: [] }
        return { ok: true, status: 200, json: async () => body }
      }
      if (path === "/events/room-x") return { ok: true, status: 200, json: async () => ({ ...cardBase, id: "room-x", interest: { id: "film", slug: "film", name: "Film" }, locationName: "Sinema", confirmedParticipantCount: 2, minParticipants: 2, viewerParticipationStatus: "confirmed" }) }
      return previousFetch(url, options)
    }
    const room = await mount("EventRoom", { eventId: "room-x" })
    await act(() => new Promise(resolve => setTimeout(resolve, 30)))
    assert.deepEqual([...started].sort(), ["activity", "messages", "messages/reads"], "All three room requests start together while messages are still loading")
    releaseMessages()
    await act(() => new Promise(resolve => setTimeout(resolve, 20)))
    await act(async () => room.unmount())
    global.fetch = previousFetch
  }

  // Rooms open with the latest 20 messages; scrolling to the top fetches the previous 20.
  {
    storage.set("event-app.access-token", "a"); current = "approved"
    const previousFetch = global.fetch
    const messageUrls = []
    const page = (from, count) => Array.from({ length: count }, (_, i) => ({ id: `m${from + i}`, text: `mesaj ${from + i}`, createdAt: new Date(Date.UTC(2030, 0, 1, 0, from + i)).toISOString(), user: { id: "u", firstName: "Ece", lastName: "K" } }))
    global.fetch = async (url, options = {}) => {
      const parsed = new URL(url)
      if (parsed.pathname === "/events/room-p/messages") {
        messageUrls.push(parsed.search)
        const older = parsed.searchParams.get("cursor")
        return { ok: true, status: 200, json: async () => older ? { items: page(0, 20), nextCursor: null } : { items: page(20, 20), nextCursor: "c1" } }
      }
      if (/^\/events\/room-p\/(messages\/reads|activity)$/.test(parsed.pathname)) return { ok: true, status: 200, json: async () => parsed.pathname.endsWith("reads") ? { items: [] } : { waitlist: [], checkins: [] } }
      if (parsed.pathname === "/events/room-p") return { ok: true, status: 200, json: async () => ({ ...cardBase, id: "room-p", interest: { id: "film", slug: "film", name: "Film" }, locationName: "Sinema", confirmedParticipantCount: 2, minParticipants: 2, viewerParticipationStatus: "confirmed" }) }
      return previousFetch(url, options)
    }
    let room = await mount("EventRoom", { eventId: "room-p" })
    await act(() => new Promise(resolve => setTimeout(resolve, 50)))
    assert.deepEqual(messageUrls, ["?limit=20"], "A room opens with the latest 20 messages")
    // The list is flipped (opens at the newest message by itself); earlier messages load at the top.
    await tap(room, "Önceki mesajları göster")
    await act(() => new Promise(resolve => setTimeout(resolve, 30)))
    assert.deepEqual(messageUrls, ["?limit=20", "?cursor=c1&limit=20"], "Earlier messages load the previous 20")
    assert(text(room.toJSON()).includes("mesaj 0") && text(room.toJSON()).includes("mesaj 39"), "Both pages are shown")
    {
      // 40 messages a minute apart all have different times, so each keeps its own time.
      const times = room.root.findAllByType("Text").filter(n => /^\d{2}:\d{2}$/.test([].concat(n.props.children).join("")))
      assert.equal(times.length, 40, "Messages sent at different times are not merged under one time")
    }
    await act(async () => room.unmount())
    // Reopening loads the room with a single request. (The saved-messages catch-up needs the account id,
    // which each fresh test mount loads only after the room opens; see the cache test below.)
    messageUrls.length = 0
    room = await mount("EventRoom", { eventId: "room-p" })
    await act(() => new Promise(resolve => setTimeout(resolve, 60)))
    assert.equal(messageUrls.length, 1, "Reopening a room makes one messages request")
    assert(text(room.toJSON()).includes("mesaj 39"), "The newest messages are shown")
    await act(async () => room.unmount())
    global.fetch = previousFetch
  }

  // Saved chats: kept per account on the phone, restored after an app restart, read marks clear badges.
  {
    const cachePath = require.resolve("../src/services/chat-cache.ts")
    let cache = require(cachePath)
    cache.rememberRoom("acct-1", "room-x", [{ id: "m1", createdAt: "2026-10-20T10:00:00.000Z", text: "Merhaba", time: "13:00", user: { id: "u2", name: "Ada" } }], "c9")
    cache.rememberChatList("acct-1", [{ id: "conv-1", user: { id: "u2", firstName: "Ada", lastName: "Y", profilePhoto: null }, canSend: true, lastMessage: { id: "d1", conversationId: "conv-1", senderId: "u2", text: "Selam", createdAt: "2026-10-20T10:00:00.000Z" }, unreadCount: 2 }])
    cache.rememberRoomList("acct-1", [{ id: "room-x", ownerId: "u2", interest: { id: "film", name: "Film" }, date: "20/10/2026", startTime: "20:00", locationName: "Sinema", roomName: null, status: "waiting_participants", minParticipants: 2, maxParticipants: 8, confirmedParticipantCount: 2, participants: [], lastMessageAt: "2026-10-20T10:00:00.000Z", unreadCount: 3 }])
    await new Promise(resolve => setTimeout(resolve, 450))
    assert(storage.has("chat-cache:v1:acct-1"), "Chats are saved on the phone per account")
    // A restart: the module starts empty and reads the saved copy back.
    delete require.cache[cachePath]
    cache = require(cachePath)
    assert.equal(cache.cachedRoom("acct-1", "room-x"), undefined, "Nothing in memory before loading")
    await cache.hydrateChatCache("acct-1")
    assert.equal(cache.cachedRoom("acct-1", "room-x").items[0].text, "Merhaba", "Room messages come back after a restart")
    assert.equal(cache.cachedRoom("acct-1", "room-x").cursor, "c9")
    assert.equal(cache.cachedConversation("acct-1", "u2").id, "conv-1", "The chat with a person comes back")
    assert.equal(cache.cachedRoom("acct-2", "room-x"), undefined, "Another account never sees them")
    assert.equal(cache.cachedRoomList("acct-1")[0].id, "room-x", "The room list (Sohbetler) comes back after a restart too")
    cache.markRoomListRead("acct-1", "room-x")
    assert.equal(cache.cachedRoomList("acct-1")[0].unreadCount, 0, "A room read on this phone keeps no saved badge")
    cache.noteRead("acct-1", "conv-1", Date.parse("2026-10-20T10:05:00.000Z"))
    assert.equal(cache.applyLocalReads("acct-1", cache.cachedChatList("acct-1"))[0].unreadCount, 0, "A chat read on this phone shows no badge")
    // Live messages for a closed room are kept; they move the "complete up to" mark only while caught up.
    const live = (id, at) => ({ id, createdAt: at, text: id, time: "13:00", user: { id: "u2", name: "Ada" } })
    cache.appendLiveRoomMessage("acct-1", "room-x", live("m2", "2026-10-20T10:01:00.000Z"))
    assert.equal(cache.cachedRoom("acct-1", "room-x").items.at(-1).id, "m2", "A message arriving while the room is closed is kept")
    assert.equal(cache.cachedRoom("acct-1", "room-x").syncedAt, undefined, "After a restart live messages do not mark the copy complete")
    cache.markRoomSynced("acct-1", "room-x", "2026-10-20T10:01:00.000Z")
    cache.appendLiveRoomMessage("acct-1", "room-x", live("m3", "2026-10-20T10:02:00.000Z"))
    assert.equal(cache.cachedRoom("acct-1", "room-x").syncedAt, "2026-10-20T10:02:00.000Z", "Caught up and connected: live messages keep it complete")
    cache.markChatsStale()
    cache.appendLiveRoomMessage("acct-1", "room-x", live("m4", "2026-10-20T10:05:00.000Z"))
    assert.equal(cache.cachedRoom("acct-1", "room-x").syncedAt, "2026-10-20T10:02:00.000Z", "After a lost connection the gap is fetched on the next open")
    await cache.clearChatCache()
    assert.equal(cache.cachedChatList("acct-1").length, 0, "Signing out forgets the chats in memory")
  }

  // Chat: no global loader, and a sent message shows at once while delivery runs in the background.
  {
    storage.set("event-app.access-token", "a"); current = "approved"
    const { apiLoading } = require("../src/api/loading.ts")
    let busy = 0
    const unsubscribe = apiLoading.subscribe(count => { busy = Math.max(busy, count) })
    const previousFetch = global.fetch
    let releaseSend, failNext = false
    let sendGate = new Promise(resolve => { releaseSend = resolve })
    const sentTexts = []
    global.fetch = async (url, options = {}) => {
      const parsed = new URL(url)
      if (parsed.pathname === "/events/room-s/messages" && options.method === "POST") {
        const { text: body } = JSON.parse(options.body); sentTexts.push(body)
        await sendGate
        if (failNext) { failNext = false; return { ok: false, status: 500, text: async () => "fail" } }
        return { ok: true, status: 200, json: async () => ({ id: `srv-${sentTexts.length}`, text: body, createdAt: new Date().toISOString(), user: { id: "pending-user", firstName: "Bekleyen", lastName: "Üye" } }) }
      }
      if (parsed.pathname === "/events/room-s/messages") return { ok: true, status: 200, json: async () => ({ items: [], nextCursor: null }) }
      if (/^\/events\/room-s\/(messages\/reads|messages\/read|activity)$/.test(parsed.pathname)) return { ok: true, status: 200, json: async () => parsed.pathname.endsWith("activity") ? { waitlist: [], checkins: [] } : { items: [] } }
      if (parsed.pathname === "/events/room-s") return { ok: true, status: 200, json: async () => ({ ...cardBase, id: "room-s", interest: { id: "film", slug: "film", name: "Film" }, locationName: "Sinema", confirmedParticipantCount: 2, minParticipants: 2, viewerParticipationStatus: "confirmed" }) }
      return previousFetch(url, options)
    }
    // Messages go over the socket when it is connected; the fake socket answers like the server.
    const fakeSocket = require("./mock-socket.cjs")
    fakeSocket.setAction(async (name, payload) => {
      if (name !== "chat:message") return {}
      sentTexts.push(payload.text)
      await sendGate
      if (failNext) { failNext = false; throw new Error("send failed") }
      return { id: `srv-${sentTexts.length}`, text: payload.text, createdAt: new Date().toISOString(), user: { id: "pending-user", firstName: "Bekleyen", lastName: "Üye" } }
    })
    const room = await mount("EventRoom", { eventId: "room-s" })
    await act(() => new Promise(resolve => setTimeout(resolve, 50)))
    busy = 0
    const input = () => room.root.findAllByType("TextInput").find(n => n.props.placeholder === "Bir mesaj yaz…")
    await act(async () => input().props.onChangeText("Merhaba oda"))
    await act(async () => room.root.findAllByType("Pressable").find(n => n.props.accessibilityLabel === "Mesaj gönder").props.onPress())
    assert(text(room.toJSON()).includes("Merhaba oda") && text(room.toJSON()).includes("Gönderiliyor"), "The message appears at once, marked as sending")
    assert.equal(input().props.value, "", "The input clears without waiting for the server")
    releaseSend(); await act(() => new Promise(resolve => setTimeout(resolve, 30)))
    assert(!text(room.toJSON()).includes("Gönderiliyor") && text(room.toJSON()).includes("Merhaba oda"), "After delivery the server copy replaces it")
    sendGate = new Promise(resolve => { releaseSend = resolve }); failNext = true
    await act(async () => input().props.onChangeText("Kayıp mesaj"))
    await act(async () => room.root.findAllByType("Pressable").find(n => n.props.accessibilityLabel === "Mesaj gönder").props.onPress())
    releaseSend(); await act(() => new Promise(resolve => setTimeout(resolve, 30)))
    assert(text(room.toJSON()).includes("Gönderilemedi"), "A failed send stays visible with a retry option")
    await act(async () => room.root.findAllByType("Pressable").find(n => n.props.accessibilityLabel === "Mesajı tekrar gönder").props.onPress())
    await act(() => new Promise(resolve => setTimeout(resolve, 30)))
    assert(!text(room.toJSON()).includes("Gönderilemedi") && text(room.toJSON()).includes("Kayıp mesaj"), "Retry delivers the message")
    assert.deepEqual(sentTexts, ["Merhaba oda", "Kayıp mesaj", "Kayıp mesaj"])
    assert.equal(busy, 0, "Chat requests never show the global loading overlay")
    await act(async () => room.unmount())
    unsubscribe()
    fakeSocket.setAction(async () => ({}))
    global.fetch = previousFetch
  }

  // Name/photo once per same-sender run; times merge only within the same minute.
  {
    storage.set("event-app.access-token", "a"); current = "approved"
    const previousFetch = global.fetch
    const at = minute => new Date(Date.UTC(2030, 0, 1, 7, minute)).toISOString()
    const msg = (id, who, minute) => ({ id, text: `t-${id}`, createdAt: new Date(Date.parse(at(minute)) + ["a2"].includes(id) * 20000).toISOString(), user: { id: who, firstName: who, lastName: "X" } })
    global.fetch = async (url, options = {}) => {
      const parsed = new URL(url)
      if (parsed.pathname === "/events/room-g/messages") return { ok: true, status: 200, json: async () => ({ items: [msg("a1", "ali", 0), msg("a2", "ali", 0), msg("a3", "ali", 1), msg("b1", "banu", 1)], nextCursor: null }) }
      if (/^\/events\/room-g\/(messages\/reads|messages\/read|activity)$/.test(parsed.pathname)) return { ok: true, status: 200, json: async () => parsed.pathname.endsWith("activity") ? { waitlist: [], checkins: [] } : { items: [] } }
      if (parsed.pathname === "/events/room-g") return { ok: true, status: 200, json: async () => ({ ...cardBase, id: "room-g", interest: { id: "film", slug: "film", name: "Film" }, locationName: "Sinema", confirmedParticipantCount: 2, minParticipants: 2, viewerParticipationStatus: "confirmed" }) }
      return previousFetch(url, options)
    }
    const room = await mount("EventRoom", { eventId: "room-g" })
    await act(() => new Promise(resolve => setTimeout(resolve, 50)))
    const times = room.root.findAllByType("Text").map(n => [].concat(n.props.children).join("")).filter(value => /^\d{2}:\d{2}$/.test(value))
    assert.equal(times.length, 3, "a1+a2 (same minute) share one time; a3 (next minute) and banu's message each get their own")
    assert.equal(room.root.findAllByType("Text").filter(n => ["ali", "banu"].includes([].concat(n.props.children).join(""))).length, 2, "A run of the same sender shows the name once, whatever the minutes")
    await act(async () => room.unmount())
    global.fetch = previousFetch
  }

  // A just-sent message sorts last even though the server writes "+03:00" times and the device "Z".
  {
    storage.set("event-app.access-token", "a"); current = "approved"
    const previousFetch = global.fetch
    const pad = n => String(n).padStart(2, "0")
    const plus3 = date => { const t = new Date(date.getTime() + 3 * 3600000); return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}T${pad(t.getUTCHours())}:${pad(t.getUTCMinutes())}:${pad(t.getUTCSeconds())}.000+03:00` }
    const earlier = plus3(new Date(Date.now() - 10 * 60000))
    let release
    const gate = new Promise(resolve => { release = resolve })
    const fakeSocket = require("./mock-socket.cjs")
    fakeSocket.setAction(async (name, payload) => name !== "chat:message" ? {} : (await gate, { id: "srv-new", text: payload.text, createdAt: plus3(new Date()), user: { id: "pending-user", firstName: "Bekleyen", lastName: "Üye" } }))
    global.fetch = async (url, options = {}) => {
      const parsed = new URL(url)
      if (parsed.pathname === "/events/room-o/messages") return { ok: true, status: 200, json: async () => ({ items: [{ id: "old", text: "Eski mesaj", createdAt: earlier, user: { id: "other", firstName: "Ece", lastName: "K" } }], nextCursor: null }) }
      if (/^\/events\/room-o\/(messages\/reads|messages\/read|activity)$/.test(parsed.pathname)) return { ok: true, status: 200, json: async () => parsed.pathname.endsWith("activity") ? { waitlist: [], checkins: [] } : { items: [] } }
      if (parsed.pathname === "/events/room-o") return { ok: true, status: 200, json: async () => ({ ...cardBase, id: "room-o", interest: { id: "film", slug: "film", name: "Film" }, locationName: "Sinema", confirmedParticipantCount: 2, minParticipants: 2, viewerParticipationStatus: "confirmed" }) }
      return previousFetch(url, options)
    }
    const room = await mount("EventRoom", { eventId: "room-o" })
    await act(() => new Promise(resolve => setTimeout(resolve, 50)))
    await act(async () => room.root.findAllByType("TextInput").find(n => n.props.placeholder === "Bir mesaj yaz…").props.onChangeText("Yeni mesaj"))
    await act(async () => room.root.findAllByType("Pressable").find(n => n.props.accessibilityLabel === "Mesaj gönder").props.onPress())
    const order = () => { const all = text(room.toJSON()); return all.indexOf("Eski mesaj") < all.indexOf("Yeni mesaj") }
    assert(order(), "While sending, the new message sits below the older one")
    release(); await act(() => new Promise(resolve => setTimeout(resolve, 30)))
    assert(order(), "After delivery the new message stays at the bottom")
    await act(async () => room.unmount())
    fakeSocket.setAction(async () => ({}))
    global.fetch = previousFetch
  }

  // Room participants: sorted by name, active/passive from presence, tap opens the profile.
  {
    storage.set("event-app.access-token", "a"); current = "approved"
    const previousFetch = global.fetch
    const fakeSocket = require("./mock-socket.cjs")
    fakeSocket.setAction(async name => name === "event:presence" ? ["ali"] : {})
    global.fetch = async (url, options = {}) => {
      const parsed = new URL(url)
      if (parsed.pathname === "/events/room-u/messages") return { ok: true, status: 200, json: async () => ({ items: [], nextCursor: null }) }
      if (/^\/events\/room-u\/(messages\/reads|messages\/read|activity)$/.test(parsed.pathname)) return { ok: true, status: 200, json: async () => parsed.pathname.endsWith("activity") ? { waitlist: [], checkins: [] } : { items: [] } }
      if (parsed.pathname === "/events/room-u") return { ok: true, status: 200, json: async () => ({ ...cardBase, id: "room-u", owner: { id: "host", firstName: "Ev", lastName: "Sahibi" }, interest: { id: "film", slug: "film", name: "Film" }, locationName: "Sinema", confirmedParticipantCount: 3, minParticipants: 2, viewerParticipationStatus: "confirmed", participants: [{ id: "zeynep", firstName: "Zeynep", lastName: "Aydın" }, { id: "ali", firstName: "Ali", lastName: "Kaya" }, { id: "host", firstName: "Ev", lastName: "Sahibi" }] }) }
      return previousFetch(url, options)
    }
    let opened
    const room = await mount("EventRoom", { eventId: "room-u", navigate: (route, opts) => { opened = { route, opts } } })
    await act(() => new Promise(resolve => setTimeout(resolve, 400)))
    assert(!room.root.findAllByType("Modal").length, "The room sheet starts closed")
    await act(async () => room.root.findAllByType("Pressable").find(n => String(n.props.accessibilityLabel).startsWith("Film · ")).props.onPress())
    assert(room.root.findAllByType("Modal").length > 0 && text(room.toJSON()).replace(/\s+/g, " ").includes("Katılımcılar · 3"), "Tapping the room name opens the sheet with participants")
    const rows = () => room.root.findAllByType("Pressable").filter(n => / profilini aç$/.test(String(n.props.accessibilityLabel)))
    assert.deepEqual(rows().map(n => n.props.accessibilityLabel), ["Ali Kaya profilini aç", "Ev Sahibi profilini aç", "Zeynep Aydın profilini aç"], "Participants are sorted by name")
    const status = name => rows().find(n => n.props.accessibilityLabel.startsWith(name)).findAll(n => n.props.accessibilityLabel === "Odada").length ? "Aktif" : "Pasif"
    assert(!/Aktif|Pasif/.test(text(room.toJSON())), "No Aktif/Pasif text under participants")
    assert.equal(status("Ali"), "Aktif", "Someone in the room shows as active")
    assert.equal(status("Zeynep"), "Pasif", "Someone not in the room shows as passive")
    const socket = fakeSocket.instances.at(-1)
    await act(async () => socket.receive("chat:user_joined", { eventId: "room-u", userId: "zeynep" }))
    assert.equal(status("Zeynep"), "Aktif", "Joining the room turns a member active live")
    await act(async () => rows().find(n => n.props.accessibilityLabel.startsWith("Ali")).props.onPress())
    assert.deepEqual(opened, { route: "profile", opts: { userId: "ali" } }, "Tapping a participant opens their profile")
    assert(!room.root.findAllByType("Modal").length, "The sheet closes when a profile opens")
    // "Etkinliğe git" lives in the sheet (no icon in the header): it opens the event detail and closes the sheet.
    assert(!room.root.findAll(n => n.props.accessibilityLabel === "Etkinlik detayına git").length, "No event icon in the header")
    await act(async () => room.root.findAllByType("Pressable").find(n => String(n.props.accessibilityLabel).startsWith("Film · ")).props.onPress())
    await act(async () => room.root.findAll(n => n.props.accessibilityLabel === "Etkinliğe git" && typeof n.props.onPress === "function")[0].props.onPress())
    assert.deepEqual(opened, { route: "event-detail", opts: { eventId: "room-u" } }, "Etkinliğe git in the sheet opens the event detail")
    assert(!room.root.findAllByType("Modal").length, "The sheet closes when the event opens")
    await act(async () => room.unmount())
    fakeSocket.setAction(async () => ({}))
    global.fetch = previousFetch
  }

  // Live messages: a failed room join is retried, and "room:message" on the user's own channel
  // fetches the newest page when the chat event never arrives.
  {
    storage.set("event-app.access-token", "a"); current = "approved"
    const previousFetch = global.fetch
    const fakeSocket = require("./mock-socket.cjs")
    let joins = 0
    fakeSocket.setAction(async name => { if (name === "event:join" && ++joins === 1) throw new Error("ROOM_LIMIT"); return name === "event:presence" ? [] : {} })
    const serverMessages = []
    let messageFetches = 0
    global.fetch = async (url, options = {}) => {
      const parsed = new URL(url)
      if (parsed.pathname === "/events/room-u/messages") { messageFetches++; return { ok: true, status: 200, json: async () => ({ items: [...serverMessages], nextCursor: null }) } }
      if (/^\/events\/room-u\/(messages\/reads|messages\/read|activity)$/.test(parsed.pathname)) return { ok: true, status: 200, json: async () => parsed.pathname.endsWith("activity") ? { waitlist: [], checkins: [] } : { items: [] } }
      if (parsed.pathname === "/events/room-u") return { ok: true, status: 200, json: async () => ({ ...cardBase, id: "room-u", owner: { id: "host", firstName: "Ev", lastName: "Sahibi" }, interest: { id: "film", slug: "film", name: "Film" }, locationName: "Sinema", confirmedParticipantCount: 3, minParticipants: 2, viewerParticipationStatus: "confirmed", participants: [{ id: "ali", firstName: "Ali", lastName: "Kaya" }] }) }
      return previousFetch(url, options)
    }
    const room = await mount("EventRoom", { eventId: "room-u" })
    await act(() => new Promise(resolve => setTimeout(resolve, 1300)))
    assert(joins >= 2, "A failed room join is retried")
    const socket = fakeSocket.instances.at(-1)
    // Delivered by the chat event: no extra fetch.
    const first = { id: "m1", text: "Canlı mesaj", createdAt: new Date().toISOString(), user: { id: "ali", firstName: "Ali", lastName: "Kaya" } }
    const before = messageFetches
    await act(async () => { socket.receive("chat:message_created", { eventId: "room-u", message: first }); socket.receive("room:message", { eventId: "room-u", at: first.createdAt, userId: "ali" }) })
    await act(() => new Promise(resolve => setTimeout(resolve, 1600)))
    assert(text(room.toJSON()).includes("Canlı mesaj"), "A chat event shows the message at once")
    assert.equal(messageFetches, before, "No fallback fetch when the chat event arrived")
    // Chat event lost: the user-channel notice fetches it.
    const second = { id: "m2", text: "Kaçan mesaj", createdAt: new Date(Date.now() + 1000).toISOString(), user: { id: "ali", firstName: "Ali", lastName: "Kaya" } }
    serverMessages.push(first, second)
    await act(async () => socket.receive("room:message", { eventId: "room-u", at: second.createdAt, userId: "ali" }))
    await act(() => new Promise(resolve => setTimeout(resolve, 1600)))
    assert(text(room.toJSON()).includes("Kaçan mesaj"), "A message whose chat event never arrived still appears")
    await act(async () => room.unmount())
    fakeSocket.setAction(async () => ({}))
    global.fetch = previousFetch
  }

  // Room name: only the organizer can change it; every member sees the new name live.
  {
    storage.set("event-app.access-token", "a"); current = "approved"
    const previousFetch = global.fetch
    const fakeSocket = require("./mock-socket.cjs")
    fakeSocket.setAction(async name => name === "event:presence" ? [] : {})
    const renames = []
    const roomEvent = owner => ({ ...cardBase, id: "room-n", owner, interest: { id: "film", slug: "film", name: "Film" }, locationName: "Sinema", confirmedParticipantCount: 3, minParticipants: 2, viewerParticipationStatus: "confirmed", participants: [{ id: "ali", firstName: "Ali", lastName: "Kaya" }], roomName: null })
    let owner = { id: "pending-user", firstName: "Bekleyen", lastName: "Üye" }
    global.fetch = async (url, options = {}) => {
      const parsed = new URL(url)
      if (parsed.pathname === "/events/room-n/room-name") { const body = JSON.parse(options.body); renames.push({ method: options.method, body }); return { ok: true, status: 200, json: async () => ({ eventId: "room-n", roomName: body.name || null }) } }
      if (/^\/events\/room-n\/(messages|messages\/reads|messages\/read|activity)$/.test(parsed.pathname)) return { ok: true, status: 200, json: async () => parsed.pathname.endsWith("activity") ? { waitlist: [], checkins: [] } : { items: [], nextCursor: null } }
      if (parsed.pathname === "/events/room-n") return { ok: true, status: 200, json: async () => roomEvent(owner) }
      return previousFetch(url, options)
    }
    const openSheet = async tree => act(async () => tree.root.findAllByType("Pressable").find(n => String(n.props.accessibilityLabel).startsWith("Film · ") || n.props.accessibilityLabel === "Cuma Film Ekibi").props.onPress())
    const field = tree => tree.root.findAll(n => n.props.accessibilityLabel === "Oda adı" && typeof n.props.onChangeText === "function")[0]
    // Organizer: can rename; the header shows the new name at once.
    const mine = await mount("EventRoom", { eventId: "room-n" })
    await act(() => new Promise(resolve => setTimeout(resolve, 300)))
    await openSheet(mine)
    assert(field(mine), "The organizer sees the room name field")
    await act(async () => field(mine).props.onChangeText("  Cuma   Film Ekibi "))
    await act(async () => mine.root.findAll(n => typeof n.props.onPress === "function" && text(n).trim() === "Oda adını kaydet")[0].props.onPress())
    await act(() => new Promise(resolve => setTimeout(resolve, 30)))
    assert.deepEqual(renames, [{ method: "PATCH", body: { name: "Cuma Film Ekibi" } }], "The new name is sent once, trimmed")
    assert(text(mine.toJSON()).includes("Cuma Film Ekibi"), "The organizer sees the new name right away")
    const systemLine = (id, owner, name) => ({ eventId: "room-n", message: { id, kind: "system", text: `oda adını “${name}” olarak değiştirdi`, createdAt: new Date().toISOString(), user: owner } })
    await act(async () => fakeSocket.instances.at(-1).receive("chat:message_created", systemLine("sys-1", { id: "pending-user", firstName: "Bekleyen", lastName: "Üye" }, "Cuma Film Ekibi")))
    assert(text(mine.toJSON()).replace(/\s+/g, " ").includes("Sen oda adını “Cuma Film Ekibi” olarak değiştirdi"), "The organizer sees the change as a system line")
    await act(async () => mine.unmount())
    // Member: no field; a rename by the organizer arrives over the socket and replaces the title.
    owner = { id: "host", firstName: "Ev", lastName: "Sahibi" }
    const member = await mount("EventRoom", { eventId: "room-n" })
    await act(() => new Promise(resolve => setTimeout(resolve, 300)))
    await openSheet(member)
    assert(!field(member), "Other members cannot rename the room")
    await act(async () => fakeSocket.instances.at(-1).receive("room:renamed", { eventId: "room-n", roomName: "Pazar Sinema" }))
    assert(text(member.toJSON()).includes("Pazar Sinema"), "Members see the organizer's new name live")
    await act(async () => fakeSocket.instances.at(-1).receive("chat:message_created", systemLine("sys-2", owner, "Pazar Sinema")))
    const chat = text(member.toJSON()).replace(/\s+/g, " ")
    assert(chat.includes("Ev oda adını “Pazar Sinema” olarak değiştirdi"), "Members see who renamed the room, WhatsApp-style")
    assert(!member.root.findAll(n => n.props.accessibilityLabel === "Mesaj seçenekleri" && text(n).includes("Pazar Sinema")).length, "A system line is not a bubble with message actions")
    // The organizer cancels: the open room stops taking messages live; the history stays readable.
    assert(member.root.findAll(n => n.props.accessibilityLabel === "Mesaj gönder").length, "Before cancelling, messages can be sent")
    await act(async () => fakeSocket.instances.at(-1).receive("event:cancelled", { eventId: "room-n", status: "cancelled" }))
    const closed = text(member.toJSON()).replace(/\s+/g, " ")
    assert(closed.includes("Etkinlik sahibi etkinliği iptal etti") && !member.root.findAll(n => n.props.accessibilityLabel === "Mesaj gönder").length, "After cancelling, the room cannot send messages")
    assert(closed.includes("Ev oda adını “Pazar Sinema” olarak değiştirdi"), "The history stays readable")
    await act(async () => member.unmount())
    fakeSocket.setAction(async () => ({}))
    global.fetch = previousFetch
  }

  // Rooms reloads only the user's own, joined and favourite events and the one-to-one chats (on open and on pull).
  storage.set("event-app.access-token", "a"); current = "approved"
  const roomsTree = await mount("Rooms")
  await act(() => new Promise(resolve => setTimeout(resolve, 50)))
  calls.length = 0
  await act(async () => { roomsTree.root.findAll(n => n.props.refreshControl)[0].props.refreshControl.props.onRefresh() })
  await act(() => new Promise(resolve => setTimeout(resolve, 50)))
  // Pulling down refreshes the rooms and the one-to-one chats together, nothing heavier.
  assert.deepEqual([...calls].sort(), ["/direct", "/events/rooms"], "Rooms refresh reloads only the rooms and the chats")
  await act(async () => roomsTree.unmount())

  // A room only known from /events/rooms is listed; a summary never wipes details already loaded.
  {
    const { mergeRoomSummaries, mapApiEvent } = require("../src/native/Store.tsx")
    const room = { id: "room-only", ownerId: "host", interest: { id: "film", name: "Film" }, date: "22/10/2030", startTime: "20:30", locationName: "Sinema", status: "started", minParticipants: 2, maxParticipants: 8, confirmedParticipantCount: 3, participants: [{ id: "pending-user", firstName: "Bekleyen", lastName: "Üye" }], lastMessageAt: "2030-10-20T10:00:00.000Z", unreadCount: 2 }
    global.__testRooms = [room]
    storage.set("event-app.access-token", "a"); current = "approved"
    const onlyRooms = await mount("Rooms")
    await act(() => new Promise(resolve => setTimeout(resolve, 50)))
    assert(text(onlyRooms.toJSON()).includes("Film · 22/10/2030"), "A room from /events/rooms appears in the list")
    assert(onlyRooms.root.findAll(n => n.props.accessibilityLabel === "2 okunmamış mesaj").length > 0, "Its unread count comes from the summary")
    await act(async () => onlyRooms.unmount())
    global.__testRooms = undefined
    const full = { ...mapApiEvent({ id: "room-only", owner: { id: "host", firstName: "Ev", lastName: "Sahibi" }, interest: { id: "film", slug: "film", name: "Film" }, level: null, date: "22/10/2030", startTime: "20:30", durationMinutes: 90, locationName: "Sinema", latitude: 41, longitude: 29, minParticipants: 2, maxParticipants: 8, coverPhoto: "https://example.com/cover.jpg", description: "Uzun açıklama", requirements: null, confirmedParticipantCount: 2, participants: [], isFavorite: true, status: { enum: "waiting_participants", name: "" }, viewerParticipationStatus: "confirmed" }) }
    const [merged] = mergeRoomSummaries([full], [room])
    assert.equal(merged.description, "Uzun açıklama", "A room summary keeps the loaded description")
    assert.equal(merged.coverImage, "https://example.com/cover.jpg", "A room summary keeps the loaded cover")
    assert.equal(merged.currentParticipants, 3, "A room summary updates the participant count")
    assert.equal(merged.status, "started", "A room summary updates the status")
  }

  // Pulling the home feed down reloads it from the server.
  storage.set("event-app.access-token", "a"); current = "approved"
  const home = await mount("Discover")
  await act(() => new Promise(resolve => setTimeout(resolve, 50)))
  const pull = () => home.root.findAll(n => n.props.refreshControl)[0].props.refreshControl
  assert(pull(), "Home feed supports pull-to-refresh")
  calls.length = 0; urls.length = 0
  await act(async () => { pull().props.onRefresh() })
  await act(() => new Promise(resolve => setTimeout(resolve, 50)))
  assert.deepEqual(calls, ["/events", "/events"], "Discover pull-to-refresh reloads only the feed")
  const feedUrls = urls.map(url => new URL(url)).filter(url => url.pathname === "/events")
  assert.equal(feedUrls[0].searchParams.get("includePhotos"), "false", "The list comes first, without the heavy covers")
  assert.equal(feedUrls[1].searchParams.get("includePhotos"), null, "Covers follow in a second request")
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

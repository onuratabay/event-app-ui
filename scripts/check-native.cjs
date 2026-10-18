// Render every migrated screen against native host mocks, then exercise key flows.
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const Module = require("node:module")
const ts = require("typescript")
const React = require("react")
const { create, act } = require("react-test-renderer")
global.IS_REACT_ACT_ENVIRONMENT = true
// React Native provides requestAnimationFrame; Node does not.
global.requestAnimationFrame = callback => setTimeout(() => callback(Date.now()), 0)
global.__DEV__ = true
// Swapping the fake server stands in for a different backend, so the app's in-memory
// session cache (catalogs, settings) must not leak between suites.
{
  let currentFetch
  const clientPath = require("node:path").join(__dirname, "../src/api/client.ts")
  Object.defineProperty(global, "fetch", {
    configurable: true,
    get: () => currentFetch,
    set: value => { currentFetch = value; require.cache[clientPath]?.exports.clearSessionCache?.() },
  })
}
global.fetch = async () => ({ ok: true, json: async () => ({ items: [], total: 0 }) })
for (const extension of [".ts", ".tsx"])
  require.extensions[extension] = (module, filename) => {
    const source = fs.readFileSync(filename, "utf8")
    module._compile(
      ts.transpileModule(source, {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          jsx: ts.JsxEmit.ReactJSX,
          target: ts.ScriptTarget.ES2020,
          esModuleInterop: true,
        },
      }).outputText,
      filename,
    )
  }
// Metro resolves bundled image assets; the Node host renderer uses filenames.
require.extensions[".png"] = (module, filename) => { module.exports = filename }
const originalLoad = Module._load
const flatten = (s) =>
  Array.isArray(s) ? Object.assign({}, ...s.map(flatten)) : s || {}
class Value {
  constructor(value) {
    this.value = value
  }
  setValue(value) { this.value = value }
  stopAnimation() {}
  interpolate() {
    return this.value
  }
}
const anim = () => ({ start() {}, stop() {} })
const storage = new Map()
Module._load = function (id, parent, isMain) {
  if (id === "expo-router") return { useFocusEffect: callback => React.useEffect(callback, [callback]), usePathname: () => global.__testPathname || "/discover", useLocalSearchParams: () => global.__testParams || {}, useGlobalSearchParams: () => global.__testParams || {}, useRootNavigationState: () => global.__testRootState, useRouter: () => ({ navigate: href => { global.__testMethods?.push("navigate"); global.__testNavigations?.push(href.pathname ?? href) }, replace: href => { global.__testMethods?.push("replace"); global.__testNavigations?.push(href.pathname ?? href) }, push: href => { global.__testMethods?.push("push"); global.__testNavigations?.push(href.pathname ?? href) }, back: () => global.__testNavigations?.push("back"), canGoBack: () => { let state = global.__testRootState; while (state?.routes?.[state.index ?? 0]?.state) state = state.routes[state.index ?? 0].state; return (state?.index ?? 0) > 0 }, canDismiss: () => true, dismissAll: () => global.__testNavigations?.push("dismissAll") }) }
  if (id === "socket.io-client") return require("./mock-socket.cjs")
  if (id === "expo-notifications") { global.__expoNotificationsLoaded = true; return global.__testNotifications || {} }
  if (id === "expo-device") return { isDevice: true }
  if (id === "expo-location") return {
    getForegroundPermissionsAsync: async () => ({ granted: global.__testForegroundLocationPermission === true }), requestForegroundPermissionsAsync: async () => ({ granted: global.__testLocationPermission === true }),
    Accuracy: { Balanced: 3 }, getCurrentPositionAsync: async () => global.__testCurrentPosition ? global.__testCurrentPosition() : ({ coords: { latitude: 39.92, longitude: 32.85 } }), geocodeAsync: async () => [{ latitude: 39.92, longitude: 32.85 }], reverseGeocodeAsync: async () => global.__testReverseGeocode || [],
  }
  if (id === "react-native-maps") return { __esModule: true, default: "MapView", Marker: "Marker", Circle: "Circle" }
  if (id === "expo-constants") return { __esModule: true, default: { expoConfig: { hostUri: "192.168.1.15:8081" } } }
  if (id === "react-native")
    return {
      View: "View",
      ActivityIndicator: "ActivityIndicator",
      KeyboardAvoidingView: "KeyboardAvoidingView",
      RefreshControl: "RefreshControl",
      Text: "Text",
      Pressable: "Pressable",
      ScrollView: "ScrollView",
      TextInput: "TextInput",
      Modal: "Modal",
      Switch: "Switch",
      Platform: { OS: process.env.TEST_PLATFORM || "ios" },
      useWindowDimensions: () => ({ width: global.__testWindowWidth || 390, height: 844, scale: 3, fontScale: 1 }),
      // Tests may answer dialogs through global.__testAlert (e.g. press the destructive button).
      Alert: { alert: (...args) => global.__testAlert?.(...args) },
      AppState: { currentState: "active", addEventListener: () => ({ remove() {} }) },
      Keyboard: { addListener: (name, handler) => { (global.__testKeyboardListeners ||= {})[name] = handler; return { remove() { if (global.__testKeyboardListeners?.[name] === handler) delete global.__testKeyboardListeners[name] } } }, dismiss: () => { global.__testKeyboardDismissed = true } },
      BackHandler: { addEventListener: (_name, handler) => { global.__testBackHandler = handler; return { remove() { global.__testBackHandler = undefined } } } },
      AccessibilityInfo: { isReduceMotionEnabled: async () => false, announceForAccessibility() {}, getRecommendedTimeoutMillis: async value => value },
      Easing: { linear: value => value, quad: value => value ** 2, cubic: value => value ** 3, out: easing => easing, inOut: easing => easing },
      Linking: { openURL: async url => { global.__openedUrl = url }, canOpenURL: async () => true },
      Share: { share: async value => { global.__lastShare = value; return {} } },
      StyleSheet: {
        create: (s) => s,
        flatten,
        absoluteFill: {
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
        },
      },
      Animated: {
        View: "View",
        createAnimatedComponent: (c) => c,
        Value,
        timing: anim,
        loop: anim,
        sequence: anim,
        multiply: () => new Value(0),
        spring: anim,
      },
    }
  if (id === "react-native-svg")
    return new Proxy({ __esModule: true, default: "Svg" }, {
      get: (o, k) => o[k] || k,
    })
  if (id === "expo-contacts/legacy") return { Fields: { PhoneNumbers: "phoneNumbers" } }
  if (id === "expo-haptics") return { impactAsync: async () => {}, ImpactFeedbackStyle: { Light: "light" } }
  if (id === "expo-image") return { Image: "Image" }
  if (id === "expo-linear-gradient") return { LinearGradient: "LinearGradient" }
  if (id === "expo-blur") return { BlurView: "BlurView", BlurTargetView: "BlurTargetView" }
  if (id === "react-native-safe-area-context") return { SafeAreaView: "View", useSafeAreaInsets: () => ({ top: 47, bottom: 34, left: 0, right: 0 }) }
  if (id === "@react-native-community/datetimepicker")
    return { __esModule: true, default: "DateTimePicker" }
  if (id === "@react-native-async-storage/async-storage")
    return {
      __esModule: true,
      default: {
        getItem: async (k) => storage.get(k) || null,
        setItem: async (k, v) => storage.set(k, v),
        removeItem: async (k) => storage.delete(k),
        multiRemove: async (keys) => keys.forEach(key => storage.delete(key)),
        multiSet: async (entries) => entries.forEach(([k, v]) => storage.set(k, v)),
      },
    }
  if (id === "expo-image-picker")
    return { launchImageLibraryAsync: async () => ({ canceled: true }) }
  if (id === "expo-clipboard") return { setStringAsync: async value => { global.__clipboard = value } }
  if (id === "expo-file-system")
    return { File: class {}, Paths: { document: "/mock" } }
  return originalLoad.call(this, id, parent, isMain)
}
const errors = []
const oldError = console.error
console.error = (...args) => {
  if (!String(args[0]).includes("react-test-renderer is deprecated"))
    errors.push(args.join(" "))
}
const { StoreProvider } = require("../src/native/Store.tsx")
const { EVENTS } = require("../src/data.ts")
function text(node) {
  if (typeof node === "string") return node
  return (node?.children || []).map(text).join(" ")
}
function audit(node, parent) {
  if (node == null) return
  if (Array.isArray(node)) {
    node.forEach((n) => audit(n, parent))
    return
  }
  if (typeof node === "string") {
    assert.equal(parent, "Text", `Raw text outside native Text: ${node}`)
    return
  }
  assert(
    !["div", "span", "p", "button", "input", "img", "svg"].includes(node.type),
    `DOM host ${node.type}`,
  )
  node.children?.forEach((n) => audit(n, node.type))
}
async function mount(name, props = {}) {
  const Screen = require(`../src/screens/${name}Screen.tsx`).default
  let tree
  await act(async () => {
    tree = create(
      React.createElement(
        StoreProvider,
        null,
        React.createElement(Screen, { navigate: () => {}, ...props }),
      ),
      { createNodeMock: node => node.type === "MapView" ? {
        animateToRegion(region) { global.__testMapCameraActions?.push({ type: "region", region }) },
        fitToCoordinates(coordinates) { global.__testMapCameraActions?.push({ type: "fit", coordinates }) },
      } : ({ scrollToEnd() { global.__scrollToEndCalls = (global.__scrollToEndCalls || 0) + 1 }, scrollTo() {}, focus() {} }) },
    )
  })
  audit(tree.toJSON())
  return tree
}
async function tap(tree, label) {
  const buttons = tree.root.findAllByType("Pressable")
  const node = buttons.find((n) => text(n).includes(label))
  assert(node, `Missing button: ${label}`)
  await act(async () => node.props.onPress?.({ stopPropagation() {} }))
  audit(tree.toJSON())
}
;(async () => {
  if (process.env.TEST_WALKTHROUGH_ONLY === "1") {
    await require("./check-walkthrough.cjs")({ act, text, audit, storage })
    assert.equal(errors.length, 0, errors.join("\n"))
    return
  }
  // Selection behavior must remain identical on both platform hosts, including leap-day clamping.
  const Wheel = require("../src/components/DateTimeWheel.tsx").default
  let wheel, result, closed = 0
  await act(async () => { wheel = create(React.createElement(Wheel, { mode: "date", value: "2024-01-31", onConfirm: value => { result = value }, onClose: () => { closed++ } }), { createNodeMock: () => ({ scrollTo() {} }) }) })
  const february = wheel.root.findAllByType("Pressable").find(node => node.props.accessibilityLabel === "Ay: Şubat")
  await act(async () => february.props.onPress())
  const confirm = wheel.root.findAllByType("Pressable").find(node => text(node.toJSON ? node.toJSON() : null) === "Tamam" || node.findAllByType("Text").some(child => child.props.children === "Tamam"))
  await act(async () => confirm.props.onPress())
  assert.equal(result, "2024-02-29")
  assert.equal(closed, 1)
  await act(async () => wheel.unmount())
  result = undefined
  await act(async () => { wheel = create(React.createElement(Wheel, { mode: "time", value: "23:59", onConfirm: value => { result = value }, onClose: () => { closed++ } })) })
  const cancel = wheel.root.findAllByType("Pressable").find(node => node.findAllByType("Text").some(child => child.props.children === "İptal"))
  await act(async () => cancel.props.onPress())
  assert.equal(result, undefined, "Cancelling does not mutate the field")
  await act(async () => wheel.unmount())
  console.log(`PASS: ${process.env.TEST_PLATFORM || "ios"} common date/time panel, leap-day selection and cancellation.`)

  const { resolveApiUrl } = require("../src/api/config.ts")
  assert.equal(resolveApiUrl(undefined, "192.168.1.15:8081", "ios"), "http://192.168.1.15:3000")
  assert.equal(resolveApiUrl(undefined, "192.168.1.25:8081", "android"), "http://192.168.1.25:3000")
  assert.equal(resolveApiUrl("https://api.example.com/", "192.168.1.15:8081", "ios"), "https://api.example.com")
  assert.equal(resolveApiUrl(undefined, undefined, "android"), "http://10.0.2.2:3000")
  const api = require("../src/api/client.ts")
  const server = require("./mock-server.cjs")();
  const { mapApiEvent, mapApiEventPreservingCover } = require("../src/native/Store.tsx")
  const photoFree = { ...server.events[0], coverPhoto: null }
  const defaultCover = mapApiEvent(photoFree).coverImage
  assert(defaultCover.startsWith("https://images.unsplash.com/"), "Events without stored photos use the project's category cover")
  const actualCover = "data:image/png;base64,iVBORw0KGgo="
  const existing = { ...mapApiEvent(photoFree), coverImage: actualCover }
  assert.equal(mapApiEventPreservingCover(photoFree, existing).coverImage, actualCover, "Photo-free map payload must preserve an existing cover")
  assert.equal(mapApiEvent({ ...photoFree, coverPhoto: actualCover }).coverImage, actualCover, "Real server photo takes priority over stock cover")
  const withPhotos = { ...photoFree, participants: [{ id: "p1", firstName: "Ali", lastName: "Veli", profilePhoto: actualCover }, { id: "p2", firstName: "Ayşe", lastName: "Kaya", profilePhoto: null }] }
  const detailed = mapApiEvent(withPhotos)
  assert.equal(detailed.participants[0].avatar, actualCover, "Participant photo from event detail becomes the avatar")
  assert.equal(detailed.participants[1].avatar, "", "Participants without a visible photo fall back to initials")
  const listed = mapApiEventPreservingCover({ ...withPhotos, participants: withPhotos.participants.map(({ profilePhoto, ...rest }) => rest) }, detailed)
  assert.equal(listed.participants[0].avatar, actualCover, "Photo-less list payload keeps participant photos loaded on detail")
  const { byLatestMessage, roomTitle } = require("../src/native/Store.tsx")
  const roomA = { ...mapApiEvent(photoFree), id: "a", lastMessageAt: "2026-10-06T13:00:00.000+03:00" }
  const roomB = { ...mapApiEvent(photoFree), id: "b", lastMessageAt: "2026-10-06T10:30:00.000Z" }
  const roomC = { ...mapApiEvent(photoFree), id: "c" }
  assert.deepEqual([roomC, roomA, roomB].sort(byLatestMessage).map(room => room.id), ["b", "a", "c"], "Rooms sort by newest message across time zone formats; silent rooms last")
  assert.equal(roomTitle(roomA), `${roomA.title} · ${roomA.date}`)
  // Text never sits on a line shorter than its size, even when the size is inherited (Android clipped descenders).
  {
    const { Box, Label } = require("../src/native/UI.tsx")
    let tree
    await act(async () => { tree = create(React.createElement(Box, { style: { fontSize: 20, fontFamily: "Fraunces" } }, React.createElement(Label, null, "Ayşe Yılmaz"))) })
    const lineHeight = [].concat(tree.root.findByType("Text").props.style).reduce((value, part) => part?.lineHeight ?? value, undefined)
    assert(lineHeight >= 26, `Inherited 20px text gets a tall enough line (got ${lineHeight})`)
    await act(async () => tree.unmount())
  }
  // Grids are explicit rows of equal flex cells, so nothing can wrap (Android pixel rounding
  // used to push cells onto one per line).
  {
    const { Box } = require("../src/native/UI.tsx")
    let grid
    await act(async () => { grid = create(React.createElement(Box, { style: { gap: 12, flexDirection: "row", flexWrap: "wrap" }, columns: 2 }, ["a", "b", "c"].map(key => React.createElement(Box, { key, testID: key })))) })
    const rows = grid.root.findAll(n => n.type === "View" && n.props.style?.flexDirection === "row" && n.props.style?.gap === 12 && !n.props.style?.flexWrap)
    assert.equal(rows.length, 2, "Three items in two columns make two rows")
    const cells = row => row.children.filter(child => child.props.style?.flex === 1)
    assert.deepEqual(rows.map(row => cells(row).length), [2, 2], "Each row has one equal cell per column")
    assert.equal(cells(rows[1])[1].findAll(n => n.props.testID).length, 0, "The incomplete last row keeps an empty spacer so cells stay the same width")
    await act(async () => grid.unmount())
  }
  // expo-router loads every route at startup; Expo Go on Android throws as soon as expo-notifications loads.
  global.__expoNotificationsLoaded = false
  require("../app/settings.tsx")
  assert.equal(global.__expoNotificationsLoaded, false, "Loading the settings route must not load expo-notifications")
  const { sortFeed, isOpenForFeed } = require("../src/discover/sort.ts")
  const at = (date, time, extra) => ({ ...mapApiEvent(photoFree), date, time, ...extra })
  const now = new Date(2026, 9, 11, 12, 0).getTime()
  assert.equal(isOpenForFeed(at("12/10/2026", "18:00", { status: "waiting_participants" }), now), true, "Upcoming events waiting for participants are shown")
  assert.equal(isOpenForFeed(at("11/10/2026", "11:30", { status: "started", duration: "90 dk" }), now), false, "Started events are not listed, even while in progress")
  assert.equal(isOpenForFeed(at("11/10/2026", "09:00", { status: "started", duration: "60 dk" }), now), false, "Started events past their end are hidden")
  assert.equal(isOpenForFeed(at("10/10/2026", "18:00", { status: "waiting_participants" }), now), false, "Waiting events whose start passed are hidden (status not updated yet)")
  for (const status of ["closed", "cancelled"]) assert.equal(isOpenForFeed(at("20/10/2026", "18:00", { status }), now), false, `${status} events are hidden`)
  const feedEvent = (id, extra) => ({ ...mapApiEvent(photoFree), id, ...extra })
  const feed = [
    feedEvent("old-padel", { category: "Padel", createdAt: "2026-10-01T10:00:00Z", date: "20/10/2026", time: "18:00", latitude: 39.95, longitude: 32.85 }),
    feedEvent("new-yoga", { category: "Yoga", createdAt: "2026-10-09T10:00:00Z", date: "20/10/2026", time: "18:00", latitude: 41.0, longitude: 29.0 }),
    feedEvent("new-padel", { category: "Padel", createdAt: "2026-10-08T10:00:00Z", date: "25/10/2026", time: "09:00", latitude: undefined, longitude: undefined }),
    feedEvent("soon-film", { category: "Film", createdAt: "2026-10-02T10:00:00Z", date: "15/10/2026", time: "20:00", latitude: 39.93, longitude: 32.86 }),
  ]
  const order = (sortBy, location) => sortFeed(feed, sortBy, { interests: ["Padel"], location }).map(event => event.id)
  assert.deepEqual(order("recommended"), ["old-padel", "new-padel", "soon-film", "new-yoga"], "Recommended: user's interests first, then the soonest start")
  assert.deepEqual(order("time-asc"), ["soon-film", "new-yoga", "old-padel", "new-padel"], "Nearest time first; same start time puts the newest first")
  assert.deepEqual(order("time-desc"), ["new-padel", "new-yoga", "old-padel", "soon-film"], "Farthest time first; same start time puts the newest first")
  const ankara = { latitude: 39.92, longitude: 32.85 }
  assert.deepEqual(order("distance-near", ankara), ["soon-film", "old-padel", "new-yoga", "new-padel"], "Nearest to the user first; events without a location last")
  assert.deepEqual(order("distance-far", ankara), ["new-yoga", "old-padel", "soon-film", "new-padel"], "Farthest from the user first; events without a location last")
  console.log("PASS: category cover fallback, real photo priority and image preservation across map navigation.")
  global.fetch = server.fetch;
  const originalFetch = global.fetch
  let registrationRequest
  global.fetch = async (url, options) => {
    if (url.endsWith("/events?page=1&limit=20")) return { ok: true, json: async () => ({ items: [] }) }
    if (url.endsWith("/legal/documents")) return { ok: true, json: async () => ({ items: [{ type: "terms", version: 2, title: "Kullanım Koşulları", required: true }, { type: "community", version: 1, title: "Topluluk Kuralları", required: true }, { type: "privacy", version: 1, title: "Gizlilik Politikası", required: true }, { type: "kvkk", version: 1, title: "KVKK", required: true }, { type: "marketing", version: 1, title: "Ticari İleti", required: false }] }) }
    registrationRequest = { url, body: JSON.parse(options.body) }
    return { ok: true, json: async () => ({ user: { id: "registered-user" }, tokens: { accessToken: "test-access", refreshToken: "test-refresh" } }) }
  }
  let destination
  const registration = await mount("Onboarding", { step: 1, navigate: (route) => { destination = route } })
  const fields = registration.root.findAllByType("TextInput")
  assert.deepEqual([fields[0].props.autoCapitalize, fields[1].props.autoCapitalize], ["words", "words"], "Name fields start each word with a capital letter")
  {
    // "+90" sits in its own box; the number is kept exactly as typed (no leading 5 is added).
    assert(text(registration.toJSON()).includes("+90"), "The country code is shown in its own box")
    const phoneField = () => registration.root.findAllByType("TextInput").find(n => n.props.accessibilityLabel === "Telefon numarası")
    await act(async () => phoneField().props.onFocus?.())
    assert.equal(phoneField().props.value, "", "Focusing an empty number field adds nothing")
    await act(async () => phoneField().props.onChangeText("321234567"))
    assert.equal(phoneField().props.value, "321 234 56 7", "Nothing is added to a typed number")
    await act(async () => phoneField().props.onChangeText("+90 532 123 45 67"))
    assert.equal(phoneField().props.value, "532 123 45 67", "A pasted number loses its country code")
    await act(async () => phoneField().props.onChangeText(""))
  }
  for (const [index, value] of ["Deniz", "Test", "deniz@example.com", "+90 532 123 45 67", "Password1!"].entries()) {
    await act(async () => fields[index].props.onChangeText(value))
  }
  // Birth date is chosen with the shared date picker (YYYY-MM-DD) and sent as dd/MM/yyyy.
  const birthField = () => registration.root.findAll(n => n.props.mode === "date" && typeof n.props.onChangeText === "function")[0]
  assert(birthField(), "Birth date opens the date picker")
  assert.equal(birthField().props.defaultValue, "2000-01-01", "Picker starts at a plausible birth year")
  const birthButton = registration.root.findAllByType("Pressable").find(n => n.props.accessibilityLabel === "Doğum Tarihi")
  global.__testKeyboardDismissed = false
  await act(async () => birthButton.props.onPress?.({ stopPropagation() {} }))
  assert(global.__testKeyboardDismissed, "Opening the date picker closes the keyboard so it cannot hide the panel")
  assert(registration.root.findAllByType("Modal").length > 0 && text(registration.toJSON()).includes("Tarih seç"), "Tapping birth date opens the date picker")
  await tap(registration, "İptal")
  await act(async () => birthField().props.onChangeText("2099-01-01"))
  assert(text(registration.toJSON()).includes("Doğum tarihi gelecekte olamaz"), "Future birth dates are rejected")
  await act(async () => birthField().props.onChangeText("1995-06-15"))
  assert.equal(birthField().props.value, "1995-06-15")
  // City is a required select: open the list, search with Turkish casing and pick.
  const cityField = registration.root.findAllByType("Pressable").find(n => String(n.props.accessibilityLabel).startsWith("Şehir:"))
  assert(cityField, "Registration has a city select")
  await act(async () => cityField.props.onPress())
  const citySearch = registration.root.findAllByType("TextInput").find(n => n.props.placeholder === "Şehir ara")
  // The sheet keeps one height while filtering, so the search field never drops under the keyboard.
  const sheet = () => registration.root.findAll(n => n.type === "View" && n.props.edges?.includes?.("bottom") || (n.type === "View" && [].concat(n.props.style).some(style => style && style.borderTopLeftRadius === 24)))[0]
  const sheetStyle = () => Object.assign({}, ...[].concat(sheet().props.style).flat(Infinity).filter(Boolean))
  assert.equal(sheetStyle().flex, 1, "The city sheet fills a fixed area instead of shrinking to its content")
  assert.equal(sheetStyle().maxHeight, undefined)
  await act(async () => citySearch.props.onChangeText("izmir"))
  assert.equal(sheetStyle().flex, 1, "Filtering the list does not change the sheet height")
  if ((process.env.TEST_PLATFORM || "ios") === "ios") {
    await act(async () => global.__testKeyboardListeners.keyboardWillShow({ endCoordinates: { height: 320 } }))
    const list = registration.root.findAll(n => n.type === "ScrollView" && n.props.contentContainerStyle?.paddingBottom !== undefined).at(-1)
    assert.equal(list.props.contentContainerStyle.paddingBottom, 320, "On iOS the list makes room for the keyboard")
    await act(async () => global.__testKeyboardListeners.keyboardWillHide())
  }
  const options = registration.root.findAllByType("Pressable").filter(n => n.props.accessibilityState && "selected" in n.props.accessibilityState)
  assert.deepEqual(options.map(n => text(n).trim()), ["İzmir"], "Searching 'izmir' finds İzmir")
  await act(async () => options[0].props.onPress())
  await act(async () => birthField().props.onChangeText("2015-06-15"))
  assert(text(registration.toJSON()).includes("en az 18 yaşında"), "Members must be at least 18")
  await act(async () => birthField().props.onChangeText("1995-06-15"))
  assert(!text(registration.toJSON()).includes("en az 18 yaşında"))
  // Principles and consents live in one card that opens by itself once the password is entered.
  assert(!text(registration.toJSON()).includes("KVKK Aydınlatma Metni"), "The agreements card starts closed")
  assert(text(registration.toJSON()).includes("2 zorunlu onay"), "The closed card says what is still needed")
  const passwordField = registration.root.findAll(n => n.type === "TextInput" && n.props.accessibilityLabel === "Şifre")[0]
  await act(async () => passwordField.props.onEndEditing({ nativeEvent: { text: passwordField.props.value } }))
  assert(text(registration.toJSON()).includes("KVKK Aydınlatma Metni") && text(registration.toJSON()).includes("İlkeler"), "Finishing the password opens the principles and consents")
  await tap(registration, "Topluluk Kuralları")
  await tap(registration, "Devam Et")
  assert.equal(registrationRequest, undefined, "Registration waits for every required consent")
  await tap(registration, "KVKK Aydınlatma Metni")
  assert(text(registration.toJSON()).includes("Onaylandı"), "The card header confirms the required consents")
  await tap(registration, "Devam Et")
  assert.equal(destination, "onboarding-2")
  assert.deepEqual(registrationRequest.body.acceptedDocuments, [{ type: "terms", version: 2 }, { type: "community", version: 1 }, { type: "privacy", version: 1 }, { type: "kvkk", version: 1 }], "The accepted server versions are sent; marketing stays opt-in")
  assert.equal(registrationRequest.body.marketingConsent, false)
  assert.equal(registrationRequest.url, "http://192.168.1.15:3000/auth/register")
  assert.equal(registrationRequest.body.birthDate, "15/06/1995")
  assert.equal(registrationRequest.body.city, "İzmir", "The chosen city is sent with the registration")
  assert.equal(registrationRequest.body.phoneNumber, "+905321234567")
  assert.equal(storage.get("event-app:access-token"), "test-access")
  await act(async () => registration.unmount())
  global.fetch = async () => { throw new TypeError("Network request failed") }
  await assert.rejects(() => api.register({}), error => api.getApiErrorMessage(error).includes("Sunucuya bağlanılamadı"))
  storage.clear()
  global.fetch = originalFetch
  await require("./check-blur.cjs")()
  await require("./check-map.cjs")({ mount, tap, act, text, storage })
  await require("./check-session.cjs")({ mount, tap, act, text, storage })
  await require("./check-access.cjs")({ mount, tap, act, text, storage })
  await require("./check-password-reset.cjs")({ mount, tap, act, text, storage })
  await require("./check-server-state.cjs")({ mount, tap, act, text, storage })
  await require("./check-availability.cjs")({ mount, tap, act, text, storage })
  await require("./check-legal.cjs")({ mount, tap, act, text, storage })
  await require("./check-admin.cjs")({ mount, tap, act, text, storage })
  await require("./check-places.cjs")({ act, text, storage })
  await require("./check-forms.cjs")({ act })
  await require("./check-walkthrough.cjs")({ act, text, audit, storage })
  const names = [
    "Splash",
    "Welcome",
    "Approval",
    "Interests",
    "Discover",
    "EventDetail",
    "EventRoom",
    "Map",
    "CreateEvent",
    "Profile",
    "Rooms",
    "Search",
    "Notifications",
    "Availability",
    "AppGuide",
  ]
  for (const name of names) {
    const tree = await mount(name, { eventId: EVENTS[0].id })
    assert(tree.toJSON(), name)
    await act(async () => tree.unmount())
  }
  for (const step of [1, 2, 3]) {
    const tree = await mount("Onboarding", { step })
    await act(async () => tree.unmount())
  }
  const search = await mount("Search")
  const input = search.root.findByType("TextInput")
  {
    // The text sits on the same vertical centre as the search icon: no inherited line height, centred row.
    const flatInput = Object.assign({}, ...[].concat(input.props.style).flat(Infinity).filter(Boolean))
    assert.equal(flatInput.lineHeight, undefined, "Single-line inputs carry no line height that would push the text off centre")
    assert.equal(flatInput.textAlignVertical, "center")
    let row = input.parent; while (row && !row.findAll(n => n.type === "Svg" || n.type === "Vector").length) row = row.parent
    assert(row && [].concat(row.props.style).flat(Infinity).filter(Boolean).some(style => style.alignItems === "center"), "The icon and the text share a centred row")
  }
  await act(async () => input.props.onChangeText("zzzz-no-match"))
  assert(text(search.toJSON()).includes("sonuç bulunamadı"))
  await act(async () => search.unmount())
  {
    // Every top bar uses the same control sizes: 20 px icons (back included) and one text style for links.
    const flat = node => Object.assign({}, ...[].concat(node.props.style).flat(Infinity).filter(Boolean))
    const iconWidth = (tree, label) => { const action = tree.root.findAllByType("Pressable").find(n => n.props.accessibilityLabel === label); assert(action, `Missing top-bar control: ${label}`); return Number(action.findAll(n => n.type === "Svg")[0]?.props.width) }
    const detailBar = await mount("EventDetail", { eventId: EVENTS[0].id })
    assert.deepEqual([iconWidth(detailBar, "Geri git"), iconWidth(detailBar, "Paylaş")], [20, 20], "Back and share icons share one size")
    await act(async () => detailBar.unmount())
    const profileBar = await mount("Profile")
    assert(!profileBar.root.findAllByType("Pressable").some(n => n.props.accessibilityLabel === "Geri git"), "Your own profile (a bottom-bar tab) has no back button")
    const linkSizes = ["Ayarları aç", "Çıkış yap"].map(label => flat(profileBar.root.findAllByType("Pressable").find(n => n.props.accessibilityLabel === label).findAll(n => n.type === "Text")[0]).fontSize)
    assert.equal(new Set(linkSizes).size, 1, "Text links in the top bar share one size")
    await act(async () => profileBar.unmount())
  }
  {
    // The location card starts directions in the phone's map or navigation app.
    const where = await mount("EventDetail", { eventId: EVENTS[0].id })
    const card = where.root.findAllByType("Pressable").find(n => String(n.props.accessibilityLabel).endsWith("yol tarifi al"))
    assert(card && text(where.toJSON()).includes("Yol tarifi"), "The location card offers directions")
    let offered = []
    global.__testAlert = (title, _message, buttons) => { offered = buttons || []; assert.equal(title, "Yol tarifi") }
    global.__openedUrl = undefined
    await act(async () => { card.props.onPress?.({ stopPropagation() {} }); await new Promise(resolve => setTimeout(resolve, 0)) })
    const event = server.events.find(item => item.id === EVENTS[0].id) || server.events[0]
    if ((process.env.TEST_PLATFORM || "ios") === "android") {
      // Android: a geo: link, so the system lists every installed map and navigation app.
      assert(String(global.__openedUrl).startsWith(`geo:${event.latitude},${event.longitude}?q=`), `Android hands the place to the system app chooser (${global.__openedUrl})`)
    } else {
      assert.deepEqual(offered.map(button => button.text), ["Apple Haritalar", "Google Haritalar", "Yandex Navigasyon", "Waze", "Vazgeç"], "iOS offers the common map and navigation apps")
      await act(async () => { offered[0].onPress(); await new Promise(resolve => setTimeout(resolve, 0)) })
      assert(String(global.__openedUrl).startsWith(`maps://?daddr=${event.latitude},${event.longitude}`), `Apple Maps starts directions to the event (${global.__openedUrl})`)
    }
    global.__testAlert = undefined
    await act(async () => where.unmount())
  }
  const profileNavigations = []
  const detail = await mount("EventDetail", { eventId: EVENTS[0].id, navigate: (screen, options) => profileNavigations.push({ screen, options }) })
  assert(!detail.root.findAllByType("Pressable").some(n => text(n).trim() === "Profil"), "The organizer card has no separate profile button")
  const hostLink = detail.root.findAllByType("Pressable").find(n => n.props.accessibilityLabel?.endsWith(" profilini aç"))
  assert(hostLink, "The organizer name opens their profile")
  await act(async () => hostLink.props.onPress?.({ stopPropagation() {} }))
  assert.deepEqual(profileNavigations.pop(), { screen: "profile", options: { userId: server.events[0].owner.id } }, "The host name selects the host instead of the signed-in user")
  {
    // My own event: the organizer name is not a link (it would just open my own profile).
    const originalOwner = server.events[0].owner
    server.events[0].owner = { id: server.user.id, firstName: server.user.firstName, lastName: server.user.lastName }
    // Storage was cleared above; this check needs a signed-in user.
    storage.set("event-app:access-token", "own-event-test")
    const ownDetail = await mount("EventDetail", { eventId: EVENTS[0].id })
    await act(async () => { await new Promise(r => setTimeout(r, 150)) })
    assert(text(ownDetail.toJSON()).includes("Düzenleyen"), "The organizer card is still shown")
    assert(!ownDetail.root.findAllByType("Pressable").some(n => n.props.accessibilityLabel?.endsWith(" profilini aç")), "No profile link when I organize the event")
    // The organizer cancels before the start (after confirming); the detail shows it at once.
    global.__testAlert = (_title, _message, buttons) => buttons?.find(button => button.style === "destructive")?.onPress?.()
    await act(async () => ownDetail.root.findAll(n => n.props.accessibilityLabel === "Etkinliği iptal et" && typeof n.props.onPress === "function")[0].props.onPress())
    await act(async () => { await new Promise(r => setTimeout(r, 30)) })
    global.__testAlert = undefined
    const cancelRequest = server.requests.find(r => r.path === `/events/${EVENTS[0].id}/status` && r.method === "PATCH")
    assert.deepEqual(cancelRequest?.body, { status: "cancelled" }, "The organizer can cancel the event")
    assert(text(ownDetail.toJSON()).includes("Etkinlik iptal edildi") && !ownDetail.root.findAll(n => n.props.accessibilityLabel === "Etkinliği iptal et").length, "The detail shows the cancellation right away")
    await act(async () => ownDetail.unmount())
    server.events[0].owner = originalOwner
    // Participants cannot change their participation once the event started or was cancelled.
    const original = { status: server.events[0].status, viewer: server.events[0].viewerParticipationStatus }
    const freeze = async (status, viewer) => {
      Object.assign(server.events[0], { status: { enum: status }, viewerParticipationStatus: viewer })
      const view = await mount("EventDetail", { eventId: EVENTS[0].id })
      await act(async () => { await new Promise(r => setTimeout(r, 150)) })
      return view
    }
    let frozen = await freeze("started", "confirmed")
    assert(!frozen.root.findAll(n => n.props.accessibilityLabel === "Katılımı iptal et").length, "A started event cannot be left")
    assert(text(frozen.toJSON()).includes("Etkinlik başladı; katılım durumu artık değiştirilemez."), "The reason is shown")
    await act(async () => frozen.unmount())
    frozen = await freeze("cancelled", null)
    const join = frozen.root.findAll(n => typeof n.props.onPress === "function" && "disabled" in n.props && text(n).trim() === "Katıl")[0]
    assert(join && join.props.disabled === true, "A cancelled event cannot be joined")
    assert(text(frozen.toJSON()).includes("Etkinlik iptal edildi; katılım durumu değiştirilemez."))
    await act(async () => frozen.unmount())
    Object.assign(server.events[0], { status: original.status, viewerParticipationStatus: original.viewer })
    storage.delete("event-app:access-token")
  }
  {
    // The detail shows the event's duration where distance used to be.
    const { durationLabel } = require("../src/screens/EventDetailScreen.tsx")
    assert.deepEqual(["45 dk", "60 dk", "90 dk", "150 dk", undefined].map(durationLabel), ["45 dk", "1 saat", "1 saat 30 dk", "2 saat 30 dk", "Belirtilmedi"], "Durations read naturally")
    const info = text(detail.toJSON()).replace(/\s+/g, " ")
    assert(info.includes("Süre 1 saat") && !info.includes("Mesafe"), "Event detail shows Süre instead of Mesafe")
    // All meta boxes share one height, and the participant list has no "+" placeholder seats.
    const flat = node => Object.assign({}, ...[].concat(node.props.style).flat(Infinity).filter(Boolean))
    const boxHeight = label => { let node = detail.root.findAll(n => n.type === "Text" && text(n) === label)[0]; while (node && !flat(node).height) node = node.parent; return node && flat(node).height }
    const metaHeights = ["Tarih & Saat", "Konum", "Süre"].map(boxHeight)
    assert(metaHeights.every(Number.isFinite) && new Set(metaHeights).size === 1, "Meta boxes have equal heights")
    assert(!detail.root.findAll(node => node.type === "Text" && node.children.join("") === "+").length, "No + placeholder seats")
  }
  await tap(detail, "Katıl")
  assert(text(detail.toJSON()).includes("Katıldın"))
  assert(!text(detail.toJSON()).includes("Odaya Katıl"), "No room button below the minimum")
  assert(text(detail.toJSON()).includes("minimum katılımcı sayısına ulaştığında oda açılacak"), "Explains when the room opens")
  await act(async () => detail.unmount())
  const originalGetUserProfile = api.getUserProfile
  api.getUserProfile = async id => ({ id, firstName: "Ada", lastName: "Misafir", city: "İzmir", bio: "Tenis severim", rank: 4.5, interests: [{ id: "tennis", name: "Tenis" }] })
  const memberProfile = await mount("Profile", { userId: "other-member" })
  assert(text(memberProfile.toJSON()).includes("Ada Misafir"), "Selected member's name is displayed")
  assert(text(memberProfile.toJSON()).includes("Tenis severim"), "Selected member's bio is displayed")
  assert(text(memberProfile.toJSON()).includes("Tenis"), "Selected member's interests are displayed")
  for (const ownAction of ["Ayarlar", "Çıkış", "+ Ekle", "Referanslarım", "Etkinlik Takvimim"]) assert(!text(memberProfile.toJSON()).includes(ownAction), `Member profile hides ${ownAction}`)
  await act(async () => memberProfile.unmount())
  api.getUserProfile = originalGetUserProfile
  server.events[0].confirmedParticipantCount = server.events[0].minParticipants
  const restored = await mount("EventDetail", { eventId: EVENTS[0].id })
  await act(async () => { await new Promise(r=>setTimeout(r,20)) })
  assert(text(restored.toJSON()).includes("Katıldın"))
  assert(text(restored.toJSON()).includes("Odaya Katıl"), "Room opens for members once the minimum is met")
  storage.set("event-app:access-token", "rooms-test")
  server.events[0].unreadCount = 3
  const rooms = await mount("Rooms")
  await act(async () => { await new Promise(r=>setTimeout(r,50)) })
  assert(rooms.root.findAll(n => n.props.accessibilityLabel === "3 okunmamış mesaj").length > 0, "Rooms show their unread message count")
  const liveSocket = require("./mock-socket.cjs").instances.at(-1)
  await act(async () => liveSocket.receive("room:message", { eventId: EVENTS[0].id, at: new Date().toISOString(), userId: "someone-else" }))
  assert(rooms.root.findAll(n => n.props.accessibilityLabel === "4 okunmamış mesaj").length > 0, "A new message from another member increments the badge live")
  await act(async () => liveSocket.receive("room:message", { eventId: EVENTS[0].id, at: new Date().toISOString(), userId: server.user.id }))
  assert(rooms.root.findAll(n => n.props.accessibilityLabel === "4 okunmamış mesaj").length > 0, "Own messages are never unread")
  assert(text(rooms.toJSON()).includes("Sohbetler") && text(rooms.toJSON()).includes(`${EVENTS[0].category} · 01/10/2030`), "Open room is named after the activity and date")
  await act(async () => rooms.unmount())
  {
    // The room list comes from cached events: /events/rooms runs once per session (or on pull-to-refresh),
    // and a room joined elsewhere arrives over the socket with one /events/:id fetch.
    const RoomsScreen = require("../src/screens/RoomsScreen.tsx").default
    const roomsCalls = () => server.requests.filter(r => r.path === "/events/rooms").length
    const view = show => React.createElement(StoreProvider, null, show ? React.createElement(RoomsScreen, { navigate: () => {} }) : null)
    const settle = () => act(async () => { await new Promise(r => setTimeout(r, 50)) })
    const before = roomsCalls()
    let session
    await act(async () => { session = create(view(true)) })
    await settle()
    assert.equal(roomsCalls(), before + 1, "Rooms load once when first opened")
    await act(async () => session.update(view(false)))
    await act(async () => session.update(view(true)))
    await settle()
    assert.equal(roomsCalls(), before + 1, "Reopening Rooms reuses the cached list")
    await act(async () => session.root.findAll(n => n.props.refreshControl)[0].props.refreshControl.props.onRefresh())
    await settle()
    assert.equal(roomsCalls(), before + 2, "Pull-to-refresh reloads the rooms")
    server.events.push({ ...server.events[0], id: "socket-room", interest: { id: "kahve", slug: "kahve", name: "Kahve Sohbeti" }, confirmedParticipantCount: 2, participants: [server.user], viewerParticipationStatus: "confirmed", unreadCount: 0 })
    const socket = require("./mock-socket.cjs").instances.at(-1)
    await act(async () => socket.receive("event:participant_joined", { eventId: "socket-room", userId: server.user.id }))
    await settle()
    assert(server.requests.some(r => r.path === "/events/socket-room" && r.method === "GET"), "A room joined elsewhere is fetched by id")
    assert(text(session.toJSON()).includes("Kahve Sohbeti · 01/10/2030"), "The new room appears without /events/rooms")
    await act(async () => socket.receive("event:participant_joined", { eventId: "socket-room", userId: server.user.id }))
    await settle()
    assert.equal(server.requests.filter(r => r.path === "/events/socket-room").length, 1, "A cached room is not fetched again")
    assert.equal(roomsCalls(), before + 2, "Socket membership updates never call /events/rooms")
    await act(async () => session.unmount())
    server.events.pop()
  }
  server.events[0].unreadCount = 0
  const room = await mount("EventRoom", { eventId: EVENTS[0].id })
  await act(async () => { await new Promise(r=>setTimeout(r,50)) })
  assert(server.requests.some(r => r.path === `/events/${EVENTS[0].id}/messages/read` && r.method === "POST"), "Opening a room marks it as read")
  {
    const press = async label => { const node = room.root.findAll(n => n.props.accessibilityLabel === label && typeof n.props.onPress === "function")[0]; assert(node, `Missing button: ${label}`); await act(async () => node.props.onPress({ stopPropagation() {} })) }
    assert(!text(room.toJSON()).includes("Odayı sessize al"), "Room settings start closed")
    assert(!room.root.findAll(n => ["Katılımcıları göster", "Oda bilgisini aç"].includes(n.props.accessibilityLabel)).length, "The header has no separate participants/⋯ buttons")
    await press(`${EVENTS[0].category} · 01/10/2030`)
    const sheet = text(room.toJSON())
    assert(room.root.findAllByType("Modal").length > 0 && sheet.includes("Odayı sessize al") && sheet.includes("Katılımcılar ·") && !/Aktif|Pasif/.test(sheet), "Tapping the room name opens info, participants and settings in one sheet")
    await press("Oda bilgisini kapat")
    assert(!text(room.toJSON()).includes("Odayı sessize al"), "Room settings sheet closes")
  }
  await act(async () => room.unmount())
  storage.delete("event-app:access-token")
  server.events[0].confirmedParticipantCount = 1
  await tap(restored, "İptal Et")
  await act(async () => restored.unmount())
  global.__testLocationPermission = true
  let createdNavigation
  const createEvent = await mount("CreateEvent", { navigate: (route, opts) => { createdNavigation = { route, opts } } })
  await tap(createEvent, "Padel")
  await act(async () => {
    await new Promise((r) => setTimeout(r, 220))
  })
  assert(text(createEvent.toJSON()).includes("Hangi seviyede"))
  await tap(createEvent, "Başlangıç")
  await act(async () => { await new Promise(r=>setTimeout(r,220)) })
  for (const [mode,value] of [["date","2030-10-01"],["time","18:30"]]) {
    const field=createEvent.root.findAll(n=>n.props.mode===mode && typeof n.props.onChangeText==='function')[0]
    assert(field, `Missing ${mode} field`)
    await act(async()=>field.props.onChangeText(value))
  }
  const continueButton = () => createEvent.root.findAllByType("Pressable").find(n => text(n).includes("Devam Et"))
  assert(text(createEvent.toJSON()).includes("Ne kadar sürecek"), "Duration is chosen on the date and time step")
  assert.equal(continueButton().props.disabled, true, "A duration is required before continuing")
  await tap(createEvent,"Özel süre")
  const minutesField = createEvent.root.findAll(n => n.props.accessibilityLabel === "Dakika" && typeof n.props.onChangeText === "function")[0]
  assert(minutesField, "Custom duration has a minutes field")
  await act(async () => minutesField.props.onChangeText("75"))
  assert.equal(createEvent.root.findAll(n => n.props.accessibilityLabel === "Dakika" && typeof n.props.onChangeText === "function")[0].props.value, "59", "Custom minutes are capped at 59")
  await tap(createEvent,"1 saat")
  assert.equal(continueButton().props.disabled, false, "Valid date, time and duration enable continue")
  await tap(createEvent,"Devam Et")
  // The meeting point is chosen on a Google map: search moves the pin, a tap or drag refines it.
  global.__testReverseGeocode = [{ region: "Ankara", subregion: "Çankaya", street: "Atatürk Bulvarı" }]
  const locationMap = () => createEvent.root.find(n => n.props.testID === "event-location-map")
  assert(locationMap(), "Location step shows a map")
  assert.equal(continueButton().props.disabled, true, "A meeting point is required before continuing")
  assert(createEvent.root.findAllByType("Pressable").some(n => String(n.props.accessibilityLabel).startsWith("Şehir:")), "City is chosen on the location step")
  const addressSearch = createEvent.root.findAll(n => n.props.accessibilityLabel === "Adres veya mekan ara" && typeof n.props.onChangeText === "function")[0]
  await act(async () => addressSearch.props.onChangeText("Kuğulu Park"))
  await tap(createEvent, "Ara")
  await act(async () => { await new Promise(r => setTimeout(r, 20)) })
  assert(text(createEvent.toJSON()).includes("Çankaya, Ankara"), "District and city come from the picked point")
  const venueField = () => createEvent.root.findAll(n => n.props.accessibilityLabel === "Buluşma noktası (isteğe bağlı)" && typeof n.props.onChangeText === "function")[0]
  assert.equal(venueField().props.value, "Kuğulu Park", "A searched place fills the venue name")
  await act(async () => locationMap().props.onPress({ nativeEvent: { coordinate: { latitude: 39.9, longitude: 32.86 } } }))
  await act(async () => { await new Promise(r => setTimeout(r, 20)) })
  await act(async () => venueField().props.onChangeText("Native Test Mekanı"))
  assert.equal(continueButton().props.disabled, false)
  global.__testReverseGeocode = undefined
  await tap(createEvent,"Devam Et")
  const maxCard = () => createEvent.root.findAllByType("Pressable").some(n => n.props.accessibilityLabel === "Maksimum artır")
  // The maximum appears only once the minimum is above 2, with "Sınır koy" chosen and starting at the minimum.
  assert(!maxCard() && !text(createEvent.toJSON()).includes("Sınır koy"), "No maximum field while the minimum is 2")
  const pressLabel = async label => { const node = createEvent.root.findAllByType("Pressable").find(n => n.props.accessibilityLabel === label); assert(node, `Missing button: ${label}`); await act(async () => node.props.onPress?.({ stopPropagation() {} })) }
  await pressLabel("Minimum artır")
  assert(maxCard(), "Above 2 the maximum field appears with a limit chosen")
  await pressLabel("Minimum artır")
  await pressLabel("Minimum artır")
  assert(text(createEvent.toJSON()).includes("Tam 5 kişilik"), "The limit follows the minimum: exactly that many")
  const maxDecrease = createEvent.root.findAllByType("Pressable").find(n => n.props.accessibilityLabel === "Maksimum azalt")
  assert.equal(maxDecrease.props.disabled, true, "The maximum never goes below the minimum")
  await tap(createEvent, "Sınır yok")
  assert(!maxCard(), "Choosing no limit hides the max card")
  assert(text(createEvent.toJSON()).includes("Sınır yok: minimum dolunca"), "No limit is explained")
  for (let i = 0; i < 3; i++) await pressLabel("Minimum azalt")
  assert(!maxCard() && !text(createEvent.toJSON()).includes("Sınır koy"), "Back at 2 the maximum field hides again")
  assert(text(createEvent.toJSON()).includes("Hızlı ekle"), "Message to participants is on the participants step")
  {
    // Long quick-add chips stay inside the row: capped width, left-aligned text, × never shrinks away.
    const flat = node => Object.assign({}, ...[].concat(node.props.style).flat(Infinity).filter(Boolean))
    const remove = createEvent.root.findAllByType("Pressable").find(n => n.props.accessibilityLabel === "Su getir. önerisini sil")
    let chip = remove.parent
    while (chip && flat(chip).maxWidth === undefined) chip = chip.parent
    assert.equal(chip && flat(chip).maxWidth, "100%", "A quick-add chip is never wider than its row")
    assert.equal(flat(remove).flexShrink, 0, "The remove button keeps its size")
    const label = createEvent.root.findAllByType("Pressable").find(n => text(n).trim() === "Su getir." && n.props.accessibilityLabel !== "Su getir. önerisini sil")
    assert.equal(flat(label).alignItems, "flex-start", "Chip text is left-aligned")
  }
  const description = createEvent.root.findAllByType("TextInput")[0]
  await act(async () => description.props.onChangeText("Sunucuya kaydedilen test etkinliği"))
  await tap(createEvent,"Su getir.")
  assert.equal(createEvent.root.findAllByType("TextInput")[0].props.value, "Sunucuya kaydedilen test etkinliği\nSu getir.", "Personal suggestion is appended to the textarea")
  const dismiss = createEvent.root.findAllByType("Pressable").find(n => n.props.accessibilityLabel === "Raket gerekli. önerisini sil")
  assert(dismiss, "Personal suggestions can be dismissed")
  await act(async () => dismiss.props.onPress?.({ stopPropagation() {} }))
  assert.deepEqual(server.suggestions, ["Su getir."], "Dismissal is stored on the server")
  assert(!text(createEvent.toJSON()).includes("Raket gerekli."), "Dismissed suggestion disappears")
  await tap(createEvent,"Devam Et")
  await tap(createEvent,"Devam Et")
  assert(!text(createEvent.toJSON()).includes("Önerilenler"), "Recommended visibility is not offered")
  await tap(createEvent,"Sadece Davet")
  await act(async () => { await new Promise(r=>setTimeout(r,20)) })
  assert(text(createEvent.toJSON()).includes("Ayşe Arkadaş"), "Invite-only lists active friends")
  assert.equal(continueButton().props.disabled, false, "Friends are optional: pool candidates need no friendship")
  assert(text(createEvent.toJSON()).includes("takvim havuzundan"), "The step says pool candidates can be invited next")
  await tap(createEvent,"Ayşe Arkadaş")
  await tap(createEvent,"Devam Et")
  assert(text(createEvent.toJSON()).includes("Önizleme"))
  await act(async () => { await new Promise(r=>setTimeout(r,20)) })
  const previewRequest = server.requests.find(r => r.path === '/events/candidates/preview')
  assert(previewRequest && previewRequest.body.interestId === 'padel' && previewRequest.body.levelId === 'beginner' && /^\d{2}\/\d{2}\/\d{4}$/.test(previewRequest.body.date), "The draft is matched against the availability pool before creation")
  assert(text(createEvent.toJSON()).includes("Uygun kişilerden davet et") && text(createEvent.toJSON()).includes("Ece Aday"), "Pool candidates are offered while creating")
  await tap(createEvent,"Ece Aday")
  assert(text(createEvent.toJSON()).includes("1 kişiyi davet et"))
  assert.equal(server.poolInvites.length, 0, "Nobody is invited before the event exists")
  await tap(createEvent,"Etkinliği Oluştur")
  await act(async () => { await new Promise(r=>setTimeout(r,20)) })
  assert.deepEqual(server.poolInvites.map(invite => [invite.eventId, invite.userId]), [['created-on-server', 'cand-1']], "Chosen pool candidates are invited right after creation")
  assert.equal(server.events[0].id, 'created-on-server')
  assert.deepEqual(createdNavigation, { route: 'event-detail', opts: { eventId: 'created-on-server', aboveHome: true } }, 'New event detail opens with only home below it')
  assert.equal(server.events[0].locationName, 'Native Test Mekanı, Çankaya, Ankara', 'Venue, district and city are saved as the location')
  assert.deepEqual([server.events[0].latitude, server.events[0].longitude], [39.9, 32.86], 'The tapped map point is saved')
  assert.equal(server.events[0].visibilityId, 'invite_only')
  assert.deepEqual(server.events[0].invitedUserIds, ['friend-1'], 'Selected friends are invited')
  assert.equal(server.events[0].durationMinutes, 60)
  assert.equal(server.events[0].minParticipants, 2)
  assert.equal(server.events[0].maxParticipants, 100000, 'Without a maximum the server gets its placeholder capacity')
  {
    // No maximum is not "unlimited": the placeholder never shows, and the minimum drives progress.
    const { participantCount, capacityTarget } = require("../src/native/Store.tsx")
    assert.equal(participantCount(3, 100000), "3", "Only the count shows when no maximum was set")
    assert.equal(participantCount(3, 8), "3/8")
    assert.equal(capacityTarget({ minParticipants: 4, maxParticipants: 100000 }), 4, "The minimum is the goal without a maximum")
    // Organizer photo: taken from the participant list, where the server only fills it in when the viewer has a photo.
    const { mapApiEvent } = require("../src/native/Store.tsx")
    const withPhoto = mapApiEvent({ ...server.events[0], owner: { id: "host", firstName: "Ev", lastName: "Sahibi" }, participants: [{ id: "host", firstName: "Ev", lastName: "Sahibi", profilePhoto: "data:image/png;base64,HOST" }] })
    assert.equal(withPhoto.host.avatar, "data:image/png;base64,HOST", "The organizer's photo is shown when the server sends it")
    const hidden = mapApiEvent({ ...server.events[0], owner: { id: "host", firstName: "Ev", lastName: "Sahibi" }, participants: [{ id: "host", firstName: "Ev", lastName: "Sahibi", profilePhoto: null }] })
    assert.equal(hidden.host.avatar, "", "No photo (viewer has none) falls back to the initial")
    const noMax = await mount("EventDetail", { eventId: server.events[0].id })
    await act(async () => { await new Promise(r => setTimeout(r, 30)) })
    const shown = text(noMax.toJSON())
    assert(!/100000|∞|[Ss]ınırsız|sınırı yok/.test(shown), "The detail never shows an unlimited capacity")
    await act(async () => noMax.unmount())
  }
  assert.equal(storage.has('event-app:v1'), false, 'No domain data is written to device storage')
  storage.set("event-app:access-token", "invite-test")
  assert.equal(server.events[0].levelId, 'beginner', 'Interest level is sent when the interest has levels')
  const levelless = await mount("CreateEvent")
  await act(async () => { await new Promise(r=>setTimeout(r,20)) })
  await tap(levelless, "Kahve")
  await act(async () => { await new Promise(r=>setTimeout(r,220)) })
  assert(!text(levelless.toJSON()).includes("Hangi seviyede"), "Interests without levels skip the level step")
  assert(text(levelless.toJSON()).includes("Ne zaman"), "Level-less interest goes straight to date and time")
  await act(async () => levelless.unmount())
  const preselected = await mount("CreateEvent", { initialActivity: "kahve" })
  await act(async () => { await new Promise(r=>setTimeout(r,250)) })
  assert(text(preselected.toJSON()).includes("Ne zaman"), "An activity passed from Discover is picked automatically")
  await act(async () => preselected.unmount())
  server.state.createBlocked = true
  const blockedCreate = await mount("CreateEvent")
  await act(async () => { await new Promise(r=>setTimeout(r,20)) })
  assert(text(blockedCreate.toJSON()).includes("hakkınız kalmadı"), "Create flow is blocked when the user cannot create events")
  assert(!text(blockedCreate.toJSON()).includes("Ne yapmak"), "Creation steps are hidden while blocked")
  await act(async () => blockedCreate.unmount())
  server.state.createBlocked = false
  server.notifications.push({ id: "notice-1", type: "participant_joined", title: "Etkinliğine yeni katılımcı", body: "Ayşe etkinliğine katıldı.", eventId: server.events[0].id, actorId: "other", readAt: null, createdAt: new Date().toISOString() })
  const notificationNavigations = []
  let notifications = await mount("Notifications", { navigate: (screen, options) => notificationNavigations.push({ screen, options }) })
  await act(async () => { await new Promise(r=>setTimeout(r,20)) })
  assert(text(notifications.toJSON()).includes("etkinliğine davet etti"), "Pending invitations are listed")
  assert(text(notifications.toJSON()).includes("Etkinliğine yeni katılımcı"), "Persisted notifications are loaded")
  await tap(notifications, "Etkinliğine yeni katılımcı")
  assert(server.notifications[0].readAt, "Opening a notification persists its read state")
  assert.deepEqual(notificationNavigations.pop(), { screen: "event-detail", options: { eventId: server.events[0].id } }, "Notification opens its related event")
  server.notifications.push({ id: "notice-2", type: "reference_response", title: "Referans isteğin yanıtlandı", body: "Referans onaylandı", eventId: null, actorId: "other", readAt: null, createdAt: new Date().toISOString() })
  const fakeSocket = require("./mock-socket.cjs").instances.at(-1)
  await act(async () => { fakeSocket.receive("notification:created", server.notifications.at(-1)); await new Promise(resolve => setTimeout(resolve, 20)) })
  assert(text(notifications.toJSON()).includes("Referans isteğin yanıtlandı"), "Remote realtime notifications appear without reopening")
  await tap(notifications, "Tümünü oku")
  assert(server.notifications.every(row => row.readAt), "Read-all persists for every notification")
  await tap(notifications,"Kabul et")
  assert(server.requests.some(r => r.path === '/events/invite-1/join' && r.method === 'POST'), "Accepting an invitation joins the event")
  assert.equal(server.invitations.length, 0)
  assert(!text(notifications.toJSON()).includes("etkinliğine davet etti"), "Answered invitation leaves the list")
  {
    // "Tümünü sil": with requests still waiting, the user may decline them too.
    const dialogs = []
    server.state.friendRequests = [{ id: "friend-1", firstName: "Can", lastName: "Arkadaş", profilePhoto: null }]
    // Reference cards: only the request still waiting for my answer shows; answered/outgoing ones do not.
    const ref = (id, direction, status, requester, recipient) => ({ id, direction, status, createdAt: new Date().toISOString(), requester: { id: requester, name: requester }, recipient: { id: recipient, name: recipient } })
    server.state.references = [ref("ref-wait", "incoming", "pending", "Deniz Bekleyen", "Ben"), ref("ref-done", "incoming", "approved", "Eski Onaylı", "Ben"), ref("ref-out", "outgoing", "pending", "Ben", "Giden İstek")]
    await act(async () => notifications.unmount())
    notifications = await mount("Notifications", { navigate: (screen, options) => notificationNavigations.push({ screen, options }) })
    await act(async () => { await new Promise(r => setTimeout(r, 30)) })
    const cards = text(notifications.toJSON())
    assert(cards.includes("Deniz Bekleyen senden referans istiyor"), "A reference request waiting for my answer is shown")
    assert(!cards.includes("Eski Onaylı") && !cards.includes("Giden İstek"), "Answered and outgoing references are not notification cards")
    server.invitations.push({ ...server.events[1], id: "invite-1", owner: { id: "inviter", firstName: "Davet", lastName: "Eden" }, viewerParticipationStatus: "invited" })
    global.__testAlert = (title, message, buttons) => { dialogs.push({ title, message }); buttons.find(button => button.text === "Reddet ve tümünü sil").onPress() }
    await tap(notifications, "Tümünü sil")
    await act(async () => { await new Promise(r => setTimeout(r, 40)) })
    assert.equal(dialogs[0]?.title, "Onay bekleyen istekler var", "Pending requests are offered for declining")
    assert(dialogs[0].message.includes("1 arkadaşlık isteği") && dialogs[0].message.includes("1 etkinlik daveti"), "The dialog says what is waiting")
    assert(server.requests.some(r => r.path === "/friends/requests/friend-1/decline" && r.method === "POST"), "A pending friend request is declined")
    assert(server.requests.some(r => r.path === "/events/invite-1/leave" && r.method === "POST"), "A pending invitation is declined")
    assert(server.requests.some(r => r.path === "/notifications" && r.method === "DELETE") && server.notifications.length === 0, "Every notification is deleted")
    assert(dialogs[0].message.includes("1 referans isteği"), "Pending references are counted")
    assert.equal(server.state.references.find(row => row.id === "ref-wait").status, "declined", "A pending reference request is declined")
    assert(!text(notifications.toJSON()).includes("Referans isteğin yanıtlandı") && !text(notifications.toJSON()).includes("etkinliğine davet etti") && !text(notifications.toJSON()).includes("senden referans istiyor"), "The screen is cleared, reference cards included")
    // Chat messages are pushes only: a room message notification never shows in the list.
    server.notifications.push({ id: "chat-1", type: "message", title: "Yeni oda mesajı", body: "Gizli", eventId: null, actorId: null, readAt: null, createdAt: new Date().toISOString() })
    await act(async () => { require("./mock-socket.cjs").instances.at(-1).receive("notification:created", server.notifications.at(-1)); await new Promise(r => setTimeout(r, 20)) })
    assert(!text(notifications.toJSON()).includes("Gizli"), "Room and direct chat messages are not listed as notifications")
    server.notifications.splice(server.notifications.findIndex(row => row.id === "chat-1"), 1)
    // Nothing waiting: a plain confirmation, and "Sadece bildirimleri sil" never declines anything.
    server.notifications.push({ id: "notice-3", type: "announcement", title: "Yeni etkinlik duyurusu", body: "Selam", eventId: null, actorId: null, readAt: null, createdAt: new Date().toISOString() })
    await act(async () => { require("./mock-socket.cjs").instances.at(-1).receive("notification:created", server.notifications.at(-1)); await new Promise(r => setTimeout(r, 20)) })
    dialogs.length = 0
    global.__testAlert = (title, message, buttons) => { dialogs.push({ title, message }); buttons.find(button => button.style === "destructive").onPress() }
    await tap(notifications, "Tümünü sil")
    await act(async () => { await new Promise(r => setTimeout(r, 40)) })
    assert.equal(dialogs[0]?.title, "Tüm bildirimler silinsin mi?", "Without pending requests a simple confirmation is shown")
    assert.equal(server.notifications.length, 0)
    // Nothing left to show: like "Tümünü oku", "Tümünü sil" is disabled.
    const deleteAll = () => notifications.root.findAll(n => n.props.accessibilityLabel === "Tüm bildirimleri sil" && "disabled" in n.props)[0]
    assert.equal(deleteAll().props.disabled, true, "Tümünü sil is disabled when there is nothing to delete")
    server.notifications.push({ id: "notice-4", type: "announcement", title: "Yine duyuru", body: "Selam", eventId: null, actorId: null, readAt: null, createdAt: new Date().toISOString() })
    await act(async () => { require("./mock-socket.cjs").instances.at(-1).receive("notification:created", server.notifications.at(-1)); await new Promise(r => setTimeout(r, 20)) })
    assert.equal(deleteAll().props.disabled, false, "Tümünü sil is enabled again when a notification arrives")
    global.__testAlert = undefined
  }
  await act(async () => notifications.unmount())
  storage.delete("event-app:access-token")
  const routes=fs.readdirSync(path.join(__dirname,"../app"))
  for(const screen of [...names.filter(n=>n!=="Splash"&&n!=="Onboarding").map(n=>n.replace(/[A-Z]/g,(c,i)=>(i?"-":"")+c.toLowerCase())),"onboarding-1","onboarding-2","onboarding-3"]){assert(routes.includes(screen+".tsx"),`Missing route ${screen}`)}
  await act(async () => createEvent.unmount())
  await require("./check-guest-sharing.cjs")({ act, text, storage, tap, audit })
  await require("./check-socket.cjs")({ storage })
  assert.equal(errors.length, 0, errors.join("\n"))
  console.log(
    "PASS: 16 screens/states render as native hosts; search, server-backed join/cancel, no local domain persistence, all 8 creation steps and route coverage.",
  )
})()
  .catch((error) => {
    oldError(error)
    process.exitCode = 1
  })
  .finally(() => {
    console.error = oldError
  })

// Render every migrated screen against native host mocks, then exercise key flows.
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const Module = require("node:module")
const ts = require("typescript")
const React = require("react")
const { create, act } = require("react-test-renderer")
global.IS_REACT_ACT_ENVIRONMENT = true
global.__DEV__ = true
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
  if (id === "expo-router") return { useFocusEffect: callback => React.useEffect(callback, [callback]) }
  if (id === "socket.io-client") return require("./mock-socket.cjs")
  if (id === "expo-location") return {
    getForegroundPermissionsAsync: async () => ({ granted: false }), requestForegroundPermissionsAsync: async () => ({ granted: global.__testLocationPermission === true }),
    Accuracy: { Balanced: 3 }, geocodeAsync: async () => [{ latitude: 39.92, longitude: 32.85 }], reverseGeocodeAsync: async () => [],
  }
  if (id === "react-native-maps") return { __esModule: true, default: "MapView", Marker: "Marker" }
  if (id === "expo-constants") return { __esModule: true, default: { expoConfig: { hostUri: "192.168.1.15:8081" } } }
  if (id === "react-native")
    return {
      View: "View",
      ActivityIndicator: "ActivityIndicator",
      KeyboardAvoidingView: "KeyboardAvoidingView",
      Text: "Text",
      Pressable: "Pressable",
      ScrollView: "ScrollView",
      TextInput: "TextInput",
      Modal: "Modal",
      Platform: { OS: process.env.TEST_PLATFORM || "ios" },
      Alert: { alert() {} },
      AppState: { currentState: "active", addEventListener: () => ({ remove() {} }) },
      AccessibilityInfo: { isReduceMotionEnabled: async () => false, announceForAccessibility() {}, getRecommendedTimeoutMillis: async value => value },
      Easing: { linear: value => value, quad: value => value ** 2, cubic: value => value ** 3, out: easing => easing, inOut: easing => easing },
      Linking: { openURL: async () => {} },
      Share: { share: async () => {} },
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
  if (id === "expo-blur") return { BlurView: "BlurView", BlurTargetView: "View" }
  if (id === "react-native-safe-area-context") return { SafeAreaView: "View" }
  if (id === "@react-native-community/datetimepicker")
    return { __esModule: true, default: "DateTimePicker" }
  if (id === "@react-native-async-storage/async-storage")
    return {
      __esModule: true,
      default: {
        getItem: async (k) => storage.get(k) || null,
        setItem: async (k, v) => storage.set(k, v),
        multiRemove: async (keys) => keys.forEach(key => storage.delete(key)),
        multiSet: async (entries) => entries.forEach(([k, v]) => storage.set(k, v)),
      },
    }
  if (id === "expo-image-picker")
    return { launchImageLibraryAsync: async () => ({ canceled: true }) }
  if (id === "expo-clipboard") return { setStringAsync: async () => {} }
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
      { createNodeMock: () => ({ scrollToEnd() {}, focus() {} }) },
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
  console.log("PASS: category cover fallback, real photo priority and image preservation across map/AI navigation.")
  global.fetch = server.fetch;
  const originalFetch = global.fetch
  let registrationRequest
  global.fetch = async (url, options) => {
    if (url.endsWith("/events?page=1&limit=20")) return { ok: true, json: async () => ({ items: [] }) }
    registrationRequest = { url, body: JSON.parse(options.body) }
    return { ok: true, json: async () => ({ user: { id: "registered-user" }, tokens: { accessToken: "test-access", refreshToken: "test-refresh" } }) }
  }
  let destination
  const registration = await mount("Onboarding", { step: 1, navigate: (route) => { destination = route } })
  const fields = registration.root.findAllByType("TextInput")
  for (const [index, value] of ["Deniz", "Test", "deniz@example.com", "+90 532 123 45 67", "15061995", "Password1!"].entries()) {
    await act(async () => fields[index].props.onChangeText(value))
  }
  await tap(registration, "Topluluk ilkelerini okudum")
  await tap(registration, "Devam Et")
  assert.equal(destination, "onboarding-2")
  assert.equal(registrationRequest.url, "http://192.168.1.15:3000/auth/register")
  assert.equal(registrationRequest.body.birthDate, "15/06/1995")
  assert.equal(registrationRequest.body.phoneNumber, "+905321234567")
  assert.equal(storage.get("event-app:access-token"), "test-access")
  await act(async () => registration.unmount())
  global.fetch = async () => { throw new TypeError("Network request failed") }
  await assert.rejects(() => api.register({}), error => api.getApiErrorMessage(error).includes("Sunucuya bağlanılamadı"))
  storage.clear()
  global.fetch = originalFetch
  await require("./check-map.cjs")({ mount, tap, act, text, storage })
  await require("./check-session.cjs")({ mount, tap, act, text, storage })
  await require("./check-recommendations.cjs")({ mount, tap, act, text, storage })
  await require("./check-password-reset.cjs")({ mount, tap, act, text, storage })
  await require("./check-server-state.cjs")({ mount, tap, act, text, storage })
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
  await act(async () => input.props.onChangeText("zzzz-no-match"))
  assert(text(search.toJSON()).includes("sonuç bulunamadı"))
  await act(async () => search.unmount())
  const detail = await mount("EventDetail", { eventId: EVENTS[0].id })
  await tap(detail, "Katıl")
  assert(text(detail.toJSON()).includes("Katıldın"))
  await act(async () => detail.unmount())
  const restored = await mount("EventDetail", { eventId: EVENTS[0].id })
  assert(text(restored.toJSON()).includes("Katıldın"))
  await tap(restored, "İptal Et")
  await act(async () => restored.unmount())
  global.__testLocationPermission = true
  const createEvent = await mount("CreateEvent")
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
  await tap(createEvent,"Devam Et")
  await tap(createEvent,"1 saat")
  await act(async () => { await new Promise(r=>setTimeout(r,220)) })
  const location=createEvent.root.findByType("TextInput")
  await act(async()=>location.props.onChangeText("Native Test Mekanı"))
  await tap(createEvent,"Adresi bul")
  await tap(createEvent,"39.9200")
  await tap(createEvent,"Devam Et")
  await tap(createEvent,"Devam Et")
  await tap(createEvent,"Devam Et")
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
  assert(!text(createEvent.toJSON()).includes("Önerilenler"), "Recommended visibility is not offered")
  await tap(createEvent,"Sadece Davet")
  await act(async () => { await new Promise(r=>setTimeout(r,20)) })
  assert(text(createEvent.toJSON()).includes("Ayşe Arkadaş"), "Invite-only lists active friends")
  await tap(createEvent,"Ayşe Arkadaş")
  await tap(createEvent,"Devam Et")
  assert(text(createEvent.toJSON()).includes("Önizleme"))
  await tap(createEvent,"Etkinliği Oluştur")
  assert.equal(server.events[0].id, 'created-on-server')
  assert.equal(server.events[0].locationName, 'Native Test Mekanı')
  assert.equal(server.events[0].visibilityId, 'invite_only')
  assert.deepEqual(server.events[0].invitedUserIds, ['friend-1'], 'Selected friends are invited')
  assert.equal(server.events[0].durationMinutes, 60)
  assert.equal(server.events[0].minParticipants, 2)
  assert.equal(server.events[0].maxParticipants, 100000, 'Closed max is sent as unlimited capacity')
  assert.equal(storage.has('event-app:v1'), false, 'No domain data is written to device storage')
  storage.set("event-app:access-token", "invite-test")
  const notifications = await mount("Notifications")
  await act(async () => { await new Promise(r=>setTimeout(r,20)) })
  assert(text(notifications.toJSON()).includes("etkinliğine davet etti"), "Pending invitations are listed")
  await tap(notifications,"Kabul et")
  assert(server.requests.some(r => r.path === '/events/invite-1/join' && r.method === 'POST'), "Accepting an invitation joins the event")
  assert.equal(server.invitations.length, 0)
  assert(!text(notifications.toJSON()).includes("etkinliğine davet etti"), "Answered invitation leaves the list")
  await act(async () => notifications.unmount())
  storage.delete("event-app:access-token")
  const routes=fs.readdirSync(path.join(__dirname,"../app"))
  for(const screen of [...names.filter(n=>n!=="Splash"&&n!=="Onboarding").map(n=>n.replace(/[A-Z]/g,(c,i)=>(i?"-":"")+c.toLowerCase())),"onboarding-1","onboarding-2","onboarding-3"]){assert(routes.includes(screen+".tsx"),`Missing route ${screen}`)}
  await act(async () => createEvent.unmount())
  await require("./check-socket.cjs")({ storage })
  assert.equal(errors.length, 0, errors.join("\n"))
  console.log(
    "PASS: 16 screens/states render as native hosts; search, server-backed join/cancel, no local domain persistence, all 10 creation steps and route coverage.",
  )
})()
  .catch((error) => {
    oldError(error)
    process.exitCode = 1
  })
  .finally(() => {
    console.error = oldError
  })

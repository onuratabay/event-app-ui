// Render every migrated screen against native host mocks, then exercise key flows.
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const Module = require("node:module")
const ts = require("typescript")
const React = require("react")
const { create, act } = require("react-test-renderer")
global.IS_REACT_ACT_ENVIRONMENT = true
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
  if (id === "react-native")
    return {
      View: "View",
      Text: "Text",
      Pressable: "Pressable",
      ScrollView: "ScrollView",
      TextInput: "TextInput",
      Modal: "Modal",
      Platform: { OS: "ios" },
      Alert: { alert() {} },
      AppState: { currentState: "active", addEventListener: () => ({ remove() {} }) },
      AccessibilityInfo: { isReduceMotionEnabled: async () => false, announceForAccessibility() {}, getRecommendedTimeoutMillis: async value => value },
      Easing: { cubic: value => value ** 3, out: easing => easing },
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
  if (id === "expo-blur") return { BlurView: "BlurView" }
  if (id === "react-native-safe-area-context") return { SafeAreaView: "View" }
  if (id === "@react-native-community/datetimepicker")
    return { __esModule: true, default: "DateTimePicker" }
  if (id === "@react-native-async-storage/async-storage")
    return {
      __esModule: true,
      default: {
        getItem: async (k) => storage.get(k) || null,
        setItem: async (k, v) => storage.set(k, v),
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
  const createEvent = await mount("CreateEvent")
  await tap(createEvent, "Padel")
  await act(async () => {
    await new Promise((r) => setTimeout(r, 220))
  })
  assert(text(createEvent.toJSON()).includes("Hangi seviyede"))
  await tap(createEvent, "Başlangıç")
  await act(async () => { await new Promise(r=>setTimeout(r,220)) })
  for (const [mode,value] of [["date","2026-10-01"],["time","18:30"]]) {
    const field=createEvent.root.findAll(n=>n.props.mode===mode && typeof n.props.onChangeText==='function')[0]
    assert(field, `Missing ${mode} field`)
    await act(async()=>field.props.onChangeText(value))
  }
  await tap(createEvent,"Devam Et")
  await tap(createEvent,"1 saat")
  await act(async () => { await new Promise(r=>setTimeout(r,220)) })
  const location=createEvent.root.findByType("TextInput")
  await act(async()=>location.props.onChangeText("Native Test Mekanı"))
  await tap(createEvent,"Devam Et")
  await tap(createEvent,"Devam Et")
  await tap(createEvent,"Devam Et")
  await tap(createEvent,"Devam Et")
  await tap(createEvent,"Herkese Açık")
  await act(async () => { await new Promise(r=>setTimeout(r,220)) })
  assert(text(createEvent.toJSON()).includes("Önizleme"))
  await tap(createEvent,"Etkinliği Oluştur")
  const persisted=JSON.parse(storage.get("event-app:v1"))
  assert.equal(persisted.events[0].location,"Native Test Mekanı")
  assert.equal(persisted.events[0].privacy,"Herkese Açık")
  assert.equal(persisted.events[0].duration,"1 saat")
  const routes=fs.readdirSync(path.join(__dirname,"../app"))
  for(const screen of [...names.filter(n=>n!=="Splash"&&n!=="Onboarding").map(n=>n.replace(/[A-Z]/g,(c,i)=>(i?"-":"")+c.toLowerCase())),"onboarding-1","onboarding-2","onboarding-3"]){assert(routes.includes(screen+".tsx"),`Missing route ${screen}`)}
  await act(async () => createEvent.unmount())
  assert.equal(errors.length, 0, errors.join("\n"))
  console.log(
    "PASS: 16 screens/states render as native hosts; search, join/cancel, persistence, all 10 creation steps and route coverage.",
  )
})()
  .catch((error) => {
    oldError(error)
    process.exitCode = 1
  })
  .finally(() => {
    console.error = oldError
  })

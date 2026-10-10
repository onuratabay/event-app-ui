module.exports = async function ({ mount, tap, act, text, storage }) {
  const assert = require("node:assert/strict")
  const originalFetch = global.fetch
  storage.clear()
  const requests = []
  let rejectToken = true, unavailable = false
  global.fetch = async (url, options) => {
    if (!url.includes("/auth/")) return { ok: true, status: 200, json: async () => ({ items: [], total: 0 }) }
    const body = JSON.parse(options.body); requests.push({ url, body })
    if (unavailable) return { ok: false, status: 503, text: async () => JSON.stringify({ errors: [{ message: "E-posta hizmeti kullanılamıyor." }] }) }
    if (url.endsWith("/auth/reset-password") && rejectToken) return { ok: false, status: 400, text: async () => JSON.stringify({ errors: [{ message: "Kod geçersiz veya süresi dolmuş." }] }) }
    return { ok: true, status: 200, json: async () => ({ message: "OK" }) }
  }
  let destination
  let tree = await mount("Login", { navigate: route => { destination = route } })
  await tap(tree, "Şifremi unuttum")
  assert.equal(destination, "forgot-password")
  await act(async () => tree.unmount())
  tree = await mount("ForgotPassword", { navigate: route => { destination = route } })
  const input = label => tree.root.findAllByType("TextInput").find(item => item.props.accessibilityLabel === label)
  await tap(tree, "Sıfırlama kodu gönder")
  assert(text(tree.toJSON()).includes("Geçerli bir e-posta"))
  assert.equal(requests.length, 0)
  await act(async () => input("Sıfırlama e-postası").props.onChangeText(" test@example.com "))
  await tap(tree, "Sıfırlama kodu gönder")
  assert.equal(requests[0].body.email, "test@example.com")
  assert(text(tree.toJSON()).includes("Bu adres kayıtlıysa"))
  await act(async () => input("Sıfırlama kodu").props.onChangeText("https://example.com/reset?token=test-token"))
  await act(async () => input("Yeni şifre").props.onChangeText("Password1!"))
  await act(async () => input("Yeni şifre tekrar").props.onChangeText("Different1!"))
  await tap(tree, "Şifremi yenile")
  assert(text(tree.toJSON()).includes("Şifreler eşleşmiyor"))
  assert.equal(requests.length, 1)
  await act(async () => input("Yeni şifre tekrar").props.onChangeText("Password1!"))
  await tap(tree, "Şifremi yenile")
  assert(text(tree.toJSON()).includes("Kod geçersiz veya süresi dolmuş"))
  assert.equal(requests[1].body.token, "test-token")
  rejectToken = false
  await tap(tree, "Şifremi yenile")
  assert(text(tree.toJSON()).includes("Şifren yenilendi"))
  assert.equal(tree.root.findAllByType("TextInput").length, 0)
  await tap(tree, "Giriş yap")
  assert.equal(destination, "login")
  await act(async () => tree.unmount())
  unavailable = true
  tree = await mount("ForgotPassword")
  await act(async () => input("Sıfırlama e-postası").props.onChangeText("test@example.com"))
  await tap(tree, "Sıfırlama kodu gönder")
  assert(text(tree.toJSON()).includes("E-posta hizmeti kullanılamıyor"))
  assert(!text(tree.toJSON()).includes("Bu adres kayıtlıysa"))
  await act(async () => tree.unmount())
  global.fetch = originalFetch
  for (const [screen, props, fallback] of [
    ["Login", {}, "welcome"], ["ForgotPassword", {}, "login"],
    ["Onboarding", { step: 1 }, "welcome"], ["Onboarding", { step: 2 }, "onboarding-1"], ["Onboarding", { step: 3 }, "onboarding-2"],
    ["Approval", {}, "onboarding-3"], ["Interests", {}, "discover"],
  ]) {
    let back
    tree = await mount(screen, { ...props, navigate: (...args) => { back = args } })
    const button = tree.root.findAllByType("Pressable").find(item => item.props.accessibilityLabel === "Geri git")
    assert(button, `${screen} needs a back button`)
    await act(async () => button.props.onPress())
    assert.equal(back[0], fallback)
    assert.equal(back[1].back, true)
    await act(async () => tree.unmount())
  }
  storage.clear(); global.fetch = originalFetch
  console.log("PASS: forgot/reset flow, validation, expired token, SMTP failure, token-link parsing and pre-feed back actions.")
}

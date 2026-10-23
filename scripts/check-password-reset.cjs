module.exports = async function ({ mount, tap, act, text, storage }) {
  const assert = require("node:assert/strict")
  const originalFetch = global.fetch
  storage.clear()
  const requests = []
  let rejectCode = true, unavailable = false
  global.fetch = async (url, options) => {
    if (!url.includes("/auth/")) return { ok: true, status: 200, json: async () => ({ items: [], total: 0 }) }
    const body = JSON.parse(options.body); requests.push({ url, body })
    if (unavailable) return { ok: false, status: 503, text: async () => JSON.stringify({ errors: [{ message: "E-posta hizmeti kullanılamıyor." }] }) }
    if (url.endsWith("/auth/verify-reset-code") && rejectCode) return { ok: false, status: 400, text: async () => JSON.stringify({ errors: [{ message: "Kod hatalı ya da süresi dolmuş." }] }) }
    return { ok: true, status: 200, json: async () => ({ message: "OK", valid: true }) }
  }
  let destination
  let tree = await mount("Login", { navigate: route => { destination = route } })
  await tap(tree, "Şifremi unuttum")
  assert.equal(destination, "forgot-password")
  await act(async () => tree.unmount())
  tree = await mount("ForgotPassword", { navigate: route => { destination = route } })
  const input = label => tree.root.findAllByType("TextInput").find(item => item.props.accessibilityLabel === label)
  // 1. Email
  await tap(tree, "Kod gönder")
  assert(text(tree.toJSON()).includes("Geçerli bir e-posta"))
  assert.equal(requests.length, 0)
  await act(async () => input("Sıfırlama e-postası").props.onChangeText(" test@example.com "))
  await tap(tree, "Kod gönder")
  assert.equal(requests[0].body.email, "test@example.com")
  // 2. The 6-digit code, with the 2-minute countdown
  assert(text(tree.toJSON()).includes("6 haneli bir kod gönderdik"), "The code step explains where the code went")
  assert(/2:00|1:59/.test(text(tree.toJSON())), "The 2-minute countdown is shown")
  assert(!input("Yeni şifre"), "No password fields before the code is confirmed")
  await act(async () => input("Sıfırlama kodu").props.onChangeText("12a3"))
  assert.equal(input("Sıfırlama kodu").props.value, "123", "Only digits are kept")
  await tap(tree, "Kodu onayla")
  assert(text(tree.toJSON()).includes("6 haneli kodu gir"))
  await act(async () => input("Sıfırlama kodu").props.onChangeText("123456"))
  await tap(tree, "Kodu onayla")
  assert(text(tree.toJSON()).includes("Kod hatalı ya da süresi dolmuş"))
  assert.deepEqual(requests[1].body, { email: "test@example.com", code: "123456", language: "tr" })
  rejectCode = false
  await tap(tree, "Kodu onayla")
  // 3. New password twice
  assert(input("Yeni şifre") && input("Yeni şifre tekrar"), "A confirmed code opens the new password step")
  await act(async () => input("Yeni şifre").props.onChangeText("Password1!"))
  await act(async () => input("Yeni şifre tekrar").props.onChangeText("Different1!"))
  await tap(tree, "Şifremi yenile")
  assert(text(tree.toJSON()).includes("Şifreler eşleşmiyor"))
  await act(async () => input("Yeni şifre tekrar").props.onChangeText("Password1!"))
  await tap(tree, "Şifremi yenile")
  const reset = requests.find(item => item.url.endsWith("/auth/reset-password"))
  assert.deepEqual(reset.body, { email: "test@example.com", code: "123456", newPassword: "Password1!", language: "tr" })
  assert(text(tree.toJSON()).includes("Şifren yenilendi"))
  assert.equal(tree.root.findAllByType("TextInput").length, 0)
  await tap(tree, "Giriş yap")
  assert.equal(destination, "login")
  await act(async () => tree.unmount())
  unavailable = true
  tree = await mount("ForgotPassword")
  await act(async () => input("Sıfırlama e-postası").props.onChangeText("test@example.com"))
  await tap(tree, "Kod gönder")
  assert(text(tree.toJSON()).includes("E-posta hizmeti kullanılamıyor"))
  assert(!input("Sıfırlama kodu"), "No code step when the email could not be sent")
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
  console.log("PASS: forgot/reset flow (email → 6-digit code with countdown → new password), validation, wrong code, SMTP failure and pre-feed back actions.")
}

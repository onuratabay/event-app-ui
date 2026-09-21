module.exports = async function ({ mount, tap, act, text, storage }) {
  const assert = require("node:assert/strict")
  const api = require("../src/api/client.ts")
  const oldFetch = global.fetch
  const ok = body => ({ ok: true, status: 200, json: async () => body })
  const unauthorized = () => ({ ok: false, status: 401, text: async () => '{"errors":[{"message":"Expired"}]}' })
  storage.clear()
  global.fetch = oldFetch
  let route
  let tree = await mount("Splash", { navigate: next => { route = next } })
  assert.equal(route, "welcome")
  await act(async () => tree.unmount())
  storage.set("event-app:access-token", "old-access")
  storage.set("event-app:refresh-token", "refresh")
  tree = await mount("Splash", { navigate: next => { route = next } })
  assert.equal(route, "discover")
  await act(async () => tree.unmount())
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
  assert.equal(storage.get("event-app:access-token"), "new-access")
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
  assert.equal(route, "welcome")
  await act(async () => tree.unmount())
  tree = await mount("Discover", { navigate: next => { route = next } })
  const search = tree.root.findAllByType("Pressable").filter(node => node.props.accessibilityLabel === "Ara")
  assert.equal(search.length, 1, "Only the header has the search action")
  await act(async () => search[0].props.onPress())
  assert.equal(route, "search")
  await tap(tree, "Harita")
  assert.equal(route, "map")
  await act(async () => tree.unmount())
  storage.clear()
  global.fetch = oldFetch
  console.log("PASS: saved-session startup, hidden auth screens, refresh single-flight, logout race and navigation placement.")
}

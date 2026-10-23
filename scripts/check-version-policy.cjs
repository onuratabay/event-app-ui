module.exports = async function ({ act, text }) {
  const assert = require("node:assert/strict")
  const React = require("react")
  const { create } = require("react-test-renderer")
  const originalFetch = global.fetch
  const UpdateRequired = require("../src/components/UpdateRequired.tsx").default
  const { compareVersions } = require("../src/components/UpdateRequired.tsx")
  assert(compareVersions("1.10.0", "1.9.0") > 0 && compareVersions("1.2", "1.2.0") === 0 && compareVersions("1.0.0", "1.0.1") < 0, "Versions compare numerically")
  const requests = []
  let policy
  global.fetch = async (url, options) => {
    requests.push({ url, headers: options.headers })
    if (policy === "offline") throw new Error("offline")
    return { ok: true, status: 200, json: async () => policy }
  }
  const render = async () => {
    let tree
    await act(async () => { tree = create(React.createElement(UpdateRequired)) })
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 20)) })
    return tree
  }
  // The test build reports version 0.0.0 (no app.json version in the mock).
  policy = { minimumVersion: { ios: "1.0.0", android: "1.0.0" }, storeUrl: { ios: "https://apps.apple.com/app/id1", android: "https://play.google.com/store/apps/details?id=x" } }
  let tree = await render()
  assert(text(tree.toJSON()).includes("Uygulamayı güncelle"), "An older build is held on the update page")
  assert(requests[0].url.endsWith("/app/version-policy"))
  assert.equal(requests[0].headers["X-App-Version"], "0.0.0", "Every request says which app version is calling")
  assert(requests[0].headers["X-App-Platform"], "…and the platform")
  await act(async () => tree.unmount())
  policy = { minimumVersion: { ios: "0.0.0", android: "0.0.0" }, storeUrl: { ios: null, android: null } }
  tree = await render()
  assert.equal(tree.toJSON(), null, "A supported build sees nothing")
  await act(async () => tree.unmount())
  policy = "offline"
  tree = await render()
  assert.equal(tree.toJSON(), null, "A failed check never blocks the app")
  await act(async () => tree.unmount())
  global.fetch = originalFetch
  console.log("PASS: forced update page (older build held, supported build free, offline never blocks) and version headers.")
}

// App release versions: v1.0.0 first, fixes bump the last number, features the middle one, the first only by hand.
const assert = require("assert")
const { execFileSync } = require("child_process")
const fs = require("fs")
const os = require("os")
const path = require("path")
const { nextVersion, release } = require("./release-version.cjs")

module.exports = function checkReleaseVersion() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "release-version-"))
  const git = (...args) => execFileSync("git", ["-C", root, ...args], { encoding: "utf8" })
  const write = (version) => {
    fs.writeFileSync(path.join(root, "app.json"), JSON.stringify({ expo: { name: "Ewent", version } }, null, 2) + "\n")
    fs.writeFileSync(path.join(root, "package.json"), JSON.stringify({ name: "event-app", version }, null, 2) + "\n")
    fs.writeFileSync(path.join(root, "package-lock.json"), JSON.stringify({ name: "event-app", version, lockfileVersion: 3, packages: { "": { name: "event-app", version } } }, null, 2) + "\n")
  }
  const commit = (message) => { git("add", "-A"); git("commit", "-q", "--allow-empty", "-m", message) }
  const appVersion = () => JSON.parse(fs.readFileSync(path.join(root, "app.json"), "utf8")).expo.version
  try {
    git("init", "-q", "-b", "main"); git("config", "user.email", "ci@example.com"); git("config", "user.name", "CI")
    write("1.0.0"); commit("feat: first build")
    assert.deepEqual(nextVersion(root), { version: "1.0.0", changed: true }, "The first release is app.json's version")
    assert.equal(release(root), "1.0.0")
    assert.equal(git("tag", "--points-at", "HEAD").trim(), "v1.0.0", "An unchanged first release tags the current commit")
    assert.throws(() => release(root), /Nothing to release/)

    commit("fix(chat): composer above the keyboard")
    commit("Davet sayfası metni")
    assert.equal(nextVersion(root).version, "1.0.1", "Fixes and other changes bump the last number")
    assert.equal(release(root), "1.0.1")
    assert.equal(appVersion(), "1.0.1")
    assert.equal(JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8")).version, "1.0.1")
    assert.equal(git("log", "-1", "--format=%s").trim(), "chore(release): v1.0.1")

    commit("fix: spacing"); commit("feat(events): pools")
    assert.equal(nextVersion(root).version, "1.1.0", "A feature bumps the middle number and resets the last")
    commit("feat!: new matching")
    commit("fix: token\n\nBREAKING CHANGE: old tokens rejected")
    assert.equal(nextVersion(root).version, "1.1.0", "The first number never moves by itself")
    assert.equal(release(root), "1.1.0")

    write("2.0.0"); commit("chore: big redesign release")
    assert.equal(nextVersion(root).version, "2.0.0", "A big release is set by hand in app.json")

    fs.writeFileSync(path.join(root, "notes.txt"), "draft")
    assert.throws(() => release(root), /Commit or stash/, "Releasing needs a clean working tree")
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
  console.log("PASS: app release versions start at v1.0.0, fixes bump patch, features bump minor, majors only by hand.")
}

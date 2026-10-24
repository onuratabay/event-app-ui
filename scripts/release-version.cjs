#!/usr/bin/env node
// App release version (SemVer, shown in Settings and compared by the forced-update check), from the
// Conventional Commits since the last v* tag — the same rules as the backend's scripts/next-version.py:
// a new feature (`feat`, also `feat!:` or a BREAKING CHANGE footer) bumps the middle number
// (1.0.4 → 1.1.0); anything else bumps the last one (1.0.0 → 1.0.1). The first number never moves by
// itself: a big release raises app.json's version (e.g. to 2.0.0) by hand. Without a tag the first
// release is app.json's version.
//
//   node scripts/release-version.cjs          print the next version
//   npm run release                           write it to app.json/package.json, commit and tag v<version>
const { execFileSync } = require("child_process")
const fs = require("fs")
const path = require("path")

const TAG = /^v(\d+)\.(\d+)\.(\d+)$/
const HEADER = /^(\w+)(?:\([^)]*\))?(!)?:/
const BREAKING = /^BREAKING[ -]CHANGE:/m

const git = (root, ...args) => execFileSync("git", ["-C", root, ...args], { encoding: "utf8" })
const parse = version => version.split(".").map(Number)
const compare = (a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2]

function bump([major, minor, patch], messages) {
  const feature = messages.some(message => {
    const header = HEADER.exec(message)
    return (header && (header[1] === "feat" || header[2])) || BREAKING.test(message)
  })
  return feature ? [major, minor + 1, 0] : [major, minor, patch + 1]
}

/** The next version, and whether anything changed since the last release. */
function nextVersion(root = path.join(__dirname, "..")) {
  const baseline = parse(JSON.parse(fs.readFileSync(path.join(root, "app.json"), "utf8")).expo.version)
  const released = git(root, "tag", "--merged", "HEAD", "--list", "v*").split(/\s+/)
    .map(tag => TAG.exec(tag)).filter(Boolean).map(match => match.slice(1).map(Number)).sort(compare).reverse()
  if (!released.length) return { version: baseline.join("."), changed: true }
  const latest = `v${released[0].join(".")}`
  if (git(root, "rev-list", "--count", `${latest}..HEAD`).trim() === "0") return { version: latest.slice(1), changed: false }
  const messages = git(root, "log", "--no-merges", "--format=%B%x00", `${latest}..HEAD`).split("\0").map(m => m.trim()).filter(Boolean)
  const next = bump(released[0], messages)
  return { version: (compare(baseline, next) > 0 ? baseline : next).join("."), changed: true }
}

function release(root = path.join(__dirname, "..")) {
  if (git(root, "status", "--porcelain").trim()) throw new Error("Commit or stash your changes before releasing.")
  const { version, changed } = nextVersion(root)
  if (!changed) throw new Error(`Nothing to release: v${version} is already the latest commit.`)
  const appFile = path.join(root, "app.json")
  const app = JSON.parse(fs.readFileSync(appFile, "utf8"))
  app.expo.version = version
  fs.writeFileSync(appFile, JSON.stringify(app, null, 2) + "\n")
  execFileSync("npm", ["version", version, "--no-git-tag-version", "--allow-same-version"], { cwd: root, stdio: "ignore" })
  // The first release may already carry its version: then the current commit is tagged as it is.
  if (git(root, "status", "--porcelain").trim()) {
    git(root, "add", "app.json", "package.json", "package-lock.json")
    git(root, "commit", "-m", `chore(release): v${version}`)
  }
  git(root, "tag", `v${version}`)
  return version
}

module.exports = { nextVersion, release }

if (require.main === module) {
  try {
    if (process.argv.includes("--release")) {
      const version = release()
      console.log(`v${version} hazır. Göndermek için: git push --follow-tags, ardından eas build.`)
    } else console.log(nextVersion().version)
  } catch (error) {
    console.error(error.message)
    process.exit(1)
  }
}

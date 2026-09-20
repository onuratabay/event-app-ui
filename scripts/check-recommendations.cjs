module.exports = async function ({ mount, tap, act, text, storage }) {
  const assert = require("node:assert/strict")
  const { recommend, initialProfile, PLACES, targetActivities } = require("../src/recommendations/model.ts")
  const { apiDate, dateRange, DEFAULT_FILTERS } = require("../src/map/filters.ts")
  const now = new Date(2026, 8, 20)
  const izmir = PLACES[0], ankara = PLACES[1]
  const profile = { ...initialProfile([]), equipmentByCity: { izmir: ["racket"], ankara: ["bicycle"] }, activitiesByPlace: { eymir: ["walking", "cycling"], cesme: ["sea"] } }
  const event = (id, latitude = izmir.latitude, longitude = izmir.longitude) => ({
    id, latitude, longitude, date: "23/09/2026", startTime: "18:00", durationMinutes: 60,
    status: { enum: "waiting_participants" }, interest: { id: "padel", slug: "padel", name: "Padel" },
    owner: { id: "host", firstName: "Test", lastName: "Host" }, level: { enum: "beginner", name: "Başlangıç" }, minParticipants: 2, maxParticipants: 8,
    confirmedParticipantCount: 2, participants: [], coverPhoto: null, description: "Test", requirements: null, isFavorite: false,
  })
  const six = Array.from({ length: 6 }, (_, index) => event(`padel-${index}`, izmir.latitude + index * 0.001))
  assert.equal(recommend(six, profile, izmir, now).length, 5)
  assert.equal(recommend(six.slice(0, 2), profile, izmir, now).length, 2)
  assert.equal(recommend([], profile, izmir, now).length, 0)
  assert.equal(recommend([{ ...event("full"), confirmedParticipantCount: 8 }, { ...event("closed"), status: { enum: "closed" } }, event("elsewhere", ankara.latitude, ankara.longitude)], profile, izmir, now).length, 0)
  const ankaraProfile = { ...profile, trip: { ...profile.trip, placeId: "ankara" } }
  assert.deepEqual(targetActivities(ankaraProfile).map(activity => activity.id), ["cycling"])
  const ride = { ...event("ride", ankara.latitude, ankara.longitude), interest: { id: "cycle", name: "Bisiklet", slug: "cycling" } }
  assert(recommend([ride], ankaraProfile, ankara, now)[0].reason.includes("Ankara"))
  assert.deepEqual(targetActivities({ ...profile, trip: { ...profile.trip, placeId: "eymir" } }).map(activity => activity.id), ["cycling", "walking"])
  assert.deepEqual(targetActivities({ ...profile, trip: { ...profile.trip, placeId: "cesme" } }).map(activity => activity.id), ["sea"])
  const oldFetch = global.fetch
  storage.clear()
  const nextWeek = dateRange({ ...DEFAULT_FILTERS, datePreset: "week" }).from
  global.fetch = async () => ({ ok: true, status: 200, json: async () => ({ items: [{ ...event("real-event"), date: apiDate(nextWeek) }], total: 1 }) })
  const tree = await mount("Discover")
  assert(!text(tree.toJSON()).includes("Harita Görünümü"))
  assert(!text(tree.toJSON()).includes("Yapay Zeka Önerileri Geliyor"))
  const button = tree.root.findAllByType("Pressable").find(item => item.props.accessibilityLabel === "Sana özel öneriler")
  assert(button)
  await act(async () => button.props.onPress())
  await tap(tree, "Padel raketim var")
  await tap(tree, "Kaydet ve önerileri bul")
  assert(text(tree.toJSON()).includes("1"))
  assert(text(tree.toJSON()).includes("etkinlik buldum"))
  assert(!text(tree.toJSON()).includes("5 etkinlik buldum"))
  const saved = JSON.parse(storage.get("event-app:v1")).user.recommendationProfile
  assert(saved.equipmentByCity.izmir.includes("racket"))
  await act(async () => tree.unmount())
  storage.clear()
  global.fetch = oldFetch
  console.log("PASS: recommendation counts, city-specific equipment, Eymir/Çeşme preferences, full-event exclusion, persisted context and AI entry.")
}

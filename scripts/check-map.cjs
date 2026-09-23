// Uses the TS loader and native host mocks installed by check-native.cjs.
module.exports = async function checkMap({ mount, tap, act, text, storage }) {
  const assert = require("node:assert/strict")
  const model = require("../src/map/model.ts")
  const makeEvent = (id, latitude = 39.92, longitude = 32.85) => ({
    id, latitude, longitude, date: "20/09/2026", startTime: "18:00", status: { enum: "waiting_participants", name: "Bekleyen" },
    interest: { id: "padel", name: "Padel", slug: "padel" }, owner: { id: "host", firstName: "Deniz", lastName: "Test" },
    level: { enum: "beginner", name: "Başlangıç" }, durationMinutes: 60, minParticipants: 2, maxParticipants: 10,
    confirmedParticipantCount: 1, participants: [], coverPhoto: null, requirements: null, description: "Harita testi", isFavorite: false,
  })
  const points = [makeEvent("one"), makeEvent("two", 39.9205, 32.8505)]
  assert.deepEqual([10, 12, 16].map(model.modeForZoom), ["heat", "cluster", "event"])
  assert.equal(model.filterEvents([...points, makeEvent("invalid", NaN), { ...makeEvent("cancelled"), status: { enum: "cancelled" } }], "Tümü").length, 2)
  assert.equal(model.filterEvents(points, "Bugün", new Date(2026, 8, 21)).length, 0)
  assert.equal(model.filterEvents(points, "Bugün", new Date(2026, 8, 20)).length, 2)
  const index = model.createIndex(points)
  const cluster = index.getClusters([32, 39, 33, 40], 10)[0]
  assert.equal(cluster.properties.point_count, 2)
  assert.deepEqual(new Set(index.getLeaves(cluster.properties.cluster_id, Infinity).map(point => point.properties.eventId)), new Set(["one", "two"]))
  assert.equal(index.getClusters([32, 39, 33, 40], 19).length, 2)
  const region = { latitude: 39.92, longitude: 32.85, latitudeDelta: 0.8, longitudeDelta: 0.8 }
  assert.equal(model.project(points[0], region, 400, 500).x, 200)
  assert(model.isVisible(makeEvent("dateline", 0, -179.9), { latitude: 0, longitude: 179.9, latitudeDelta: 1, longitudeDelta: 1 }))
  assert(model.densityPaths(points, region, 400, 500).some(path => path.d))
  assert(model.densityPaths([], region, 400, 500).every(path => !path.d))
  const onePeak = model.densityPaths([points[0]], region, 400, 500).findLastIndex(path => path.d)
  const twoPeak = model.densityPaths([points[0], points[0]], region, 400, 500).findLastIndex(path => path.d)
  assert(twoPeak > onePeak, "Overlapping events must increase heat intensity")
  const discovery = require("../src/map/filters.ts")
  const now = new Date(2026, 8, 20, 14, 0)
  const ankara = discovery.CITY_PRESETS[0], izmir = discovery.CITY_PRESETS[1]
  const scenarios = [
    { ...makeEvent("ankara-cycle", ankara.latitude, ankara.longitude), interest: { id: "cycle", name: "Bisiklet" } },
    { ...makeEvent("izmir-padel", izmir.latitude, izmir.longitude), date: "23/09/2026" },
    { ...makeEvent("ankara-padel", ankara.latitude, ankara.longitude), date: "23/09/2026" },
  ]
  const trip = { ...discovery.DEFAULT_FILTERS, datePreset: "week", place: izmir, interestIds: ["padel"], timeFrom: "17:00", timeTo: "20:00" }
  assert.deepEqual(discovery.applyDiscoveryFilters(scenarios, trip, now).map(event => event.id), ["izmir-padel"])
  const todayRide = { ...discovery.DEFAULT_FILTERS, datePreset: "today", place: ankara, interestIds: ["cycle"] }
  assert.deepEqual(discovery.applyDiscoveryFilters(scenarios, todayRide, now).map(event => event.id), ["ankara-cycle"])
  assert.equal(discovery.applyDiscoveryFilters(scenarios, { ...trip, timeTo: "18:30" }, now).length, 0, "Whole event must fit availability")
  assert.equal(discovery.filterError({ ...trip, datePreset: "custom", dateFrom: "2026-09-25", dateTo: "2026-09-20" }) !== null, true)
  assert.equal(discovery.filterError({ ...trip, timeFrom: "25:00" }) !== null, true)
  assert.deepEqual(discovery.dateRange({ ...trip, datePreset: "tomorrow" }, new Date(2026, 11, 31)), { from: "2027-01-01", to: "2027-01-01" })
  assert.deepEqual(discovery.dateRange(trip, now), { from: "2026-09-21", to: "2026-09-27" })
  assert.equal(discovery.applyDiscoveryFilters([{ ...scenarios[1], startTime: "23:00", durationMinutes: 120 }], { ...trip, timeFrom: "22:00", timeTo: "02:00" }, now).length, 1)
  assert.equal(discovery.categoryVisual("Bisiklet").icon, "🚲")
  assert.equal(discovery.categoryVisual("Padel").icon, "🎾")
  const oldFetch = global.fetch
  let pageRequests = 0
  global.fetch = async url => ({ ok: true, json: async () => {
    if (url.includes("limit=20")) return { items: [], total: 0 }
    pageRequests++
    return { items: url.includes("page=1&") ? [points[0]] : [points[1]], total: 101 }
  } })
  const api = require("../src/api/client.ts")
  const result = await api.getMapEvents()
  assert.equal(pageRequests, 2)
  assert.equal(result.items.length, 2)
  global.fetch = async () => ({ ok: true, json: async () => ({ items: points, total: 2 }) })
  let capturedUrl
  global.fetch = async url => { capturedUrl = url; return { ok: true, json: async () => ({ items: [], total: 0 }) } }
  await api.getMapEvents(undefined, { dateFrom: "21/09/2026", dateTo: "27/09/2026", interestIds: ["padel"] })
  const sent = new URL(capturedUrl)
  assert.equal(sent.searchParams.get("dateFrom"), "21/09/2026")
  assert.equal(sent.searchParams.get("interestId"), "padel")
  assert.equal(sent.searchParams.get("includePhotos"), "false")
  let limitedCalls = 0
  global.fetch = async () => { limitedCalls++; return { ok: true, json: async () => ({ items: [points[0]], total: 10000 }) } }
  const limited = await api.getMapEvents()
  assert.equal(limitedCalls, 5)
  assert.equal(limited.truncated, true)
  let savedFilters
  global.fetch = async (url, options) => {
    if (url.endsWith('/users/me/preferences/mapFilters')) savedFilters = JSON.parse(options.body).value
    return { ok: true, json: async () => url.endsWith('/interests') ? [{ id: 'padel', name: 'Padel' }] : url.includes('/preferences') ? {} : ({ items: points.map(e => ({ ...e, date: '01/10/2030' })), total: 2 }) }
  }
  let destination
  const tree = await mount("Map", { navigate: (...args) => { destination = args } })
  assert(text(tree.toJSON()).includes("Yoğunluk"))
  const map = tree.root.findByType("MapView")
  await act(async () => map.props.onRegionChangeComplete({ ...region, latitudeDelta: 0.1, longitudeDelta: 0.1 }))
  assert(text(tree.toJSON()).includes("Etkinlik kümeleri"))
  await act(async () => map.props.onRegionChangeComplete({ ...region, latitudeDelta: 0.0008, longitudeDelta: 0.0008 }))
  assert(text(tree.toJSON()).includes("Otomatik görünüm"))
  await act(async () => tree.root.findAllByType("Marker")[0].props.onPress({ stopPropagation() {} }))
  await tap(tree, "Detay")
  assert.equal(destination[0], "event-detail")
  assert.equal(destination[1].eventId, "one")
  await tap(tree, "Sana göre")
  assert.equal(tree.root.findAllByType("Modal").length, 1)
  await tap(tree, "İzmir")
  await tap(tree, "Etkinlikleri göster")
  assert.equal(tree.root.findAllByType("Modal").length, 0)
  assert.equal(savedFilters.place.name, "İzmir")
  await tap(tree, "Yakınımda")
  assert(text(tree.toJSON()).includes("Konum izni verilmedi"))
  await act(async () => tree.unmount())
  global.fetch = async () => { throw new Error("offline") }
  const failed = await mount("Map")
  assert(text(failed.toJSON()).includes("Sunucuya bağlanılamadı"))
  await act(async () => failed.unmount())
  global.fetch = oldFetch
  storage.clear()
  console.log("PASS: map density, zoom modes, real clustering, date/place/time/type combinations, next-week İzmir padel, today Ankara cycling, filter sheet, location denial, pagination, selection and network errors.")
}

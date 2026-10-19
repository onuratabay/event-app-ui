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
  const assertTenKmViewport = (region, width, height) => {
    const northSouthKm = region.latitudeDelta * 111.195
    const eastWestKm = region.longitudeDelta * 111.195 * Math.cos(region.latitude * Math.PI / 180)
    assert(Math.min(northSouthKm, eastWestKm) >= 20 - 0.00001, "The whole 10 km radius must fit")
    assert(Math.abs(Math.min(northSouthKm, eastWestKm) - 20) < 0.00001, "Start close to the user, rather than fitting distant events")
    assert(Math.abs(eastWestKm / northSouthKm - width / height) < 0.00001, "Radius must fit both viewport orientations")
  }
  for (const [width, height] of [[390, 760], [760, 390]]) {
    assertTenKmViewport(model.regionForRadius({ latitude: 41.01, longitude: 28.98 }, 10, { width, height }), width, height)
  }
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
  // Filter suggestions: availability first, then interests (with the profile city), then what is popular.
  const tips = require("../src/map/suggestions.ts")
  const categories = [{ id: "padel", name: "Padel" }, { id: "yoga", name: "Yoga" }]
  const availability = { id: "a1", status: "active", dateFrom: "2026-09-01", dateTo: "2026-09-30", weekdays: [1, 2, 3, 4, 5, 6, 7],
    timeWindows: [{ from: "18:00", to: "21:00" }], area: { mode: "city", name: "Eskişehir", latitude: 39.78, longitude: 30.52 },
    activities: [{ interestId: "yoga", maxDurationMinutes: null }] }
  const built = tips.buildFilterSuggestions({ availabilities: [availability, { ...availability, id: "old", dateTo: "2026-09-10" }, { ...availability, id: "off", status: "paused" }],
    interestNames: ["padel"], profileCity: "Ankara", categories, events: [...points, { ...points[0], id: "past", date: "01/09/2026" }], now })
  assert.deepEqual(built.map(item => item.id), ["availability-a1", "interests", "popular-activity", "popular-time", "popular-city", "quick-tonight", "quick-weekend"], "Expired and paused records are skipped")
  const fromCalendar = built[0]
  assert.equal(fromCalendar.label, "Eskişehir · 18:00–21:00 · Yoga")
  assert.deepEqual({ from: fromCalendar.apply.dateFrom, to: fromCalendar.apply.dateTo, time: fromCalendar.apply.timeFrom, ids: fromCalendar.apply.interestIds }, { from: "2026-09-20", to: "2026-09-30", time: "18:00", ids: ["yoga"] }, "A record that already began starts today")
  assert.equal(built[1].label, "İlgi alanların · Ankara")
  assert.equal(built.find(item => item.id === "popular-activity").label, "Padel (2)", "Past events do not count")
  assert.equal(built.find(item => item.id === "popular-time").apply.timeFrom, "17:00")
  assert.equal(built.find(item => item.id === "popular-city").apply.place.name, "Ankara")
  const applied = { ...discovery.DEFAULT_FILTERS, ...built[1].apply }
  assert(tips.suggestionApplied(applied, built[1]) && !tips.suggestionApplied(applied, fromCalendar), "Only the picked suggestion is marked")
  // A new account still gets quick picks; the weekend pick on a Sunday is that same day.
  const fresh = tips.buildFilterSuggestions({ availabilities: [], interestNames: [], profileCity: "", categories, events: [], nearby: { name: "Bulunduğun konum", latitude: 39.9, longitude: 32.8 }, now })
  assert.deepEqual(fresh.map(item => item.id), ["quick-tonight", "quick-weekend", "quick-nearby"])
  assert.deepEqual([fresh[1].apply.dateFrom, fresh[1].apply.dateTo], ["2026-09-20", "2026-09-20"])
  assert.equal(tips.buildFilterSuggestions({ availabilities: [], interestNames: [], profileCity: "", categories, events: [], now: new Date(2026, 8, 16) })[1].apply.dateTo, "2026-09-20", "Midweek, the weekend is the coming Saturday and Sunday")
  // Interests match by id (names can arrive in another language); a single event is still a popular pick.
  const byId = tips.buildFilterSuggestions({ availabilities: [], interestIds: ["yoga"], interestNames: ["Yoga (EN)"], profileCity: "", categories, events: [points[0]], now })
  assert.deepEqual(byId.find(item => item.id === "interests").apply.interestIds, ["yoga"])
  assert.equal(byId.find(item => item.id === "popular-activity").label, "Padel")
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
  const press = async label => { const node = tree.root.findAllByType("Pressable").find(item => item.props.accessibilityLabel === label); assert(node, `Missing control: ${label}`); await act(async () => node.props.onPress?.({ stopPropagation() {} })) }
  const map = tree.root.findByType("MapView")
  assert(Array.isArray(map.props.customMapStyle) && map.props.customMapStyle.length > 0 && map.props.userInterfaceStyle === "dark", "The map uses the dark style")
  // Wide view: heat layer with a compact legend; with no pins on screen there is no event strip.
  assert(text(tree.toJSON()).includes("Yoğunluk") && !text(tree.toJSON()).includes("etkinlik bu alanda"), "No event strip without pins")
  assert(!text(tree.toJSON()).includes("Otomatik görünüm"), "No mode jargon in the bottom panel")
  await act(async () => map.props.onRegionChangeComplete({ ...region, latitudeDelta: 0.1, longitudeDelta: 0.1 }))
  assert(!text(tree.toJSON()).includes("Yoğunluk"), "The density legend is only shown while the heat layer is visible")
  await act(async () => map.props.onRegionChangeComplete({ ...region, latitudeDelta: 0.0008, longitudeDelta: 0.0008 }))
  // With pins on screen, the events in view appear as small cards that open the event.
  assert(text(tree.toJSON()).includes("etkinlik bu alanda"), "Pins on screen bring up the event strip")
  const mini = tree.root.findAllByType("Pressable").find(item => /detayı aç$/.test(String(item.props.accessibilityLabel)))
  assert(mini, "Each event in view has a small card")
  await act(async () => mini.props.onPress?.({ stopPropagation() {} }))
  assert.equal(destination[0], "event-detail")
  destination = undefined
  // Picking a pin opens an event card with one clear action.
  await act(async () => tree.root.findAllByType("Marker")[0].props.onPress({ stopPropagation() {} }))
  assert(text(tree.toJSON()).includes("Seçilen etkinlik") && text(tree.toJSON()).includes("1/10 kişi"), "The picked event shows as a card with its fill")
  await tap(tree, "Detay")
  assert.equal(destination[0], "event-detail")
  assert.equal(destination[1].eventId, "one")
  await press("Seçimi kapat")
  assert(!text(tree.toJSON()).includes("Seçilen etkinlik"), "The card can be dismissed")
  // Only "Filtreler" sits on the map: date, activity, time and place are all chosen in its sheet.
  assert(!tree.root.findAllByType("Pressable").some(item => /^Tarih: /.test(String(item.props.accessibilityLabel)) || text(item).trim() === "Tüm türler"), "No date or activity chips over the map")
  await press("Filtreler")
  assert.equal(tree.root.findAllByType("Modal").length, 1)
  await tap(tree, "İzmir")
  await tap(tree, "Etkinlikleri göster")
  assert.equal(tree.root.findAllByType("Modal").length, 0)
  assert.equal(savedFilters.place.name, "İzmir")
  assert(tree.root.findAllByType("Pressable").some(item => item.props.accessibilityLabel === "Filtreler, 1 aktif"), "The filter button shows how many filters are active")
  // The locate button only moves the camera; a denied permission is explained.
  await press("Konumuma git")
  assert(text(tree.toJSON()).includes("Konum izni verilmedi"))
  assert.equal(savedFilters.place.name, "İzmir", "Locating never changes the saved filters")
  await act(async () => tree.unmount())
  // Events and saved filters can arrive before GPS. The first camera move still belongs to the user.
  global.__testForegroundLocationPermission = true
  global.__testMapCameraActions = []
  let resolvePosition
  global.__testCurrentPosition = () => new Promise(resolve => { resolvePosition = resolve })
  global.fetch = async url => ({ ok: true, json: async () => url.endsWith('/interests') ? [] : url.includes('/preferences') ? { mapFilters: { ...discovery.DEFAULT_FILTERS, place: izmir } } : ({ items: points, total: 2 }) })
  const nearbyMap = await mount("Map")
  const nearbyHost = nearbyMap.root.findByType("MapView")
  await act(async () => {
    nearbyMap.root.findAllByType("View").find(node => node.props.onLayout).props.onLayout({ nativeEvent: { layout: { width: 390, height: 760 } } })
    nearbyHost.props.onMapReady()
  })
  assert.equal(global.__testMapCameraActions.length, 0, "No event-fit while the first location is pending")
  await act(async () => resolvePosition({ coords: { latitude: 41.01, longitude: 28.98 } }))
  assert.equal(global.__testMapCameraActions.length, 1)
  const firstCamera = global.__testMapCameraActions[0]
  assert.equal(firstCamera.type, "region")
  assert.equal(firstCamera.region.latitude, 41.01)
  assert.equal(firstCamera.region.longitude, 28.98)
  assertTenKmViewport(firstCamera.region, 390, 760)
  await act(async () => nearbyMap.unmount())
  global.__testMapCameraActions = []
  global.fetch = async url => ({ ok: true, json: async () => url.endsWith('/interests') ? [] : url.includes('/preferences') ? {} : ({ items: points.map(event => ({ ...event, date: '01/10/2030' })), total: 2 }) })
  const pannedMap = await mount("Map")
  await act(async () => pannedMap.root.findByType("MapView").props.onMapReady())
  assert.equal(global.__testMapCameraActions.length, 0, "Loaded events must not take the camera before GPS")
  await act(async () => {
    const host = pannedMap.root.findByType("MapView")
    host.props.onPanDrag()
  })
  await act(async () => resolvePosition({ coords: { latitude: 41.01, longitude: 28.98 } }))
  assert.equal(global.__testMapCameraActions.length, 0, "A late GPS result must not move a map the user already panned")
  await act(async () => pannedMap.unmount())
  delete global.__testForegroundLocationPermission
  delete global.__testCurrentPosition
  delete global.__testMapCameraActions
  global.fetch = async () => { throw new Error("offline") }
  const failed = await mount("Map")
  assert(text(failed.toJSON()).includes("Sunucuya bağlanılamadı"))
  await act(async () => failed.unmount())
  global.fetch = oldFetch
  storage.clear()
  console.log("PASS: map density, zoom modes, clustering, discovery filters, 10 km viewport in both orientations, delayed GPS startup, manual pan, location denial, pagination, selection and network errors.")
}

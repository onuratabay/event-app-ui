// "Etkinlik Takvimim": date/time rules, activity preferences, saving and managing records, organizer invites and the invite countdown.
module.exports = async function ({ mount, act, text, storage }) {
  const assert = require("node:assert/strict")
  const model = require("../src/availability/model.ts")
  const { AVAILABILITY_SERVER_READY } = require("../src/availability/server.ts")
  const now = new Date(2026, 9, 12, 10, 0) // Monday 12 Oct 2026, 10:00
  const catalog = [
    { id: "padel", name: "Padel", levels: [{ id: "beginner", enum: "beginner", name: "Başlangıç" }, { id: "advanced", enum: "advanced", name: "İleri" }, { id: "all", enum: "all", name: "Her seviye" }] },
    { id: "kahve", name: "Kahve", levels: [] },
  ]
  const issues = (draft, field) => model.validateDraft(draft, catalog, now).filter(issue => !field || issue.field === field).map(issue => issue.message)
  const base = { ...model.emptyDraft(), startDate: "2026-10-14", endDate: "2026-10-17", area: { mode: "city", place: { name: "Ankara", latitude: 39.93, longitude: 32.86 } }, activities: [model.newPreference("kahve")] }

  // Hotel-style range picking.
  let range = { startDate: "", endDate: "" }
  assert.deepEqual(model.pickDay(range, "2026-10-10", now), range, "Past days cannot be picked")
  range = model.pickDay(range, "2026-10-15", now)
  assert.deepEqual(range, { startDate: "2026-10-15", endDate: "" })
  assert.deepEqual(model.pickDay(range, "2026-10-13", now), { startDate: "2026-10-13", endDate: "" }, "A day before the start restarts the range")
  range = model.pickDay(range, "2026-10-18", now)
  assert.deepEqual(range, { startDate: "2026-10-15", endDate: "2026-10-18" })
  assert.deepEqual(model.pickDay(range, "2026-10-20", now), { startDate: "2026-10-20", endDate: "" }, "A complete range starts over")
  assert.deepEqual(model.pickDay({ startDate: "2026-10-15", endDate: "" }, "2026-10-15", now), { startDate: "2026-10-15", endDate: "2026-10-15" }, "Same day twice is a single day")
  assert.equal(model.describeDates({ startDate: "2026-10-15", endDate: "" }), "15 Eki 2026 · tek gün")
  assert.equal(model.describeDates({ startDate: "2026-10-14", endDate: "2026-10-17" }), "14 Eki – 17 Eki 2026 · 4 gün")

  // Date validation.
  assert.deepEqual(issues(base), [], "A complete draft is valid")
  assert(issues({ ...base, startDate: "2026-10-11", endDate: "" }, "date")[0].includes("Geçmiş"), "Past start is rejected")
  assert(issues({ ...base, startDate: "2026-10-20", endDate: "2026-10-18" }, "date")[0].includes("Bitiş tarihi başlangıçtan önce olamaz"), "End before start is rejected")
  assert.deepEqual(issues({ ...base, startDate: "2026-10-12", endDate: "" }, "date"), [], "Today as a single day is allowed")

  // Days and hours.
  assert.deepEqual(model.weekdaysInRange("2026-10-17", "2026-10-17"), [6], "A single Saturday only offers Saturday")
  assert.equal(model.weekdaysInRange("2026-10-12", "2026-10-30").length, 7)
  const weekdaysOnly = model.applyPreset(base, "weekdays")
  assert.deepEqual(weekdaysOnly.weekdays, [1, 2, 3, 4, 5])
  assert(model.isPresetActive(weekdaysOnly, "weekdays") && !model.isPresetActive(weekdaysOnly, "everyDay"))
  assert(issues({ ...weekdaysOnly, startDate: "2026-10-17", endDate: "2026-10-18" }, "days").length, "Weekday-only availability over a weekend is rejected")
  const evenings = model.applyPreset(weekdaysOnly, "evenings")
  assert.deepEqual(evenings.timeWindows, [{ from: "18:00", to: "23:00" }], "Akşamları applies visible, editable hours")
  assert.deepEqual(evenings.weekdays, [1, 2, 3, 4, 5], "Akşamları keeps the chosen days")
  assert.equal(model.describeDays(evenings.weekdays), "Hafta içi")
  assert.equal(model.describeTimes([]), "Gün boyu müsaitim", "No hours means all day")
  assert(issues({ ...base, timeWindows: [{ from: "20:00", to: "19:00" }] }, "time").length, "End hour before start is rejected")
  assert(issues({ ...base, timeWindows: [{ from: "09:00", to: "12:00" }, { from: "11:00", to: "13:00" }] }, "time")[0].includes("çakışıyor"), "Overlapping hours are rejected")
  assert(issues({ ...base, startDate: "2026-10-12", endDate: "", timeWindows: [{ from: "07:00", to: "09:00" }] }, "time")[0].includes("geçti"), "Hours already over today are rejected")

  // Area: city or map radius (km, radius not diameter).
  assert(issues({ ...base, area: { mode: "city", place: null } }, "area").length)
  assert(issues({ ...base, area: { mode: "radius", center: null, radiusKm: 5 } }, "area")[0].includes("merkez"))
  assert(issues({ ...base, area: { mode: "radius", center: { latitude: 41, longitude: 29 }, radiusKm: 0 } }, "area")[0].includes("Yarıçap"))
  assert.equal(model.describeArea({ mode: "radius", center: { latitude: 41, longitude: 29 }, radiusKm: 5 }), "Haritadan seçilen alan · 5 km yarıçap")

  // Activities: several at once; level fields only where the catalog defines levels; "Her seviye" is a partner preference.
  assert.deepEqual(model.skillLevels(catalog[0]).map(level => level.enum), ["beginner", "advanced"], "'all' is never an own skill level")
  let draft = model.toggleActivity({ ...base, activities: [] }, "padel")
  draft = model.toggleActivity(draft, "kahve")
  assert.equal(draft.activities.length, 2)
  assert.deepEqual(issues(draft, "activities").length, 2, "Padel needs own and partner levels")
  let padel = { ...draft.activities[0], ownLevelId: "advanced" }
  padel = model.togglePartnerLevel(padel, "beginner")
  assert.deepEqual(padel.partnerLevelIds, ["beginner"])
  padel = model.togglePartnerLevel(padel, "any")
  assert.equal(padel.anyPartnerLevel, true)
  assert.deepEqual(padel.partnerLevelIds, [], "Her seviye replaces specific levels")
  padel = { ...padel, maxDurationMinutes: 120 }
  draft = { ...draft, activities: [padel, draft.activities[1]] }
  assert.deepEqual(issues(draft), [])
  assert.equal(model.describeActivity(padel, catalog).detail, "Seviyem: İleri · Birlikte: her seviye · en fazla 2 saat")

  // Proposed payload: wire formats, own level kept separate from the match preference, no level fields for coffee.
  const payload = model.toPayload({ ...draft, startDate: "2026-10-17", endDate: "" , weekdays: [1, 2, 3, 4, 5, 6, 7] }, catalog)
  assert.equal(payload.dateFrom, "17/10/2026")
  assert.equal(payload.dateTo, "17/10/2026", "A single day ends where it starts")
  assert.deepEqual(payload.weekdays, [6], "Only weekdays inside the range are sent")
  assert.deepEqual(payload.activities[0], { interestId: "padel", ownLevelId: "advanced", anyPartnerLevel: true, partnerLevelIds: [], maxDurationMinutes: 120 })
  assert.deepEqual(payload.activities[1], { interestId: "kahve", maxDurationMinutes: null })
  const roundTrip = model.fromApi({ id: "a", status: "paused", ...payload })
  assert.equal(roundTrip.endDate, "", "Single-day records reopen as single days")
  assert.equal(roundTrip.activities[0].anyPartnerLevel, true)

  // Screen: validation, summary review, saving, the record list and its actions.
  assert.equal(AVAILABILITY_SERVER_READY, true)
  const server = require("./mock-server.cjs")()
  const oldFetch = global.fetch
  // Region search (Google Places "regions") is answered here; everything else by the mock server.
  const placeCalls = []
  const REGIONS = { "kadıköy": { placeId: "kadikoy", title: "Kadıköy", subtitle: "İstanbul, Türkiye", latitude: 40.99, longitude: 29.03 }, "kazım büfe": { placeId: "kazim", title: "Kazım Büfe", subtitle: "Moda, Kadıköy/İstanbul", latitude: 40.98, longitude: 29.02 }, "ankara": { placeId: "ankara", title: "Ankara", subtitle: "Türkiye", latitude: 39.93, longitude: 32.86 } }
  global.fetch = async (url, init) => {
    const parsed = new URL(url)
    if (parsed.pathname === "/places/autocomplete") {
      placeCalls.push(parsed.search)
      const q = (parsed.searchParams.get("q") || "").toLocaleLowerCase("tr")
      return { ok: true, status: 200, json: async () => ({ items: Object.entries(REGIONS).filter(([name]) => name.startsWith(q)).map(([, { placeId, title, subtitle }]) => ({ placeId, title, subtitle })) }) }
    }
    const region = Object.values(REGIONS).find(item => parsed.pathname === `/places/${item.placeId}`)
    if (region) return { ok: true, status: 200, json: async () => ({ placeId: region.placeId, name: region.title, address: "", latitude: region.latitude, longitude: region.longitude, city: region.subtitle.split(",")[0], district: "" }) }
    return server.fetch(url, init)
  }
  server.availabilities.push({ id: "old", status: "expired", dateFrom: "01/09/2026", dateTo: "03/09/2026", weekdays: [2, 3, 4], timeWindows: [], area: { mode: "city", name: "İzmir", latitude: 38.42, longitude: 27.14 }, activities: [{ interestId: "kahve", maxDurationMinutes: null }] })
  server.availabilities.push({ id: "lapsed", status: "active", dateFrom: "01/10/2026", dateTo: "05/10/2026", weekdays: [2, 3, 4], timeWindows: [], area: { mode: "city", name: "İzmir", latitude: 38.42, longitude: 27.14 }, activities: [{ interestId: "kahve", maxDurationMinutes: null }] })
  const wait = (ms = 20) => act(async () => { await new Promise(resolve => setTimeout(resolve, ms)) })
  const screen = await mount("Availability", { now })
  await wait()
  const pressables = () => screen.root.findAllByType("Pressable")
  const byLabel = label => pressables().find(node => typeof node.props.accessibilityLabel === "string" && node.props.accessibilityLabel.startsWith(label))
  const press = async label => { const node = byLabel(label); assert(node, `Missing control: ${label}`); await act(async () => node.props.onPress?.({ stopPropagation() {}, nativeEvent: {} })) }
  const pressText = async (label, index = 0) => { const node = pressables().filter(item => text(item).includes(label)).at(index); assert(node, `Missing button: ${label}`); await act(async () => node.props.onPress?.({ stopPropagation() {} })) }
  let content = text(screen.toJSON())
  assert(content.includes("Etkinlik Takvimim") && !content.includes("Müsait olduğun zamanları kaydet"), "The page opens straight on the form, without the intro card")
  assert(!content.includes("Kaydetme henüz açık değil") && !content.includes("İlan yayınla"))
  // Two tabs: the form (with the calendar right at the top) and the saved records.
  assert(byLabel("Yeni müsaitlik").props.accessibilityState.selected, "The screen opens on the form")
  assert(byLabel("14 Eki 2026"), "The calendar is visible without scrolling past the records")
  assert(!content.includes("Süresi geçenler"), "Records live in their own tab")
  await press("Kayıtlarım")
  content = text(screen.toJSON())
  assert(content.includes("Süresi geçenler") && content.includes("Süresi doldu"), "Expired records are listed separately")
  assert(content.includes("güncel bir müsaitlik kaydın yok"), "Empty state for current records")
  {
    // Past records look disabled: dimmed, no edit or pause, even when the server has not marked them expired yet.
    const flat = node => Object.assign({}, ...[].concat(node.props.style).flat(Infinity).filter(Boolean))
    const past = screen.root.findAll(node => node.type === "View" && String(node.props.accessibilityLabel || "").endsWith("süresi geçti") && flat(node).opacity === 0.5)
    assert.equal(past.length, 2, "Both past records are dimmed")
    assert(!pressables().some(node => text(node).includes("Düzenle")), "Past records cannot be edited")
  }
  await pressText("Yeni müsaitlik oluştur")
  assert(byLabel("Yeni müsaitlik").props.accessibilityState.selected, "The empty state leads to the form")
  await pressText("Kaydet ve davet al")
  assert(text(screen.toJSON()).includes("Başlangıç tarihini seç."), "Saving an incomplete form shows what is missing")
  assert(!text(screen.toJSON()).includes("Kaydetmeden önce kontrol et"))
  assert(byLabel("10 Eki 2026").props.accessibilityState.disabled, "Past days are disabled")
  await press("14 Eki 2026")
  await press("17 Eki 2026")
  assert(text(screen.toJSON()).includes("14 Eki – 17 Eki 2026 · 4 gün"), "The chosen range is summarized")
  assert(byLabel("15 Eki 2026").props.accessibilityState.selected, "Days inside the range are highlighted")
  await press("Günler ve saatler")
  assert(text(screen.toJSON()).includes("gün boyu müsaitim olarak kaydedilir"), "Missing hours are explained as all day")
  await press("Akşamları")
  assert(text(screen.toJSON()).includes("18:00–23:00"), "Applied preset hours are visible")
  assert(byLabel("1. aralık başlangıç saati"), "Preset hours stay editable")
  await press("Aktiviteler")
  await press("Padel")
  await press("Kahve")
  content = text(screen.toJSON())
  assert.equal((content.match(/Benim seviyem/g) || []).length, 1, "Only the activity with levels asks for a level")
  assert.equal((content.match(/Maksimum katılım süresi/g) || []).length, 2, "Each selected activity opens its own details")
  await press("Benim seviyem: Başlangıç")
  await press("Birlikte: her seviye")
  await press("Padel en fazla 2 saat")
  await press("Konum")
  // Same flow as the event location step: a city field, then a district search with suggestions.
  assert(screen.root.findAll(node => node.props.testID === "availability-map").length, "The location section always shows the map")
  assert(text(screen.toJSON()).includes("haritada bir noktaya dokun"), "With no area yet, the section says how to choose one")
  const regionSearch = () => screen.root.findAll(node => node.props.accessibilityLabel === "Adres veya mekan ara" && typeof node.props.onChangeText === "function")[0]
  const settle = (ms = 320) => act(async () => { await new Promise(resolve => setTimeout(resolve, ms)) })
  await act(async () => regionSearch().props.onChangeText("Kad"))
  await settle()
  assert(placeCalls.length && placeCalls.every(call => !new URLSearchParams(call).has("kind")), "The area search covers venues too, like the event location step")
  await press("Kadıköy, İstanbul, Türkiye")
  await settle(30)
  assert(text(screen.toJSON()).includes("Kadıköy · 5 km yarıçap"), "A picked district is a named circle around it")
  assert.equal(regionSearch().props.value, "Kadıköy", "The picked district stays in the search field")
  await press("Seçimi kaldır")
  assert(!screen.root.findAll(node => node.type === "Circle" && node.props.center).length && regionSearch().props.value === "", "The picked district can be removed")
  await act(async () => regionSearch().props.onChangeText("Kazım"))
  await settle()
  await press("Kazım Büfe, Moda, Kadıköy/İstanbul")
  await settle(30)
  assert(text(screen.toJSON()).includes("Kazım Büfe · 5 km yarıçap") && regionSearch().props.value === "Kazım Büfe", "A venue can be searched and becomes a named circle around it")
  await press("Seçimi kaldır")
  assert(!screen.root.findAll(node => node.type === "Circle" && node.props.center).length && regionSearch().props.value === "", "The picked district can be removed")
  await act(async () => regionSearch().props.onChangeText("Ank"))
  await settle()
  await press("Ankara, Türkiye")
  await settle(30)
  assert(byLabel("Şehir: Ankara") && byLabel("Tüm şehir").props.accessibilityState.selected, "A picked province fills the city field as the whole city")
  await press("Şehir: Ankara")
  await pressText("İstanbul")
  assert(byLabel("Şehir: İstanbul"), "The city is changed from the city field")
  assert(screen.root.findAll(node => node.type === "Circle" && node.props.radius === 30000).length, "A chosen city is drawn as its whole-city circle")
  const map = screen.root.findAll(node => node.props.testID === "availability-map")[0]
  await act(async () => map.props.onPress({ nativeEvent: { coordinate: { latitude: 41.01, longitude: 28.97 } } }))
  assert(text(screen.toJSON()).includes("5 km uzaklığa kadar"), "Tapping the map narrows to a custom circle explained as distance from the center")
  assert(screen.root.findAll(node => node.type === "Circle" && node.props.radius === 5000).length, "The area is drawn as a circle with the radius in metres")
  await press("10 kilometre yarıçap")
  await pressText("Kaydet ve davet al")
  assert(text(screen.toJSON()).includes("Kaydetmeden önce kontrol et"), "A short summary is shown before saving")
  assert(!server.requests.some(request => request.path === "/users/me/availability" && request.method === "POST"), "Nothing is saved before confirming")
  await pressText("Kaydet ve davet al", -1) // the innermost match is the sheet's confirm button
  await wait()
  const created = server.requests.find(request => request.path === "/users/me/availability" && request.method === "POST")
  assert(created, "Confirming saves the record")
  assert.equal(created.body.dateFrom, "14/10/2026")
  assert.equal(created.body.dateTo, "17/10/2026")
  assert.deepEqual(created.body.timeWindows, [{ from: "18:00", to: "23:00" }])
  assert.deepEqual(created.body.area, { mode: "radius", latitude: 41.01, longitude: 28.97, radiusKm: 10 })
  assert.deepEqual(created.body.activities, [{ interestId: "padel", ownLevelId: "beginner", anyPartnerLevel: true, partnerLevelIds: [], maxDurationMinutes: 120 }, { interestId: "kahve", maxDurationMinutes: null }])
  content = text(screen.toJSON())
  assert(content.includes("Kaydedildi") && content.includes("Davet alıyor"), "The saved record is listed as active")
  assert(byLabel("Kayıtlarım").props.accessibilityState.selected && text(byLabel("Kayıtlarım")).includes("1") && byLabel("Kayıtlarım").props.accessibilityValue?.text === "1 kayıt", "Saving switches to the records tab with the count in its badge")
  await pressText("Duraklat")
  await wait()
  assert(server.requests.some(request => /^\/users\/me\/availability\/availability-\d+\/pause$/.test(request.path)), "Pausing calls the server")
  assert(text(screen.toJSON()).includes("Duraklatıldı"))
  await pressText("Etkinleştir")
  await wait()
  assert(text(screen.toJSON()).includes("Davet alıyor"), "A paused record can be reactivated")
  await pressText("Kaldır")
  assert(!server.requests.some(request => request.method === "DELETE"), "Removing asks for confirmation first")
  await pressText("Düzenle")
  assert(text(screen.toJSON()).includes("Kaydı düzenle") && text(screen.toJSON()).includes("14 Eki – 17 Eki 2026 · 4 gün"), "Editing reloads the record into the form")
  await act(async () => screen.unmount())

  // Organizer: "Davet et" → "Uygun kişilerden davet et" on the own, waiting event only.
  storage.set("event-app.access-token", "availability-test")
  server.events.push({ ...server.events[0], id: "own-event", owner: { id: server.user.id, firstName: "Sunucu", lastName: "Kullanıcısı" }, participants: [], viewerParticipationStatus: "confirmed" })
  const detail = await mount("EventDetail", { eventId: "own-event" })
  await wait(50)
  const detailPress = async label => { const all = detail.root.findAllByType("Pressable"); const node = all.find(item => item.props.accessibilityLabel === label) || all.filter(item => text(item).includes(label)).at(-1); assert(node, `Missing control: ${label}`); await act(async () => node.props.onPress?.({ stopPropagation() {} })); await wait() }
  assert(text(detail.toJSON()).includes("Takviminde bu tarih, saat ve yer için uygun 1 kişi var"), "The organizer sees how many people are free for this date, time and place")
  assert(!server.requests.some(request => request.path === "/events/own-event/candidates"), "The count does not load candidate cards")
  {
    // The participants card invites only from the availability pool; the guest link stays in the top bar.
    let card = detail.root.findAll(node => node.type === "Text" && text(node).trim() === "Katılımcılar")[0]
    while (card && !text(card).includes("Davet et")) card = card.parent
    assert(card && !text(card).includes("Açıklama"), "The pool invite sits in the participants card")
    assert(text(card).includes("için uygun") && !text(card).includes("Davet linki"), "No guest link inside the participants card")
    assert(detail.root.findAllByType("Pressable").some(node => node.props.accessibilityLabel === "Paylaş"), "The guest link is shared from the top bar")
  }
  await detailPress("Davet et")
  await wait(20)
  assert(text(detail.toJSON()).includes("Etkinlik Takvimi'nde bu etkinliğin tarihi, saati ve yeri için uygun"), "The invite sheet opens straight on the availability pool")
  content = text(detail.toJSON())
  assert(content.includes("Ece Aday") && content.includes("Etkinlik saatinde müsait"), "Candidates show visible profile data and a fit summary")
  assert(content.includes("Davet yer ayırmaz"), "The invite explains it does not reserve a place")
  await detailPress("Ece Aday davet et")
  await detailPress("Davet gönder (1)")
  const sent = server.requests.find(request => request.path === "/events/own-event/invitations")
  assert.deepEqual(sent.body, { userIds: ["cand-1"] }, "Only the chosen candidate is invited")
  assert(text(detail.toJSON()).includes("1 kişiye davet gönderildi") && !text(detail.toJSON()).includes("Ece Aday"), "Invited candidates leave the list")
  await act(async () => detail.unmount())
  const afterInvite = await mount("EventDetail", { eventId: "own-event" })
  await wait(50)
  assert(text(afterInvite.toJSON()).includes("takviminde bu tarih, saat ve yer için uygun kimse yok"), "The invite stays open and says nobody is waiting")
  await act(async () => afterInvite.unmount())
  // The invitation stays open until the event is full: up to the max, or up to the minimum when no max was set.
  const ownEvent = server.events.find(event => event.id === "own-event")
  const hasInvite = async (confirmed, max) => {
    Object.assign(ownEvent, { confirmedParticipantCount: confirmed, minParticipants: 2, maxParticipants: max })
    const view = await mount("EventDetail", { eventId: "own-event" })
    await wait(50)
    const shown = view.root.findAllByType("Pressable").some(node => node.props.accessibilityLabel === "Davet et")
    await act(async () => view.unmount())
    return shown
  }
  assert.equal(await hasInvite(1, 100000), true, "Min 2, no max: the organizer can still invite one person")
  assert.equal(await hasInvite(2, 100000), false, "No max: \"Davet et\" disappears once the minimum is reached")
  assert.equal(await hasInvite(2, 4), true, "With a max, inviting continues past the minimum")
  assert.equal(await hasInvite(4, 4), false, "Davet et disappears when the max is reached")
  const guestView = await mount("EventDetail", { eventId: server.events[0].id })
  await wait(50)
  assert(!guestView.root.findAllByType("Pressable").some(node => node.props.accessibilityLabel === "Davet et"), "Only the organizer sees Davet et")
  assert(!text(guestView.toJSON()).includes("katılmayı bekl"), "Only the organizer sees the pool count")
  assert(!text(guestView.toJSON()).includes("Davet açık"), "Only the organizer invites from the pool")
  await act(async () => guestView.unmount())

  // A cancelled event can be updated and created again: its details prefill the form.
  server.events.push({ ...server.events[0], id: "cancelled-own", owner: { id: server.user.id, firstName: "Sunucu", lastName: "Kullanıcısı" }, status: { enum: "cancelled" }, viewerParticipationStatus: "confirmed",
    date: "01/01/2020", startTime: "09:00", durationMinutes: 90, locationName: "Eski Buluşma, Çankaya, Ankara", latitude: 39.91, longitude: 32.86, minParticipants: 3, maxParticipants: 6, description: "İptal edilen etkinliğin açıklaması", visibility: { id: "public", enum: "public", name: "Herkese Açık" } })
  let recreateNavigation
  const cancelledView = await mount("EventDetail", { eventId: "cancelled-own", navigate: (route, opts) => { recreateNavigation = { route, opts } } })
  await wait(50)
  const recreate = cancelledView.root.findAllByType("Pressable").find(node => node.props.accessibilityLabel === "Güncelle ve yeniden oluştur")
  assert(recreate, "The organizer of a cancelled event can create it again")
  await act(async () => recreate.props.onPress())
  assert.deepEqual(recreateNavigation, { route: "create-event", opts: { eventId: "cancelled-own" } })
  await act(async () => cancelledView.unmount())
  const copy = await mount("CreateEvent", { copyFromEventId: "cancelled-own" })
  await wait(80)
  const copied = text(copy.toJSON())
  assert(copied.includes("İptal ettiğin etkinliğin bilgileri dolduruldu"), "The form says it was prefilled")
  assert(copied.includes("Ne kadar sürecek"), "The organizer lands on the date step to set a new time")
  const copyContinue = () => copy.root.findAllByType("Pressable").find(node => text(node).includes("Devam Et"))
  assert.equal(copyContinue().props.disabled, false, "A past date is replaced with an upcoming one, so the copy can continue")
  await act(async () => copyContinue().props.onPress())
  const venue = copy.root.findAll(node => node.props.accessibilityLabel === "Buluşma noktası (isteğe bağlı)" && typeof node.props.onChangeText === "function")[0]
  assert.equal(venue.props.value, "Eski Buluşma, Çankaya, Ankara", "The location is copied")
  assert.equal(copyContinue().props.disabled, false, "The copied map point is already selected")
  await act(async () => copyContinue().props.onPress())
  assert(copy.root.findAllByType("TextInput").some(node => node.props.value === "İptal edilen etkinliğin açıklaması"), "The description is copied")
  await act(async () => copy.unmount())
  assert(!server.events.some(event => event.id === "cancelled-own" && event.status.enum !== "cancelled"), "The cancelled event itself stays cancelled")

  // Invitee: countdown, place note, conflict lock; the server stays the authority on accept.
  server.invitations.splice(0, server.invitations.length,
    { ...server.invitations[0] || server.events[1], id: "invite-1", owner: { id: "inviter", firstName: "Davet", lastName: "Eden" }, viewerParticipationStatus: "invited", viewerInvitationExpiresAt: new Date(Date.now() + 5 * 3600000 + 60000).toISOString(), viewerHasTimeConflict: false },
    { ...server.events[1], id: "invite-2", owner: { id: "inviter", firstName: "Davet", lastName: "Eden" }, viewerParticipationStatus: "invited", viewerInvitationExpiresAt: new Date(Date.now() + 600000).toISOString(), viewerHasTimeConflict: true })
  const notifications = await mount("Notifications")
  await wait(50)
  content = text(notifications.toJSON())
  assert(/Yanıt için 5 sa 0[01] dk kaldı/.test(content), "A 24 hour style countdown is shown")
  assert(/Yanıt için (09|10):\d\d kaldı/.test(content), "The last hour counts down in minutes and seconds")
  assert(content.includes("Davet yer ayırmaz") && content.includes("1 saat"), "The card shows capacity and activity details")
  assert(content.includes("Aynı saatte katıldığın başka bir etkinlik var"), "Conflicting invites are flagged")
  const accepts = notifications.root.findAllByType("Pressable").filter(node => text(node).includes("Kabul et"))
  assert.equal(accepts.length, 2)
  assert.equal(accepts[0].props.accessibilityState.disabled, false)
  assert.equal(accepts[1].props.accessibilityState.disabled, true, "A conflicting invite cannot be accepted")
  await act(async () => notifications.unmount())
  storage.delete("event-app.access-token")
  global.fetch = oldFetch

  // Entry points: Discover header and own profile.
  for (const name of ["Discover", "Profile"]) {
    const visited = []
    const tree = await mount(name, { navigate: target => visited.push(target) })
    const entry = tree.root.findAllByType("Pressable").find(node => node.props.accessibilityLabel === "Etkinlik Takvimim")
    assert(entry, `${name} links to Etkinlik Takvimim`)
    await act(async () => entry.props.onPress?.({ stopPropagation() {} }))
    assert.deepEqual(visited, ["availability"])
    await act(async () => tree.unmount())
  }
  global.__testWindowWidth = 360
  const narrow = await mount("Discover")
  assert(narrow.root.findAll(node => node.props.accessibilityLabel === "Ewent.app" && node.props.style?.width === 72).length, "The wordmark shrinks to keep three actions per side on narrow phones")
  await act(async () => narrow.unmount())
  global.__testWindowWidth = undefined
}

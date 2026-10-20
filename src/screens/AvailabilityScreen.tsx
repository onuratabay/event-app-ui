import ContextualTip from "../walkthrough/ContextualTip"
import { showAlert } from "../components/AppDialog"
import { useWalkthroughAutostartBlocker, useWalkthroughScreenBlocker } from "../walkthrough/activity"
import ActivityIndicator from "../components/LoadingSpinner";
import { useEffect, useRef, useState, type ReactNode } from "react"
import { Platform, StyleSheet, View } from "react-native"
import * as Location from "expo-location"
import MapView, { Circle, Marker } from "react-native-maps"
import { MAP_PROVIDER } from "../map/provider"
import { DARK_MAP_PROPS } from "../map/darkStyle"
import { BaseTiles, BaseTilesCredit } from "../map/BaseTiles"
import { createAvailability, deleteAvailability, getApiErrorMessage, getAvailabilities, getMapInterests, setAvailabilityPaused, updateAvailability, type ApiAvailability } from "../api/client"
import { useBottomNavInset } from "../components/BottomNav"
import { AtmoBackground, GlassCard, GlassFill } from "../components/GlassUI"
import { CategoryIcon, CheckIcon, ChevronDownIcon, CloseIcon, LocationIcon, PlusIcon, SearchIcon } from "../components/Icons"
import TopNavBar from "../components/TopNavBar"
import CountBadge from "../components/CountBadge"
import CityPicker from "../components/CityPicker"
import { matchCity } from "../events/LocationPicker"
import { PlaceSuggestionList, usePlaceSuggestions } from "../map/PlaceSuggestions"
import type { PlaceSuggestion } from "../api/client"
import { DURATIONS, formatDuration } from "../events/duration"
import { CITY_PRESETS, type MapPlace } from "../map/filters"
import { INITIAL_REGION } from "../map/model"
import RangeCalendar from "../availability/RangeCalendar"
import { AVAILABILITY_SERVER_READY } from "../availability/server"
import { applyPreset, describeActivity, describeArea, describeDates, describeDays, describeTimes, emptyDraft, fromApi, isPresetActive, isRecordOver, CITY_RADIUS_KM, MAX_RADIUS_KM, MAX_TIME_WINDOWS, MIN_RADIUS_KM, QUICK_PRESETS, RADIUS_OPTIONS, skillLevels, STATUS_LABEL, toggleActivity, togglePartnerLevel, toPayload, validateDraft, WEEKDAY_LONG, WEEKDAY_SHORT, WEEKDAYS, weekdaysInRange, effectiveEnd, type ActivityPreference, type AvailabilityDraft, type CatalogInterest, type DraftField } from "../availability/model"
import { Box, Field, Label, Scroll, Sheet, Touch, useScrollAnchor } from "../native/UI"
import { palette } from "../theme/palette"
import type { NavigateFn } from "../types"

type Section = "dates" | "times" | "area" | "activities"
// Map span that fits a circle of `km` radius with a margin.
const deltaFor = (km: number) => Math.max(0.04, km / 111 * 2.6)
const DEFAULT_RADIUS_KM = 5
const SECTION_FOR: Record<DraftField, Section> = { date: "dates", days: "times", time: "times", area: "area", activities: "activities" }
type Records = { state: "loading" | "error" | "ready"; items: ApiAvailability[]; error?: string }

function Chip({ label, selected, onPress, disabled, accessibilityLabel }: { label: string; selected: boolean; onPress: () => void; disabled?: boolean; accessibilityLabel?: string }) {
  return <Touch accessibilityLabel={accessibilityLabel || label} accessibilityState={{ selected }} disabled={disabled} disabledOpacity={0.3} onPress={onPress} style={[s.chip, selected && s.chipSelected]}>
    <Label style={[s.chipText, selected && s.chipTextSelected]}>{label}</Label>
  </Touch>
}

function Accordion({ title, summary, open, onToggle, invalid, children }: { title: string; summary: string; open: boolean; onToggle: () => void; invalid?: boolean; children: ReactNode }) {
  // An opened section scrolls into view, header included.
  const anchor = useScrollAnchor()
  const ref = useRef<View | null>(null)
  useEffect(() => { if (open) anchor?.(ref.current) }, [open])
  return <View ref={ref} collapsable={false}><GlassCard style={s.section}>
    <Touch walkthroughId={title === "Tarihler" ? "availability-dates" : undefined} accessibilityLabel={`${title}: ${summary}`} accessibilityState={{ expanded: open }} onPress={onToggle} style={s.sectionHeader} haptic={false}>
      <Box style={{ flex: 1, minWidth: 0 }}>
        <Label style={s.sectionTitle}>{title}</Label>
        <Label style={[s.sectionSummary, invalid && !open && { color: palette.error }]} numberOfLines={2}>{summary}</Label>
      </Box>
      <ChevronDownIcon size={18} style={[{ color: palette.muted }, open && { transform: [{ rotate: "180deg" }] }]} />
    </Touch>
    {open && <Box style={s.sectionBody}>{children}</Box>}
  </GlassCard></View>
}

const Issues = ({ messages }: { messages: string[] }) => messages.length ? <Box accessibilityLiveRegion="polite" style={{ gap: 4 }}>{messages.map(message => <Label key={message} style={s.error}>{message}</Label>)}</Box> : null

export default function AvailabilityScreen({ navigate, now }: { navigate: NavigateFn; now?: Date }) {
  const inset = useBottomNavInset()
  const [draft, setDraft] = useState<AvailabilityDraft>(emptyDraft)
  useWalkthroughAutostartBlocker(!!draft.startDate || draft.activities.length > 0)
  const [open, setOpen] = useState<Section | null>("dates")
  // Two tabs keep the calendar at the top: the form, and the saved records.
  const [tab, setTab] = useState<"new" | "records">("new")
  const [catalog, setCatalog] = useState<CatalogInterest[] | null>(null)
  const [catalogError, setCatalogError] = useState<string | null>(null)
  const [cityQuery, setCityQuery] = useState("")
  // The last city picked, so "Tüm şehir" can widen a custom circle back to the whole city.
  const [lastCity, setLastCity] = useState<MapPlace | null>(null)
  // While typing, the search field shows the query; otherwise it shows the picked district (if any).
  const [typing, setTyping] = useState(false)
  const [searching, setSearching] = useState(false)
  const [locating, setLocating] = useState(false)
  const [records, setRecords] = useState<Records>({ state: "loading", items: [] })
  const [editingId, setEditingId] = useState<string | null>(null)
  const [reviewing, setReviewing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [showIssues, setShowIssues] = useState(false)
  const [busyRecord, setBusyRecord] = useState<string | null>(null)
  const map = useRef<MapView>(null)
  useWalkthroughScreenBlocker(saving || !!busyRecord || reviewing || searching || locating)

  const loadCatalog = () => {
    setCatalogError(null)
    getMapInterests().then(setCatalog).catch(error => setCatalogError(getApiErrorMessage(error, "Aktiviteler yüklenemedi.")))
  }
  const loadRecords = () => {
    if (!AVAILABILITY_SERVER_READY) return
    setRecords(current => ({ ...current, state: "loading" }))
    getAvailabilities().then(result => setRecords({ state: "ready", items: result.items })).catch(error => setRecords({ state: "error", items: [], error: getApiErrorMessage(error, "Kayıtların yüklenemedi.") }))
  }
  useEffect(() => { loadCatalog(); loadRecords() }, [])

  const interests = catalog || []
  const issues = validateDraft(draft, interests, now)
  const issuesFor = (field: DraftField) => showIssues ? issues.filter(issue => issue.field === field).map(issue => issue.message) : []
  const hasIssue = (field: DraftField) => issues.some(issue => issue.field === field)
  const toggle = (section: Section) => setOpen(current => current === section ? null : section)
  const update = (change: (current: AvailabilityDraft) => AvailabilityDraft) => { setNotice(null); setDraft(change) }
  const end = effectiveEnd(draft)
  const daysInRange = draft.startDate ? weekdaysInRange(draft.startDate, end) : WEEKDAYS
  const updatePreference = (interestId: string, change: (preference: ActivityPreference) => ActivityPreference) => update(current => ({ ...current, activities: current.activities.map(item => item.interestId === interestId ? change(item) : item) }))

  const searchCity = async () => {
    const query = cityQuery.trim()
    if (searching || !query) return
    setSearching(true)
    try {
      // Same geocoder as event creation; Android needs the permission for it, the map option does not.
      if (Platform.OS === "android" && !(await Location.requestForegroundPermissionsAsync()).granted) throw new Error("permission")
      const [found] = await Location.geocodeAsync(lastCity ? `${query}, ${lastCity.name}, Türkiye` : `${query}, Türkiye`)
      if (!found) { showAlert("Adres bulunamadı", "Farklı yazmayı dene ya da haritaya dokunarak alanı seç."); return }
      pickNamedArea({ latitude: found.latitude, longitude: found.longitude }, query)
    } catch {
      showAlert("Adres aranamadı", Platform.OS === "android" ? "Arama için konum izni gerekiyor. İzin vermeden şehir seçebilir ya da haritadan alan belirleyebilirsin." : "Bağlantını kontrol edip tekrar dene.")
    } finally { setSearching(false) }
  }
  const useMyLocation = async () => {
    if (locating) return
    setLocating(true)
    try {
      if (!(await Location.requestForegroundPermissionsAsync()).granted) { showAlert("Konum izni verilmedi", "Sorun değil: haritaya dokunarak merkez noktasını kendin seçebilirsin."); return }
      const { coords } = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
      const center = { latitude: coords.latitude, longitude: coords.longitude }
      update(current => ({ ...current, area: { mode: "radius", center, radiusKm: current.area.mode === "radius" ? current.area.radiusKm : DEFAULT_RADIUS_KM } }))
      focusOn(center, area.mode === "radius" ? area.radiusKm : DEFAULT_RADIUS_KM)
    } catch { showAlert("Konum alınamadı", "Haritaya dokunarak merkez noktasını seçebilirsin.") }
    finally { setLocating(false) }
  }

  const resetForm = () => { setDraft(emptyDraft()); setEditingId(null); setShowIssues(false); setOpen("dates"); setCityQuery(""); setTyping(false); setLastCity(null) }
  const submit = () => {
    setShowIssues(true)
    if (issues.length) { setOpen(SECTION_FOR[issues[0].field]); return }
    setReviewing(true)
  }
  const save = async () => {
    if (saving || !AVAILABILITY_SERVER_READY) return
    setSaving(true)
    try {
      const payload = toPayload(draft, interests)
      const saved = editingId ? await updateAvailability(editingId, payload) : await createAvailability(payload)
      setRecords(current => ({ state: "ready", items: [saved, ...current.items.filter(item => item.id !== saved.id)] }))
      setReviewing(false)
      resetForm()
      setNotice(editingId ? "Değişikliklerin kaydedildi." : "Kaydedildi. Uygun etkinliklerin organizatörleri artık seni davet edebilir.")
      setTab("records")
    } catch (error) { showAlert("Kaydedilemedi", getApiErrorMessage(error)) }
    finally { setSaving(false) }
  }
  const edit = (record: ApiAvailability) => { setDraft(fromApi(record)); setEditingId(record.id); setShowIssues(false); setNotice(null); setOpen("dates"); setTab("new") }
  const setPaused = async (record: ApiAvailability, paused: boolean) => {
    if (busyRecord) return
    setBusyRecord(record.id)
    try { const saved = await setAvailabilityPaused(record.id, paused); setRecords(current => ({ ...current, items: current.items.map(item => item.id === saved.id ? saved : item) })) }
    catch (error) { showAlert(paused ? "Duraklatılamadı" : "Etkinleştirilemedi", getApiErrorMessage(error)) }
    finally { setBusyRecord(null) }
  }
  const remove = (record: ApiAvailability) => showAlert("Kaydı kaldır", "Bu müsaitlik kaydı kaldırılacak. Oluşturduğun etkinlikler ve kabul ettiğin katılımlar etkilenmez.", [
    { text: "Vazgeç", style: "cancel" },
    { text: "Kaldır", style: "destructive", onPress: async () => {
      setBusyRecord(record.id)
      try { await deleteAvailability(record.id); setRecords(current => ({ ...current, items: current.items.filter(item => item.id !== record.id) })); if (editingId === record.id) resetForm() }
      catch (error) { showAlert("Kaldırılamadı", getApiErrorMessage(error)) }
      finally { setBusyRecord(null) }
    } },
  ])

  const area = draft.area
  // The area is one centre plus a radius: a whole city (city mode, matched with CITY_RADIUS_KM on
  // the server) or a custom circle (radius mode). Both are drawn the same way on the map.
  const areaCenter = area.mode === "city" ? (area.place ? { latitude: area.place.latitude, longitude: area.place.longitude } : null) : area.center
  const areaRadiusKm = area.mode === "city" ? CITY_RADIUS_KM : area.radiusKm
  // A record opened for editing brings its own city along.
  const cityPlace = area.mode === "city" && area.place ? area.place : lastCity
  const focusOn = (center: { latitude: number; longitude: number }, km: number) => map.current?.animateToRegion?.({ ...center, latitudeDelta: deltaFor(km), longitudeDelta: deltaFor(km) }, 350)
  const chooseCity = (place: MapPlace) => {
    setLastCity(place); setCityQuery(""); setTyping(false)
    update(current => ({ ...current, area: { mode: "city", place } }))
    focusOn(place, CITY_RADIUS_KM)
  }
  // Same city field as "Nerede buluşacaksınız": the 81 provinces, clearable. The three big cities have
  // known centres; the rest are geocoded on the device.
  const [locatingCity, setLocatingCity] = useState(false)
  const changeCity = async (name: string) => {
    if (!name) { clearArea(); return }
    const known = CITY_PRESETS.find(place => place.name === name)
    if (known) { chooseCity(known); return }
    setLocatingCity(true)
    try {
      if (Platform.OS === "android" && !(await Location.requestForegroundPermissionsAsync()).granted) throw new Error("permission")
      const [found] = await Location.geocodeAsync(`${name}, Türkiye`)
      if (!found) throw new Error("not found")
      chooseCity({ name, latitude: found.latitude, longitude: found.longitude })
    } catch { showAlert("Şehir bulunamadı", Platform.OS === "android" ? "Şehri haritada göstermek için konum izni gerekiyor. İlçe aramasıyla ya da haritaya dokunarak da alan seçebilirsin." : "Bağlantını kontrol edip tekrar dene.") }
    finally { setLocatingCity(false) }
  }
  const wholeCity = () => {
    if (!cityPlace) return
    update(current => ({ ...current, area: { mode: "city", place: cityPlace } }))
    focusOn(cityPlace, CITY_RADIUS_KM)
  }
  // Typing suggests venues, addresses, districts and cities near the area, as on the event location step.
  const regions = usePlaceSuggestions(typing ? cityQuery : "", areaCenter)
  const pickNamedArea = (center: { latitude: number; longitude: number }, label: string) => {
    setCityQuery(""); setTyping(false)
    update(current => ({ ...current, area: { mode: "radius", center, radiusKm: DEFAULT_RADIUS_KM, label } }))
    focusOn(center, DEFAULT_RADIUS_KM)
  }
  const pickRegion = async (suggestion: PlaceSuggestion) => {
    try {
      const place = await regions.resolve(suggestion)
      const center = { latitude: place.latitude, longitude: place.longitude }
      // A province is the whole city (and fills the city field); a venue, address or district becomes
      // a named circle around it.
      const city = matchCity(place.name) || matchCity(suggestion.title)
      if (city) { chooseCity(CITY_PRESETS.find(item => item.name === city) ?? { name: city, ...center }); return }
      pickNamedArea(center, place.name || suggestion.title)
    } catch { showAlert("Yer seçilemedi", "Bağlantını kontrol et ya da haritaya dokunarak alan belirle.") }
  }
  // Removes the chosen area entirely (no city, no circle) and zooms the map back out.
  const clearArea = () => {
    setLastCity(null); setCityQuery(""); setTyping(false)
    update(current => ({ ...current, area: { mode: "city", place: null } }))
    map.current?.animateToRegion?.(INITIAL_REGION, 350)
  }
  // The search field's clear button: stops a search, or drops the picked district back to the whole
  // city (or to no area when no city is chosen).
  const searchShown = typing ? cityQuery : area.mode === "radius" && area.center ? (area.label || "Haritadan seçilen alan") : ""
  const clearSearch = () => {
    if (typing) { setCityQuery(""); setTyping(false); return }
    if (cityPlace) wholeCity(); else clearArea()
  }
  const pickCenter = ({ latitude, longitude }: { latitude: number; longitude: number }) =>
    update(current => ({ ...current, area: { mode: "radius", center: { latitude, longitude }, radiusKm: current.area.mode === "radius" ? current.area.radiusKm : DEFAULT_RADIUS_KM } }))
  const chooseRadius = (km: number) => {
    if (!areaCenter) return
    const radiusKm = Math.min(MAX_RADIUS_KM, Math.max(MIN_RADIUS_KM, km))
    // Keeps the area's name (a searched district, or the city being narrowed) for the summary.
    update(current => ({ ...current, area: { mode: "radius", center: areaCenter, radiusKm, label: current.area.mode === "radius" ? current.area.label : current.area.place?.name } }))
    focusOn(areaCenter, radiusKm)
  }

  const activitySummary = draft.activities.length ? draft.activities.map(item => describeActivity(item, interests).title).join(", ") : "Aktivite seçilmedi"
  // Past records (last day gone) are shown dimmed and inactive at the end of the list.
  const current = records.items.filter(item => !isRecordOver(item, now)), expired = records.items.filter(item => isRecordOver(item, now))

  const recordCard = (record: ApiAvailability) => {
    const asDraft = fromApi(record), busy = busyRecord === record.id, over = isRecordOver(record, now)
    return <GlassCard key={record.id} style={[s.record, over && s.recordOver]} accessibilityLabel={over ? `${describeDates(asDraft)}, süresi geçti` : undefined}>
      <Box style={s.recordHead}>
        <Label style={[s.recordTitle, over && s.recordTitleOver]}>{describeDates(asDraft)}</Label>
        <Label style={[s.badge, !over && record.status === "active" ? s.badgeActive : s.badgeMuted]}>{over ? STATUS_LABEL.expired : STATUS_LABEL[record.status]}</Label>
      </Box>
      <Label style={s.recordLine}>{`${describeDays(asDraft.weekdays)} · ${describeTimes(asDraft.timeWindows)}`}</Label>
      <Label style={s.recordLine}>{describeArea(asDraft.area)}</Label>
      <Label style={s.recordLine}>{asDraft.activities.map(item => describeActivity(item, interests).title).join(", ")}</Label>
      {!over && <Box style={s.recordActions}>
        <Touch disabled={busy} onPress={() => edit(record)} style={s.recordAction}><Label style={s.recordActionText}>Düzenle</Label></Touch>
        <Touch disabled={busy} onPress={() => void setPaused(record, record.status === "active")} style={s.recordAction}><Label style={s.recordActionText}>{record.status === "active" ? "Duraklat" : "Etkinleştir"}</Label></Touch>
        <Touch disabled={busy} onPress={() => remove(record)} style={s.recordAction}><Label style={[s.recordActionText, { color: palette.error }]}>Kaldır</Label></Touch>
      </Box>}
      {over && <Touch disabled={busy} onPress={() => remove(record)} style={[s.recordAction, { alignSelf: "flex-start" }]}><Label style={[s.recordActionText, { color: palette.muted }]}>Kaldır</Label></Touch>}
    </GlassCard>
  }

  return <Box style={s.screen}>
    <AtmoBackground />
    <TopNavBar navigate={navigate} fallback="discover" title="Etkinlik Takvimim" subtitle="Özel eşleşme havuzu" />
    <Scroll style={[s.scroll, { paddingBottom: (tab === "new" ? 148 : 40) + inset }]} enter>
      <Box walkthroughId="availability-tabs" style={s.segment} accessibilityRole="tablist">
        {([["new", editingId ? "Kaydı düzenle" : "Yeni müsaitlik"], ["records", "Kayıtlarım"]] as const).map(([id, label]) => {
          // The records tab carries the count of current records in a badge beside its label.
          const count = id === "records" ? current.length : 0
          return <Touch key={id} accessibilityRole="tab" accessibilityLabel={label} accessibilityValue={count ? { text: `${count} kayıt` } : undefined} accessibilityState={{ selected: tab === id }} onPress={() => setTab(id)} style={[s.segmentItem, s.tabItem, tab === id && s.segmentActive]}>
            <Box style={s.tabLabel}>
              <Label style={[s.chipText, tab === id && s.chipTextSelected]}>{label}</Label>
              <CountBadge count={count} />
            </Box>
          </Touch>
        })}
      </Box>
      <ContextualTip id="availability" when={!!notice} />
      {notice && <Box style={s.success} accessibilityLiveRegion="polite"><CheckIcon size={16} style={{ color: palette.success }} /><Label style={s.successText}>{notice}</Label></Box>}
      {!AVAILABILITY_SERVER_READY && <Box style={s.pending} accessibilityRole="alert">
        <Label style={s.pendingTitle}>Kaydetme henüz açık değil</Label>
        <Label style={s.pendingText}>Müsaitlik kaydı ve eşleşme için sunucu desteği hazırlanıyor. Seçimlerini burada planlayabilirsin ama şu an kaydedilmez ve davet alınmaz.</Label>
      </Box>}

      {tab === "records" && AVAILABILITY_SERVER_READY && <Box style={{ gap: 10 }}>
        {records.state === "loading" && <Box style={s.stateBox}><ActivityIndicator color={palette.accent} /><Label style={s.muted}>Kayıtların yükleniyor…</Label></Box>}
        {records.state === "error" && <Box style={s.stateBox}><Label style={s.error}>{records.error}</Label><Touch onPress={loadRecords} style={s.linkButton}><Label style={s.link}>Tekrar dene</Label></Touch></Box>}
        {records.state === "ready" && !current.length && <Box style={s.stateBox}><Label style={s.muted}>Davet alabileceğin güncel bir müsaitlik kaydın yok.</Label><Touch onPress={() => setTab("new")} style={s.linkButton}><Label style={s.link}>Yeni müsaitlik oluştur</Label></Touch></Box>}
        {current.map(recordCard)}
        {expired.length > 0 && <Label style={s.groupLabel}>Süresi geçenler</Label>}
        {expired.map(recordCard)}
      </Box>}

      {tab === "new" && <>
      {editingId && <Box style={s.formHead}>
        <Label style={s.groupLabel}>Kaydı düzenle</Label>
        <Touch onPress={resetForm} style={s.linkButton}><Label style={s.link}>Vazgeç</Label></Touch>
      </Box>}

      <Accordion title="Tarihler" summary={describeDates(draft)} open={open === "dates"} onToggle={() => toggle("dates")} invalid={showIssues && hasIssue("date")}>
        <RangeCalendar startDate={draft.startDate} endDate={draft.endDate} now={now} onChange={range => update(current => ({ ...current, ...range }))} />
        <Issues messages={issuesFor("date")} />
      </Accordion>

      <Accordion title="Günler ve saatler" summary={`${describeDays(draft.weekdays)} · ${describeTimes(draft.timeWindows)}`} open={open === "times"} onToggle={() => toggle("times")} invalid={showIssues && (hasIssue("days") || hasIssue("time"))}>
        <Label style={s.fieldLabel}>Hızlı seçim</Label>
        <Box style={s.wrap}>{QUICK_PRESETS.map(preset => <Chip key={preset.key} label={preset.label} selected={isPresetActive(draft, preset.key)} onPress={() => update(current => applyPreset(current, preset.key))} />)}</Box>
        <Label style={s.fieldLabel}>Uygun günler</Label>
        <Box style={s.wrap}>{WEEKDAYS.map(day => <Chip key={day} label={WEEKDAY_SHORT[day]} accessibilityLabel={WEEKDAY_LONG[day]} disabled={!daysInRange.includes(day)} selected={draft.weekdays.includes(day)} onPress={() => update(current => ({ ...current, weekdays: current.weekdays.includes(day) ? current.weekdays.filter(item => item !== day) : [...current.weekdays, day] }))} />)}</Box>
        {draft.startDate && daysInRange.length < 7 && <Label style={s.muted}>Seçtiğin aralıkta olmayan günler kapalı.</Label>}
        <Label style={s.fieldLabel}>Saat aralıkları</Label>
        {!draft.timeWindows.length && <Box style={s.allDay}><Label style={s.allDayText}>Saat seçmedin: gün boyu müsaitim olarak kaydedilir.</Label></Box>}
        {draft.timeWindows.map((window, index) => <Box key={index} style={s.windowRow}>
          <Field mode="time" accessibilityLabel={`${index + 1}. aralık başlangıç saati`} value={window.from} onChangeText={value => update(current => ({ ...current, timeWindows: current.timeWindows.map((item, i) => i === index ? { ...item, from: value } : item) }))} style={s.timeField} glass />
          <Label style={s.muted}>–</Label>
          <Field mode="time" accessibilityLabel={`${index + 1}. aralık bitiş saati`} value={window.to} onChangeText={value => update(current => ({ ...current, timeWindows: current.timeWindows.map((item, i) => i === index ? { ...item, to: value } : item) }))} style={s.timeField} glass />
          <Touch accessibilityLabel={`${index + 1}. saat aralığını kaldır`} onPress={() => update(current => ({ ...current, timeWindows: current.timeWindows.filter((_, i) => i !== index) }))} style={s.iconButton}><CloseIcon size={16} style={{ color: palette.muted }} /></Touch>
        </Box>)}
        {draft.timeWindows.length < MAX_TIME_WINDOWS && <Touch onPress={() => update(current => ({ ...current, timeWindows: [...current.timeWindows, { from: "09:00", to: "12:00" }] }))} style={s.addButton}>
          <Box style={s.row}><PlusIcon size={16} style={{ color: palette.accent }} /><Label style={s.link}>Saat aralığı ekle</Label></Box>
        </Touch>}
        <Label style={s.muted}>Saatler İstanbul saatine göre kaydedilir. Gece yarısını geçen aralık desteklenmez.</Label>
        <Issues messages={[...issuesFor("days"), ...issuesFor("time")]} />
      </Accordion>

      <Accordion title="Konum" summary={describeArea(area)} open={open === "area"} onToggle={() => toggle("area")} invalid={showIssues && hasIssue("area")}>
        {/* Same flow as "Nerede buluşacaksınız": choose a city, then narrow it to a district by search or
            on the map; the size row below covers both. */}
        <CityPicker clearable value={cityPlace?.name ?? ""} onChange={next => void changeCity(next)} />
        {locatingCity && <Label style={s.muted}>Şehir bulunuyor…</Label>}
        <Box style={s.search}>
          <SearchIcon size={15} style={{ color: palette.muted }} />
          <Field accessibilityLabel="Adres veya mekan ara" placeholder={cityPlace ? `${cityPlace.name} içinde adres veya mekan ara…` : "Adres veya mekan ara…"} value={searchShown}
            onChangeText={text => { setCityQuery(text); setTyping(true) }} onSubmitEditing={() => void searchCity()} returnKeyType="search" style={s.searchField} />
          {/* While typing: "Ara" (device geocoder), as on the event location step; once picked: clear. */}
          {typing ? <Touch accessibilityLabel="Ara" disabled={!cityQuery.trim() || searching} onPress={() => void searchCity()} style={s.searchButton}><Label style={s.link}>{searching ? "…" : "Ara"}</Label></Touch>
            : searchShown ? <Touch accessibilityLabel="Seçimi kaldır" onPress={clearSearch} style={s.iconButton}><CloseIcon size={16} style={{ color: palette.muted }} /></Touch> : null}
        </Box>
        <PlaceSuggestionList items={regions.items} onPick={item => void pickRegion(item)} />
        <Box style={s.mapFrame}>
          <MapView ref={map} provider={MAP_PROVIDER} testID="availability-map" {...DARK_MAP_PROPS} style={StyleSheet.absoluteFill} initialRegion={areaCenter ? { ...areaCenter, latitudeDelta: deltaFor(areaRadiusKm), longitudeDelta: deltaFor(areaRadiusKm) } : INITIAL_REGION} onPress={event => pickCenter(event.nativeEvent.coordinate)}>
            <BaseTiles />
            {areaCenter && <Circle center={areaCenter} radius={areaRadiusKm * 1000} strokeColor="rgba(185,195,255,.9)" fillColor="rgba(105,120,255,.18)" strokeWidth={2} />}
            {area.mode === "radius" && area.center && <Marker coordinate={area.center} pinColor={palette.blue} />}
          </MapView>
          <BaseTilesCredit />
        </Box>
        <Touch disabled={locating} onPress={() => void useMyLocation()} style={s.addButton}>
          <Box style={s.row}><LocationIcon size={15} style={{ color: palette.accent }} /><Label style={s.link}>{locating ? "Konum alınıyor…" : "Konumumu kullan (isteğe bağlı)"}</Label></Box>
        </Touch>
        <Label style={s.fieldLabel}>Alan</Label>
        <Box style={s.wrap}>
          <Chip label="Tüm şehir" accessibilityLabel="Tüm şehir" selected={area.mode === "city" && !!area.place} disabled={!cityPlace} onPress={wholeCity} />
          <Touch accessibilityLabel="Yarıçapı azalt" disabled={!areaCenter || areaRadiusKm <= MIN_RADIUS_KM} onPress={() => chooseRadius(areaRadiusKm - 1)} style={s.stepper}><Label style={s.stepperText}>−</Label></Touch>
          {RADIUS_OPTIONS.map(km => <Chip key={km} label={`${km} km`} accessibilityLabel={`${km} kilometre yarıçap`} disabled={!areaCenter} selected={area.mode === "radius" && area.radiusKm === km} onPress={() => chooseRadius(km)} />)}
          <Touch accessibilityLabel="Yarıçapı artır" disabled={!areaCenter || areaRadiusKm >= MAX_RADIUS_KM} onPress={() => chooseRadius(areaRadiusKm + 1)} style={s.stepper}><Label style={s.stepperText}>+</Label></Touch>
        </Box>
        <Label style={s.muted}>{!areaCenter ? "Bir şehir seç ya da haritada bir noktaya dokun." : area.mode === "city" && area.place
          ? `${area.place.name} ve yaklaşık ${CITY_RADIUS_KM} km çevresindeki etkinlikler eşleşir. Daha dar bir alan için haritaya dokun ya da mesafe seç.`
          : `Seçtiğin merkezden her yöne ${areaRadiusKm} km uzaklığa kadar olan etkinlikler eşleşir. Merkezi değiştirmek için haritada başka bir noktaya dokun; merkez noktan diğer kullanıcılara gösterilmez.`}</Label>
        <Issues messages={issuesFor("area")} />
      </Accordion>

      <Accordion title="Aktiviteler" summary={activitySummary} open={open === "activities"} onToggle={() => toggle("activities")} invalid={showIssues && hasIssue("activities")}>
        {!catalog && !catalogError && <Box style={s.stateBox}><ActivityIndicator color={palette.accent} /><Label style={s.muted}>Aktiviteler yükleniyor…</Label></Box>}
        {catalogError && <Box style={s.stateBox}><Label style={s.error}>{catalogError}</Label><Touch onPress={loadCatalog} style={s.linkButton}><Label style={s.link}>Tekrar dene</Label></Touch></Box>}
        {catalog && !catalog.length && <Label style={s.muted}>Seçilebilir aktivite bulunamadı.</Label>}
        <Box style={s.wrap}>{interests.map(interest => <Chip key={interest.id} label={interest.name} selected={draft.activities.some(item => item.interestId === interest.id)} onPress={() => update(current => toggleActivity(current, interest.id))} />)}</Box>
        {draft.activities.map(preference => {
          const interest = interests.find(item => item.id === preference.interestId)
          const levels = skillLevels(interest)
          return <Box key={preference.interestId} style={s.detail}>
            <Box style={s.row}><CategoryIcon name={interest?.name} size={18} style={{ color: palette.accent }} /><Label style={s.detailTitle}>{interest?.name || "Aktivite"}</Label></Box>
            {levels.length > 0 && <>
              <Label style={s.fieldLabel}>Benim seviyem</Label>
              <Box style={s.wrap}>{levels.map(level => <Chip key={level.id} label={level.name} accessibilityLabel={`Benim seviyem: ${level.name}`} selected={preference.ownLevelId === level.id} onPress={() => updatePreference(preference.interestId, item => ({ ...item, ownLevelId: level.id }))} />)}</Box>
              <Label style={s.fieldLabel}>Birlikte oynamak istediğim seviyeler</Label>
              <Box style={s.wrap}>
                <Chip label="Her seviye" accessibilityLabel="Birlikte: her seviye" selected={preference.anyPartnerLevel} onPress={() => updatePreference(preference.interestId, item => togglePartnerLevel(item, "any"))} />
                {levels.map(level => <Chip key={level.id} label={level.name} accessibilityLabel={`Birlikte: ${level.name}`} selected={!preference.anyPartnerLevel && preference.partnerLevelIds.includes(level.id)} onPress={() => updatePreference(preference.interestId, item => togglePartnerLevel(item, level.id))} />)}
              </Box>
            </>}
            <Label style={s.fieldLabel}>Maksimum katılım süresi</Label>
            <Box style={s.wrap}>
              <Chip label="Fark etmez" accessibilityLabel={`${interest?.name || "Aktivite"} süresi fark etmez`} selected={preference.maxDurationMinutes === null} onPress={() => updatePreference(preference.interestId, item => ({ ...item, maxDurationMinutes: null }))} />
              {DURATIONS.map(minutes => <Chip key={minutes} label={formatDuration(minutes)} accessibilityLabel={`${interest?.name || "Aktivite"} en fazla ${formatDuration(minutes)}`} selected={preference.maxDurationMinutes === minutes} onPress={() => updatePreference(preference.interestId, item => ({ ...item, maxDurationMinutes: minutes }))} />)}
            </Box>
            <Issues messages={showIssues ? issues.filter(issue => issue.interestId === preference.interestId).map(issue => issue.message) : []} />
          </Box>
        })}
        <Issues messages={showIssues ? issues.filter(issue => issue.field === "activities" && !issue.interestId).map(issue => issue.message) : []} />
      </Accordion>

      <GlassCard style={s.summary}>
        <Label style={s.groupLabel}>Özet</Label>
        {[describeDates(draft), `${describeDays(draft.weekdays)} · ${describeTimes(draft.timeWindows)}`, describeArea(area)].map(line => <Label key={line} style={s.summaryLine}>{line}</Label>)}
        {draft.activities.map(item => { const text = describeActivity(item, interests); return <Label key={item.interestId} style={s.summaryLine}>{`${text.title}: ${text.detail}`}</Label> })}
        <Label style={s.muted}>Davet otomatik katılım değildir; her daveti sen kabul ya da reddedersin.</Label>
      </GlassCard>
      </>}
    </Scroll>

    {tab === "new" && <Box style={[s.sticky, { bottom: inset }]} gradient={[palette.background, "transparent"]} gradientDirection="up">
      <Touch onPress={submit} disabled={!AVAILABILITY_SERVER_READY} disabledOpacity={1} gradient={AVAILABILITY_SERVER_READY ? palette.actionGradient : ["#202b3d", "#182235", "#151f30"]} style={[s.primary, !AVAILABILITY_SERVER_READY && s.primaryDisabled]}>
        <Label style={[s.primaryText, !AVAILABILITY_SERVER_READY && { color: "rgba(226,232,240,.62)" }]}>Kaydet ve davet al</Label>
      </Touch>
      {!AVAILABILITY_SERVER_READY && <Label style={s.stickyNote}>Sunucu desteği etkinleşince kullanılabilir.</Label>}
    </Box>}

    {reviewing && <Sheet onClose={() => !saving && setReviewing(false)}>
      <Touch haptic={false} onPress={() => {}} style={s.sheet}><GlassFill kind="sheet" topRadius={24} />
        <Label style={s.sheetTitle}>Kaydetmeden önce kontrol et</Label>
        {[describeDates(draft), `${describeDays(draft.weekdays)} · ${describeTimes(draft.timeWindows)}`, describeArea(area), ...draft.activities.map(item => { const text = describeActivity(item, interests); return `${text.title}: ${text.detail}` })].map(line => <Label key={line} style={s.summaryLine}>{line}</Label>)}
        <Touch disabled={saving} onPress={() => void save()} gradient={palette.actionGradient} style={s.primary}><Label style={s.primaryText}>{saving ? "Kaydediliyor…" : "Kaydet ve davet al"}</Label></Touch>
        <Touch disabled={saving} onPress={() => setReviewing(false)} style={s.linkButton}><Label style={s.link}>Düzenlemeye dön</Label></Touch>
      </Touch>
    </Sheet>}
  </Box>
}

const s = StyleSheet.create({
  screen: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: palette.background },
  scroll: { paddingTop: 80, paddingHorizontal: 16, gap: 12 },
  pending: { borderRadius: 16, borderWidth: 1, borderColor: "rgba(243,155,175,.32)", backgroundColor: "rgba(243,155,175,.08)", padding: 14, gap: 4 },
  pendingTitle: { color: palette.error, fontFamily: "Outfit-SemiBold", fontSize: 14, lineHeight: 19 },
  pendingText: { color: "rgba(244,245,255,.78)", fontSize: 13, lineHeight: 19 },
  success: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 16, borderWidth: 1, borderColor: "rgba(111,208,182,.32)", backgroundColor: "rgba(111,208,182,.08)", padding: 14 },
  successText: { flex: 1, color: palette.text, fontSize: 13, lineHeight: 19 },
  groupLabel: { color: "rgba(241,245,249,.6)", fontSize: 12, lineHeight: 16, letterSpacing: 1.2, textTransform: "uppercase" },
  formHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 6 },
  section: { overflow: "hidden" },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  sectionTitle: { color: palette.text, fontFamily: "Outfit-SemiBold", fontSize: 15, lineHeight: 20 },
  sectionSummary: { color: palette.muted, fontSize: 13, lineHeight: 18 },
  sectionBody: { paddingHorizontal: 16, paddingBottom: 16, gap: 10 },
  fieldLabel: { color: "rgba(241,245,249,.72)", fontSize: 12, lineHeight: 16, letterSpacing: 1, textTransform: "uppercase", marginTop: 4 },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  chip: { minHeight: 40, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.surface },
  chipSelected: { backgroundColor: palette.selected, borderColor: "rgba(105,120,255,.38)" },
  chipText: { color: palette.text, fontFamily: "Outfit-Medium", fontSize: 13, lineHeight: 18, textAlign: "center" },
  chipTextSelected: { color: palette.accent, fontFamily: "Outfit-SemiBold" },
  allDay: { borderRadius: 14, borderWidth: 1, borderColor: "rgba(105,120,255,.28)", backgroundColor: "rgba(105,120,255,.08)", padding: 12 },
  allDayText: { color: palette.accent, fontSize: 13, lineHeight: 18 },
  windowRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  timeField: { flex: 1, borderRadius: 14, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.background, paddingHorizontal: 14, minHeight: 48 },
  iconButton: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  addButton: { alignSelf: "flex-start", paddingVertical: 6 },
  link: { color: palette.accent, fontFamily: "Outfit-SemiBold", fontSize: 13, lineHeight: 18 },
  linkButton: { alignSelf: "flex-start", paddingVertical: 4 },
  muted: { color: palette.muted, fontSize: 12, lineHeight: 17 },
  error: { color: palette.error, fontSize: 13, lineHeight: 18 },
  segment: { flexDirection: "row", borderRadius: 14, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.background, padding: 3 },
  segmentItem: { flex: 1, borderRadius: 11, alignItems: "center" },
  segmentActive: { backgroundColor: palette.selected },
  tabItem: { minHeight: 40, justifyContent: "center" },
  tabLabel: { flexDirection: "row", alignItems: "center", gap: 6 },
  recordOver: { opacity: 0.5 },
  recordTitleOver: { color: palette.muted },
  // Same search box as the event location step.
  search: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 48, borderRadius: 14, paddingLeft: 14, borderWidth: 1, borderColor: palette.border, backgroundColor: "rgba(255,255,255,.05)" },
  searchField: { flex: 1, color: palette.text, fontSize: 14, paddingVertical: 12 },
  searchButton: { minHeight: 44, minWidth: 52, alignItems: "center", justifyContent: "center", paddingHorizontal: 12 },
  mapFrame: { height: 240, borderRadius: 16, overflow: "hidden", borderWidth: 1, borderColor: palette.border },
  stepper: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.surface, alignItems: "center" },
  stepperText: { color: palette.text, fontSize: 18, lineHeight: 22, textAlign: "center" },
  detail: { borderRadius: 16, borderWidth: 1, borderColor: palette.border, backgroundColor: "rgba(8,11,24,.45)", padding: 14, gap: 8 },
  detailTitle: { color: palette.text, fontFamily: "Outfit-SemiBold", fontSize: 14, lineHeight: 19 },
  summary: { padding: 16, gap: 6 },
  summaryLine: { color: palette.text, fontSize: 14, lineHeight: 20 },
  stateBox: { borderRadius: 16, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.surface, padding: 16, gap: 8, alignItems: "flex-start" },
  record: { padding: 14, gap: 4 },
  recordHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  recordTitle: { flex: 1, color: palette.text, fontFamily: "Outfit-SemiBold", fontSize: 14, lineHeight: 19 },
  recordLine: { color: palette.muted, fontSize: 13, lineHeight: 18 },
  recordActions: { flexDirection: "row", gap: 16, marginTop: 4 },
  recordAction: { paddingVertical: 4 },
  recordActionText: { color: palette.accent, fontFamily: "Outfit-SemiBold", fontSize: 13, lineHeight: 18 },
  badge: { overflow: "hidden", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3, fontSize: 11, lineHeight: 15 },
  badgeActive: { color: palette.success, backgroundColor: "rgba(111,208,182,.12)" },
  badgeMuted: { color: palette.muted, backgroundColor: "rgba(146,157,184,.12)" },
  sticky: { position: "absolute", left: 0, right: 0, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8, gap: 6, zIndex: 40 },
  primary: { width: "100%", minHeight: 52, borderRadius: 16, borderWidth: 1, borderColor: "rgba(183,197,255,.24)", alignItems: "center", justifyContent: "center" },
  primaryDisabled: { borderColor: "rgba(148,163,184,.22)" },
  primaryText: { color: palette.text, fontFamily: "Outfit-SemiBold", fontSize: 16, lineHeight: 22, letterSpacing: 0.4 },
  stickyNote: { color: palette.muted, fontSize: 12, lineHeight: 16, textAlign: "center" },
  sheet: { backgroundColor: palette.glassSheet, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, gap: 10, borderWidth: 1, borderColor: palette.glassBorder, alignItems: "stretch" },
  sheetTitle: { color: palette.text, fontFamily: "Outfit-SemiBold", fontSize: 17, lineHeight: 23, marginBottom: 4 },
})

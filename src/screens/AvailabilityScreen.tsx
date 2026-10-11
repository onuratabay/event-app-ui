import { useEffect, useRef, useState, type ReactNode } from "react"
import { ActivityIndicator, Alert, Platform, StyleSheet } from "react-native"
import * as Location from "expo-location"
import MapView, { Circle, Marker } from "react-native-maps"
import { MAP_PROVIDER } from "../map/provider"
import { createAvailability, deleteAvailability, getApiErrorMessage, getAvailabilities, getMapInterests, setAvailabilityPaused, updateAvailability, type ApiAvailability } from "../api/client"
import { useBottomNavInset } from "../components/BottomNav"
import { AtmoBackground, GlassCard } from "../components/GlassUI"
import { CalendarIcon, CategoryIcon, CheckIcon, ChevronDownIcon, CloseIcon, LocationIcon, PlusIcon, SearchIcon } from "../components/Icons"
import TopNavBar from "../components/TopNavBar"
import { DURATIONS, formatDuration } from "../events/duration"
import { CITY_PRESETS, type MapPlace } from "../map/filters"
import { INITIAL_REGION } from "../map/model"
import RangeCalendar from "../availability/RangeCalendar"
import { AVAILABILITY_SERVER_READY } from "../availability/server"
import { applyPreset, describeActivity, describeArea, describeDates, describeDays, describeTimes, emptyDraft, fromApi, isPresetActive, MAX_RADIUS_KM, MAX_TIME_WINDOWS, MIN_RADIUS_KM, QUICK_PRESETS, RADIUS_OPTIONS, skillLevels, STATUS_LABEL, toggleActivity, togglePartnerLevel, toPayload, validateDraft, WEEKDAY_LONG, WEEKDAY_SHORT, WEEKDAYS, weekdaysInRange, effectiveEnd, type ActivityPreference, type AvailabilityDraft, type CatalogInterest, type DraftField } from "../availability/model"
import { Box, Field, Label, Scroll, Sheet, Touch } from "../native/UI"
import { palette } from "../theme/palette"
import type { NavigateFn } from "../types"

type Section = "dates" | "times" | "area" | "activities"
const regionFor = (center: { latitude: number; longitude: number } | null) => center ? { ...center, latitudeDelta: 0.3, longitudeDelta: 0.3 } : INITIAL_REGION
const SECTION_FOR: Record<DraftField, Section> = { date: "dates", days: "times", time: "times", area: "area", activities: "activities" }
type Records = { state: "loading" | "error" | "ready"; items: ApiAvailability[]; error?: string }

function Chip({ label, selected, onPress, disabled, accessibilityLabel }: { label: string; selected: boolean; onPress: () => void; disabled?: boolean; accessibilityLabel?: string }) {
  return <Touch accessibilityLabel={accessibilityLabel || label} accessibilityState={{ selected }} disabled={disabled} disabledOpacity={0.3} onPress={onPress} style={[s.chip, selected && s.chipSelected]}>
    <Label style={[s.chipText, selected && s.chipTextSelected]}>{label}</Label>
  </Touch>
}

function Accordion({ title, summary, open, onToggle, invalid, children }: { title: string; summary: string; open: boolean; onToggle: () => void; invalid?: boolean; children: ReactNode }) {
  return <GlassCard style={s.section}>
    <Touch accessibilityLabel={`${title}: ${summary}`} accessibilityState={{ expanded: open }} onPress={onToggle} style={s.sectionHeader} haptic={false}>
      <Box style={{ flex: 1, minWidth: 0 }}>
        <Label style={s.sectionTitle}>{title}</Label>
        <Label style={[s.sectionSummary, invalid && !open && { color: palette.error }]} numberOfLines={2}>{summary}</Label>
      </Box>
      <ChevronDownIcon size={18} style={[{ color: palette.muted }, open && { transform: [{ rotate: "180deg" }] }]} />
    </Touch>
    {open && <Box style={s.sectionBody}>{children}</Box>}
  </GlassCard>
}

const Issues = ({ messages }: { messages: string[] }) => messages.length ? <Box accessibilityLiveRegion="polite" style={{ gap: 4 }}>{messages.map(message => <Label key={message} style={s.error}>{message}</Label>)}</Box> : null

export default function AvailabilityScreen({ navigate, now }: { navigate: NavigateFn; now?: Date }) {
  const inset = useBottomNavInset()
  const [draft, setDraft] = useState<AvailabilityDraft>(emptyDraft)
  const [open, setOpen] = useState<Section | null>("dates")
  const [catalog, setCatalog] = useState<CatalogInterest[] | null>(null)
  const [catalogError, setCatalogError] = useState<string | null>(null)
  const [cityQuery, setCityQuery] = useState("")
  const [geocoded, setGeocoded] = useState<MapPlace[]>([])
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
      const results = await Location.geocodeAsync(query)
      setGeocoded(results.slice(0, 3).map(({ latitude, longitude }) => ({ name: query, latitude, longitude })))
      if (!results.length) Alert.alert("Konum bulunamadı", "Şehir adını kontrol edip tekrar ara.")
    } catch {
      Alert.alert("Şehir aranamadı", Platform.OS === "android" ? "Arama için konum izni gerekiyor. İzin vermeden listeden seçebilir ya da haritadan alan belirleyebilirsin." : "Bağlantını kontrol edip tekrar dene.")
    } finally { setSearching(false) }
  }
  const useMyLocation = async () => {
    if (locating) return
    setLocating(true)
    try {
      if (!(await Location.requestForegroundPermissionsAsync()).granted) { Alert.alert("Konum izni verilmedi", "Sorun değil: haritaya dokunarak merkez noktasını kendin seçebilirsin."); return }
      const { coords } = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
      const center = { latitude: coords.latitude, longitude: coords.longitude }
      update(current => current.area.mode === "radius" ? { ...current, area: { ...current.area, center } } : current)
      map.current?.animateToRegion?.({ ...center, latitudeDelta: 0.3, longitudeDelta: 0.3 })
    } catch { Alert.alert("Konum alınamadı", "Haritaya dokunarak merkez noktasını seçebilirsin.") }
    finally { setLocating(false) }
  }

  const resetForm = () => { setDraft(emptyDraft()); setEditingId(null); setShowIssues(false); setOpen("dates"); setCityQuery(""); setGeocoded([]) }
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
    } catch (error) { Alert.alert("Kaydedilemedi", getApiErrorMessage(error)) }
    finally { setSaving(false) }
  }
  const edit = (record: ApiAvailability) => { setDraft(fromApi(record)); setEditingId(record.id); setShowIssues(false); setNotice(null); setOpen("dates") }
  const setPaused = async (record: ApiAvailability, paused: boolean) => {
    if (busyRecord) return
    setBusyRecord(record.id)
    try { const saved = await setAvailabilityPaused(record.id, paused); setRecords(current => ({ ...current, items: current.items.map(item => item.id === saved.id ? saved : item) })) }
    catch (error) { Alert.alert(paused ? "Duraklatılamadı" : "Etkinleştirilemedi", getApiErrorMessage(error)) }
    finally { setBusyRecord(null) }
  }
  const remove = (record: ApiAvailability) => Alert.alert("Kaydı kaldır", "Bu müsaitlik kaydı kaldırılacak. Oluşturduğun etkinlikler ve kabul ettiğin katılımlar etkilenmez.", [
    { text: "Vazgeç", style: "cancel" },
    { text: "Kaldır", style: "destructive", onPress: async () => {
      setBusyRecord(record.id)
      try { await deleteAvailability(record.id); setRecords(current => ({ ...current, items: current.items.filter(item => item.id !== record.id) })); if (editingId === record.id) resetForm() }
      catch (error) { Alert.alert("Kaldırılamadı", getApiErrorMessage(error)) }
      finally { setBusyRecord(null) }
    } },
  ])

  const cityMatches = CITY_PRESETS.filter(place => place.name.toLocaleLowerCase("tr-TR").includes(cityQuery.trim().toLocaleLowerCase("tr-TR")))
  const area = draft.area
  const activitySummary = draft.activities.length ? draft.activities.map(item => describeActivity(item, interests).title).join(", ") : "Aktivite seçilmedi"
  const current = records.items.filter(item => item.status !== "expired"), expired = records.items.filter(item => item.status === "expired")

  const recordCard = (record: ApiAvailability) => {
    const asDraft = fromApi(record), busy = busyRecord === record.id
    return <GlassCard key={record.id} style={s.record}>
      <Box style={s.recordHead}>
        <Label style={s.recordTitle}>{describeDates(asDraft)}</Label>
        <Label style={[s.badge, record.status === "active" ? s.badgeActive : s.badgeMuted]}>{STATUS_LABEL[record.status]}</Label>
      </Box>
      <Label style={s.recordLine}>{`${describeDays(asDraft.weekdays)} · ${describeTimes(asDraft.timeWindows)}`}</Label>
      <Label style={s.recordLine}>{describeArea(asDraft.area)}</Label>
      <Label style={s.recordLine}>{asDraft.activities.map(item => describeActivity(item, interests).title).join(", ")}</Label>
      {record.status !== "expired" && <Box style={s.recordActions}>
        <Touch disabled={busy} onPress={() => edit(record)} style={s.recordAction}><Label style={s.recordActionText}>Düzenle</Label></Touch>
        <Touch disabled={busy} onPress={() => void setPaused(record, record.status === "active")} style={s.recordAction}><Label style={s.recordActionText}>{record.status === "active" ? "Duraklat" : "Etkinleştir"}</Label></Touch>
        <Touch disabled={busy} onPress={() => remove(record)} style={s.recordAction}><Label style={[s.recordActionText, { color: palette.error }]}>Kaldır</Label></Touch>
      </Box>}
      {record.status === "expired" && <Touch disabled={busy} onPress={() => remove(record)} style={[s.recordAction, { alignSelf: "flex-start" }]}><Label style={s.recordActionText}>Kaldır</Label></Touch>}
    </GlassCard>
  }

  return <Box style={s.screen}>
    <AtmoBackground />
    <TopNavBar navigate={navigate} fallback="discover" title="Etkinlik Takvimim" subtitle="Özel eşleşme havuzu" />
    <Scroll style={[s.scroll, { paddingBottom: 148 + inset }]} enter>
      <GlassCard style={s.intro}>
        <Box style={s.introIcon}><CalendarIcon size={20} style={{ color: palette.accent }} /></Box>
        <Box style={{ flex: 1, gap: 4 }}>
          <Label style={s.introTitle}>Müsait olduğun zamanları kaydet</Label>
          <Label style={s.introText}>Bu kayıt etkinlik ya da herkese açık bir ilan oluşturmaz. Yalnızca uygun etkinliklerin organizatörleri seni davet edebilir; telefonun, e-postan ve kesin konumun paylaşılmaz.</Label>
        </Box>
      </GlassCard>

      {!AVAILABILITY_SERVER_READY && <Box style={s.pending} accessibilityRole="alert">
        <Label style={s.pendingTitle}>Kaydetme henüz açık değil</Label>
        <Label style={s.pendingText}>Müsaitlik kaydı ve eşleşme için sunucu desteği hazırlanıyor. Seçimlerini burada planlayabilirsin ama şu an kaydedilmez ve davet alınmaz.</Label>
      </Box>}
      {notice && <Box style={s.success} accessibilityLiveRegion="polite"><CheckIcon size={16} style={{ color: palette.success }} /><Label style={s.successText}>{notice}</Label></Box>}

      {AVAILABILITY_SERVER_READY && <Box style={{ gap: 10 }}>
        <Label style={s.groupLabel}>Kayıtlarım</Label>
        {records.state === "loading" && <Box style={s.stateBox}><ActivityIndicator color={palette.accent} /><Label style={s.muted}>Kayıtların yükleniyor…</Label></Box>}
        {records.state === "error" && <Box style={s.stateBox}><Label style={s.error}>{records.error}</Label><Touch onPress={loadRecords} style={s.linkButton}><Label style={s.link}>Tekrar dene</Label></Touch></Box>}
        {records.state === "ready" && !current.length && <Box style={s.stateBox}><Label style={s.muted}>Henüz müsaitlik kaydın yok. Aşağıdan ilk kaydını oluştur.</Label></Box>}
        {current.map(recordCard)}
        {expired.length > 0 && <Label style={s.groupLabel}>Süresi geçenler</Label>}
        {expired.map(recordCard)}
      </Box>}

      <Box style={s.formHead}>
        <Label style={s.groupLabel}>{editingId ? "Kaydı düzenle" : "Yeni müsaitlik"}</Label>
        {editingId && <Touch onPress={resetForm} style={s.linkButton}><Label style={s.link}>Vazgeç</Label></Touch>}
      </Box>

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
        <Box style={s.segment} accessibilityRole="tablist">
          {([["city", "Şehir / bölge"], ["radius", "Haritadan alan"]] as const).map(([mode, label]) => <Touch key={mode} accessibilityLabel={label} accessibilityRole="tab" accessibilityState={{ selected: area.mode === mode }} onPress={() => update(current => current.area.mode === mode ? current : { ...current, area: mode === "city" ? { mode, place: null } : { mode, center: current.area.mode === "city" && current.area.place ? { latitude: current.area.place.latitude, longitude: current.area.place.longitude } : null, radiusKm: 5 } })} style={[s.segmentItem, area.mode === mode && s.segmentActive]}>
            <Label style={[s.chipText, area.mode === mode && s.chipTextSelected]}>{label}</Label>
          </Touch>)}
        </Box>
        {area.mode === "city" && <Box style={{ gap: 10 }}>
          <Box style={s.search}>
            <SearchIcon size={15} style={{ color: palette.muted }} />
            <Field accessibilityLabel="Şehir ara" placeholder="Şehir ara…" value={cityQuery} onChangeText={text => { setCityQuery(text); setGeocoded([]) }} onSubmitEditing={() => void searchCity()} returnKeyType="search" style={s.searchField} />
          </Box>
          <Box style={s.wrap}>{[...cityMatches, ...geocoded].map((place, index) => <Chip key={`${place.name}-${index}`} label={geocoded.includes(place) ? `${place.name} · ${place.latitude.toFixed(2)}, ${place.longitude.toFixed(2)}` : place.name} selected={area.place?.name === place.name && area.place.latitude === place.latitude} onPress={() => update(current => ({ ...current, area: { mode: "city", place } }))} />)}</Box>
          {cityQuery.trim().length > 1 && !cityMatches.some(place => place.name.toLocaleLowerCase("tr-TR") === cityQuery.trim().toLocaleLowerCase("tr-TR")) && <Touch disabled={searching} onPress={() => void searchCity()} style={s.addButton}>
            <Box style={s.row}><SearchIcon size={15} style={{ color: palette.accent }} /><Label style={s.link}>{searching ? "Aranıyor…" : `“${cityQuery.trim()}” konumunu ara`}</Label></Box>
          </Touch>}
          <Label style={s.muted}>İlçe/bölge seçimi şu an desteklenmiyor. Daha dar bir alan için “Haritadan alan” seçeneğini kullan.</Label>
        </Box>}
        {area.mode === "radius" && <Box style={{ gap: 10 }}>
          <Box style={s.mapFrame}>
            <MapView ref={map} provider={MAP_PROVIDER} testID="availability-map" style={StyleSheet.absoluteFill} initialRegion={regionFor(area.center)} onPress={event => { const center = event.nativeEvent.coordinate; update(current => current.area.mode === "radius" ? { ...current, area: { ...current.area, center: { latitude: center.latitude, longitude: center.longitude } } } : current) }}>
              {area.center && <Circle center={area.center} radius={area.radiusKm * 1000} strokeColor="rgba(185,195,255,.9)" fillColor="rgba(105,120,255,.18)" strokeWidth={2} />}
              {area.center && <Marker coordinate={area.center} pinColor={palette.blue} />}
            </MapView>
          </Box>
          <Label style={s.muted}>{area.center ? "Merkezi değiştirmek için haritada başka bir noktaya dokun." : "Merkez noktasını seçmek için haritaya dokun."}</Label>
          <Touch disabled={locating} onPress={() => void useMyLocation()} style={s.addButton}>
            <Box style={s.row}><LocationIcon size={15} style={{ color: palette.accent }} /><Label style={s.link}>{locating ? "Konum alınıyor…" : "Konumumu kullan (isteğe bağlı)"}</Label></Box>
          </Touch>
          <Label style={s.fieldLabel}>{`Yarıçap: ${area.radiusKm} km`}</Label>
          <Box style={s.wrap}>
            <Touch accessibilityLabel="Yarıçapı azalt" disabled={area.radiusKm <= MIN_RADIUS_KM} onPress={() => update(current => current.area.mode === "radius" ? { ...current, area: { ...current.area, radiusKm: Math.max(MIN_RADIUS_KM, current.area.radiusKm - 1) } } : current)} style={s.stepper}><Label style={s.stepperText}>−</Label></Touch>
            {RADIUS_OPTIONS.map(km => <Chip key={km} label={`${km} km`} accessibilityLabel={`${km} kilometre yarıçap`} selected={area.radiusKm === km} onPress={() => update(current => current.area.mode === "radius" ? { ...current, area: { ...current.area, radiusKm: km } } : current)} />)}
            <Touch accessibilityLabel="Yarıçapı artır" disabled={area.radiusKm >= MAX_RADIUS_KM} onPress={() => update(current => current.area.mode === "radius" ? { ...current, area: { ...current.area, radiusKm: Math.min(MAX_RADIUS_KM, current.area.radiusKm + 1) } } : current)} style={s.stepper}><Label style={s.stepperText}>+</Label></Touch>
          </Box>
          <Label style={s.muted}>{`Seçtiğin merkezden her yöne ${area.radiusKm} km uzaklığa kadar olan etkinlikler eşleşir. Merkez noktan diğer kullanıcılara gösterilmez.`}</Label>
        </Box>}
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
    </Scroll>

    <Box style={[s.sticky, { bottom: inset }]} gradient={[palette.background, "transparent"]} gradientDirection="up">
      <Touch onPress={submit} disabled={!AVAILABILITY_SERVER_READY} disabledOpacity={1} gradient={AVAILABILITY_SERVER_READY ? palette.actionGradient : ["#202b3d", "#182235", "#151f30"]} style={[s.primary, !AVAILABILITY_SERVER_READY && s.primaryDisabled]}>
        <Label style={[s.primaryText, !AVAILABILITY_SERVER_READY && { color: "rgba(226,232,240,.62)" }]}>Kaydet ve davet al</Label>
      </Touch>
      {!AVAILABILITY_SERVER_READY && <Label style={s.stickyNote}>Sunucu desteği etkinleşince kullanılabilir.</Label>}
    </Box>

    {reviewing && <Sheet onClose={() => !saving && setReviewing(false)}>
      <Touch haptic={false} onPress={() => {}} style={s.sheet}>
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
  intro: { flexDirection: "row", gap: 12, padding: 16 },
  introIcon: { width: 40, height: 40, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: palette.selected, borderWidth: 1, borderColor: "rgba(105,120,255,.3)" },
  introTitle: { color: palette.text, fontFamily: "Outfit-SemiBold", fontSize: 15, lineHeight: 20 },
  introText: { color: palette.muted, fontSize: 13, lineHeight: 19 },
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
  search: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 14, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.background, paddingHorizontal: 12 },
  searchField: { flex: 1, color: palette.text, fontSize: 15 },
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
  sheet: { backgroundColor: palette.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, gap: 10, borderWidth: 1, borderColor: palette.border, alignItems: "stretch" },
  sheetTitle: { color: palette.text, fontFamily: "Outfit-SemiBold", fontSize: 17, lineHeight: 23, marginBottom: 4 },
})

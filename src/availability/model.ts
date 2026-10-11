import { apiDate, localDate, type MapPlace } from "../map/filters"
import { formatDuration } from "../events/duration"

// Dates use the app's existing approach: YYYY-MM-DD on the device, gg/aa/yyyy and HH:MM on the wire,
// interpreted by the server in its single application time zone (İstanbul).

/** ISO weekday: 1 = Pazartesi … 7 = Pazar. */
export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7
export const WEEKDAYS: Weekday[] = [1, 2, 3, 4, 5, 6, 7]
export const WEEKDAY_SHORT: Record<Weekday, string> = { 1: "Pzt", 2: "Sal", 3: "Çar", 4: "Per", 5: "Cum", 6: "Cmt", 7: "Paz" }
export const WEEKDAY_LONG: Record<Weekday, string> = { 1: "Pazartesi", 2: "Salı", 3: "Çarşamba", 4: "Perşembe", 5: "Cuma", 6: "Cumartesi", 7: "Pazar" }
export const MONTHS = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"]
const MONTHS_SHORT = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"]

export interface TimeWindow { from: string; to: string }
export interface ActivityPreference {
  interestId: string
  /** The user's own skill level; never "all". */
  ownLevelId: string | null
  /** Levels the user wants to play with. Ignored when anyPartnerLevel is set. */
  partnerLevelIds: string[]
  /** "Her seviye" is a matching preference, not a skill level. */
  anyPartnerLevel: boolean
  /** Longest event the user wants to join; null means any length. */
  maxDurationMinutes: number | null
}
export type AreaSelection =
  | { mode: "city"; place: MapPlace | null }
  | { mode: "radius"; center: { latitude: number; longitude: number } | null; radiusKm: number }
export interface AvailabilityDraft {
  startDate: string
  /** Empty while only the first day is chosen: a single-day availability. */
  endDate: string
  weekdays: Weekday[]
  /** Empty means available all day. */
  timeWindows: TimeWindow[]
  area: AreaSelection
  activities: ActivityPreference[]
}
export interface CatalogInterest { id: string; name: string; levels?: Array<{ id: string; enum: string; name: string }> }

export const MAX_DAYS_AHEAD = 180
export const MIN_RADIUS_KM = 1
export const MAX_RADIUS_KM = 50
export const RADIUS_OPTIONS = [2, 5, 10, 25, 50]
export const MAX_TIME_WINDOWS = 3
export const EVENING: TimeWindow = { from: "18:00", to: "23:00" }

export const emptyDraft = (): AvailabilityDraft => ({ startDate: "", endDate: "", weekdays: [...WEEKDAYS], timeWindows: [], area: { mode: "city", place: null }, activities: [] })

const parse = (iso: string) => new Date(`${iso}T12:00:00`)
const validIso = (iso: string) => /^\d{4}-\d{2}-\d{2}$/.test(iso) && !isNaN(parse(iso).getTime()) && localDate(parse(iso)) === iso
const validTime = (value: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(value)
const minutes = (value: string) => { const [h, m] = value.split(":").map(Number); return h * 60 + m }
export const isoWeekday = (iso: string) => ((parse(iso).getDay() + 6) % 7 + 1) as Weekday
export const addDays = (iso: string, days: number) => { const date = parse(iso); date.setDate(date.getDate() + days); return localDate(date) }
export const todayIso = (now = new Date()) => localDate(now)
export const lastSelectableDay = (now = new Date()) => addDays(todayIso(now), MAX_DAYS_AHEAD)
export const effectiveEnd = (draft: Pick<AvailabilityDraft, "startDate" | "endDate">) => draft.endDate || draft.startDate
export function dayCount(start: string, end: string) {
  return Math.round((parse(end).getTime() - parse(start).getTime()) / 86400000) + 1
}

/** Hotel-style range picking: first tap starts, second tap ends; the same day twice is a single day. */
export function pickDay(range: { startDate: string; endDate: string }, day: string, now = new Date()) {
  if (day < todayIso(now) || day > lastSelectableDay(now)) return range
  if (!range.startDate || range.endDate) return { startDate: day, endDate: "" }
  if (day < range.startDate) return { startDate: day, endDate: "" }
  return { startDate: range.startDate, endDate: day }
}

/** Weekdays that actually occur between start and end (inclusive). */
export function weekdaysInRange(start: string, end: string): Weekday[] {
  if (!validIso(start) || !validIso(end) || end < start) return []
  const found = new Set<Weekday>()
  for (let day = start, i = 0; day <= end && i < 7; day = addDays(day, 1), i++) found.add(isoWeekday(day))
  return WEEKDAYS.filter(day => found.has(day))
}

export type QuickPreset = "everyDay" | "weekdays" | "weekend" | "evenings"
export const QUICK_PRESETS: Array<{ key: QuickPreset; label: string }> = [
  { key: "everyDay", label: "Her gün" },
  { key: "weekdays", label: "Hafta içi" },
  { key: "weekend", label: "Hafta sonu" },
  { key: "evenings", label: "Akşamları" },
]
const PRESET_DAYS: Record<Exclude<QuickPreset, "evenings">, Weekday[]> = { everyDay: [...WEEKDAYS], weekdays: [1, 2, 3, 4, 5], weekend: [6, 7] }
/** Day presets replace the day selection and keep the hours; "Akşamları" sets the hours and keeps the days. */
export function applyPreset(draft: AvailabilityDraft, preset: QuickPreset): AvailabilityDraft {
  if (preset === "evenings") return { ...draft, timeWindows: [{ ...EVENING }] }
  return { ...draft, weekdays: [...PRESET_DAYS[preset]] }
}
const sameDays = (a: Weekday[], b: Weekday[]) => a.length === b.length && a.every(day => b.includes(day))
export function isPresetActive(draft: AvailabilityDraft, preset: QuickPreset) {
  if (preset === "evenings") return draft.timeWindows.length === 1 && draft.timeWindows[0].from === EVENING.from && draft.timeWindows[0].to === EVENING.to
  return sameDays(draft.weekdays, PRESET_DAYS[preset])
}

export function describeDays(days: Weekday[]) {
  const sorted = WEEKDAYS.filter(day => days.includes(day))
  if (sorted.length === 7) return "Her gün"
  if (sameDays(sorted, PRESET_DAYS.weekdays)) return "Hafta içi"
  if (sorted.length === 2 && sameDays(sorted, PRESET_DAYS.weekend)) return "Hafta sonu"
  return sorted.map(day => WEEKDAY_SHORT[day]).join(", ")
}
export const describeTimes = (windows: TimeWindow[]) => windows.length ? windows.map(w => `${w.from}–${w.to}`).join(", ") : "Gün boyu müsaitim"
export function formatDay(iso: string, withYear = true) {
  if (!validIso(iso)) return ""
  const date = parse(iso)
  return `${date.getDate()} ${MONTHS_SHORT[date.getMonth()]}${withYear ? ` ${date.getFullYear()}` : ""}`
}
export function describeDates(draft: Pick<AvailabilityDraft, "startDate" | "endDate">) {
  if (!draft.startDate) return "Tarih seçilmedi"
  const end = effectiveEnd(draft)
  if (end === draft.startDate) return `${formatDay(draft.startDate)} · tek gün`
  const sameYear = draft.startDate.slice(0, 4) === end.slice(0, 4)
  return `${formatDay(draft.startDate, !sameYear)} – ${formatDay(end)} · ${dayCount(draft.startDate, end)} gün`
}
export function describeArea(area: AreaSelection) {
  if (area.mode === "city") return area.place ? area.place.name : "Konum seçilmedi"
  return area.center ? `Haritadan seçilen alan · ${area.radiusKm} km yarıçap` : "Haritada merkez seçilmedi"
}
export function describeActivity(preference: ActivityPreference, catalog: CatalogInterest[]) {
  const interest = catalog.find(item => item.id === preference.interestId)
  const levelName = (id: string | null) => interest?.levels?.find(level => level.id === id)?.name
  const parts: string[] = []
  if (preference.ownLevelId) parts.push(`Seviyem: ${levelName(preference.ownLevelId) || "—"}`)
  if (preference.anyPartnerLevel) parts.push("Birlikte: her seviye")
  else if (preference.partnerLevelIds.length) parts.push(`Birlikte: ${preference.partnerLevelIds.map(levelName).filter(Boolean).join(", ")}`)
  parts.push(preference.maxDurationMinutes ? `en fazla ${formatDuration(preference.maxDurationMinutes)}` : "süre fark etmez")
  return { title: interest?.name || "Aktivite", detail: parts.join(" · ") }
}

/** Levels a user can hold as their own skill. The catalog's "all" entry is only a partner preference. */
export const skillLevels = (interest?: CatalogInterest) => (interest?.levels || []).filter(level => level.enum !== "all")

export type DraftField = "date" | "days" | "time" | "area" | "activities"
export interface DraftIssue { field: DraftField; message: string; interestId?: string }
export function validateDraft(draft: AvailabilityDraft, catalog: CatalogInterest[], now = new Date()): DraftIssue[] {
  const issues: DraftIssue[] = []
  const today = todayIso(now), end = effectiveEnd(draft)
  if (!draft.startDate || !validIso(draft.startDate)) issues.push({ field: "date", message: "Başlangıç tarihini seç." })
  else if (draft.startDate < today) issues.push({ field: "date", message: "Geçmiş bir tarih seçemezsin." })
  else if (!validIso(end) || end < draft.startDate) issues.push({ field: "date", message: "Bitiş tarihi başlangıçtan önce olamaz." })
  else if (end > lastSelectableDay(now)) issues.push({ field: "date", message: `En fazla ${MAX_DAYS_AHEAD} gün ilerisini seçebilirsin.` })
  else {
    const available = weekdaysInRange(draft.startDate, end)
    if (!draft.weekdays.some(day => available.includes(day))) issues.push({ field: "days", message: "Seçtiğin günler bu tarih aralığında yok. En az bir gün seç." })
  }
  const windows = draft.timeWindows
  if (windows.some(w => !validTime(w.from) || !validTime(w.to))) issues.push({ field: "time", message: "Her saat aralığı için başlangıç ve bitiş seç." })
  else if (windows.some(w => minutes(w.to) <= minutes(w.from))) issues.push({ field: "time", message: "Bitiş saati başlangıç saatinden sonra olmalı." })
  else {
    const sorted = [...windows].sort((a, b) => minutes(a.from) - minutes(b.from))
    if (sorted.some((w, i) => i > 0 && minutes(w.from) < minutes(sorted[i - 1].to))) issues.push({ field: "time", message: "Saat aralıkları çakışıyor." })
    else if (draft.startDate === today && end === today && windows.length) {
      const current = now.getHours() * 60 + now.getMinutes()
      if (windows.every(w => minutes(w.to) <= current)) issues.push({ field: "time", message: "Bugün için seçtiğin saatler geçti." })
    }
  }
  if (draft.area.mode === "city" && !draft.area.place) issues.push({ field: "area", message: "Bir şehir seç." })
  if (draft.area.mode === "radius") {
    if (!draft.area.center) issues.push({ field: "area", message: "Haritada bir merkez noktası seç." })
    else if (!(draft.area.radiusKm >= MIN_RADIUS_KM && draft.area.radiusKm <= MAX_RADIUS_KM)) issues.push({ field: "area", message: `Yarıçap ${MIN_RADIUS_KM}–${MAX_RADIUS_KM} km arasında olmalı.` })
  }
  if (!draft.activities.length) issues.push({ field: "activities", message: "En az bir aktivite seç." })
  for (const preference of draft.activities) {
    const interest = catalog.find(item => item.id === preference.interestId)
    if (!interest) { issues.push({ field: "activities", interestId: preference.interestId, message: "Seçtiğin bir aktivite artık mevcut değil." }); continue }
    if (!skillLevels(interest).length) continue
    if (!preference.ownLevelId) issues.push({ field: "activities", interestId: interest.id, message: `${interest.name}: kendi seviyeni seç.` })
    if (!preference.anyPartnerLevel && !preference.partnerLevelIds.length) issues.push({ field: "activities", interestId: interest.id, message: `${interest.name}: birlikte oynamak istediğin seviyeleri seç.` })
  }
  return issues
}

/** A fresh preference for a newly selected activity; level fields only exist for activities with levels. */
export const newPreference = (interestId: string): ActivityPreference => ({ interestId, ownLevelId: null, partnerLevelIds: [], anyPartnerLevel: false, maxDurationMinutes: null })
export function toggleActivity(draft: AvailabilityDraft, interestId: string): AvailabilityDraft {
  const selected = draft.activities.some(item => item.interestId === interestId)
  return { ...draft, activities: selected ? draft.activities.filter(item => item.interestId !== interestId) : [...draft.activities, newPreference(interestId)] }
}
export function togglePartnerLevel(preference: ActivityPreference, levelId: string | "any"): ActivityPreference {
  if (levelId === "any") return { ...preference, anyPartnerLevel: !preference.anyPartnerLevel, partnerLevelIds: [] }
  const ids = preference.partnerLevelIds.includes(levelId) ? preference.partnerLevelIds.filter(id => id !== levelId) : [...preference.partnerLevelIds, levelId]
  return { ...preference, anyPartnerLevel: false, partnerLevelIds: ids }
}

/** Request body for the proposed availability API (pending backend approval). */
export function toPayload(draft: AvailabilityDraft, catalog: CatalogInterest[]) {
  const end = effectiveEnd(draft)
  const available = weekdaysInRange(draft.startDate, end)
  return {
    dateFrom: apiDate(draft.startDate),
    dateTo: apiDate(end),
    weekdays: WEEKDAYS.filter(day => draft.weekdays.includes(day) && available.includes(day)),
    timeWindows: [...draft.timeWindows].sort((a, b) => minutes(a.from) - minutes(b.from)),
    area: draft.area.mode === "city"
      ? { mode: "city" as const, name: draft.area.place?.name ?? "", latitude: draft.area.place?.latitude ?? 0, longitude: draft.area.place?.longitude ?? 0 }
      : { mode: "radius" as const, latitude: draft.area.center?.latitude ?? 0, longitude: draft.area.center?.longitude ?? 0, radiusKm: draft.area.radiusKm },
    activities: draft.activities.map(preference => {
      const hasLevels = skillLevels(catalog.find(item => item.id === preference.interestId)).length > 0
      return {
        interestId: preference.interestId,
        ...(hasLevels ? { ownLevelId: preference.ownLevelId, anyPartnerLevel: preference.anyPartnerLevel, partnerLevelIds: preference.anyPartnerLevel ? [] : preference.partnerLevelIds } : {}),
        maxDurationMinutes: preference.maxDurationMinutes,
      }
    }),
  }
}
export type AvailabilityPayload = ReturnType<typeof toPayload>

/** Loads a saved record back into the form for editing. */
export function fromApi(record: import("../api/client").ApiAvailability): AvailabilityDraft {
  const iso = (value: string) => value.split("/").reverse().join("-")
  const startDate = iso(record.dateFrom), end = iso(record.dateTo)
  return {
    startDate,
    endDate: end === startDate ? "" : end,
    weekdays: record.weekdays.filter((day): day is Weekday => WEEKDAYS.includes(day as Weekday)),
    timeWindows: record.timeWindows.map(window => ({ ...window })),
    area: record.area.mode === "city"
      ? { mode: "city", place: { name: record.area.name, latitude: record.area.latitude, longitude: record.area.longitude } }
      : { mode: "radius", center: { latitude: record.area.latitude, longitude: record.area.longitude }, radiusKm: record.area.radiusKm },
    activities: record.activities.map(item => ({ interestId: item.interestId, ownLevelId: item.ownLevelId ?? null, partnerLevelIds: item.partnerLevelIds ?? [], anyPartnerLevel: !!item.anyPartnerLevel, maxDurationMinutes: item.maxDurationMinutes })),
  }
}
export const STATUS_LABEL: Record<import("../api/client").ApiAvailability["status"], string> = { active: "Davet alıyor", paused: "Duraklatıldı", expired: "Süresi doldu" }

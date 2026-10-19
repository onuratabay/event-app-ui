import type { ApiAvailability, ApiEvent } from "../api/client"
import { CITY_PRESETS, distanceKm, localDate, type DiscoveryFilters, type MapPlace } from "./filters"

export type SuggestionSource = "availability" | "interests" | "popular" | "quick"
/** One tap in the filter sheet: a ready combination of place, time and activity. */
export interface FilterSuggestion {
  id: string
  label: string
  source: SuggestionSource
  apply: Partial<DiscoveryFilters>
}
export const SOURCE_LABEL: Record<SuggestionSource, string> = { availability: "Takviminden", interests: "İlgi alanların", popular: "Popüler", quick: "Hızlı seçim" }

const TIME_BANDS = [
  { label: "Sabah", from: "06:00", to: "12:00" },
  { label: "Öğleden sonra", from: "12:00", to: "17:00" },
  { label: "Akşam", from: "17:00", to: "22:00" },
  { label: "Gece", from: "22:00", to: "02:00" },
]
const minutes = (time: string) => { const [h, m] = time.split(":").map(Number); return h * 60 + m }
const inBand = (time: string, band: { from: string; to: string }) => {
  const value = minutes(time), from = minutes(band.from), to = minutes(band.to)
  return to > from ? value >= from && value < to : value >= from || value < to
}
const isoDate = (date: string) => date.split("/").reverse().join("-")
const CITY_RADIUS_KM = 30

function topBy<T>(items: T[], key: (item: T) => string | null): { key: string; count: number; item: T } | null {
  const counts = new Map<string, { count: number; item: T }>()
  for (const item of items) {
    const k = key(item)
    if (!k) continue
    const entry = counts.get(k)
    counts.set(k, { count: (entry?.count ?? 0) + 1, item: entry?.item ?? item })
  }
  let best: { key: string; count: number; item: T } | null = null
  for (const [k, entry] of counts) if (!best || entry.count > best.count) best = { key: k, ...entry }
  return best
}

/**
 * Suggestions from, in order: the user's active availability records, their interests (with their
 * profile city when it is a known place), and what is most common among the upcoming events loaded.
 */
export function buildFilterSuggestions({ availabilities, interestIds: myInterestIds = [], interestNames, profileCity, categories, events, nearby = null, now = new Date() }: {
  availabilities: ApiAvailability[]
  /** The user's interests by id; names are the fallback when the ids could not load. */
  interestIds?: string[]
  interestNames: string[]
  profileCity: string
  categories: Array<{ id: string; name: string }>
  events: ApiEvent[]
  nearby?: MapPlace | null
  now?: Date
}): FilterSuggestion[] {
  const today = localDate(now)
  const nameOf = (id: string) => categories.find(item => item.id === id)?.name
  const places: MapPlace[] = [...CITY_PRESETS]
  const suggestions: FilterSuggestion[] = []

  for (const availability of availabilities) {
    if (availability.status !== "active" || availability.dateTo < today) continue
    const area = availability.area
    const place: MapPlace = area.mode === "city" ? { name: area.name, latitude: area.latitude, longitude: area.longitude } : { name: "Takvimindeki bölge", latitude: area.latitude, longitude: area.longitude }
    if (area.mode === "city" && !places.some(item => item.name === area.name)) places.push(place)
    const window = availability.timeWindows[0]
    const interestIds = availability.activities.map(activity => activity.interestId)
    const activityNames = interestIds.map(nameOf).filter(Boolean)
    const label = [place.name, window ? `${window.from}–${window.to}` : "", activityNames.length > 2 ? `${activityNames.length} aktivite` : activityNames.join(", ")].filter(Boolean).join(" · ")
    suggestions.push({ id: `availability-${availability.id}`, label, source: "availability", apply: {
      place, radiusKm: area.mode === "radius" ? area.radiusKm : CITY_RADIUS_KM,
      datePreset: "custom", dateFrom: availability.dateFrom < today ? today : availability.dateFrom, dateTo: availability.dateTo,
      timeFrom: window?.from ?? "", timeTo: window?.to ?? "", interestIds,
    } })
    if (suggestions.length >= 2) break
  }

  const wanted = new Set(interestNames.map(name => name.toLocaleLowerCase("tr-TR")))
  const interestIds = myInterestIds.length ? myInterestIds : categories.filter(item => wanted.has(item.name.toLocaleLowerCase("tr-TR"))).map(item => item.id)
  if (interestIds.length) {
    const home = places.find(place => place.name.toLocaleLowerCase("tr-TR") === profileCity.trim().toLocaleLowerCase("tr-TR"))
    suggestions.push({ id: "interests", label: home ? `İlgi alanların · ${home.name}` : "İlgi alanların", source: "interests", apply: {
      interestIds, ...(home ? { place: home, radiusKm: CITY_RADIUS_KM } : {}),
    } })
  }

  const upcoming = events.filter(event => isoDate(event.date) >= today)
  const activity = topBy(upcoming, event => event.interest.id)
  if (activity) suggestions.push({ id: "popular-activity", label: `${activity.item.interest.name}${counted(activity.count)}`, source: "popular", apply: { interestIds: [activity.key] } })
  const band = topBy(upcoming, event => TIME_BANDS.find(item => inBand(event.startTime, item))?.label ?? null)
  const bandValue = band && TIME_BANDS.find(item => item.label === band.key)
  if (band && bandValue) suggestions.push({ id: "popular-time", label: `${band.key} ${bandValue.from}–${bandValue.to}`, source: "popular", apply: { timeFrom: bandValue.from, timeTo: bandValue.to } })
  const city = topBy(upcoming, event => places.find(place => distanceKm(place, event) <= CITY_RADIUS_KM)?.name ?? null)
  const cityPlace = city && places.find(place => place.name === city.key)
  if (city && cityPlace) suggestions.push({ id: "popular-city", label: `${city.key}${counted(city.count)}`, source: "popular", apply: { place: cityPlace, radiusKm: CITY_RADIUS_KM } })

  // Quick picks are always offered, so the section is never empty for a new account.
  const weekendStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  if (weekendStart.getDay() !== 0) weekendStart.setDate(weekendStart.getDate() + ((6 - weekendStart.getDay() + 7) % 7))
  const weekendEnd = new Date(weekendStart)
  if (weekendStart.getDay() === 6) weekendEnd.setDate(weekendEnd.getDate() + 1)
  suggestions.push({ id: "quick-tonight", label: "Bu akşam", source: "quick", apply: { datePreset: "today", timeFrom: "17:00", timeTo: "23:00" } })
  suggestions.push({ id: "quick-weekend", label: "Hafta sonu", source: "quick", apply: { datePreset: "custom", dateFrom: localDate(weekendStart), dateTo: localDate(weekendEnd), timeFrom: "", timeTo: "" } })
  if (nearby) suggestions.push({ id: "quick-nearby", label: "Yakınımda · 5 km", source: "quick", apply: { place: nearby, radiusKm: 5 } })
  return suggestions
}
const counted = (count: number) => count > 1 ? ` (${count})` : ""

/** A suggestion counts as picked while every value it sets is still in the draft. */
export function suggestionApplied(draft: DiscoveryFilters, suggestion: FilterSuggestion) {
  return Object.entries(suggestion.apply).every(([key, value]) => {
    const current = draft[key as keyof DiscoveryFilters]
    if (key === "place") return (current as MapPlace | null)?.name === (value as MapPlace).name
    if (Array.isArray(value)) return Array.isArray(current) && current.length === value.length && value.every(id => current.includes(id))
    return current === value
  })
}

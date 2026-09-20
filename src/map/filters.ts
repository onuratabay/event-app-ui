import type { ApiEvent } from "../api/client"
import { hasCoordinates } from "./model"
export type DatePreset = "all" | "today" | "tomorrow" | "week" | "custom"
export interface MapPlace { name: string; latitude: number; longitude: number }
export interface DiscoveryFilters {
  datePreset: DatePreset
  dateFrom: string
  dateTo: string
  timeFrom: string
  timeTo: string
  place: MapPlace | null
  radiusKm: number
  interestIds: string[]
}
export const DEFAULT_FILTERS: DiscoveryFilters = { datePreset: "all", dateFrom: "", dateTo: "", timeFrom: "", timeTo: "", place: null, radiusKm: 30, interestIds: [] }
export const CITY_PRESETS: MapPlace[] = [
  { name: "Ankara", latitude: 39.9334, longitude: 32.8597 },
  { name: "İzmir", latitude: 38.4237, longitude: 27.1428 },
  { name: "İstanbul", latitude: 41.0082, longitude: 28.9784 },
]
export function localDate(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}` }
export function dateRange(filters: DiscoveryFilters, now = new Date()) {
  if (filters.datePreset === "custom") return { from: filters.dateFrom, to: filters.dateTo }
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  if (filters.datePreset === "tomorrow") start.setDate(start.getDate() + 1)
  if (filters.datePreset === "week") start.setDate(start.getDate() + (8 - (start.getDay() || 7)))
  const end = new Date(start)
  if (filters.datePreset === "week") end.setDate(end.getDate() + 6)
  return { from: localDate(start), to: filters.datePreset === "all" ? "" : localDate(end) }
}
export const apiDate = (iso: string) => iso ? iso.split("-").reverse().join("/") : ""
const validDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !isNaN(new Date(`${value}T12:00:00`).getTime()) && localDate(new Date(`${value}T12:00:00`)) === value
const validTime = (value: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(value)
export function filterError(filters: DiscoveryFilters): string | null {
  if (!["all", "today", "tomorrow", "week", "custom"].includes(filters.datePreset)) return "Bir tarih seç."
  if (filters.datePreset === "custom" && (!validDate(filters.dateFrom) || !validDate(filters.dateTo) || filters.dateFrom > filters.dateTo)) return "Bitiş tarihi başlangıçtan önce olamaz. İki tarihi de seç."
  if ((filters.timeFrom || filters.timeTo) && (!validTime(filters.timeFrom) || !validTime(filters.timeTo) || filters.timeFrom === filters.timeTo)) return "Uygun olduğun başlangıç ve bitiş saatini seç."
  if (!Number.isFinite(filters.radiusKm) || filters.radiusKm <= 0 || filters.radiusKm > 200) return "1–200 km arasında bir mesafe seç."
  if (filters.place && (!hasCoordinates(filters.place) || !filters.place.name)) return "Geçerli bir konum seç."
  if (!Array.isArray(filters.interestIds) || !filters.interestIds.every(id => typeof id === "string")) return "Etkinlik türlerini yeniden seç."
  return null
}
export function distanceKm(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) {
  const rad = Math.PI / 180
  const value = Math.sin((b.latitude - a.latitude) * rad / 2) ** 2 + Math.cos(a.latitude * rad) * Math.cos(b.latitude * rad) * Math.sin((b.longitude - a.longitude) * rad / 2) ** 2
  return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, value)))
}
const minutes = (time: string) => { const [h, m] = time.split(":").map(Number); return h * 60 + m }
export function applyDiscoveryFilters(events: ApiEvent[], filters: DiscoveryFilters, now = new Date()) {
  const { from, to } = dateRange(filters, now)
  return events.filter(event => {
    if (!hasCoordinates(event) || ["cancelled", "closed"].includes(event.status.enum)) return false
    const iso = event.date.split("/").reverse().join("-")
    if (!validDate(iso) || iso < from || (to && iso > to)) return false
    if (filters.interestIds.length && !filters.interestIds.includes(event.interest.id)) return false
    if (filters.place && distanceKm(filters.place, event) > filters.radiusKm) return false
    if (filters.timeFrom && filters.timeTo) {
      const start = minutes(event.startTime), availableStart = minutes(filters.timeFrom)
      let availableEnd = minutes(filters.timeTo)
      // An overnight availability window belongs to the selected start date.
      if (availableEnd < availableStart) availableEnd += 1440
      const duration = event.durationMinutes ?? 0
      if (!Number.isFinite(start) || start < availableStart || start + duration > availableEnd) return false
    }
    return true
  })
}
export function categoryVisual(name: string) {
  const normalized = name.toLocaleLowerCase("tr-TR")
  if (/padel|tenis|tennis/.test(normalized)) return { icon: "🎾", color: "#c5e67d" }
  if (/bisiklet|cycl|bike/.test(normalized)) return { icon: "🚲", color: "#7dd9d0" }
  if (/koş|run|hiking|doğa|yürüy|outdoor/.test(normalized)) return { icon: "🥾", color: "#a8d991" }
  if (/kahve|coffee|yemek|food/.test(normalized)) return { icon: "☕", color: "#e8bb88" }
  if (/müzik|konser|music/.test(normalized)) return { icon: "🎵", color: "#bb9ee9" }
  if (/sanat|foto|art/.test(normalized)) return { icon: "🎨", color: "#efa3ba" }
  return { icon: "✨", color: "#dcb95d" }
}

export function placeBounds(place: MapPlace | null, radiusKm: number) {
  if (!place) return {}
  const latDelta = radiusKm / 110.5
  const lngDelta = latDelta / Math.max(0.01, Math.cos((Math.abs(place.latitude) + latDelta) * Math.PI / 180))
  const crossesDateline = place.longitude - lngDelta < -180 || place.longitude + lngDelta > 180
  return { minLat: Math.max(-90, place.latitude - latDelta), maxLat: Math.min(90, place.latitude + latDelta), minLng: crossesDateline ? -180 : place.longitude - lngDelta, maxLng: crossesDateline ? 180 : place.longitude + lngDelta }
}

import type { ApiEvent } from "../api/client"
import { applyDiscoveryFilters, DEFAULT_FILTERS, distanceKm, type DatePreset, type MapPlace } from "../map/filters"
export const ACTIVITIES = [
  { id: "padel", label: "Padel", icon: "🎾", words: /padel/i, equipment: "racket" },
  { id: "cycling", label: "Bisiklet", icon: "🚲", words: /bisiklet|cycl|bike/i, equipment: "bicycle" },
  { id: "walking", label: "Yürüyüş", icon: "🥾", words: /yürüy|yuruy|hiking|walking|trek/i, equipment: "shoes" },
  { id: "sea", label: "Deniz / yüzme", icon: "🌊", words: /deniz|yüz|yuz|swim|surf|plaj|beach/i, equipment: "swim" },
] as const
export const EQUIPMENT = [{ id: "racket", label: "Padel raketim var" }, { id: "bicycle", label: "Bisikletim var" }, { id: "shoes", label: "Yürüyüş ekipmanım var" }, { id: "swim", label: "Deniz / yüzme ekipmanım var" }]
export const PLACES = [
  { id: "izmir", name: "İzmir", city: "izmir", latitude: 38.4237, longitude: 27.1428, radiusKm: 40 },
  { id: "ankara", name: "Ankara", city: "ankara", latitude: 39.9334, longitude: 32.8597, radiusKm: 40 },
  { id: "eymir", name: "Eymir", city: "ankara", query: "Eymir Gölü, Ankara, Türkiye", radiusKm: 5 },
  { id: "cesme", name: "Çeşme", city: "izmir", query: "Çeşme, İzmir, Türkiye", radiusKm: 20 },
] as const
export interface RecommendationProfile {
  equipmentByCity: Record<string, string[]>
  activitiesByPlace: Record<string, string[]>
  trip: { placeId: string; datePreset: DatePreset; dateFrom: string; dateTo: string }
}
export function initialProfile(interests: string[]): RecommendationProfile {
  const inferred = ACTIVITIES.filter(activity => interests.some(interest => activity.words.test(interest))).map(activity => activity.id)
  return { equipmentByCity: {}, activitiesByPlace: { izmir: [...inferred], ankara: [...inferred] }, trip: { placeId: "izmir", datePreset: "week", dateFrom: "", dateTo: "" } }
}
export function targetActivities(profile: RecommendationProfile) {
  const place = PLACES.find(item => item.id === profile.trip.placeId) || PLACES[0]
  const chosen = profile.activitiesByPlace[place.id] || []
  if (chosen.length) return ACTIVITIES.filter(activity => chosen.includes(activity.id))
  const owned = profile.equipmentByCity[place.city] || []
  return ACTIVITIES.filter(activity => owned.includes(activity.equipment))
}
export function recommendationFilters(profile: RecommendationProfile, place: MapPlace) {
  return { ...DEFAULT_FILTERS, ...profile.trip, place, radiusKm: (PLACES.find(item => item.id === profile.trip.placeId) || PLACES[0]).radiusKm }
}
export function recommend(events: ApiEvent[], profile: RecommendationProfile, place: MapPlace, now = new Date()) {
  const location = PLACES.find(item => item.id === profile.trip.placeId) || PLACES[0]
  const activities = targetActivities(profile)
  const candidates = applyDiscoveryFilters(events, recommendationFilters(profile, place), now)
  return candidates.flatMap(event => {
    const activity = activities.find(item => item.words.test(`${event.interest.name} ${event.interest.slug}`))
    if (!activity || event.confirmedParticipantCount >= event.maxParticipants) return []
    const ownsEquipment = (profile.equipmentByCity[location.city] || []).includes(activity.equipment)
    const distance = distanceKm(place, event)
    return [{ event, distance, score: (ownsEquipment ? 100 : 0) - distance, reason: ownsEquipment
      ? `${location.city === "izmir" ? "İzmir" : "Ankara"} için kaydettiğin ekipmanla ve ${activity.label.toLocaleLowerCase("tr-TR")} tercihinle eşleşiyor.`
      : `${location.name} için seçtiğin ${activity.label.toLocaleLowerCase("tr-TR")} tercihin ve tarihinle eşleşiyor.` }]
  }).sort((a, b) => b.score - a.score || a.event.date.split("/").reverse().join("").localeCompare(b.event.date.split("/").reverse().join("")) || a.event.startTime.localeCompare(b.event.startTime)).slice(0, 5)
}

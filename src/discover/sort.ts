import { distanceKm } from "../map/filters"
import type { AppEvent } from "../types"

export type SortOption = "recommended" | "time-asc" | "time-desc" | "distance-near" | "distance-far"
export interface SortContext {
  /** Interest names of the signed-in user. */
  interests: string[]
  /** Device position, required for distance sorts. */
  location?: { latitude: number; longitude: number } | null
}

const startTime = (event: AppEvent) => {
  const [day, month, year] = event.date.split("/").map(Number)
  const [hour, minute] = event.time.split(":").map(Number)
  return new Date(year, month - 1, day, hour || 0, minute || 0).getTime()
}
/**
 * The home feed shows only events still open to people: waiting for participants (not yet
 * started) or started and not yet over. The time check also hides events whose status has not
 * been updated yet (the server's status jobs are off in development).
 */
export function isOpenForFeed(event: AppEvent, now = Date.now()) {
  const status = event.status || "waiting_participants"
  const start = startTime(event)
  if (status === "waiting_participants") return start >= now
  if (status === "started") return start + (parseInt(event.duration || "", 10) || 120) * 60000 > now
  return false
}
const created = (event: AppEvent) => Date.parse(event.createdAt || "") || 0
const hasCoordinates = (event: AppEvent) => Number.isFinite(event.latitude) && Number.isFinite(event.longitude)

/**
 * Feed order. Every option breaks ties with the most recently added event first:
 * - recommended: events in the user's interests first, then the soonest start
 * - time-asc / time-desc: by start time
 * - distance-near / distance-far: by distance from the device; events without coordinates last
 */
export function sortFeed(events: AppEvent[], sortBy: SortOption, context: SortContext): AppEvent[] {
  const interests = new Set(context.interests)
  const location = context.location
  const distance = (event: AppEvent) => location && hasCoordinates(event) ? distanceKm(location, { latitude: event.latitude!, longitude: event.longitude! }) : Infinity
  const primary = (a: AppEvent, b: AppEvent) => {
    switch (sortBy) {
      case "recommended": return Number(interests.has(b.category)) - Number(interests.has(a.category)) || startTime(a) - startTime(b)
      case "time-asc": return startTime(a) - startTime(b)
      case "time-desc": return startTime(b) - startTime(a)
      case "distance-near":
      case "distance-far": {
        const da = distance(a), db = distance(b)
        if (da === db) return 0
        if (da === Infinity) return 1
        if (db === Infinity) return -1
        return sortBy === "distance-near" ? da - db : db - da
      }
    }
  }
  return [...events].sort((a, b) => primary(a, b) || created(b) - created(a))
}

import Supercluster from "supercluster"
import type { Region } from "react-native-maps"
import type { ApiEvent } from "../api/client"

export const INITIAL_REGION: Region = { latitude: 39.92, longitude: 32.85, latitudeDelta: 0.8, longitudeDelta: 0.8 }
export const COLORS = ["#436b9e", "#628dcd", "#927dff", "#d2c3ff"]
export type MapMode = "heat" | "cluster" | "event"
export const modeForZoom = (zoom: number): MapMode => zoom < 11 ? "heat" : zoom < 15 ? "cluster" : "event"
export const zoomForRegion = (region: Region, width: number) => Math.max(0, Math.min(20, Math.log2(360 * Math.max(1, width) / (256 * Math.max(0.00001, region.longitudeDelta)))))
export const longitudeDistance = (a: number, b: number) => ((a - b + 540) % 360) - 180
export function hasCoordinates(event: Pick<ApiEvent, "latitude" | "longitude">) {
  return Number.isFinite(event.latitude) && Number.isFinite(event.longitude) && Math.abs(event.latitude) <= 85 && Math.abs(event.longitude) <= 180
}
export function filterEvents(events: ApiEvent[], filter: string, now = new Date()) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + (filter === "Bugün" ? 1 : 7)).getTime()
  return events.filter(event => {
    if (!hasCoordinates(event) || event.status.enum === "cancelled") return false
    if (filter === "Tümü") return true
    const parts = event.date.split("/").map(Number)
    const date = parts.length === 3 ? new Date(parts[2], parts[1] - 1, parts[0]).getTime() : NaN
    return date >= today && date < end
  })
}
export function createIndex(events: ApiEvent[]) {
  return new Supercluster<{ eventId: string }>({ radius: 60, maxZoom: 20 }).load(events.map(event => ({
    type: "Feature" as const, geometry: { type: "Point" as const, coordinates: [event.longitude, event.latitude] }, properties: { eventId: event.id },
  })))
}
export function isVisible(event: ApiEvent, region: Region) {
  return Math.abs(event.latitude - region.latitude) <= region.latitudeDelta / 2 && Math.abs(longitudeDistance(event.longitude, region.longitude)) <= region.longitudeDelta / 2
}
const mercatorY = (lat: number) => Math.log(Math.tan(Math.PI / 4 + Math.max(-85, Math.min(85, lat)) * Math.PI / 360))
export function project(event: Pick<ApiEvent, "latitude" | "longitude">, region: Region, width: number, height: number) {
  const top = mercatorY(region.latitude + region.latitudeDelta / 2)
  const bottom = mercatorY(region.latitude - region.latitudeDelta / 2)
  return {
    x: width * (0.5 + longitudeDistance(event.longitude, region.longitude) / region.longitudeDelta),
    y: height * (top - mercatorY(event.latitude)) / (top - bottom),
  }
}
// A Gaussian density field, summed before color mapping: overlap changes intensity.
// Quantized SVG paths keep the native view count fixed rather than one view per cell.
export function densityPaths(events: ApiEvent[], region: Region, width: number, height: number) {
  const cell = 10, sigma = 28, radius = sigma * 3
  const cols = Math.ceil(width / cell), rows = Math.ceil(height / cell)
  const grid = new Float32Array(cols * rows)
  for (const event of events) {
    const { x, y } = project(event, region, width, height)
    if (x < -radius || y < -radius || x > width + radius || y > height + radius) continue
    for (let row = Math.max(0, Math.floor((y - radius) / cell)); row < Math.min(rows, Math.ceil((y + radius) / cell)); row++) {
      for (let col = Math.max(0, Math.floor((x - radius) / cell)); col < Math.min(cols, Math.ceil((x + radius) / cell)); col++) {
        const distance = ((col + 0.5) * cell - x) ** 2 + ((row + 0.5) * cell - y) ** 2
        grid[row * cols + col] += Math.exp(-distance / (2 * sigma ** 2))
      }
    }
  }
  let peak = 0
  for (const value of grid) peak = Math.max(peak, value)
  const paths = Array.from({ length: 24 }, () => "")
  for (let i = 0; i < grid.length; i++) {
    if (grid[i] < 0.035 || !peak) continue
    const level = Math.min(23, Math.floor(grid[i] / Math.max(2, peak) * 23))
    paths[level] += `M${(i % cols) * cell},${Math.floor(i / cols) * cell}h${cell}v${cell}h-${cell}z`
  }
  return paths.map((d, level) => ({ d, color: COLORS[Math.min(3, Math.floor(level / 6))], opacity: 0.12 + level / 23 * 0.65 }))
}

// Smooth radial blooms are layered in SVG rather than painted as visible grid cells.
// Overlapping blooms naturally become brighter, preserving the density signal.
export function densitySpots(events: ApiEvent[], region: Region, width: number, height: number) {
  // At city-level zoom a compact bloom reads as a density field, not a set of rings.
  const radius = Math.max(36, Math.min(68, Math.min(width, height) * 0.11))
  return events
    .map(event => project(event, region, width, height))
    .filter(({ x, y }) => x > -radius && y > -radius && x < width + radius && y < height + radius)
    .slice(0, 240)
    .map(({ x, y }) => ({ x, y, radius }))
}

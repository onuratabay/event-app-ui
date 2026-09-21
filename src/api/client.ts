import AsyncStorage from "@react-native-async-storage/async-storage"
import { Platform } from "react-native"
import Constants from "expo-constants"
import { resolveApiUrl } from "./config"

const API_URL = resolveApiUrl(process.env.EXPO_PUBLIC_API_URL, __DEV__ ? Constants.expoConfig?.hostUri : undefined, Platform.OS)
class ApiConnectionError extends Error {}
const ACCESS_TOKEN_KEY = "event-app:access-token"
const REFRESH_TOKEN_KEY = "event-app:refresh-token"

export interface ApiEvent {
  id: string
  owner: { id: string; firstName: string; lastName: string }
  interest: { id: string; slug: string; name: string }
  level: { enum: string; name: string }
  date: string
  startTime: string
  durationMinutes: number | null
  locationName?: string
  latitude: number
  longitude: number
  minParticipants: number
  maxParticipants: number
  coverPhoto: string | null
  description: string
  requirements: string | null
  confirmedParticipantCount: number
  participants: Array<{ id: string; firstName: string; lastName: string }>
  isFavorite: boolean
  status: { enum: string; name: string }
  viewerParticipationStatus?: string | null
}

interface EventListResponse {
  items: ApiEvent[]
  total: number
}

interface TokenResponse {
  accessToken: string
  refreshToken: string
}

interface AuthResponse {
  tokens: TokenResponse
  user: unknown
}

export function getApiErrorMessage(error: unknown, fallback = "Lütfen tekrar dene.") {
  if (error instanceof ApiConnectionError) return error.message
  if (!(error instanceof Error)) return fallback
  const match = error.message.match(/\{[\s\S]*\}$/)
  if (!match) return fallback
  try {
    const payload = JSON.parse(match[0]) as { errors?: Array<{ message?: string }>; message?: string | string[] }
    return payload.errors?.map((item) => item.message).filter(Boolean).join(" ") || (Array.isArray(payload.message) ? payload.message.join(" ") : payload.message) || fallback
  } catch {
    return fallback
  }
}

async function request<T>(path: string, options: RequestInit = {}, retryAuth = true): Promise<T> {
  const accessToken = await AsyncStorage.getItem(ACCESS_TOKEN_KEY)
  const controller = new AbortController()
  const cancel = () => controller.abort()
  if (options.signal?.aborted) cancel()
  options.signal?.addEventListener("abort", cancel)
  const timeout = setTimeout(() => controller.abort(), 10000)
  let response: Response
  try {
  response = await fetch(`${API_URL}${path}`, {
    ...options,
    signal: controller.signal,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...(options.headers || {}),
    },
  })

  } catch {
    throw new ApiConnectionError(controller.signal.aborted
      ? "Sunucu zamanında yanıt vermedi. Biraz sonra tekrar dene."
      : "Sunucuya bağlanılamadı. İnternet bağlantını kontrol et ve tekrar dene.")
  } finally {
    clearTimeout(timeout)
    options.signal?.removeEventListener("abort", cancel)
  }

  if (response.status === 401 && retryAuth && !["/auth/login", "/auth/register", "/auth/refresh", "/auth/forgot-password", "/auth/reset-password"].includes(path)) {
    if (await refreshSession()) return request<T>(path, options, false)
  }
  if (!response.ok) {
    const body = await response.text()
    throw new Error(`API ${response.status}: ${body || response.statusText}`)
  }

  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}

let sessionVersion = 0
let tokenWrites = Promise.resolve()
let refreshing: Promise<boolean> | null = null
function saveTokens(tokens: TokenResponse, expectedVersion = sessionVersion) {
  const write = tokenWrites.then(async () => {
    if (sessionVersion !== expectedVersion) return
    await AsyncStorage.multiSet([[ACCESS_TOKEN_KEY, tokens.accessToken], [REFRESH_TOKEN_KEY, tokens.refreshToken]])
  })
  tokenWrites = write.catch(() => {})
  return write
}
async function refreshSession(): Promise<boolean> {
  if (refreshing) return refreshing
  const version = sessionVersion
  refreshing = (async () => {
    const refreshToken = await AsyncStorage.getItem(REFRESH_TOKEN_KEY)
    if (!refreshToken) return false
    const tokens = await request<TokenResponse>("/auth/refresh", { method: "POST", body: JSON.stringify({ refreshToken }) }, false)
    if (version !== sessionVersion) return false
    await saveTokens(tokens, version)
    return version === sessionVersion
  })().finally(() => { refreshing = null })
  return refreshing
}

export async function register(input: {
  firstName: string
  lastName: string
  email: string
  phoneNumber: string
  password: string
  birthDate: string
}) {
  const response = await request<AuthResponse>("/auth/register", {
    method: "POST",
    body: JSON.stringify({ ...input, language: "tr" }),
  })
  await saveTokens(response.tokens)
  return response
}

export async function login(email: string, password: string) {
  const response = await request<AuthResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password, language: "tr" }),
  })
  await saveTokens(response.tokens)
  return response
}

export async function logout() {
  sessionVersion++
  const removal = tokenWrites.then(() => AsyncStorage.multiRemove([ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY]))
  tokenWrites = removal.catch(() => {})
  await removal
}

export async function getEvents() {
  return request<EventListResponse>("/events?page=1&limit=20")
}

export async function getMapEvents(signal?: AbortSignal, filters: { dateFrom?: string; dateTo?: string; interestIds?: string[]; minLat?: number; maxLat?: number; minLng?: number; maxLng?: number } = {}) {
  const params = new URLSearchParams()
  if (filters.dateFrom) params.set("dateFrom", filters.dateFrom)
  if (filters.dateTo) params.set("dateTo", filters.dateTo)
  for (const id of filters.interestIds || []) params.append("interestId", id)
  for (const key of ["minLat", "maxLat", "minLng", "maxLng"] as const) {
    if (filters[key] !== undefined) params.set(key, String(filters[key]))
  }
  const encoded = params.toString()
  const query = encoded ? `&${encoded}` : ""
  const events = new Map<string, ApiEvent>()
  let total = 0
  for (let page = 1; page <= 20; page++) {
    const result = await request<EventListResponse>(`/events?page=${page}&limit=100${query}`, { signal })
    total = result.total
    for (const event of result.items) events.set(event.id, event)
    if (page * 100 >= total || !result.items.length) break
  }
  return { items: [...events.values()], total, truncated: events.size < total }
}

export function hasRemoteApiConfigured() {
  return Boolean(process.env.EXPO_PUBLIC_API_URL)
}

export interface ReferenceMember { id: string; name: string; phone: string }
export interface ReferenceRequest {
  id: string
  status: "pending" | "approved" | "declined"
  direction?: "incoming" | "outgoing"
  createdAt: string
  requester: { id: string; name: string }
  recipient: { id: string; name: string }
}
export async function matchReferenceContacts(phones: string[]) {
  const items: ReferenceMember[] = []
  const unique = [...new Set(phones)]
  for (let index = 0; index < unique.length; index += 300) {
    const result = await request<{ items: ReferenceMember[] }>("/references/contacts", { method: "POST", body: JSON.stringify({ phones: unique.slice(index, index + 300) }) })
    items.push(...result.items)
  }
  return [...new Map(items.map(item => [item.id, item])).values()]
}
export function getReferenceRequests() { return request<{ items: ReferenceRequest[] }>("/references/requests") }
export function sendReferenceRequest(recipientId: string) {
  return request<ReferenceRequest>("/references/requests", { method: "POST", body: JSON.stringify({ recipientId }) })
}
export function respondToReference(id: string, decision: "approved" | "declined") {
  return request<{ status: "approved" | "declined" }>(`/references/requests/${id}/respond`, { method: "POST", body: JSON.stringify({ decision }) })
}
export async function hasSession() { return Boolean((await AsyncStorage.getItem(ACCESS_TOKEN_KEY)) || (await AsyncStorage.getItem(REFRESH_TOKEN_KEY))) }

export function getMapInterests(signal?: AbortSignal) {
  return request<Array<{ id: string; name: string; slug: string }>>("/interests", { signal, headers: { "Accept-Language": "tr" } })
}

export function forgotPassword(email: string) {
  return request<{ message: string }>("/auth/forgot-password", { method: "POST", body: JSON.stringify({ email: email.trim(), language: "tr" }) }, false)
}
export function resetPassword(token: string, newPassword: string) {
  return request<{ message: string }>("/auth/reset-password", { method: "POST", body: JSON.stringify({ token: token.trim(), newPassword, language: "tr" }) }, false)
}

export interface ApiUser { id: string; firstName: string; lastName: string; city?: string; bio?: string; instagramUsername?: string; profilePhoto?: string | null; rank?: number }
export interface Preferences { mapFilters?: import('../map/filters').DiscoveryFilters; recommendationProfile?: import('../recommendations/model').RecommendationProfile }
export const getCurrentUser = () => request<ApiUser>('/auth/me', { method: 'POST' })
export const getUserInterests = () => request<Array<{ id: string; name: string }>>('/users/me/interests')
export const setUserInterests = (interestIds: string[]) => request<Array<{ id: string; name: string }>>('/users/me/interests', { method: 'PUT', body: JSON.stringify({ interestIds }) })
export const updateProfile = (value: Partial<ApiUser>) => request<ApiUser>('/users/me/profile', { method: 'PATCH', body: JSON.stringify(value) })
export const setProfilePhoto = (photo: string) => request('/users/me/photo', { method: photo ? 'PUT' : 'DELETE', ...(photo ? { body: JSON.stringify({ photo }) } : {}) })
export const getPreferences = () => request<Preferences>('/users/me/preferences')
let preferenceWrites = Promise.resolve<unknown>(undefined)
export function putPreference<K extends keyof Preferences>(key: K, value: NonNullable<Preferences[K]>) {
  const version = sessionVersion
  const write = preferenceWrites.catch(() => {}).then(() => {
    if (version !== sessionVersion) throw new Error('Oturum değişti.')
    return request(`/users/me/preferences/${key}`, { method: 'PUT', body: JSON.stringify({ value }) })
  })
  preferenceWrites = write
  return write
}
export const getEvent = (id: string) => request<ApiEvent>(`/events/${id}`)
export const favoriteEvent = (id: string, saved: boolean) => request(`/events/${id}/favorite`, { method: saved ? 'PUT' : 'DELETE' })
export const participate = (id: string, join: boolean) => request<ApiEvent>(`/events/${id}/${join ? 'join' : 'leave'}`, { method: 'POST' })
export const getEnums = (group: string) => request<Array<{ id: string; enum: string; name: string }>>(`/enum-values?group=${group}`)
export const createEvent = (value: Record<string, unknown>) => request<ApiEvent>('/events', { method: 'POST', body: JSON.stringify(value) })
export interface ApiMessage { id: string; text: string; createdAt: string; user: { id: string; firstName: string; lastName: string } }
export const getMessages = (id: string) => request<{ items: ApiMessage[] }>(`/events/${id}/messages`)
export const sendMessage = (id: string, text: string) => request<ApiMessage>(`/events/${id}/messages`, { method: 'POST', body: JSON.stringify({ text }) })
export async function getMyEvents() {
  const lists = await Promise.all(['mine', 'participating', 'favorites'].map(async kind => {
    const items: ApiEvent[] = []
    for (let page = 1; ; page++) {
      const result = await request<EventListResponse>(`/events/${kind}?page=${page}&limit=100`)
      items.push(...result.items)
      if (!result.items.length || page * 100 >= result.total) return items
    }
  }))
  return lists.flat()
}

export const archiveLegacyData = (value: Record<string, unknown>) => request('/users/me/legacy-data', { method: 'PUT', body: JSON.stringify({ value }) })

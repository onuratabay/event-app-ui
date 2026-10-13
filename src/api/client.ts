import AsyncStorage from "@react-native-async-storage/async-storage"
import { Platform } from "react-native"
import Constants from "expo-constants"
import { resolveApiUrl } from "./config"
import { apiLoading } from "./loading"

export const API_URL = resolveApiUrl(process.env.EXPO_PUBLIC_API_URL, __DEV__ ? Constants.expoConfig?.hostUri : undefined, Platform.OS)
class ApiConnectionError extends Error {}
const ACCESS_TOKEN_KEY = "event-app:access-token"
const REFRESH_TOKEN_KEY = "event-app:refresh-token"

export interface ApiEvent {
  id: string
  owner: { id: string; firstName: string; lastName: string }
  interest: { id: string; slug: string; name: string }
  level: { enum: string; name: string } | null
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
  // profilePhoto is only filled on event detail, and only when the viewer has a photo.
  participants: Array<{ id: string; firstName: string; lastName: string; profilePhoto?: string | null }>
  isFavorite: boolean
  status: { enum: string; name: string }
  createdAt?: string
  // Latest chat message time; only sent to room members.
  lastMessageAt?: string | null
  // Messages from others since the member last read the room.
  unreadCount?: number
  viewerParticipationStatus?: string | null
  // Pool invitations only: the server-side answer deadline (24 h or the event start, whichever is first).
  viewerInvitationExpiresAt?: string | null
  // Pending invitations list only: the viewer already joined another event at this time.
  viewerHasTimeConflict?: boolean
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

export const apiRequestCounts: Record<string, number> = {}
let guestAccountIsolation: (() => boolean) | null = null
export function registerGuestAccountIsolation(blocked: () => boolean) {
  guestAccountIsolation = blocked
  return () => { if (guestAccountIsolation === blocked) guestAccountIsolation = null }
}
/** `background`: the screen does not wait for this request, so the global loading overlay stays hidden. */
type RequestOptions = RequestInit & { background?: boolean; guest?: boolean; memberReturn?: boolean }
async function request<T>(path: string, requestOptions: RequestOptions = {}, retryAuth = true): Promise<T> {
  const { background = false, guest = false, memberReturn = false, ...options } = requestOptions
  if (!guest && guestAccountIsolation?.() && !(memberReturn && path === '/auth/me')) {
    throw new ApiConnectionError('Misafir oturumunda yalnızca davet edilen etkinliğe erişebilirsin.')
  }
  if (!background) apiLoading.begin()
  const started = Date.now()
  const counterKey = `${options.method || 'GET'} ${path.split('?')[0].replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, ':id').replace(/EWT-[A-Za-z0-9_-]{24}/g, ':invite')}`
  if (__DEV__) apiRequestCounts[counterKey] = (apiRequestCounts[counterKey] || 0) + 1
  try {
  const accessToken = guest ? null : await AsyncStorage.getItem(ACCESS_TOKEN_KEY)
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
    if (__DEV__) console.debug('[API REQUEST]', { endpoint: counterKey, durationMs: Date.now() - started, responseBytes: 0, status: 'network_error', count: apiRequestCounts[counterKey] })
    throw new ApiConnectionError(controller.signal.aborted
      ? "Sunucu zamanında yanıt vermedi. Biraz sonra tekrar dene."
      : "Sunucuya bağlanılamadı. İnternet bağlantını kontrol et ve tekrar dene.")
  } finally {
    clearTimeout(timeout)
    options.signal?.removeEventListener("abort", cancel)
  }

  if (response.status === 401 && !guest && retryAuth && !["/auth/login", "/auth/register", "/auth/refresh", "/auth/forgot-password", "/auth/reset-password"].includes(path)) {
    if (await refreshSession()) return request<T>(path, requestOptions, false)
  }
  if (!response.ok) {
    const body = await response.text()
    if (__DEV__) console.debug('[API REQUEST]', { endpoint: counterKey, durationMs: Date.now() - started, responseBytes: unescape(encodeURIComponent(body)).length, status: response.status, count: apiRequestCounts[counterKey] })
    throw new Error(`API ${response.status}: ${body || response.statusText}`)
  }

  if (response.status === 204) return undefined as T
  const result = await response.json() as T
  if (__DEV__) console.debug('[API REQUEST]', { endpoint: counterKey, durationMs: Date.now() - started, responseBytes: unescape(encodeURIComponent(JSON.stringify(result))).length, count: apiRequestCounts[counterKey] })
  return result
  } finally {
    if (!background) apiLoading.end()
  }
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

// In-memory session cache for rarely changing data. Device storage keeps session tokens
// only, so nothing here survives an app restart. Keys starting with "user:" belong to the
// signed-in account and are dropped on sign-in, sign-out and account changes.
const sessionCache = new Map<string, { expires: number; value: Promise<unknown> }>()
const HOURS = 60 * 60 * 1000
function cached<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const hit = sessionCache.get(key)
  if (hit && hit.expires > Date.now()) return hit.value as Promise<T>
  const value = load()
  sessionCache.set(key, { expires: Date.now() + ttlMs, value })
  // A failed request is not cached; the next caller retries.
  value.catch(() => { if (sessionCache.get(key)?.value === value) sessionCache.delete(key) })
  return value
}
/** Shares one request among callers that ask while it is still in flight (no reuse after it settles). */
function shared<T>(key: string, load: () => Promise<T>): Promise<T> {
  const value = cached(key, Number.POSITIVE_INFINITY, load)
  void value.finally(() => { if (sessionCache.get(key)?.value === value) sessionCache.delete(key) }).catch(() => {})
  return value
}
export function clearSessionCache(scope: "user" | "all" = "all") {
  for (const key of [...sessionCache.keys()]) if (scope === "all" || key.startsWith("user:")) sessionCache.delete(key)
}

export async function register(input: {
  firstName: string
  lastName: string
  email: string
  phoneNumber: string
  password: string
  birthDate: string
  city: string
  acceptedDocuments: LegalAcceptance[]
  marketingConsent: boolean
}) {
  const response = await request<AuthResponse>("/auth/register", {
    method: "POST",
    body: JSON.stringify({ ...input, language: "tr" }),
  })
  clearSessionCache("user")
  await saveTokens(response.tokens)
  return response
}

export async function login(email: string, password: string) {
  const response = await request<AuthResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password, language: "tr" }),
  })
  clearSessionCache("user")
  await saveTokens(response.tokens)
  return response
}

export async function logout() {
  sessionVersion++
  clearSessionCache("user")
  const removal = tokenWrites.then(() => AsyncStorage.multiRemove([ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY]))
  tokenWrites = removal.catch(() => {})
  await removal
}

/**
 * Discover feed page. `photos: false` skips the base64 covers (the server reads them one by one),
 * so the list arrives fast and the covers follow in a second, background request.
 */
export async function getEvents(page = 1, limit = 20, options: { photos?: boolean; background?: boolean } = {}) {
  return request<EventListResponse>(`/events?page=${page}&limit=${limit}${options.photos === false ? "&includePhotos=false" : ""}`, { background: options.background })
}

/** Events from the server for search: between two dates (dd/mm/yyyy, inclusive), optionally in some interests. */
export function searchEvents(dateFrom: string, dateTo?: string, interestIds: string[] = []) {
  const params = new URLSearchParams({ page: "1", limit: "100", dateFrom })
  if (dateTo) params.set("dateTo", dateTo)
  for (const id of interestIds) params.append("interestId", id)
  return request<EventListResponse>(`/events?${params.toString()}`)
}

export async function getMapEvents(signal?: AbortSignal, filters: { dateFrom?: string; dateTo?: string; interestIds?: string[]; minLat?: number; maxLat?: number; minLng?: number; maxLng?: number } = {}) {
  const params = new URLSearchParams({ includePhotos: "false" })
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
  for (let page = 1; page <= 5; page++) {
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
let referenceLoad: { version: number; promise: Promise<{ items: ReferenceRequest[] }> } | undefined
export function getReferenceRequests() {
  if (referenceLoad?.version === sessionVersion) return referenceLoad.promise
  const version = sessionVersion
  const promise = request<{ items: ReferenceRequest[] }>("/references/requests").finally(() => { if (referenceLoad?.promise === promise) referenceLoad = undefined })
  referenceLoad = { version, promise }
  return promise
}
export function sendReferenceRequest(recipientId: string) {
  return request<ReferenceRequest>("/references/requests", { method: "POST", body: JSON.stringify({ recipientId }) })
}
export function respondToReference(id: string, decision: "approved" | "declined") {
  return request<{ status: "approved" | "declined" }>(`/references/requests/${id}/respond`, { method: "POST", body: JSON.stringify({ decision }) })
}
export async function hasSession() { return Boolean((await AsyncStorage.getItem(ACCESS_TOKEN_KEY)) || (await AsyncStorage.getItem(REFRESH_TOKEN_KEY))) }

// Each interest lists its own levels (managed in the interest_levels table); empty means no level step.
export interface InterestLevel { id: string; enum: string; name: string }
// The catalog is the same for everyone and changes rarely: fetched once per 6 hours per app session.
// The signal is accepted for compatibility but not passed on, so one screen leaving cannot cancel the shared request.
export function getMapInterests(_signal?: AbortSignal) {
  return cached("interests", 6 * HOURS, () => request<Array<{ id: string; name: string; slug: string; levels?: InterestLevel[] }>>("/interests", { headers: { "Accept-Language": "tr" } }))
}

export function forgotPassword(email: string) {
  return request<{ message: string }>("/auth/forgot-password", { method: "POST", body: JSON.stringify({ email: email.trim(), language: "tr" }) }, false)
}
export function resetPassword(token: string, newPassword: string) {
  return request<{ message: string }>("/auth/reset-password", { method: "POST", body: JSON.stringify({ token: token.trim(), newPassword, language: "tr" }) }, false)
}

export type LegalDocumentType = 'terms' | 'privacy' | 'kvkk' | 'community' | 'marketing'
export interface LegalAcceptance { type: LegalDocumentType; version: number }
export interface LegalDocumentSummary extends LegalAcceptance { title: string; required: boolean; publishedAt: string }
export interface LegalConsentStatus {
  documents: Array<LegalDocumentSummary & { accepted: boolean; acceptedVersion: number | null; acceptedAt: string | null }>
  /** Required documents whose current version the user has not accepted yet. */
  pending: LegalDocumentType[]
  marketing: boolean
}
// Legal texts are public and versioned on the server; `guest` keeps them readable before sign-in and in guest mode.
export const getLegalDocuments = () => request<{ items: LegalDocumentSummary[] }>('/legal/documents', { guest: true }, false)
export const getLegalDocument = (type: LegalDocumentType) => request<LegalDocumentSummary & { body: string }>(`/legal/documents/${type}`, { guest: true }, false)
export const getLegalConsents = () => request<LegalConsentStatus>('/legal/consents', { background: true })
export const acceptLegalDocuments = (documents: LegalAcceptance[]) => request<LegalConsentStatus>('/legal/consents', { method: 'POST', body: JSON.stringify({ documents }) })
export const setMarketingConsent = (granted: boolean) => request<LegalConsentStatus>('/legal/consents/marketing', { method: 'PUT', body: JSON.stringify({ granted }) })

export interface ApiUser { id: string; firstName: string; lastName: string; status?: { enum: string }; city?: string; bio?: string; instagramUsername?: string; profilePhoto?: string | null; rank?: number }
export const getUserProfile = (userId: string) => request<ApiUser & { interests: Array<{ id: string; name: string }> }>(`/users/${encodeURIComponent(userId)}/profile`)
export interface NotificationPreferences { invites?: boolean; messages?: boolean; reminders?: boolean }
export interface Preferences { mapFilters?: import('../map/filters').DiscoveryFilters; notifications?: NotificationPreferences; mutedRooms?: { ids: string[] } }
// Startup asks for the account from several places at once; they share one request.
// Background: startup never shows the global loader for account data; only the event feed matters there.
export const getCurrentUser = () => shared('user:me', () => request<ApiUser>('/auth/me', { method: 'POST', background: true }))
// profile_incomplete → approved once at least one interest is saved (photo optional).
export const completeProfile = () => request<ApiUser>('/users/me/profile/complete', { method: 'POST' }).finally(() => clearSessionCache('user'))
export const getUserInterests = () => request<Array<{ id: string; name: string }>>('/users/me/interests', { background: true })
export const setUserInterests = (interestIds: string[]) => request<Array<{ id: string; name: string }>>('/users/me/interests', { method: 'PUT', body: JSON.stringify({ interestIds }) })
export const updateProfile = (value: Partial<ApiUser>) => request<ApiUser>('/users/me/profile', { method: 'PATCH', body: JSON.stringify(value) })
// The server bumps the token version, so every session (this one too) must sign in again afterwards.
export const changePassword = (oldPassword: string, newPassword: string) => request<{ message: string }>('/users/me/password', { method: 'PATCH', body: JSON.stringify({ oldPassword, newPassword, language: 'tr' }) })
export const deleteAccount = (password: string) => request<{ message: string }>('/users/me', { method: 'DELETE', body: JSON.stringify({ password, language: 'tr' }) })
export const setProfilePhoto = (photo: string) => request('/users/me/photo', { method: photo ? 'PUT' : 'DELETE', ...(photo ? { body: JSON.stringify({ photo }) } : {}) })
export const getPreferences = () => shared('user:preferences', () => request<Preferences>('/users/me/preferences', { background: true }))
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
export const getEvent = (id: string, options: { background?: boolean } = {}) => request<ApiEvent>(`/events/${id}`, options)
export const favoriteEvent = (id: string, saved: boolean) => request(`/events/${id}/favorite`, { method: saved ? 'PUT' : 'DELETE', background: true })
// Favourite taps run in the background, one after another per event, so the server ends on the last tap.
const favoriteQueue = new Map<string, Promise<unknown>>()
// Kept after the request settles, so a caller's error handler can still tell whether its tap was the last one.
const latestFavorite = new Map<string, Promise<unknown>>()
export function setFavorite(id: string, saved: boolean): { done: Promise<unknown>; isLatest: () => boolean } {
  const done = (favoriteQueue.get(id) ?? Promise.resolve()).catch(() => {}).then(() => favoriteEvent(id, saved))
  favoriteQueue.set(id, done)
  latestFavorite.set(id, done)
  void done.finally(() => { if (favoriteQueue.get(id) === done) favoriteQueue.delete(id) }).catch(() => {})
  return { done, isLatest: () => latestFavorite.get(id) === done }
}
export const participate = (id: string, join: boolean) => request<ApiEvent>(`/events/${id}/${join ? 'join' : 'leave'}`, { method: 'POST' })
// Most frequent lines from the user's own past event descriptions (dismissed ones excluded).
export const getSuggestions = () => request<{ items: string[] }>('/events/mine/suggestions')
export const dismissSuggestion = (text: string) => request<{ items: string[] }>('/events/mine/suggestions', { method: 'DELETE', body: JSON.stringify({ text }) })
export const canCreateEvent = () => request<{ canCreate: boolean; message: string | null }>('/events/can-create')
export const getUserSettings = () => cached('user:settings', HOURS / 6, () => request<{ canCreateInviteOnly: boolean }>('/users/me/settings'))
export interface FriendUser { id: string; firstName: string; lastName: string; profilePhoto: string | null }
// Accepted friends whose accounts are approved; only they can be invited.
export const getActiveFriends = () => request<{ items: Array<{ user: FriendUser }> }>('/friends?active=true&limit=100')
export const getInvitations = () => request<EventListResponse>('/events/invitations?limit=50')
export const getEnums = (group: string) => cached(`enums:${group}`, 6 * HOURS, () => request<Array<{ id: string; enum: string; name: string }>>(`/enum-values?group=${group}`))
export const createEvent = (value: Record<string, unknown>) => request<ApiEvent>('/events', { method: 'POST', body: JSON.stringify(value) })
export interface ApiMessage { kind?: 'message' | 'announcement'; id: string; text: string; createdAt: string; editedAt?: string | null; deleted?: boolean; user: { id: string; firstName: string; lastName: string } }
// Room requests run in the background: the chat screen never shows the global loading overlay.
export const editMessage = (eventId: string, messageId: string, text: string) => request<ApiMessage>(`/events/${eventId}/messages/${messageId}`, { method: 'PATCH', body: JSON.stringify({ text }), background: true })
export const deleteMessage = (eventId: string, messageId: string) => request<ApiMessage>(`/events/${eventId}/messages/${messageId}`, { method: 'DELETE', background: true })
// When each other member last read the room ("görüldü").
export const getMessageReads = (eventId: string) => request<{ items: Array<{ userId: string; readAt: string }> }>(`/events/${eventId}/messages/reads`, { background: true })
export const reportUser = (userId: string, description: string) => request<{ message: string }>(`/reports/users/${userId}`, { method: 'POST', body: JSON.stringify({ description, language: 'tr' }) })
// A room opens with its latest 20 messages; each older page is another 20.
export const MESSAGE_PAGE_SIZE = 20
export const getMessages = (id: string, signal?: AbortSignal, cursor?: string) => request<{ items: ApiMessage[]; nextCursor?: string | null }>(`/events/${id}/messages${cursor ? `?cursor=${encodeURIComponent(cursor)}&limit=${MESSAGE_PAGE_SIZE}` : `?limit=${MESSAGE_PAGE_SIZE}`}`, { signal, background: true })
export const markRoomRead = (id: string) => request<{ eventId: string; unreadCount: number }>(`/events/${id}/messages/read`, { method: 'POST', background: true })
export const sendMessage = (id: string, text: string) => request<ApiMessage>(`/events/${id}/messages`, { method: 'POST', body: JSON.stringify({ text }), background: true })
export async function getMyEvents(page = 1, options: { background?: boolean } = {}) {
  const lists = await Promise.all(['mine', 'participating', 'favorites'].map(kind => request<EventListResponse>(`/events/${kind}?page=${page}&limit=30`, options)))
  return { items: lists.flatMap(list => list.items), hasMore: lists.some(list => page * 30 < list.total) }
}

export const archiveLegacyData = (value: Record<string, unknown>) => request('/users/me/legacy-data', { method: 'PUT', body: JSON.stringify({ value }) })

export async function getSocketToken(renew = false) {
  if (renew && !await refreshSession()) return null
  return AsyncStorage.getItem(ACCESS_TOKEN_KEY)
}

/** Light room summaries (no description/cover) for the Rooms list: one request instead of three. */
export interface RoomSummary {
  id: string; ownerId: string; interest: { id: string; name: string }; date: string; startTime: string
  locationName: string; status: string; minParticipants: number; maxParticipants: number
  confirmedParticipantCount: number; participants: Array<{ id: string; firstName: string; lastName: string }>
  lastMessageAt: string | null; unreadCount: number
}
export const getRooms = () => request<RoomSummary[]>('/events/rooms', { background: true })
export const getEventActivity = (id: string) => request<{ waitlist: Array<{ userId: string; createdAt?: string }>; checkins: Array<{ userId: string; method?: string; createdAt?: string }> }>(`/events/${id}/activity`, { background: true })

// "Etkinlik Takvimim": the user's private availability records (never a public listing).
export interface ApiAvailability {
  id: string
  status: "active" | "paused" | "expired"
  dateFrom: string
  dateTo: string
  weekdays: number[]
  timeWindows: Array<{ from: string; to: string }>
  area: { mode: "city"; name: string; latitude: number; longitude: number } | { mode: "radius"; latitude: number; longitude: number; radiusKm: number }
  activities: Array<{ interestId: string; ownLevelId?: string | null; anyPartnerLevel?: boolean; partnerLevelIds?: string[]; maxDurationMinutes: number | null }>
}
export const getAvailabilities = () => request<{ items: ApiAvailability[] }>('/users/me/availability')
export const createAvailability = (value: import('../availability/model').AvailabilityPayload) => request<ApiAvailability>('/users/me/availability', { method: 'POST', body: JSON.stringify(value) })
export const updateAvailability = (id: string, value: import('../availability/model').AvailabilityPayload) => request<ApiAvailability>(`/users/me/availability/${id}`, { method: 'PUT', body: JSON.stringify(value) })
export const setAvailabilityPaused = (id: string, paused: boolean) => request<ApiAvailability>(`/users/me/availability/${id}/${paused ? 'pause' : 'resume'}`, { method: 'POST' })
// Removes only the availability record; events and accepted participations are untouched server-side.
export const deleteAvailability = (id: string) => request<{ message: string }>(`/users/me/availability/${id}`, { method: 'DELETE' })
// Organizer only: people from the private pool who fit this event. No contact or location data is returned.
export interface EventCandidate { user: { id: string; firstName: string; lastName: string; profilePhoto: string | null; rank: number }; match: { activity: string; level: string | null; summary: string[] } }
export const getEventCandidates = (eventId: string) => request<{ capacity: { confirmed: number; max: number; spotsLeft: number }; items: EventCandidate[] }>(`/events/${eventId}/candidates`)
// An invitation is not a seat: invitees still pass the capacity check when they accept.
export const inviteEventCandidates = (eventId: string, userIds: string[]) => request<{ invited: number; expiresAt: string }>(`/events/${eventId}/invitations`, { method: 'POST', body: JSON.stringify({ userIds }) })
// Before the event exists: pool members who fit the creation form's draft. Read-only; invitations go out after creation.
export interface CandidateDraft { interestId: string; levelId?: string; date: string; startTime: string; durationMinutes?: number; latitude: number; longitude: number }
export const previewEventCandidates = (draft: CandidateDraft) => request<{ items: EventCandidate[] }>('/events/candidates/preview', { method: 'POST', body: JSON.stringify(draft) })

export interface AppNotification {
  id: string; type: string; title: string; body: string;
  eventId: string | null; actorId: string | null; readAt: string | null; createdAt: string;
}
export const getNotifications = (cursor?: string) => request<{ items: AppNotification[]; unreadCount: number; nextCursor: string | null }>(`/notifications${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`, { background: true })
export const readNotification = (id: string) => request(`/notifications/${encodeURIComponent(id)}/read`, { method: 'PATCH' })
export const readAllNotifications = () => request('/notifications/read-all', { method: 'PATCH' })


export interface EventShareLink { url: string; code: string; expiresAt: string; responsibilityAcceptedAt: string }
export const createEventShare = (eventId: string) => request<EventShareLink>(`/events/${encodeURIComponent(eventId)}/share`, { method: 'POST', body: JSON.stringify({ acceptResponsibility: true }) })
export const revokeEventShare = (code: string) => request(`/sharing/links/${encodeURIComponent(code)}`, { method: 'DELETE' })
export interface GuestEvent {
  id: string; title: string; category: string; date: string; time: string; location: string;
  description: string; requirements: string | null; coverPhoto: string | null; status: string;
  minParticipants: number; maxParticipants: number; participantCount: number; hostName: string;
}
export const getGuestEvent = (code: string) => request<{ event: GuestEvent; imageUrl: string }>(`/guest/events/${encodeURIComponent(code)}`, { guest: true })
export const joinGuestEvent = (code: string, name: string, session?: string) => request<{ session: string; name: string; expiresAt?: string; resumed: boolean }>(`/guest/events/${encodeURIComponent(code)}/join`, { guest: true, method: 'POST', headers: session ? { 'x-guest-session': session } : {}, body: JSON.stringify({ name }) })
export const leaveGuestEvent = (code: string, session: string) => request(`/guest/events/${encodeURIComponent(code)}/join`, { guest: true, method: 'DELETE', headers: { 'x-guest-session': session } })

export const getGuestParticipation = (code: string, session: string) => request<{ joined: boolean; name: string; expiresAt: string }>(`/guest/events/${encodeURIComponent(code)}/participation`, { guest: true, headers: { 'x-guest-session': session } })

/** The only account request allowed while leaving guest mode: validate the existing member. */
export const getMemberForGuestReturn = () => request<ApiUser>('/auth/me', { method: 'POST', memberReturn: true })

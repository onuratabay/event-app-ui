import { NativeModules, Platform } from "react-native"
import Constants from "expo-constants"
import { resolveApiUrl } from "./config"
import { apiLoading } from "./loading"
import { clearChatCache } from "../services/chat-cache"
import { clearTokens, getAccessToken, getRefreshToken, setTokens } from "./token-store"

/**
 * The development computer (Metro's host:port) in a development build. SDK 58 development builds no longer
 * fill `expoConfig.hostUri`, so the address the JavaScript bundle was loaded from is used too; without it the
 * app fell back to the emulator address 10.0.2.2 and a real phone could not sign in.
 */
function devServerHost(): string | undefined {
  if (!__DEV__) return undefined
  const expo = Constants.expoConfig?.hostUri ?? (Constants as { expoGoConfig?: { debuggerHost?: string } }).expoGoConfig?.debuggerHost
  if (expo) return expo
  try {
    const sourceCode = NativeModules.SourceCode as { scriptURL?: string; getConstants?: () => { scriptURL?: string } } | undefined
    const bundle = sourceCode?.getConstants?.().scriptURL ?? sourceCode?.scriptURL
    return bundle && /^https?:/.test(bundle) ? new URL(bundle).host : undefined
  } catch { return undefined }
}
// Development builds use the local backend unless EXPO_PUBLIC_API_URL says otherwise; published builds use ewent.app.
export const API_URL = resolveApiUrl(process.env.EXPO_PUBLIC_API_URL, devServerHost(), Platform.OS, __DEV__)
if (__DEV__) console.debug("[API URL]", API_URL)
/** Photos come as signed server paths ("/photos/users/…?v=…&s=…"); images load them from the API host and cache them on disk. */
export const photoUri = (uri: string) => uri.startsWith("/photos/") ? `${API_URL.replace(/\/+$/, "")}${uri}` : uri
/** This build's version (app.json "version"); sent with every request so the server knows which app is calling. */
export const APP_VERSION = Constants.expoConfig?.version ?? "0.0.0"
class ApiConnectionError extends Error {}

export interface ApiEvent {
  id: string
  /** rank = Event Skoru; organizedCount only arrives with the event detail. */
  owner: { id: string; firstName: string; lastName: string; rank?: number; organizedCount?: number }
  interest: { id: string; slug: string; name: string }
  level: { enum: string; name: string } | null
  date: string
  startTime: string
  durationMinutes: number | null
  locationName?: string
  /** Organizer-chosen chat room name; null/absent means the default "Activity · date". */
  roomName?: string | null
  latitude: number
  longitude: number
  minParticipants: number
  maxParticipants: number
  /** Signed server path ("/photos/…"); load through Picture. */
  coverPhoto: string | null
  coverPhotoIsDefault?: boolean
  description: string
  requirements: string | null
  confirmedParticipantCount: number
  // profilePhoto is only filled on event detail, and only when the viewer has a photo.
  participants: Array<{ id: string; firstName: string; lastName: string; profilePhoto?: string | null }>
  isFavorite: boolean
  status: { enum: string; name: string }
  visibility?: { id: string; enum: string; name: string }
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
type RequestOptions = RequestInit & { background?: boolean; guest?: boolean; memberReturn?: boolean; timeoutMs?: number }
async function request<T>(path: string, requestOptions: RequestOptions = {}, retryAuth = true): Promise<T> {
  const { background = false, guest = false, memberReturn = false, timeoutMs = 10000, ...options } = requestOptions
  if (!guest && guestAccountIsolation?.() && !(memberReturn && path === '/auth/me')) {
    throw new ApiConnectionError('Misafir oturumunda yalnızca davet edilen etkinliğe erişebilirsin.')
  }
  if (!background) apiLoading.begin()
  const started = Date.now()
  const counterKey = `${options.method || 'GET'} ${path.split('?')[0].replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, ':id').replace(/EWT-[A-Za-z0-9_-]{24}/g, ':invite')}`
  if (__DEV__) apiRequestCounts[counterKey] = (apiRequestCounts[counterKey] || 0) + 1
  try {
  const accessToken = guest ? null : await getAccessToken()
  const controller = new AbortController()
  const cancel = () => controller.abort()
  if (options.signal?.aborted) cancel()
  options.signal?.addEventListener("abort", cancel)
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  let response: Response
  try {
  response = await fetch(`${API_URL}${path}`, {
    ...options,
    signal: controller.signal,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-App-Version": APP_VERSION,
      "X-App-Platform": Platform.OS,
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
    await setTokens(tokens.accessToken, tokens.refreshToken)
  })
  tokenWrites = write.catch(() => {})
  return write
}
async function refreshSession(): Promise<boolean> {
  if (refreshing) return refreshing
  const version = sessionVersion
  refreshing = (async () => {
    const refreshToken = await getRefreshToken()
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

/** Registration, before the account exists: a 6-digit code (2 minutes) to the address. */
// Sent only when the email and phone are free and the password meets the rules (409 / 400 otherwise).
export const sendRegisterEmailCode = (email: string, phoneNumber: string, password: string) => request<{ sent: boolean; expiresAt: string; resendAfter: number }>("/auth/register/email-code", { method: "POST", body: JSON.stringify({ email: email.trim(), phoneNumber, password, language: "tr" }) }, false)
/** The right code returns the proof `register` needs (valid for 30 minutes). */
export const verifyRegisterEmail = (email: string, code: string) => request<{ emailVerificationToken: string }>("/auth/register/verify-email", { method: "POST", body: JSON.stringify({ email: email.trim(), code, language: "tr" }) }, false)
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
  emailVerificationToken: string
}) {
  const response = await request<AuthResponse>("/auth/register", {
    method: "POST",
    body: JSON.stringify({ ...input, language: "tr" }),
  })
  clearSessionCache("user")
  await saveTokens(response.tokens)
  return response
}

/** Sign in with phone number (e.g. "+905321234567") and password. */
export async function login(phoneNumber: string, password: string) {
  const response = await request<AuthResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ phoneNumber, password, language: "tr" }),
  })
  clearSessionCache("user")
  await saveTokens(response.tokens)
  return response
}

// Runs while the session is still valid (e.g. to delete this device's push token).
let beforeLogout: (() => Promise<void>) | null = null
export function setBeforeLogout(task: (() => Promise<void>) | null) { beforeLogout = task }
export async function logout() {
  await beforeLogout?.().catch(() => {})
  sessionVersion++
  clearSessionCache("user")
  // Saved chats belong to the account: they leave the phone with it.
  void clearChatCache()
  const removal = tokenWrites.then(clearTokens)
  tokenWrites = removal.catch(() => {})
  await removal
}

/**
 * Discover feed page. `photos: false` skips the base64 covers (the server reads them one by one),
 * so the list arrives fast and the covers follow in a second, background request.
 */
// The home feed asks only for events still open to join (openOnly); ended or cancelled ones used to fill the
// first pages, which the feed hides, so it looked empty until a later page loaded.
export async function getEvents(page = 1, limit = 20, options: { photos?: boolean; background?: boolean } = {}) {
  return request<EventListResponse>(`/events?page=${page}&limit=${limit}&openOnly=true${options.photos === false ? "&includePhotos=false" : ""}`, { background: options.background })
}

/** Events from the server for search: between two dates (dd/mm/yyyy, inclusive), optionally in some interests. */
export function searchEvents(dateFrom: string, dateTo?: string, interestIds: string[] = []) {
  const params = new URLSearchParams({ page: "1", limit: "100", dateFrom })
  if (dateTo) params.set("dateTo", dateTo)
  for (const id of interestIds) params.append("interestId", id)
  // Background: the search screen shows its own inline progress instead of the global overlay.
  return request<EventListResponse>(`/events?${params.toString()}`, { background: true })
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
  // Background: the profile shows at once and the references fill in (no full-screen loader on first visit).
  const promise = request<{ items: ReferenceRequest[] }>("/references/requests", { background: true }).finally(() => { if (referenceLoad?.promise === promise) referenceLoad = undefined })
  referenceLoad = { version, promise }
  return promise
}
export function sendReferenceRequest(recipientId: string) {
  return request<ReferenceRequest>("/references/requests", { method: "POST", body: JSON.stringify({ recipientId }) })
}
export function deleteReferenceRequest(id: string) {
  return request<{ id: string }>(`/references/requests/${id}`, { method: "DELETE" })
}
export function respondToReference(id: string, decision: "approved" | "declined") {
  return request<{ status: "approved" | "declined" }>(`/references/requests/${id}/respond`, { method: "POST", body: JSON.stringify({ decision }) })
}
export async function hasSession() { return Boolean((await getAccessToken()) || (await getRefreshToken())) }

// Each interest lists its own levels (managed in the interest_levels table); empty means no level step.
export interface InterestLevel { id: string; enum: string; name: string }
/** A member-proposed interest: usable in the proposer's events until an admin approves it into the shared list. */
export interface ProposedInterest { id: string; slug: string; name: string; levels: InterestLevel[]; status?: 'pending' | 'rejected'; requiresCover?: boolean; existing?: boolean }
export const getMyProposedInterests = () => request<ProposedInterest[]>('/interests/mine', { background: true })
// An existing interest with the same name comes back (existing: true) instead of a duplicate.
export const proposeInterest = (name: string, withLevels: boolean) => request<ProposedInterest>('/interests/proposals', { method: 'POST', body: JSON.stringify({ name, withLevels }) })
export interface PendingInterest { id: string; name: string; createdAt: string; proposedBy: string | null; hasLevels: boolean; eventCount: number }
/** Admin: member reports (users and events, with the reported message in the description). */
export interface AdminReport { id: string; description: string; status: 'submitted' | 'in_review' | 'completed'; createdAt: string; targetType: 'user' | 'event'; targetId: string; reporterId: string; reporterName: string | null; targetName: string | null; targetStatus: string | null; eventTitle: string | null }
export const getAdminReports = (status: 'open' | 'all') => request<{ items: AdminReport[]; counts: { open: number; all: number } }>(`/admin/reports?status=${status}`, { background: true })
// One action closes the report and every other open report about the same member or event.
export const decideReport = (id: string, action: 'dismiss' | 'deactivate') => request<{ closed: string[]; targetId: string; targetStatus?: string }>(`/admin/reports/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ action }) })
/** Admin: a member found by email, before deleting them for good. */
export interface AdminUserLookup { id: string; firstName: string; lastName: string; email: string; phoneNumber: string; city: string | null; status: string | null; role: 'member' | 'admin'; createdAt: string; ownedEvents: number; participations: number }
export const lookupUserByEmail = (email: string) => request<AdminUserLookup>(`/admin/users/lookup?email=${encodeURIComponent(email.trim())}`, { background: true })
// The email goes along again: the server deletes only when it still belongs to this id.
export const deleteUserPermanently = (id: string, email: string) => request<{ deleted: true; id: string }>(`/admin/users/${encodeURIComponent(id)}`, { method: 'DELETE', body: JSON.stringify({ email }) })
export const getPendingInterests = () => request<PendingInterest[]>('/admin/interests/pending', { background: true })
export const decideInterest = (id: string, decision: 'approved' | 'rejected') => request<{ id: string; status: string }>(`/admin/interests/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ decision }) })
// The catalog is the same for everyone and changes rarely: fetched once per 6 hours per app session.
// The signal is accepted for compatibility but not passed on, so one screen leaving cannot cancel the shared request.
/** Stock cover images of an interest (empty for a member-proposed one until an admin adds some). */
export const getInterestImages = (interestId: string) => request<Array<{ id: string }>>(`/interests/${encodeURIComponent(interestId)}/images`, { background: true })
export function getMapInterests(_signal?: AbortSignal) {
  return cached("interests", 6 * HOURS, () => request<Array<{ id: string; name: string; slug: string; levels?: InterestLevel[]; requiresCover?: boolean }>>("/interests", { headers: { "Accept-Language": "tr" } }))
}

export interface VersionPolicy { minimumVersion: { ios: string; android: string }; storeUrl: { ios: string | null; android: string | null } }
/** Forced update: the lowest supported version per platform and the store links (public, no session needed). */
export const getVersionPolicy = () => request<VersionPolicy>("/app/version-policy", { background: true, guest: true, timeoutMs: 6000 }, false)
export function forgotPassword(email: string) {
  return request<{ message: string }>("/auth/forgot-password", { method: "POST", body: JSON.stringify({ email: email.trim(), language: "tr" }) }, false)
}
/** Checks the 6-digit emailed code (does not use it up); 5 wrong tries cancel the request. */
export function verifyResetCode(email: string, code: string) {
  return request<{ valid: true }>("/auth/verify-reset-code", { method: "POST", body: JSON.stringify({ email: email.trim(), code, language: "tr" }) }, false)
}
export function resetPassword(email: string, code: string, newPassword: string) {
  return request<{ message: string }>("/auth/reset-password", { method: "POST", body: JSON.stringify({ email: email.trim(), code, newPassword, language: "tr" }) }, false)
}

// Admin only: membership applications. The server rejects these calls for non-admin accounts.
export type ApplicationFilter = 'pending' | 'review' | 'incomplete' | 'approved' | 'passive' | 'rejected' | 'all'
export type ApplicationDecision = 'approve' | 'reject' | 'review' | 'deactivate'
export interface MembershipApplication {
  id: string; firstName: string; lastName: string; email: string; phoneNumber: string; city: string
  instagramUsername: string | null; birthDate: string; age: number | null
  status: { enum: string; name: string }; interests: string[]; approvedReferences: number; createdAt: string
}
export interface ApplicationsPage { items: MembershipApplication[]; total: number; page: number; hasMore: boolean; counts: Record<ApplicationFilter, number> }
type Counts = Record<string, number>
type Ranked = Array<{ name: string; count: number }>
/** Admin dashboard figures (GET /admin/stats); series cover the last 30 days, oldest first. */
export interface AdminStats {
  generatedAt: string
  users: { total: number; admins: number; byStatus: Counts; newToday: number; new7d: number; new30d: number; active: { day: number; week: number; month: number }; withPhoto: number; withInstagram: number; withPush: number; pushTokens: { ios: number; android: number }; locked: number; marketingConsent: number; ageBuckets: Ranked; topCities: Ranked; topInterests: Ranked }
  events: { total: number; active: number; upcoming: number; today: number; overdue: number; created7d: number; created30d: number; byStatus: Counts; byVisibility: Counts; cancellations: Counts; avgConfirmed: number | null; fillRate: number | null; reachedMinimum: number; notCancelled: number; paid: number; topInterests: Ranked }
  participation: { byStatus: Counts; guests: number; activeGuests: number; shareLinks: number; checkins: number; favorites: number }
  engagement: { eventMessages: number; eventMessages7d: number; announcements: number; guestMessages: number; conversations: number; directMessages: number; directMessages7d: number; friendships: number; friendRequests: number; reviews: number; avgEventScore: number | null; participantRatings: number; avgParticipantScore: number | null; availability: { active: number; paused: number } }
  moderation: { reports: Counts; reportTargets: Counts; references: Counts; interestProposals: number; interests: number }
  series: { days: string[]; registrations: number[]; events: number[]; messages: number[] }
}
/** Seasonal access code (e.g. EVENT2026): the screen to open, and the account status afterwards (it may approve). */
export const redeemAccessCode = (code: string) => request<{ target: string; status: string }>("/access-codes/redeem", { method: "POST", body: JSON.stringify({ code }) })
export const getAdminStats = () => request<AdminStats>("/admin/stats", { background: true })
export const getApplications = (params: { status: ApplicationFilter; q?: string; page?: number }, signal?: AbortSignal) =>
  request<ApplicationsPage>(`/admin/applications?${new URLSearchParams({ status: params.status, page: String(params.page || 1), limit: '20', ...(params.q?.trim() ? { q: params.q.trim() } : {}) })}`, { signal, background: true })
export interface MembershipApplicationDetail extends MembershipApplication {
  bio: string | null
  profilePhoto: string | null
  references: Array<{ id: string; name: string; status: 'pending' | 'approved' | 'declined'; createdAt: string }>
  history: Array<{ fromStatus: string; toStatus: string; createdAt: string; adminName: string | null }>
  consents: { documents: Array<{ title: string; version: number; acceptedAt: string | null }>; pending: string[]; marketing: boolean }
}
export const getApplicationDetail = (userId: string) => request<MembershipApplicationDetail>(`/admin/applications/${encodeURIComponent(userId)}`, { background: true })
export const decideApplication = (userId: string, decision: ApplicationDecision) =>
  request<MembershipApplication>(`/admin/applications/${encodeURIComponent(userId)}`, { method: 'PATCH', body: JSON.stringify({ decision }), background: true })

// Typing-ahead place search through the server (Google Places): venues, districts, cities in Türkiye.
export interface PlaceSuggestion { placeId: string; title: string; subtitle: string }
export interface PlaceDetail { placeId: string; name: string; address: string; latitude: number; longitude: number; city: string; district: string }
export const searchPlaces = (q: string, options: { latitude?: number; longitude?: number; session: string }, signal?: AbortSignal) =>
  request<{ items: PlaceSuggestion[] }>(`/places/autocomplete?${new URLSearchParams({ q, session: options.session, ...(options.latitude !== undefined && options.longitude !== undefined ? { lat: String(options.latitude), lng: String(options.longitude) } : {}) })}`, { signal, background: true })
export const getPlace = (placeId: string, session: string) => request<PlaceDetail>(`/places/${encodeURIComponent(placeId)}?session=${encodeURIComponent(session)}`, { background: true })

// This device's Expo push token belongs to the signed-in account until sign-out.
export const savePushToken = (token: string, platform: string) => request('/push/tokens', { method: 'PUT', body: JSON.stringify({ token, platform }), background: true })
export const removePushToken = (token: string) => request('/push/tokens', { method: 'DELETE', body: JSON.stringify({ token }), background: true })

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

export interface ApiUser { id: string; firstName: string; lastName: string; status?: { enum: string }; role?: 'member' | 'admin'; email?: string; phoneNumber?: string; birthDate?: string; city?: string; bio?: string; instagramUsername?: string; profilePhoto?: string | null; rank?: number; scores?: RatingScores | null }
/** Per-question averages of the post-event ratings a member received (null until someone rates them). */
export interface RatingScores {
  /** How the members this one brought in (references, reference and event codes) are rated. */
  referrals?: { members: number; average: number | null; count: number }
  punctuality: number | null; communication: number | null; community: number | null; count: number }
export const getUserProfile = (userId: string) => request<ApiUser & { interests: Array<{ id: string; name: string }> }>(`/users/${encodeURIComponent(userId)}/profile`)
export interface NotificationPreferences { invites?: boolean; messages?: boolean; reminders?: boolean }
export interface Preferences { mapFilters?: import('../map/filters').DiscoveryFilters; notifications?: NotificationPreferences; mutedRooms?: { ids: string[] } }
export const getWalkthroughs = () => request<{ accountId: string; state: import('../walkthrough/model').WalkthroughState }>("/users/me/walkthroughs", { background: true })
export const updateWalkthrough = (accountId: string, value: import('../walkthrough/model').ProgressAction) => request<{ accountId: string; state: import('../walkthrough/model').WalkthroughState; granted: boolean }>("/users/me/walkthroughs", { method: "POST", body: JSON.stringify({ accountId, ...value }), background: true })
// Startup asks for the account from several places at once; they share one request.
// Background: startup never shows the global loader for account data; only the event feed matters there.
export const getCurrentUser = () => shared('user:me', () => request<ApiUser>('/auth/me', { method: 'POST', background: true }))
// profile_incomplete → approved once at least one interest is saved and a reference is approved; otherwise reference_pending.
export const completeProfile = () => request<ApiUser>('/users/me/profile/complete', { method: 'POST' }).finally(() => clearSessionCache('user'))
export const getUserInterests = () => request<Array<{ id: string; name: string }>>('/users/me/interests', { background: true })
export const setUserInterests = (interestIds: string[]) => request<Array<{ id: string; name: string }>>('/users/me/interests', { method: 'PUT', body: JSON.stringify({ interestIds }) })
export const updateProfile = (value: Partial<ApiUser>) => request<ApiUser>('/users/me/profile', { method: 'PATCH', body: JSON.stringify(value) })
// The server bumps the token version, so every session (this one too) must sign in again afterwards.
// The server signs out every other device; this one gets a fresh token pair and stays signed in.
export async function changePassword(oldPassword: string, newPassword: string) {
  const response = await request<{ message: string; tokens: TokenResponse }>('/auth/password', { method: 'PATCH', body: JSON.stringify({ oldPassword, newPassword, language: 'tr' }) })
  await saveTokens(response.tokens)
  return response
}
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
/** Post-event rating page: the ended event, whether the viewer already rated, and the other attendees. */
export interface RatingForm {
  event: { id: string; title: string; date: string; startTime: string; ownerId: string }
  isOwner: boolean
  submitted: boolean
  participants: Array<{ id: string; firstName: string; lastName: string; isOwner: boolean; profilePhoto: string | null }>
}
export interface ParticipantRatingInput { userId: string; punctuality: number; communication: number; community: number }
export const getRatingForm = (eventId: string) => request<RatingForm>(`/events/${encodeURIComponent(eventId)}/ratings`)
// The organizer sends no eventScore; everyone else must. Ratings are final once sent.
export const submitRatings = (eventId: string, body: { eventScore?: number; participants: ParticipantRatingInput[] }) => request<{ submitted: true }>(`/events/${encodeURIComponent(eventId)}/ratings`, { method: 'POST', body: JSON.stringify(body) })
/** One-to-one chats with connections (no event room needed). canSend is false once you are no longer connected. */
export interface DirectMessage { id: string; conversationId: string; senderId: string; text: string; createdAt: string; /** Deleted by its sender: shown as "Bu mesaj silindi". */ deleted?: boolean; /** Edited by its sender: shown as "düzenlendi". */ editedAt?: string | null; /** "Cevapla": the earlier message of this chat it answers. */ replyTo?: DirectReply | null }
export interface DirectReply { id: string; senderId: string; text: string; deleted?: boolean }
export interface DirectConversation { id: string; user: { id: string; firstName: string; lastName: string; profilePhoto: string | null }; canSend: boolean; lastMessage: DirectMessage | null; unreadCount: number; /** Has the app open right now; live updates arrive as "presence:changed". */ online?: boolean }
export const getDirectConversations = () => request<{ items: DirectConversation[] }>('/direct', { background: true })
// Opens the chat with a connection (created on first use); an existing chat opens even after unfriending, read-only.
// Background: the chat screen opens at once (from saved data); this never shows the full-screen loader.
export const openDirectConversation = (userId: string) => request<DirectConversation>(`/direct/with/${encodeURIComponent(userId)}`, { method: 'POST', background: true })
// `after`: only messages newer than the device's newest (a small catch-up for a cached chat).
export const getDirectMessages = (conversationId: string, cursor?: string, after?: string) => request<{ items: DirectMessage[]; nextCursor: string | null; otherReadAt: string | null }>(`/direct/${encodeURIComponent(conversationId)}/messages${after ? `?after=${encodeURIComponent(after)}` : cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`, { background: true })
export const sendDirectMessage = (conversationId: string, text: string, replyToId?: string) => request<DirectMessage>(`/direct/${encodeURIComponent(conversationId)}/messages`, { method: 'POST', body: JSON.stringify({ text, ...(replyToId ? { replyToId } : {}) }), background: true })
// "Sohbeti sil": only for the caller; earlier messages stay hidden for them, the other side keeps everything.
export const deleteDirectConversation = (conversationId: string) => request<{ cleared: true }>(`/direct/${encodeURIComponent(conversationId)}`, { method: 'DELETE' })
// The sender edits their own message; both sides see it marked "düzenlendi".
export const editDirectMessage = (conversationId: string, messageId: string, text: string) => request<DirectMessage>(`/direct/${encodeURIComponent(conversationId)}/messages/${encodeURIComponent(messageId)}`, { method: 'PATCH', body: JSON.stringify({ text }), background: true })
// The sender deletes their own message for both sides.
export const deleteDirectMessage = (conversationId: string, messageId: string) => request<DirectMessage>(`/direct/${encodeURIComponent(conversationId)}/messages/${encodeURIComponent(messageId)}`, { method: 'DELETE', background: true })
export const markDirectRead = (conversationId: string) => request<{ readAt: string }>(`/direct/${encodeURIComponent(conversationId)}/read`, { method: 'POST', background: true })
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
/** Organizer only, before the start: members are notified and the room stops taking messages. */
export const cancelEvent = (id: string) => request<{ message: string }>(`/events/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status: 'cancelled' }) })
export const participate = (id: string, join: boolean) => request<ApiEvent>(`/events/${id}/${join ? 'join' : 'leave'}`, { method: 'POST' })
// Most frequent lines from the user's own past event descriptions (dismissed ones excluded).
export const getSuggestions = () => request<{ items: string[] }>('/events/mine/suggestions')
export const dismissSuggestion = (text: string) => request<{ items: string[] }>('/events/mine/suggestions', { method: 'DELETE', body: JSON.stringify({ text }) })
export const canCreateEvent = () => request<{ canCreate: boolean; message: string | null }>('/events/can-create')
export const getUserSettings = () => cached('user:settings', HOURS / 6, () => request<{ canCreateInviteOnly: boolean }>('/users/me/settings'))
export interface FriendUser { id: string; firstName: string; lastName: string; profilePhoto: string | null }
// Accepted friends whose accounts are approved; only they can be invited.
export const getActiveFriends = () => request<{ items: Array<{ user: FriendUser }> }>('/friends?active=true&limit=100')
/** A profile visit: our relationship, whether a request can be sent now (needs a shared event), and their friend count. */
export interface FriendRelationship { status: 'self' | 'none' | 'outgoing' | 'incoming' | 'friends'; canRequest: boolean; friendCount: number }
export const getFriendRelationship = (userId: string) => request<FriendRelationship>(`/friends/status/${encodeURIComponent(userId)}`, { background: true })
// Friend actions run in the background; the profile button updates optimistically.
export const sendFriendRequest = (userId: string) => request<{ message: string }>('/friends/requests', { method: 'POST', body: JSON.stringify({ userId }), background: true })
export const cancelFriendRequest = (userId: string) => request<{ message: string }>(`/friends/requests/${encodeURIComponent(userId)}`, { method: 'DELETE', background: true })
export const acceptFriendRequest = (userId: string) => request<{ message: string }>(`/friends/requests/${encodeURIComponent(userId)}/accept`, { method: 'POST', background: true })
export const getIncomingFriendRequests = () => request<{ items: Array<{ user: FriendUser }>; total: number }>('/friends/requests/incoming?limit=100', { background: true })
/** A member's connections: visible to themselves and their friends only (others get 403). */
export const getFriendsOf = (userId: string) => request<{ items: Array<{ user: FriendUser; friendsSince: string }>; total: number }>(`/friends/of/${encodeURIComponent(userId)}?limit=100`, { background: true })
export const removeFriend = (userId: string) => request<{ message: string }>(`/friends/${encodeURIComponent(userId)}`, { method: 'DELETE', background: true })
export const declineFriendRequest = (userId: string) => request<{ message: string }>(`/friends/requests/${encodeURIComponent(userId)}/decline`, { method: 'POST', background: true })
export const getInvitations = () => request<EventListResponse>('/events/invitations?limit=50')
export const getEnums = (group: string) => cached(`enums:${group}`, 6 * HOURS, () => request<Array<{ id: string; enum: string; name: string }>>(`/enum-values?group=${group}`))
// Creating can take long (cover moderation); a retry with the same clientRequestId returns the same event instead of a duplicate.
export const createEvent = (value: Record<string, unknown>) => request<ApiEvent>('/events', { method: 'POST', body: JSON.stringify(value), timeoutMs: 30000 })
export interface ApiMessage { kind?: 'message' | 'announcement' | 'system'; id: string; text: string; createdAt: string; editedAt?: string | null; deleted?: boolean; user: { id: string; firstName: string; lastName: string }; /** "Cevapla": the earlier message of this room it answers. */ replyTo?: RoomReply | null }
export interface RoomReply { id: string; text: string; deleted?: boolean; user: { id: string; firstName: string; lastName: string } }
// Room requests run in the background: the chat screen never shows the global loading overlay.
export const editMessage = (eventId: string, messageId: string, text: string) => request<ApiMessage>(`/events/${eventId}/messages/${messageId}`, { method: 'PATCH', body: JSON.stringify({ text }), background: true })
export const deleteMessage = (eventId: string, messageId: string) => request<ApiMessage>(`/events/${eventId}/messages/${messageId}`, { method: 'DELETE', background: true })
// When each other member last read the room ("görüldü").
export const getMessageReads = (eventId: string) => request<{ items: Array<{ userId: string; readAt: string }> }>(`/events/${eventId}/messages/reads`, { background: true })
export const reportUser = (userId: string, description: string) => request<{ message: string }>(`/reports/users/${userId}`, { method: 'POST', body: JSON.stringify({ description, language: 'tr' }) })
// A room opens with its latest 20 messages; each older page is another 20.
export const MESSAGE_PAGE_SIZE = 20
// `after`: only messages newer than the device's newest (a small catch-up for a cached room).
export const getMessages = (id: string, signal?: AbortSignal, cursor?: string, after?: string) => request<{ items: ApiMessage[]; nextCursor?: string | null }>(`/events/${id}/messages${after ? `?after=${encodeURIComponent(after)}` : cursor ? `?cursor=${encodeURIComponent(cursor)}&limit=${MESSAGE_PAGE_SIZE}` : `?limit=${MESSAGE_PAGE_SIZE}`}`, { signal, background: true })
export const markRoomRead = (id: string) => request<{ eventId: string; unreadCount: number }>(`/events/${id}/messages/read`, { method: 'POST', background: true })
export const sendMessage = (id: string, text: string, replyToId?: string) => request<ApiMessage>(`/events/${id}/messages`, { method: 'POST', body: JSON.stringify({ text, ...(replyToId ? { replyToId } : {}) }), background: true })
/** Profile "Katıldığı": ended events the user joined (not their own), newest first; `total` is the count. */
/** Profile counters: organized = own events that started; attended = joined-and-ended + organized. */
export const getProfileStats = () => request<{ attended: number; organized: number }>('/events/stats', { background: true })
// The full list loads only when it is opened (covers are heavy).
export const getAttendedEvents = (limit = 50) => request<EventListResponse>(`/events/attended?limit=${limit}`, { background: true })
/** "Düzenlediğim" on the profile: own events that started or ended, newest first. */
export const getOrganizedEvents = (limit = 50) => request<EventListResponse>(`/events/organized?limit=${limit}`, { background: true })
/** Profile "Arşiv": every event the user created, any status, newest first. Only ever the requester's own. */
export const getOwnedEvents = (page = 1) => request<EventListResponse>(`/events/mine?page=${page}&limit=20`, { background: true })
export async function getMyEvents(page = 1, options: { background?: boolean } = {}) {
  const lists = await Promise.all(['mine', 'participating', 'favorites'].map(kind => request<EventListResponse>(`/events/${kind}?page=${page}&limit=30`, options)))
  return { items: lists.flatMap(list => list.items), hasMore: lists.some(list => page * 30 < list.total) }
}

export const archiveLegacyData = (value: Record<string, unknown>) => request('/users/me/legacy-data', { method: 'PUT', body: JSON.stringify({ value }) })

export async function getSocketToken(renew = false) {
  if (renew && !await refreshSession()) return null
  return getAccessToken()
}

/** Light room summaries (no description/cover) for the Rooms list: one request instead of three. */
export interface RoomSummary {
  id: string; ownerId: string; interest: { id: string; name: string }; date: string; startTime: string
  locationName: string; roomName?: string | null; status: string; minParticipants: number; maxParticipants: number
  confirmedParticipantCount: number; participants: Array<{ id: string; firstName: string; lastName: string }>
  lastMessageAt: string | null; unreadCount: number
}
export const getRooms = () => request<RoomSummary[]>('/events/rooms', { background: true })
/** Organizer only; an empty name restores the default title. Every member is told over the socket. */
export const renameRoom = (id: string, name: string) => request<{ eventId: string; roomName: string | null }>(`/events/${id}/room-name`, { method: 'PATCH', body: JSON.stringify({ name }), background: true })
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
// Organizer only: how many pool members match the event and have not been invited yet (no cards, no photos).
export const getEventCandidateCount = (eventId: string) => request<{ count: number }>(`/events/${eventId}/candidates/count`, { background: true })
export const getEventCandidates = (eventId: string) => request<{ capacity: { confirmed: number; max: number; spotsLeft: number }; items: EventCandidate[] }>(`/events/${eventId}/candidates`)
// An invitation is not a seat: invitees still pass the capacity check when they accept.
export type FriendInviteStatus = 'none' | 'invited' | 'expired' | 'confirmed' | 'waitlisted' | 'declined'
export interface FriendInvite { user: { id: string; firstName: string; lastName: string; profilePhoto: string | null }; status: FriendInviteStatus; canInvite: boolean }
/** "Sadece Davet" events: the organizer's friends with their status in this event. */
export const getEventFriendInvites = (eventId: string) => request<{ items: FriendInvite[] }>(`/events/${eventId}/friend-invites`, { background: true })
/** Invites friends (again, for those who declined or let the invitation expire); sent 20 at a time. */
export async function inviteEventFriends(eventId: string, userIds: string[]) {
  let invited = 0
  for (let i = 0; i < userIds.length; i += 20) invited += (await request<{ invited: number }>(`/events/${eventId}/friend-invites`, { method: 'POST', body: JSON.stringify({ userIds: userIds.slice(i, i + 20) }) })).invited
  return { invited }
}
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
export const deleteAllNotifications = () => request<{ deleted: number }>('/notifications', { method: 'DELETE' })


export interface EventShareLink { url: string; code: string; expiresAt: string; responsibilityAcceptedAt: string }
export const createEventShare = (eventId: string) => request<EventShareLink>(`/events/${encodeURIComponent(eventId)}/share`, { method: 'POST', body: JSON.stringify({ acceptResponsibility: true }) })
/** The organizer's 24-hour event code (EWT-…); accepting guest responsibility is part of creating it. */
export const createEventCode = (eventId: string) => request<EventShareLink>(`/events/${encodeURIComponent(eventId)}/share`, { method: 'POST', body: JSON.stringify({ acceptResponsibility: true, kind: 'code' }) })
export const createReferenceCode = () => request<{ code: string; expiresAt: string }>('/references/codes', { method: 'POST' })
export const getActiveReferenceCode = () => request<{ code: { code: string; expiresAt: string } | null }>('/references/codes/active', { background: true }).then(result => result.code)
export const revokeEventShare = (code: string) => request(`/sharing/links/${encodeURIComponent(code)}`, { method: 'DELETE' })
export interface GuestEvent {
  id: string; title: string; category: string; date: string; time: string; location: string;
  /** Older servers leave these out. */ durationMinutes?: number | null; level?: string | null;
  description: string; requirements: string | null; coverPhoto: string | null; status: string;
  minParticipants: number; maxParticipants: number; participantCount: number; hostName: string;
}
// A new member takes over the guest place this device held in that event (member request, guest session in a header).
export const claimGuestParticipation = (code: string, session: string) => request<{ eventId: string; joined: boolean }>(`/guest/events/${encodeURIComponent(code)}/claim`, { method: 'POST', headers: { 'x-guest-session': session }, background: true })
export const getGuestEvent = (code: string) => request<{ event: GuestEvent; imageUrl: string }>(`/guest/events/${encodeURIComponent(code)}`, { guest: true })
export const joinGuestEvent = (code: string, name: string, session?: string) => request<{ session: string; name: string; expiresAt?: string; resumed: boolean }>(`/guest/events/${encodeURIComponent(code)}/join`, { guest: true, method: 'POST', headers: session ? { 'x-guest-session': session } : {}, body: JSON.stringify({ name }) })
export const leaveGuestEvent = (code: string, session: string) => request(`/guest/events/${encodeURIComponent(code)}/join`, { guest: true, method: 'DELETE', headers: { 'x-guest-session': session } })

export interface GuestRoomMessage { id: string; text: string; name: string; isGuest: boolean; mine?: boolean; createdAt: string; replyTo?: { id: string; name: string; isGuest: boolean; text: string; deleted: boolean } | null }
// The room as a guest sees it: the latest 100 messages of members and guests (403 while the room is closed).
export const getGuestMessages = (code: string, session: string) => request<{ items: GuestRoomMessage[] }>(`/guest/events/${encodeURIComponent(code)}/messages`, { guest: true, background: true, headers: { 'x-guest-session': session } })
export const sendGuestMessage = (code: string, session: string, text: string, replyToId?: string) => request<{ id: string }>(`/guest/events/${encodeURIComponent(code)}/messages`, { guest: true, method: 'POST', headers: { 'x-guest-session': session }, body: JSON.stringify(replyToId ? { text, replyToId } : { text }) })

export const getGuestParticipation = (code: string, session: string) => request<{ joined: boolean; name: string; expiresAt: string }>(`/guest/events/${encodeURIComponent(code)}/participation`, { guest: true, headers: { 'x-guest-session': session } })

/** The only account request allowed while leaving guest mode: validate the existing member. */
export const getMemberForGuestReturn = () => request<ApiUser>('/auth/me', { method: 'POST', memberReturn: true })

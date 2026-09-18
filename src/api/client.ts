import AsyncStorage from "@react-native-async-storage/async-storage"
import { Platform } from "react-native"

const API_URL =
  process.env.EXPO_PUBLIC_API_URL ||
  (Platform.OS === "android" ? "http://10.0.2.2:3000" : "http://192.168.1.5:3000")
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
  minParticipants: number
  maxParticipants: number
  coverPhoto: string | null
  description: string
  requirements: string | null
  confirmedParticipantCount: number
  participants: Array<{ id: string; firstName: string; lastName: string }>
  isFavorite: boolean
  status: { enum: string; name: string }
}

interface EventListResponse {
  items: ApiEvent[]
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
  if (!(error instanceof Error)) return fallback
  const match = error.message.match(/\{[\s\S]*\}$/)
  if (!match) return fallback
  try {
    const payload = JSON.parse(match[0]) as { errors?: Array<{ message?: string }> }
    return payload.errors?.map((item) => item.message).filter(Boolean).join(" ") || fallback
  } catch {
    return fallback
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const accessToken = await AsyncStorage.getItem(ACCESS_TOKEN_KEY)
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...(options.headers || {}),
    },
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`API ${response.status}: ${body || response.statusText}`)
  }

  return (await response.json()) as T
}

async function saveTokens(tokens: TokenResponse) {
  await AsyncStorage.multiSet([
    [ACCESS_TOKEN_KEY, tokens.accessToken],
    [REFRESH_TOKEN_KEY, tokens.refreshToken],
  ])
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
  await AsyncStorage.multiRemove([ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY])
}

export async function getEvents() {
  return request<EventListResponse>("/events?page=1&limit=20")
}

export function hasRemoteApiConfigured() {
  return Boolean(process.env.EXPO_PUBLIC_API_URL)
}

export type Screen = "splash" | "welcome" | "login" | "forgot-password" | "onboarding-1" | "onboarding-2" | "onboarding-3" | "approval" | "interests" | "discover" | "event-detail" | "event-room" | "map" | "create-event" | "rooms" | "search" | "notifications" | "profile"

export type NavigateFn = (screen: Screen, opts?: { eventId?: string; back?: boolean; reset?: boolean; aboveHome?: boolean }) => void

export interface AppUser {
  id: string
  /** Account status (approved, profile_incomplete, reference_pending, ...). */
  status?: string
  name: string
  avatar: string
  city: string
  bio: string
  instagram: string
  recommendationProfile?: import("./recommendations/model").RecommendationProfile
  interests: string[]
  score: number
  scores: {
    punctuality: number
    communication: number
    community: number
  }
  stats: {
    attended: number
    connections: number
    organized: number
  }
}

export interface AppEvent {
  id: string
  title: string
  category: string
  categoryEmoji: string
  date: string
  time: string
  location: string
  latitude?: number
  longitude?: number
  distance: string
  level: string
  currentParticipants: number
  maxParticipants: number
  minParticipants: number
  host: AppUser
  participants: AppUser[]
  coverImage: string
  description: string
  requirements: string[]
  status?: string
  isActive: boolean
  isSaved: boolean
  waitlisted?: boolean
  invited?: boolean
  /** When the event was created; the feed puts newer events first on ties. */
  createdAt?: string
  lastMessageAt?: string
  unreadCount?: number
  joined?: boolean
  duration?: string
  privacy?: string
}

export interface ChatMessage {
  createdAt?: string
  id: string
  user: AppUser
  text: string
  time: string
  isHost?: boolean
}

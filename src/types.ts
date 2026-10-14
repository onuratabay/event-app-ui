export type Screen = "splash" | "welcome" | "login" | "forgot-password" | "onboarding-1" | "onboarding-2" | "onboarding-3" | "approval" | "interests" | "discover" | "event-detail" | "event-room" | "map" | "create-event" | "rooms" | "search" | "notifications" | "profile" | "settings" | "availability" | "guest-event" | "guest-entry" | "legal" | "admin"

export type NavigateFn = (screen: Screen, opts?: { eventId?: string; userId?: string; activity?: string; back?: boolean; reset?: boolean; aboveHome?: boolean }) => void

export interface AppUser {
  id: string
  /** Account status (approved, profile_incomplete, reference_pending, ...). */
  status?: string
  /** "admin" may manage membership applications; the server checks it on every admin request. */
  role?: string
  name: string
  avatar: string
  city: string
  bio: string
  instagram: string
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
  /** Organizer-chosen chat room name (shown instead of "Activity · date"). */
  roomName?: string
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
  /** Pool invitations only: server deadline for answering. */
  invitationExpiresAt?: string
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

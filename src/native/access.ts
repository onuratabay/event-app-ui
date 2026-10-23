import type { Screen } from "../types"

/**
 * Accounts that are not approved never enter the app. An unfinished application resumes where it stopped:
 * the Instagram/reference step until the (required) Instagram handle is saved, then the profile step
 * (optional photo, interests). A filed one waits on the approval page. Unknown means "not loaded yet".
 */
export function gatedScreen(status?: string, account?: { instagramUsername?: string | null }): Screen | null {
  if (!status || status === "approved") return null
  if (status === "profile_incomplete") return account?.instagramUsername ? "interests" : "onboarding-2"
  return "onboarding-3"
}

/** Sign-in and onboarding pages a pending account may still use. */
export const PRE_APP_ROUTES = new Set(["/", "/welcome", "/login", "/forgot-password", "/onboarding-1", "/onboarding-2", "/onboarding-3", "/interests", "/legal", "/app-guide"])

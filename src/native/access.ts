import type { Screen } from "../types"

/**
 * Accounts that are not approved never enter the app. An unfinished application resumes at the
 * reference step (then profile); a filed one waits on the approval page. Unknown means "not loaded yet".
 */
export function gatedScreen(status?: string): Screen | null {
  if (!status || status === "approved") return null
  // An unfinished application resumes at the reference step; the profile (interests) comes after it.
  if (status === "profile_incomplete") return "onboarding-2"
  return "onboarding-3"
}

/** Sign-in and onboarding pages a pending account may still use. */
export const PRE_APP_ROUTES = new Set(["/", "/welcome", "/login", "/forgot-password", "/onboarding-1", "/onboarding-2", "/onboarding-3", "/interests", "/legal"])

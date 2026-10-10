import type { Screen } from "../types"

/**
 * Accounts that are not approved never enter the app. Each pending status has its
 * own page: profile completion or the reference wait. Unknown means "not loaded yet".
 */
export function gatedScreen(status?: string): Screen | null {
  if (!status || status === "approved") return null
  if (status === "profile_incomplete") return "interests"
  return "onboarding-3"
}

/** Sign-in and onboarding pages a pending account may still use. */
export const PRE_APP_ROUTES = new Set(["/", "/welcome", "/login", "/forgot-password", "/onboarding-1", "/onboarding-2", "/onboarding-3", "/interests"])

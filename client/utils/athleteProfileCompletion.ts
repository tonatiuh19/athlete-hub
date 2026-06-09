import type { AthleteUser } from "@shared/api";
import {
  findPendingRegistrationReturnPath,
  hasPendingRegistrationAuth,
} from "@/utils/registrationSessionStorage";

export function athleteNeedsProfileCompletion(
  user: AthleteUser | null | undefined,
): boolean {
  return Boolean(user && (!user.dateOfBirth || !user.gender));
}

export function athletePostAuthPath(
  user: AthleteUser | null | undefined,
  returnTo?: string | null,
): string {
  const registrationReturn = findPendingRegistrationReturnPath(returnTo);
  if (registrationReturn) {
    return registrationReturn;
  }
  if (athleteNeedsProfileCompletion(user)) {
    return "/portal/complete-profile";
  }
  return returnTo || "/portal";
}

export function shouldResumeRegistrationAfterAuth(returnTo?: string | null): boolean {
  if (!returnTo?.startsWith("/events/")) return false;
  const slug = returnTo.match(/^\/events\/([^/]+)/)?.[1];
  if (!slug) return false;
  return hasPendingRegistrationAuth(slug);
}

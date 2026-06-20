import type { AthleteUser } from "@shared/api";
import {
  findPendingRegistrationReturnPath,
  hasPendingRegistrationAuth,
} from "@/utils/registrationSessionStorage";
import { normalizeSsoReturnTo } from "@/utils/ssoReturnStorage";

export function athleteNeedsProfileCompletion(
  user: AthleteUser | null | undefined,
): boolean {
  return Boolean(user && (!user.dateOfBirth || !user.gender));
}

export function athletePostAuthPath(
  user: AthleteUser | null | undefined,
  returnTo?: string | null,
): string {
  const safeReturnTo = normalizeSsoReturnTo(returnTo);
  const registrationReturn = findPendingRegistrationReturnPath(safeReturnTo);
  if (registrationReturn) {
    return registrationReturn;
  }
  if (athleteNeedsProfileCompletion(user)) {
    return "/portal/complete-profile";
  }
  return safeReturnTo || "/portal";
}

export function shouldResumeRegistrationAfterAuth(returnTo?: string | null): boolean {
  if (!returnTo?.startsWith("/events/")) return false;
  const slug = returnTo.match(/^\/events\/([^/]+)/)?.[1];
  if (!slug) return false;
  return hasPendingRegistrationAuth(slug);
}

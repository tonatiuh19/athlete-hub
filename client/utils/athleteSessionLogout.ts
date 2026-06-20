import type { AppDispatch } from "@/store";
import { athleteLogout } from "@/store/slices/athleteAuthSlice";
import { readSsoOAuthStartedAt, ssoTrace } from "@/utils/ssoTrace";

const INTENTIONAL_LOGOUT_KEY = "athlete_hub_intentional_logout";
const INTENTIONAL_LOGOUT_TTL_MS = 60_000;

/** Set before clearing sessions so login auto-resume does not immediately sign back in. */
export function markAthleteIntentionalLogout(): void {
  sessionStorage.setItem(INTENTIONAL_LOGOUT_KEY, String(Date.now()));
}

export function clearAthleteIntentionalLogout(): void {
  sessionStorage.removeItem(INTENTIONAL_LOGOUT_KEY);
}

export function shouldSkipClerkAthleteResume(): boolean {
  if (typeof window !== "undefined" && window.location.pathname === "/sso-callback") {
    return false;
  }
  if (readSsoOAuthStartedAt() !== null) {
    return false;
  }

  const raw = sessionStorage.getItem(INTENTIONAL_LOGOUT_KEY);
  if (!raw) return false;
  const ts = Number(raw);
  if (Number.isNaN(ts) || Date.now() - ts > INTENTIONAL_LOGOUT_TTL_MS) {
    clearAthleteIntentionalLogout();
    return false;
  }
  return true;
}

/**
 * End both Clerk and Triboo athlete sessions in a safe order.
 * Clerk must be cleared before Triboo so /login auto-resume cannot race.
 */
export async function performAthleteLogout(opts: {
  dispatch: AppDispatch;
  clerkSignOut?: (() => Promise<void>) | null;
}): Promise<void> {
  markAthleteIntentionalLogout();
  ssoTrace("logout:start", { clerk: Boolean(opts.clerkSignOut) });

  if (opts.clerkSignOut) {
    try {
      await opts.clerkSignOut();
      ssoTrace("logout:clerk-done", {});
    } catch (err) {
      ssoTrace("logout:clerk-error", { error: String(err) });
    }
  }

  await opts.dispatch(athleteLogout());
  ssoTrace("logout:triboo-done", {});
}

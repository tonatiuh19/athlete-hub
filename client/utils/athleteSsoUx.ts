import { CLERK_SSO_CALLBACK_PATH } from "@/config/clerkUrls";
import { getAthleteToken } from "@/lib/api";
import { clearSsoOAuthStarted, readSsoOAuthStartedAt } from "@/utils/ssoTrace";

const SSO_OAUTH_STALE_MS = 5 * 60_000;

function pathFromClerkRoute(to: string): string {
  if (to.startsWith("http://") || to.startsWith("https://")) {
    try {
      return new URL(to).pathname;
    } catch {
      return to;
    }
  }
  return to.split("?")[0]?.split("#")[0] ?? to;
}

function isStaleOauthAttempt(): boolean {
  const started = readSsoOAuthStartedAt();
  if (started === null) return false;
  if (Date.now() - started <= SSO_OAUTH_STALE_MS) return false;
  clearSsoOAuthStarted();
  return true;
}

/** True while Google/Clerk OAuth is in flight and Triboo JWT is not ready yet. */
export function isAthleteOauthCompleting(): boolean {
  if (typeof window === "undefined") return false;
  if (getAthleteToken()) return false;
  if (window.location.pathname === CLERK_SSO_CALLBACK_PATH) return true;
  if (isStaleOauthAttempt()) return false;
  return readSsoOAuthStartedAt() !== null;
}

/** Clerk may router-push /login during handleRedirectCallback — send back to callback instead. */
export function shouldRedirectClerkAuthRouteToCallback(to: string): boolean {
  if (!isAthleteOauthCompleting()) return false;
  const path = pathFromClerkRoute(to);
  return path === "/login" || path.startsWith("/login/");
}

export function athleteSsoCallbackPathWithCurrentQuery(): string {
  if (typeof window === "undefined") return CLERK_SSO_CALLBACK_PATH;
  return `${CLERK_SSO_CALLBACK_PATH}${window.location.search}${window.location.hash}`;
}

import {
  clerkSignInUrl,
  clerkSignUpUrl,
  clerkOriginUrl,
  CLERK_SSO_CALLBACK_PATH,
} from "@/config/clerkUrls";
import { clerkSsoCallbackUrl } from "@/utils/clerkSso";

/**
 * Params required by Clerk `handleRedirectCallback` / `<AuthenticateWithRedirectCallback />`.
 * Without signInUrl/signUpUrl, Clerk falls back to the hosted Account Portal (accounts.dev).
 * @see https://clerk.com/docs/guides/development/custom-flows/authentication/legacy/oauth-connections
 */
export function clerkOAuthCallbackParams() {
  const signInUrl = clerkSignInUrl();
  const signUpUrl = clerkSignUpUrl();
  const callbackUrl = clerkSsoCallbackUrl();

  return {
    signInUrl,
    signUpUrl,
    signInFallbackRedirectUrl: callbackUrl,
    signUpFallbackRedirectUrl: callbackUrl,
    continueSignUpUrl: clerkOriginUrl("/portal/complete-profile"),
  };
}

/** Params for `signIn.authenticateWithRedirect` (legacy Core 2 API on @clerk/clerk-react v5). */
export function clerkOAuthStartParams() {
  const callbackUrl = clerkSsoCallbackUrl();
  return {
    redirectUrl: callbackUrl,
    redirectUrlComplete: callbackUrl,
  };
}

export function clerkOAuthRoutingSnapshot() {
  const callback = clerkOAuthCallbackParams();
  const start = clerkOAuthStartParams();
  return {
    ...callback,
    authenticateWithRedirect: start,
    ssoCallbackPath: CLERK_SSO_CALLBACK_PATH,
    appOrigin: typeof window !== "undefined" ? window.location.origin : null,
    onAccountsDev:
      typeof window !== "undefined" &&
      window.location.hostname.endsWith(".accounts.dev"),
  };
}

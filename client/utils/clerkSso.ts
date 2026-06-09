/** Absolute URL Clerk must redirect to after the OAuth provider (no query params). */
export function clerkSsoCallbackUrl(): string {
  if (typeof window === "undefined") return "/sso-callback";
  return `${window.location.origin}/sso-callback`;
}

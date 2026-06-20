import { CLERK_SSO_CALLBACK_PATH } from "@/config/clerkUrls";

/** Absolute URL Clerk must redirect to after the OAuth provider (no query params). */
export function clerkSsoCallbackUrl(): string {
  if (typeof window === "undefined") return CLERK_SSO_CALLBACK_PATH;
  return `${window.location.origin}${CLERK_SSO_CALLBACK_PATH}`;
}

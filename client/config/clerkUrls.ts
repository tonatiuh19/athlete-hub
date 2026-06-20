/** In-app athlete auth routes — keep in sync with App.tsx and Clerk Dashboard → Paths. */
export const CLERK_SIGN_IN_PATH = "/login";
export const CLERK_SIGN_UP_PATH = "/login";
export const CLERK_SSO_CALLBACK_PATH = "/sso-callback";

export function clerkSignInPath(): string {
  return CLERK_SIGN_IN_PATH;
}

export function clerkSignUpPath(): string {
  return CLERK_SIGN_UP_PATH;
}

/** Absolute in-app URL (required for Clerk OAuth callback handlers). */
export function clerkOriginUrl(path: string): string {
  if (typeof window === "undefined") return path;
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${window.location.origin}${normalized}`;
}

/** Absolute sign-in URL — dev instances require absolute format for custom flows. */
export function clerkSignInUrl(): string {
  return clerkOriginUrl(CLERK_SIGN_IN_PATH);
}

export function clerkSignUpUrl(): string {
  return clerkOriginUrl(CLERK_SIGN_UP_PATH);
}

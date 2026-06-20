const SSO_RETURN_TO_KEY = "triboo_sso_return_to";

/** Never use auth/callback routes as post-SSO destinations. */
const AUTH_FLOW_PATHS = ["/login", "/sso-callback", "/staff/login"] as const;

function safeReturnPath(raw: string | null | undefined): string | null {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return null;
  return raw;
}

export function isAuthFlowReturnPath(path: string | null | undefined): boolean {
  if (!path) return false;
  return AUTH_FLOW_PATHS.some(
    (authPath) => path === authPath || path.startsWith(`${authPath}/`),
  );
}

/** Drop auth-flow paths so successful SSO lands in the portal (or a real deep link). */
export function normalizeSsoReturnTo(path: string | null | undefined): string | null {
  const safe = safeReturnPath(path);
  if (!safe || isAuthFlowReturnPath(safe)) return null;
  return safe;
}

/** Persist post-SSO destination before leaving for the OAuth provider. */
export function stashSsoReturnTo(path: string | undefined) {
  try {
    const normalized = normalizeSsoReturnTo(path);
    if (normalized) {
      sessionStorage.setItem(SSO_RETURN_TO_KEY, normalized);
    }
  } catch {
    /* ignore quota errors */
  }
}

/** Read and clear the stashed return path (sessionStorage first, then query param). */
export function resolveSsoReturnTo(queryReturnTo: string | null): string | null {
  try {
    const stashed = normalizeSsoReturnTo(sessionStorage.getItem(SSO_RETURN_TO_KEY));
    if (stashed) {
      sessionStorage.removeItem(SSO_RETURN_TO_KEY);
      return stashed;
    }
  } catch {
    /* ignore */
  }
  return normalizeSsoReturnTo(queryReturnTo);
}

export function hasOAuthCallbackParams(): boolean {
  const search = window.location.search;
  const hash = window.location.hash;
  const blob = `${search}${hash}`;
  if (!blob) return false;
  return (
    blob.includes("__clerk") ||
    blob.includes("code=") ||
    blob.includes("state=") ||
    blob.includes("redirect_url=")
  );
}

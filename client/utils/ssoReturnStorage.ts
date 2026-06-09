const SSO_RETURN_TO_KEY = "triboo_sso_return_to";

function safeReturnPath(raw: string | null | undefined): string | null {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return null;
  return raw;
}

/** Persist post-SSO destination before leaving for the OAuth provider. */
export function stashSsoReturnTo(path: string | undefined) {
  try {
    if (path && safeReturnPath(path)) {
      sessionStorage.setItem(SSO_RETURN_TO_KEY, path);
    }
  } catch {
    /* ignore quota errors */
  }
}

/** Read and clear the stashed return path (sessionStorage first, then query param). */
export function resolveSsoReturnTo(queryReturnTo: string | null): string | null {
  try {
    const stashed = safeReturnPath(sessionStorage.getItem(SSO_RETURN_TO_KEY));
    if (stashed) {
      sessionStorage.removeItem(SSO_RETURN_TO_KEY);
      return stashed;
    }
  } catch {
    /* ignore */
  }
  return safeReturnPath(queryReturnTo);
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

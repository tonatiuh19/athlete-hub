import { logger } from "@/utils/logger";
import { hasOAuthCallbackParams } from "@/utils/ssoReturnStorage";

export const SSO_OAUTH_STARTED_KEY = "triboo_sso_oauth_started_at";

export function markSsoOAuthStarted() {
  try {
    sessionStorage.setItem(SSO_OAUTH_STARTED_KEY, String(Date.now()));
  } catch {
    /* ignore */
  }
}

export function readSsoOAuthStartedAt(): number | null {
  try {
    const raw = sessionStorage.getItem(SSO_OAUTH_STARTED_KEY);
    if (!raw) return null;
    const ts = Number(raw);
    return Number.isFinite(ts) ? ts : null;
  } catch {
    return null;
  }
}

export function clearSsoOAuthStarted() {
  try {
    sessionStorage.removeItem(SSO_OAUTH_STARTED_KEY);
  } catch {
    /* ignore */
  }
}

export function ssoUrlSnapshot() {
  return {
    href: window.location.href,
    pathname: window.location.pathname,
    search: window.location.search || "(empty)",
    hash: window.location.hash || "(empty)",
    hasOAuthParams: hasOAuthCallbackParams(),
    oauthStartedAt: readSsoOAuthStartedAt(),
    msSinceOAuthStart: (() => {
      const started = readSsoOAuthStartedAt();
      return started ? Date.now() - started : null;
    })(),
  };
}

export function serializeClerkError(err: unknown) {
  if (!err || typeof err !== "object") {
    return { message: String(err) };
  }
  const e = err as {
    message?: string;
    errors?: Array<{ code?: string; message?: string; longMessage?: string }>;
    status?: number;
    clerkError?: boolean;
  };
  return {
    message: e.message,
    status: e.status,
    clerkError: e.clerkError,
    errors: e.errors?.map((x) => ({
      code: x.code,
      message: x.message,
      longMessage: x.longMessage,
    })),
  };
}

/** Dev-only structured SSO trace (always visible in console during local dev). */
export function ssoTrace(step: string, data?: Record<string, unknown>) {
  logger.info(`[sso] ${step}`, data ?? {});
}

let ssoNavigationProbeInstalled = false;

/** Log outbound navigations while an OAuth round-trip is in flight (dev diagnosis). */
export function installSsoNavigationProbe() {
  if (ssoNavigationProbeInstalled || typeof window === "undefined") return;
  ssoNavigationProbeInstalled = true;

  window.addEventListener("pagehide", () => {
    if (!readSsoOAuthStartedAt()) return;
    ssoTrace("navigation:pagehide", {
      ...ssoUrlSnapshot(),
      onAccountsDev: window.location.hostname.endsWith(".accounts.dev"),
    });
  });

  const wrapHistory = (method: "pushState" | "replaceState") => {
    const original = history[method].bind(history);
    history[method] = ((...args: Parameters<History["pushState"]>) => {
      if (readSsoOAuthStartedAt()) {
        ssoTrace(`navigation:${method}`, {
          url: args[2] ?? null,
          ...ssoUrlSnapshot(),
        });
      }
      return original(...args);
    }) as History["pushState"];
  };

  wrapHistory("pushState");
  wrapHistory("replaceState");
}

export function ssoTraceSignIn(signIn: unknown) {
  if (!signIn || typeof signIn !== "object") {
    return { signIn: null };
  }
  const s = signIn as Record<string, unknown>;
  return {
    status: s.status,
    id: s.id,
    createdSessionId: s.createdSessionId,
    firstFactorVerification: s.firstFactorVerification,
    isTransferable: s.isTransferable,
    existingSession: s.existingSession,
  };
}

export function ssoTraceSignUp(signUp: unknown) {
  if (!signUp || typeof signUp !== "object") {
    return { signUp: null };
  }
  const s = signUp as Record<string, unknown>;
  return {
    status: s.status,
    id: s.id,
    createdSessionId: s.createdSessionId,
    missingFields: s.missingFields,
    isTransferable: s.isTransferable,
    existingSession: s.existingSession,
  };
}

export function ssoClerkSnapshot(args: {
  clerkLoaded: boolean;
  authLoaded: boolean;
  isSignedIn: boolean;
  userId: string | null | undefined;
  sessionId: string | null | undefined;
  clerkSessionId: string | null | undefined;
}) {
  return {
    clerkLoaded: args.clerkLoaded,
    authLoaded: args.authLoaded,
    isSignedIn: args.isSignedIn,
    userId: args.userId ?? null,
    sessionId: args.sessionId ?? null,
    clerkSessionId: args.clerkSessionId ?? null,
  };
}

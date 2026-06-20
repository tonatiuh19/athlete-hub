import type { AppDispatch } from "@/store";
import { syncAthleteClerk } from "@/store/slices/athleteAuthSlice";
import { athletePostAuthPath } from "@/utils/athleteProfileCompletion";
import { ssoTrace } from "@/utils/ssoTrace";
import { clearAthleteIntentionalLogout, shouldSkipClerkAthleteResume } from "@/utils/athleteSessionLogout";

export type ClerkAthleteResumeResult =
  | { ok: true; path: string }
  | { ok: false; error: string };

export function clerkResumeError(result: ClerkAthleteResumeResult): string | null {
  return "error" in result ? result.error : null;
}

export function clerkResumePath(result: ClerkAthleteResumeResult): string | null {
  return "path" in result ? result.path : null;
}

type ClerkSignOutClient = {
  signOut: (opts?: { redirectUrl?: string | null }) => Promise<unknown>;
};

export function isRecoverableClerkResumeError(error: string): boolean {
  return (
    error.includes("Invalid or expired social session") ||
    error === "sync_failed" ||
    error === "clerk_token_unavailable" ||
    error === "no_clerk_token" ||
    error === "already_signed_in"
  );
}

/** Drop a stale Clerk browser session so OAuth can start cleanly after Triboo sync failed. */
export async function clearClerkSessionAfterFailedResume(
  clerk: ClerkSignOutClient | null | undefined,
  error: string,
): Promise<void> {
  if (!clerk || !isRecoverableClerkResumeError(error)) return;
  try {
    await clerk.signOut({ redirectUrl: null });
    ssoTrace("clerk-resume:cleared-stale-session", { error });
  } catch (err) {
    ssoTrace("clerk-resume:signout-failed", { error: String(err) });
  }
}

/**
 * Exchange an existing Clerk browser session for a Triboo athlete JWT.
 * Use when Clerk reports a signed-in user but local Triboo token is missing.
 */
export async function resumeClerkAthleteSession(opts: {
  dispatch: AppDispatch;
  getToken: () => Promise<string | null>;
  returnTo?: string;
}): Promise<ClerkAthleteResumeResult> {
  if (shouldSkipClerkAthleteResume()) {
    ssoTrace("clerk-resume:skipped-intentional-logout", {});
    return { ok: false as const, error: "intentional_logout" };
  }

  // OAuth callback is completing — do not treat a recent logout as stale-session recovery.
  if (
    typeof window !== "undefined" &&
    window.location.pathname === "/sso-callback"
  ) {
    clearAthleteIntentionalLogout();
  }

  let sessionToken: string | null = null;
  try {
    sessionToken = await opts.getToken();
  } catch (err) {
    ssoTrace("clerk-resume:token-error", { error: String(err) });
    return { ok: false as const, error: "clerk_token_unavailable" };
  }

  if (!sessionToken) {
    return { ok: false as const, error: "no_clerk_token" };
  }

  ssoTrace("clerk-resume:start", { returnTo: opts.returnTo ?? null });
  const result = await opts.dispatch(syncAthleteClerk({ sessionToken }));

  if (syncAthleteClerk.fulfilled.match(result)) {
    const path = athletePostAuthPath(result.payload.athlete, opts.returnTo);
    ssoTrace("clerk-resume:success", {
      path,
      athleteId: result.payload.athlete?.id,
      isNew: result.payload.isNew,
    });
    return { ok: true as const, path };
  }

  const error = String(result.payload || "sync_failed");
  ssoTrace("clerk-resume:failed", { error });
  return { ok: false as const, error };
}

export function isClerkAlreadySignedInError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return message.toLowerCase().includes("already signed in");
}

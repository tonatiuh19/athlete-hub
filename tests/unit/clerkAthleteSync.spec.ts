import { describe, expect, it, vi } from "vitest";

vi.mock("@/store/slices/athleteAuthSlice", () => {
  const fulfilled = {
    type: "athleteAuth/syncClerk/fulfilled",
    match: (action: { type?: string }) =>
      action?.type === "athleteAuth/syncClerk/fulfilled",
  };
  const syncAthleteClerk = Object.assign(
    (payload: unknown) => payload,
    { fulfilled, rejected: { match: () => false } },
  );
  return { syncAthleteClerk };
});

vi.mock("@/utils/athleteProfileCompletion", () => ({
  athletePostAuthPath: (_user: unknown, returnTo?: string | null) =>
    returnTo || "/portal",
}));

vi.mock("@/utils/ssoTrace", () => ({
  ssoTrace: vi.fn(),
}));

vi.mock("@/utils/athleteSessionLogout", () => ({
  shouldSkipClerkAthleteResume: () => false,
}));

import {
  clearClerkSessionAfterFailedResume,
  isClerkAlreadySignedInError,
  isRecoverableClerkResumeError,
  resumeClerkAthleteSession,
} from "@/utils/clerkAthleteSync";

describe("clerkAthleteSync", () => {
  describe("isClerkAlreadySignedInError", () => {
    it("detects Clerk already-signed-in errors", () => {
      expect(isClerkAlreadySignedInError(new Error("You're already signed in."))).toBe(
        true,
      );
      expect(isClerkAlreadySignedInError("ALREADY SIGNED IN")).toBe(true);
      expect(isClerkAlreadySignedInError(new Error("network error"))).toBe(false);
    });
  });

  describe("resumeClerkAthleteSession", () => {
    it("returns path when sync succeeds", async () => {
      const athlete = { id: "a1", email: "a@example.com" };
      const dispatch = vi.fn().mockResolvedValue({
        type: "athleteAuth/syncClerk/fulfilled",
        payload: { athlete, isNew: false, token: "jwt" },
      });

      const result = await resumeClerkAthleteSession({
        dispatch: dispatch as never,
        getToken: async () => "clerk-token",
        returnTo: "/events/foo/register",
      });

      expect(result).toEqual({ ok: true, path: "/events/foo/register" });
    });

    it("returns error when clerk token is missing", async () => {
      const dispatch = vi.fn();
      const result = await resumeClerkAthleteSession({
        dispatch: dispatch as never,
        getToken: async () => null,
      });
      expect(result).toEqual({ ok: false, error: "no_clerk_token" });
      expect(dispatch).not.toHaveBeenCalled();
    });
  });

  describe("clearClerkSessionAfterFailedResume", () => {
    it("signs out clerk for recoverable resume errors", async () => {
      const signOut = vi.fn().mockResolvedValue(undefined);
      await clearClerkSessionAfterFailedResume(
        { signOut },
        "Invalid or expired social session. Please try again.",
      );
      expect(signOut).toHaveBeenCalledWith({ redirectUrl: null });
    });

    it("skips sign out for non-recoverable errors", async () => {
      const signOut = vi.fn();
      await clearClerkSessionAfterFailedResume({ signOut }, "intentional_logout");
      expect(signOut).not.toHaveBeenCalled();
    });
  });

  describe("isRecoverableClerkResumeError", () => {
    it("flags stale session and sync failures", () => {
      expect(
        isRecoverableClerkResumeError("Invalid or expired social session. Please try again."),
      ).toBe(true);
      expect(isRecoverableClerkResumeError("already_signed_in")).toBe(true);
      expect(isRecoverableClerkResumeError("intentional_logout")).toBe(false);
    });
  });
});

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

const sessionStore = new Map<string, string>();
vi.stubGlobal("sessionStorage", {
  getItem: (key: string) => sessionStore.get(key) ?? null,
  setItem: (key: string, value: string) => {
    sessionStore.set(key, value);
  },
  removeItem: (key: string) => {
    sessionStore.delete(key);
  },
  clear: () => sessionStore.clear(),
});

vi.mock("@/store/slices/athleteAuthSlice", () => ({
  athleteLogout: Object.assign(() => ({ type: "athleteAuth/logout" }), {
    fulfilled: { type: "athleteAuth/logout/fulfilled" },
  }),
}));

vi.mock("@/utils/ssoTrace", () => ({
  ssoTrace: vi.fn(),
  readSsoOAuthStartedAt: () => null,
}));

import {
  clearAthleteIntentionalLogout,
  markAthleteIntentionalLogout,
  performAthleteLogout,
  shouldSkipClerkAthleteResume,
} from "@/utils/athleteSessionLogout";

describe("athleteSessionLogout", () => {
  beforeEach(() => {
    sessionStore.clear();
  });

  afterEach(() => {
    sessionStore.clear();
  });

  it("marks and detects intentional logout within TTL", () => {
    expect(shouldSkipClerkAthleteResume()).toBe(false);
    markAthleteIntentionalLogout();
    expect(shouldSkipClerkAthleteResume()).toBe(true);
    clearAthleteIntentionalLogout();
    expect(shouldSkipClerkAthleteResume()).toBe(false);
  });

  it("signs out clerk before clearing triboo session", async () => {
    const order: string[] = [];
    const clerkSignOut = vi.fn(async () => {
      order.push("clerk");
    });
    const dispatch = vi.fn(async () => {
      order.push("triboo");
      return { type: "athleteAuth/logout/fulfilled" };
    });

    await performAthleteLogout({
      dispatch: dispatch as never,
      clerkSignOut,
    });

    expect(order).toEqual(["clerk", "triboo"]);
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(shouldSkipClerkAthleteResume()).toBe(true);
  });

  it("does not skip resume during an active OAuth callback", () => {
    markAthleteIntentionalLogout();
    vi.stubGlobal("window", {
      location: { pathname: "/sso-callback" },
    } as Window);
    expect(shouldSkipClerkAthleteResume()).toBe(false);
  });
});

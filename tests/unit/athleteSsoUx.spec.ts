// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { SSO_OAUTH_STARTED_KEY } from "@/utils/ssoTrace";

vi.mock("@/lib/api", () => ({
  getAthleteToken: vi.fn(() => null),
}));

import { getAthleteToken } from "@/lib/api";
import {
  athleteSsoCallbackPathWithCurrentQuery,
  isAthleteOauthCompleting,
  shouldRedirectClerkAuthRouteToCallback,
} from "@/utils/athleteSsoUx";

describe("athleteSsoUx", () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.mocked(getAthleteToken).mockReturnValue(null);
    Object.defineProperty(window, "location", {
      value: new URL("http://localhost:8080/sso-callback?__clerk_handshake=abc"),
      writable: true,
    });
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  it("detects oauth in progress on callback route", () => {
    expect(isAthleteOauthCompleting()).toBe(true);
  });

  it("detects oauth in progress via session flag on other routes", () => {
    Object.defineProperty(window, "location", {
      value: new URL("http://localhost:8080/login"),
      writable: true,
    });
    sessionStorage.setItem(SSO_OAUTH_STARTED_KEY, String(Date.now()));
    expect(isAthleteOauthCompleting()).toBe(true);
  });

  it("redirects clerk navigation to login during oauth", () => {
    expect(shouldRedirectClerkAuthRouteToCallback("/login")).toBe(true);
    expect(shouldRedirectClerkAuthRouteToCallback("http://localhost:8080/login")).toBe(
      true,
    );
    expect(shouldRedirectClerkAuthRouteToCallback("/portal")).toBe(false);
  });

  it("builds callback path preserving clerk query params", () => {
    expect(athleteSsoCallbackPathWithCurrentQuery()).toBe(
      "/sso-callback?__clerk_handshake=abc",
    );
  });

  it("clears stale oauth flag after timeout", () => {
    Object.defineProperty(window, "location", {
      value: new URL("http://localhost:8080/login"),
      writable: true,
    });
    sessionStorage.setItem(SSO_OAUTH_STARTED_KEY, String(Date.now() - 6 * 60_000));
    expect(isAthleteOauthCompleting()).toBe(false);
    expect(sessionStorage.getItem(SSO_OAUTH_STARTED_KEY)).toBeNull();
  });

  it("is false when triboo token exists", () => {
    vi.mocked(getAthleteToken).mockReturnValue("jwt");
    expect(isAthleteOauthCompleting()).toBe(false);
  });
});

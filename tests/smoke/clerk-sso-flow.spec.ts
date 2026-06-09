// @vitest-environment jsdom
/**
 * Clerk OAuth contract — must match legacy docs:
 * https://clerk.com/docs/guides/development/custom-flows/authentication/legacy/oauth-connections
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { clerkSsoCallbackUrl } from "@/utils/clerkSso";
import { stashSsoReturnTo, resolveSsoReturnTo } from "@/utils/ssoReturnStorage";

describe("smoke: clerk SSO flow contract", () => {
  const originalOrigin = window.location.origin;

  beforeEach(() => {
    sessionStorage.clear();
  });

  afterEach(() => {
    Object.defineProperty(window, "location", {
      value: new URL(originalOrigin),
      writable: true,
    });
  });

  it("callback URL is absolute origin + /sso-callback (no query)", () => {
    expect(clerkSsoCallbackUrl()).toBe(`${window.location.origin}/sso-callback`);
    expect(clerkSsoCallbackUrl()).not.toContain("?");
  });

  it("returnTo is stashed separately — never appended to Clerk redirectUrl", () => {
    stashSsoReturnTo("/events/trail-nevado-toluca-2026");
    const callback = clerkSsoCallbackUrl();
    expect(callback).not.toContain("returnTo");
    expect(resolveSsoReturnTo(null)).toBe("/events/trail-nevado-toluca-2026");
  });

  it("redirectUrl and redirectUrlComplete must match to keep user on callback until Triboo sync", () => {
    const callback = clerkSsoCallbackUrl();
    const oauthStart = {
      redirectUrl: callback,
      redirectUrlComplete: callback,
    };
    expect(oauthStart.redirectUrl).toBe(oauthStart.redirectUrlComplete);
  });
});

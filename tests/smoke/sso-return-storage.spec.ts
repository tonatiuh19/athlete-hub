// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import {
  hasOAuthCallbackParams,
  resolveSsoReturnTo,
  stashSsoReturnTo,
} from "@/utils/ssoReturnStorage";

describe("smoke: sso return storage", () => {
  beforeEach(() => {
    sessionStorage.clear();
    window.history.replaceState({}, "", "/sso-callback");
  });

  it("ignores auth-flow paths as return destinations", () => {
    stashSsoReturnTo("/login");
    expect(resolveSsoReturnTo(null)).toBeNull();
    stashSsoReturnTo("/sso-callback");
    expect(resolveSsoReturnTo(null)).toBeNull();
    stashSsoReturnTo("/events/mock-marathon");
    expect(resolveSsoReturnTo(null)).toBe("/events/mock-marathon");
  });

  it("stashes and consumes return path", () => {
    stashSsoReturnTo("/events/mock-marathon");
    expect(resolveSsoReturnTo(null)).toBe("/events/mock-marathon");
    expect(resolveSsoReturnTo(null)).toBeNull();
  });

  it("prefers stashed path over query param", () => {
    stashSsoReturnTo("/events/a");
    expect(resolveSsoReturnTo("/events/b")).toBe("/events/a");
  });

  it("detects oauth callback params in search and hash", () => {
    window.history.replaceState({}, "", "/sso-callback?code=abc&state=xyz");
    expect(hasOAuthCallbackParams()).toBe(true);

    window.history.replaceState({}, "", "/sso-callback#__clerk_status=complete");
    expect(hasOAuthCallbackParams()).toBe(true);

    window.history.replaceState({}, "", "/sso-callback");
    expect(hasOAuthCallbackParams()).toBe(false);
  });
});

// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  clerkOAuthCallbackParams,
  clerkOAuthRoutingSnapshot,
  clerkOAuthStartParams,
} from "@/utils/clerkOAuthRouting";

describe("clerkOAuthRouting", () => {
  const originalOrigin = window.location.origin;

  beforeEach(() => {
    Object.defineProperty(window, "location", {
      value: new URL("http://localhost:8080/login"),
      writable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(window, "location", {
      value: new URL(originalOrigin),
      writable: true,
    });
  });

  it("includes absolute signInUrl/signUpUrl for handleRedirectCallback", () => {
    const params = clerkOAuthCallbackParams();
    expect(params.signInUrl).toBe("http://localhost:8080/login");
    expect(params.signUpUrl).toBe("http://localhost:8080/login");
    expect(params.signInFallbackRedirectUrl).toBe("http://localhost:8080/sso-callback");
    expect(params.continueSignUpUrl).toBe("http://localhost:8080/portal/complete-profile");
    expect(params).not.toHaveProperty("redirectUrl");
  });

  it("uses matching redirect URLs for authenticateWithRedirect", () => {
    const start = clerkOAuthStartParams();
    expect(start.redirectUrl).toBe(start.redirectUrlComplete);
    expect(start.redirectUrl).toBe("http://localhost:8080/sso-callback");
  });

  it("exposes routing snapshot for SSO traces", () => {
    const snap = clerkOAuthRoutingSnapshot();
    expect(snap.signInUrl).toContain("/login");
    expect(snap.onAccountsDev).toBe(false);
    expect(snap.authenticateWithRedirect.redirectUrl).toContain("/sso-callback");
  });
});

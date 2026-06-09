import { describe, it, expect, afterEach } from "vitest";

describe("smoke: clerk OAuth provider config", () => {
  afterEach(() => {
    delete import.meta.env.VITE_CLERK_OAUTH_PROVIDERS;
  });

  it("defaults to Google only (Apple removed from defaults)", async () => {
    delete import.meta.env.VITE_CLERK_OAUTH_PROVIDERS;
    const { getClerkOAuthProviders } = await import("@/config/clerkOAuthProviders");
    const providers = getClerkOAuthProviders();
    expect(providers.map((p) => p.id)).toEqual(["google"]);
  });

  it("parses google,facebook and ignores apple", async () => {
    import.meta.env.VITE_CLERK_OAUTH_PROVIDERS = "google,apple,facebook";
    const { getClerkOAuthProviders } = await import("@/config/clerkOAuthProviders");
    expect(getClerkOAuthProviders().map((p) => p.id)).toEqual(["google", "facebook"]);
  });

  it("falls back to google when env is empty after filtering", async () => {
    import.meta.env.VITE_CLERK_OAUTH_PROVIDERS = "apple";
    const { getClerkOAuthProviders } = await import("@/config/clerkOAuthProviders");
    expect(getClerkOAuthProviders().map((p) => p.id)).toEqual(["google"]);
  });
});

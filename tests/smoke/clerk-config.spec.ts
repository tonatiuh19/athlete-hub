import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  clerkAuthorizedParties,
  getClerkConfigDiagnostics,
  resolvePublicAppUrl,
} from "../../server/clerkConfig";

describe("smoke: clerk production config", () => {
  const envBackup = { ...process.env };

  beforeEach(() => {
    process.env = { ...envBackup };
    delete process.env.PUBLIC_APP_URL;
    delete process.env.VITE_PUBLIC_APP_URL;
    delete process.env.VERCEL_URL;
    delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
    delete process.env.CLERK_AUTHORIZED_PARTIES;
    delete process.env.CLERK_SECRET_KEY;
  });

  afterEach(() => {
    process.env = envBackup;
  });

  it("resolves Vercel production URL when PUBLIC_APP_URL is unset", () => {
    process.env.VERCEL_PROJECT_PRODUCTION_URL = "athlete-hub.example.com";
    expect(resolvePublicAppUrl()).toBe("https://athlete-hub.example.com");
  });

  it("includes www and non-www host variants for authorized parties", () => {
    process.env.PUBLIC_APP_URL = "https://triboo.example.com";
    process.env.NODE_ENV = "production";
    const parties = clerkAuthorizedParties({ isProd: true });
    expect(parties).toContain("https://triboo.example.com");
    expect(parties).toContain("https://www.triboo.example.com");
  });

  it("includes localhost parties only outside production", () => {
    process.env.PUBLIC_APP_URL = "https://triboo.example.com";
    expect(clerkAuthorizedParties({ isProd: false })).toContain(
      "http://localhost:8080",
    );
    expect(clerkAuthorizedParties({ isProd: true })).not.toContain(
      "http://localhost:8080",
    );
  });

  it("warns when production uses test Clerk secret and localhost app URL", () => {
    process.env.NODE_ENV = "production";
    process.env.CLERK_SECRET_KEY = "sk_test_abc";
    process.env.PUBLIC_APP_URL = "http://localhost:8080";
    const diag = getClerkConfigDiagnostics();
    expect(diag.clerkKeyMode).toBe("test");
    expect(diag.warnings.some((w) => w.includes("test"))).toBe(true);
    expect(diag.warnings.some((w) => w.includes("localhost"))).toBe(true);
  });
});

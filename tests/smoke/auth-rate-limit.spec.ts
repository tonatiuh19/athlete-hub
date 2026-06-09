/**
 * @vitest-environment node
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { Request } from "express";
import {
  checkAthleteAuthRateLimit,
  consumeRateLimit,
  resetAuthRateLimitsForTests,
} from "../../server/authRateLimit";

function mockReq(email?: string, ip = "203.0.113.10"): Request {
  return {
    ip,
    body: email ? { email } : {},
    headers: {},
    socket: { remoteAddress: ip },
  } as Request;
}

describe("auth rate limit", () => {
  let savedTestMode: string | undefined;

  beforeEach(() => {
    savedTestMode = process.env.ATHLETE_HUB_TEST_MODE;
    delete process.env.ATHLETE_HUB_TEST_MODE;
    resetAuthRateLimitsForTests();
  });

  afterEach(() => {
    resetAuthRateLimitsForTests();
    if (savedTestMode !== undefined) {
      process.env.ATHLETE_HUB_TEST_MODE = savedTestMode;
    } else {
      process.env.ATHLETE_HUB_TEST_MODE = "1";
    }
  });

  it("blocks after limit exceeded", () => {
    for (let i = 0; i < 5; i++) {
      expect(consumeRateLimit("login:test", 5, 60_000).allowed).toBe(true);
    }
    const blocked = consumeRateLimit("login:test", 5, 60_000);
    expect(blocked.allowed).toBe(false);
    if (blocked.allowed === false) {
      expect(blocked.retryAfterSec).toBeGreaterThan(0);
    }
  });

  it("login rate limit keys by email when present", () => {
    const req = mockReq("blocked@test.local");
    for (let i = 0; i < 12; i++) {
      expect(checkAthleteAuthRateLimit(req, "login").ok).toBe(true);
    }
    const blocked = checkAthleteAuthRateLimit(req, "login");
    expect(blocked.ok).toBe(false);
    if (blocked.ok === false) {
      expect(blocked.retryAfterSec).toBeGreaterThan(0);
    }
  });

  it("is disabled when ATHLETE_HUB_TEST_MODE=1", () => {
    process.env.ATHLETE_HUB_TEST_MODE = "1";
    const req = mockReq("any@test.local");
    for (let i = 0; i < 20; i++) {
      expect(checkAthleteAuthRateLimit(req, "login").ok).toBe(true);
    }
  });
});

describe("athlete profile completion helper", () => {
  it("detects missing date of birth or gender", async () => {
    const { athleteNeedsProfileCompletion, athletePostAuthPath } = await import(
      "../../client/utils/athleteProfileCompletion"
    );
    expect(athleteNeedsProfileCompletion(null)).toBe(false);
    expect(athleteNeedsProfileCompletion({ id: 1, firstName: "A", lastName: "B" })).toBe(true);
    expect(
      athleteNeedsProfileCompletion({
        id: 1,
        firstName: "A",
        lastName: "B",
        dateOfBirth: "1990-01-01",
      }),
    ).toBe(true);
    expect(
      athleteNeedsProfileCompletion({
        id: 1,
        firstName: "A",
        lastName: "B",
        dateOfBirth: "1990-01-01",
        gender: "male",
      }),
    ).toBe(false);
    expect(athletePostAuthPath({ id: 1, firstName: "A", lastName: "B" })).toBe(
      "/portal/complete-profile",
    );
    expect(
      athletePostAuthPath(
        { id: 1, firstName: "A", lastName: "B", dateOfBirth: "1990-01-01", gender: "male" },
        "/events/foo",
      ),
    ).toBe("/events/foo");
  });
});

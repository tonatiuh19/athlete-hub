/**
 * @vitest-environment node
 */
import { describe, it, expect, afterEach } from "vitest";
import request from "supertest";
import {
  mountAthleteAuthScenario,
  teardownAthleteAuthScenario,
  AUTH_SCENARIO,
} from "../helpers/athleteAuthHarness";
import { hashAthletePassword } from "../../server/password";
import { getCapturedTestEmails } from "../../api/testHooks";

const STRONG_PASSWORD = "TribooTest1!";
const NEW_PASSWORD = "NewTriboo2@";

function registerBody(email: string, overrides: Record<string, unknown> = {}) {
  return {
    email,
    firstName: "New",
    lastName: "User",
    password: STRONG_PASSWORD,
    dateOfBirth: "1995-03-10",
    ...overrides,
  };
}

async function hashForDb(password: string): Promise<string> {
  return hashAthletePassword(password);
}

async function clerkResolverFor(profile: {
  clerkUserId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  googleId?: string | null;
}) {
  const hooks = await import("../../api/testHooks");
  hooks.setTestClerkProfileResolver(async (token) => {
    if (token === "invalid") {
      return { error: "Invalid or expired social session. Please try again." };
    }
    return {
      profile: {
        clerkUserId: profile.clerkUserId,
        email: profile.email,
        firstName: profile.firstName ?? "Social",
        lastName: profile.lastName ?? "User",
        googleId: profile.googleId ?? "google-new-999",
        appleId: null,
        avatarUrl: null,
      },
    };
  });
}

describe("HTTP smoke: athlete password auth", () => {
  afterEach(async () => {
    await teardownAthleteAuthScenario();
  });

  it("check-email returns exists/hasPassword/hasSocialLogin flags", async () => {
    const hash = await hashForDb(STRONG_PASSWORD);
    const { app } = await mountAthleteAuthScenario({ passwordHash: hash, hasSocial: true });

    const unknown = await request(app)
      .post("/api/auth/athlete/check-email")
      .send({ email: "new@test.local" });
    expect(unknown.status).toBe(200);
    expect(unknown.body).toEqual({
      exists: false,
      hasPassword: false,
      hasSocialLogin: false,
    });

    const known = await request(app)
      .post("/api/auth/athlete/check-email")
      .send({ email: AUTH_SCENARIO.email });
    expect(known.status).toBe(200);
    expect(known.body.exists).toBe(true);
    expect(known.body.hasPassword).toBe(true);
    expect(known.body.hasSocialLogin).toBe(true);
  });

  it("register rejects weak password and duplicate email", async () => {
    const { app } = await mountAthleteAuthScenario();

    const weak = await request(app).post("/api/auth/athlete/register").send({
      email: "new@test.local",
      firstName: "New",
      lastName: "User",
      password: "short",
      dateOfBirth: "1995-03-10",
    });
    expect(weak.status).toBe(400);

    const noDob = await request(app).post("/api/auth/athlete/register").send({
      email: "nodob@test.local",
      firstName: "New",
      lastName: "User",
      password: STRONG_PASSWORD,
    });
    expect(noDob.status).toBe(400);

    const ok = await request(app).post("/api/auth/athlete/register").send({
      email: "new@test.local",
      firstName: "New",
      lastName: "User",
      password: STRONG_PASSWORD,
      dateOfBirth: "1995-03-10",
      gender: "female",
    });
    expect(ok.status).toBe(200);
    expect(ok.body.token).toBeTruthy();
    expect(ok.body.athlete.email).toBe("new@test.local");
    expect(ok.body.athlete.dateOfBirth).toBe("1995-03-10");

    const dup = await request(app).post("/api/auth/athlete/register").send({
      email: "new@test.local",
      firstName: "Dup",
      lastName: "User",
      password: STRONG_PASSWORD,
      dateOfBirth: "1995-03-10",
    });
    expect(dup.status).toBe(409);
  });

  it("login rejects wrong password and legacy account without password", async () => {
    const hash = await hashForDb(STRONG_PASSWORD);
    const { app } = await mountAthleteAuthScenario({ passwordHash: hash });

    const bad = await request(app).post("/api/auth/athlete/login").send({
      email: AUTH_SCENARIO.email,
      password: "WrongPass1!",
    });
    expect(bad.status).toBe(401);

    const good = await request(app).post("/api/auth/athlete/login").send({
      email: AUTH_SCENARIO.email,
      password: STRONG_PASSWORD,
    });
    expect(good.status).toBe(200);
    expect(good.body.token).toBeTruthy();

    await teardownAthleteAuthScenario();

    const { app: legacyApp } = await mountAthleteAuthScenario({ passwordHash: null });
    const hooks = await import("../../api/testHooks");
    hooks.setTestResetCodeGenerator(() => "847291");

    const legacy = await request(legacyApp).post("/api/auth/athlete/login").send({
      email: AUTH_SCENARIO.email,
      password: "AnyPass1!",
    });
    expect(legacy.status).toBe(403);
    expect(legacy.body.code).toBe("password_not_set");

    const emails = getCapturedTestEmails();
    expect(emails.length).toBeGreaterThan(0);
    expect(emails[0].html).toContain("847291");
  });

  it("forgot-password always returns ok and sends OTP-style reset email", async () => {
    const hash = await hashForDb(STRONG_PASSWORD);
    const { app } = await mountAthleteAuthScenario({ passwordHash: hash });
    const hooks = await import("../../api/testHooks");
    hooks.setTestResetCodeGenerator(() => "562814");

    const res = await request(app)
      .post("/api/auth/athlete/forgot-password")
      .send({ email: AUTH_SCENARIO.email });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);

    const ghost = await request(app)
      .post("/api/auth/athlete/forgot-password")
      .send({ email: "ghost@test.local" });
    expect(ghost.status).toBe(200);

    const emails = getCapturedTestEmails();
    expect(emails[0].text).toContain("562814");
    expect(emails[0].html).toMatch(/562814/);
  });

  it("reset-password validates code, sets password, and rejects reuse", async () => {
    const { app, db } = await mountAthleteAuthScenario({ passwordHash: null });
    db.seedResetCode(AUTH_SCENARIO.email, "119933");

    const badCode = await request(app).post("/api/auth/athlete/reset-password").send({
      email: AUTH_SCENARIO.email,
      code: "000000",
      password: STRONG_PASSWORD,
    });
    expect(badCode.status).toBe(400);

    const weak = await request(app).post("/api/auth/athlete/reset-password").send({
      email: AUTH_SCENARIO.email,
      code: "119933",
      password: "weak",
    });
    expect(weak.status).toBe(400);

    const ok = await request(app).post("/api/auth/athlete/reset-password").send({
      email: AUTH_SCENARIO.email,
      code: "119933",
      password: STRONG_PASSWORD,
    });
    expect(ok.status).toBe(200);
    expect(ok.body.token).toBeTruthy();
    expect(ok.body.athlete.email).toBe(AUTH_SCENARIO.email);

    const reuse = await request(app).post("/api/auth/athlete/reset-password").send({
      email: AUTH_SCENARIO.email,
      code: "119933",
      password: STRONG_PASSWORD,
    });
    expect(reuse.status).toBe(400);

    const login = await request(app).post("/api/auth/athlete/login").send({
      email: AUTH_SCENARIO.email,
      password: STRONG_PASSWORD,
    });
    expect(login.status).toBe(200);
  });

  it("reset-password requires email + 6-digit code shape", async () => {
    const { app } = await mountAthleteAuthScenario({ passwordHash: null });

    const missing = await request(app).post("/api/auth/athlete/reset-password").send({
      code: "123456",
      password: STRONG_PASSWORD,
    });
    expect(missing.status).toBe(400);

    const short = await request(app).post("/api/auth/athlete/reset-password").send({
      email: AUTH_SCENARIO.email,
      code: "12345",
      password: STRONG_PASSWORD,
    });
    expect(short.status).toBe(400);
  });
});

describe("HTTP smoke: athlete auth — validation & edge cases", () => {
  afterEach(async () => {
    await teardownAthleteAuthScenario();
  });

  it("check-email rejects invalid and empty email", async () => {
    const { app } = await mountAthleteAuthScenario();
    const empty = await request(app).post("/api/auth/athlete/check-email").send({ email: "" });
    expect(empty.status).toBe(400);
    const bad = await request(app).post("/api/auth/athlete/check-email").send({ email: "not-an-email" });
    expect(bad.status).toBe(400);
  });

  it("login returns generic 401 for unknown email (no user enumeration)", async () => {
    const hash = await hashForDb(STRONG_PASSWORD);
    const { app } = await mountAthleteAuthScenario({ passwordHash: hash });

    const unknown = await request(app).post("/api/auth/athlete/login").send({
      email: "ghost@test.local",
      password: STRONG_PASSWORD,
    });
    expect(unknown.status).toBe(401);
    expect(unknown.body.error).toBe("Invalid email or password");

    const wrong = await request(app).post("/api/auth/athlete/login").send({
      email: AUTH_SCENARIO.email,
      password: "WrongPass1!",
    });
    expect(wrong.status).toBe(401);
    expect(wrong.body.error).toBe("Invalid email or password");
  });

  it("login requires email and password", async () => {
    const { app } = await mountAthleteAuthScenario();
    const res = await request(app).post("/api/auth/athlete/login").send({ email: AUTH_SCENARIO.email });
    expect(res.status).toBe(400);
  });

  it("register rejects missing names, invalid gender, and bad dob", async () => {
    const { app } = await mountAthleteAuthScenario();

    const noName = await request(app)
      .post("/api/auth/athlete/register")
      .send(registerBody("noname@test.local", { firstName: "", lastName: "" }));
    expect(noName.status).toBe(400);

    const badGender = await request(app)
      .post("/api/auth/athlete/register")
      .send(registerBody("badgender@test.local", { gender: "invalid" }));
    expect(badGender.status).toBe(400);

    const badDob = await request(app)
      .post("/api/auth/athlete/register")
      .send(registerBody("baddob@test.local", { dateOfBirth: "03-10-1995" }));
    expect(badDob.status).toBe(400);
  });

  it("register returns social_account_exists when email is social-only", async () => {
    const { app } = await mountAthleteAuthScenario({ passwordHash: null, hasSocial: true });
    const res = await request(app)
      .post("/api/auth/athlete/register")
      .send(registerBody(AUTH_SCENARIO.email));
    expect(res.status).toBe(409);
    expect(res.body.code).toBe("social_account_exists");
  });

  it("suspended athletes are unknown on check-email/login and can re-register", async () => {
    const hash = await hashForDb(STRONG_PASSWORD);
    const { app } = await mountAthleteAuthScenario({
      passwordHash: hash,
      status: "suspended",
    });

    const check = await request(app)
      .post("/api/auth/athlete/check-email")
      .send({ email: AUTH_SCENARIO.email });
    expect(check.status).toBe(200);
    expect(check.body.exists).toBe(false);

    const login = await request(app).post("/api/auth/athlete/login").send({
      email: AUTH_SCENARIO.email,
      password: STRONG_PASSWORD,
    });
    expect(login.status).toBe(401);

    const reactivate = await request(app)
      .post("/api/auth/athlete/register")
      .send(registerBody(AUTH_SCENARIO.email));
    expect(reactivate.status).toBe(200);
    expect(reactivate.body.reactivated).toBe(true);
    expect(reactivate.body.athlete.dateOfBirth).toBe("1995-03-10");
  });

  it("soft-deleted athletes are unknown on check-email/login and can re-register", async () => {
    const hash = await hashForDb(STRONG_PASSWORD);
    const { app } = await mountAthleteAuthScenario({
      passwordHash: hash,
      deleted: true,
    });

    const check = await request(app)
      .post("/api/auth/athlete/check-email")
      .send({ email: AUTH_SCENARIO.email });
    expect(check.status).toBe(200);
    expect(check.body.exists).toBe(false);

    const login = await request(app).post("/api/auth/athlete/login").send({
      email: AUTH_SCENARIO.email,
      password: STRONG_PASSWORD,
    });
    expect(login.status).toBe(401);

    const reactivate = await request(app)
      .post("/api/auth/athlete/register")
      .send(registerBody(AUTH_SCENARIO.email));
    expect(reactivate.status).toBe(200);
    expect(reactivate.body.reactivated).toBe(true);
  });

  it("forgot-password rejects invalid email but always ok for unknown", async () => {
    const hash = await hashForDb(STRONG_PASSWORD);
    const { app } = await mountAthleteAuthScenario({ passwordHash: hash });

    const bad = await request(app).post("/api/auth/athlete/forgot-password").send({ email: "bad" });
    expect(bad.status).toBe(400);

    const ghost = await request(app)
      .post("/api/auth/athlete/forgot-password")
      .send({ email: "ghost@test.local" });
    expect(ghost.status).toBe(200);
    expect(ghost.body.ok).toBe(true);
  });

  it("reset-password rejects expired codes", async () => {
    const { app, db } = await mountAthleteAuthScenario({ passwordHash: null });
    db.seedExpiredResetCode(AUTH_SCENARIO.email, "445566");
    const res = await request(app).post("/api/auth/athlete/reset-password").send({
      email: AUTH_SCENARIO.email,
      code: "445566",
      password: STRONG_PASSWORD,
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/invalid or expired/i);
  });
});

describe("HTTP smoke: athlete auth — onboarding & session journey", () => {
  afterEach(async () => {
    await teardownAthleteAuthScenario();
  });

  it("register → /athlete/me → logout invalidates session", async () => {
    const { app } = await mountAthleteAuthScenario();
    const reg = await request(app)
      .post("/api/auth/athlete/register")
      .send(registerBody("journey@test.local"));
    expect(reg.status).toBe(200);
    const token = reg.body.token as string;

    const me = await request(app)
      .get("/api/athlete/me")
      .set("Authorization", `Bearer ${token}`);
    expect(me.status).toBe(200);
    expect(me.body.athlete.email).toBe("journey@test.local");
    expect(me.body.athlete.date_of_birth).toBe("1995-03-10");

    const logout = await request(app)
      .post("/api/auth/logout")
      .set("Authorization", `Bearer ${token}`);
    expect(logout.status).toBe(200);

    const meAfter = await request(app)
      .get("/api/athlete/me")
      .set("Authorization", `Bearer ${token}`);
    expect(meAfter.status).toBe(401);
  });

  it("forgot password → reset → login (athlete forgot password scenario)", async () => {
    const hash = await hashForDb(STRONG_PASSWORD);
    const { app } = await mountAthleteAuthScenario({ passwordHash: hash });
    const hooks = await import("../../api/testHooks");
    hooks.setTestResetCodeGenerator(() => "918273");

    await request(app)
      .post("/api/auth/athlete/forgot-password")
      .send({ email: AUTH_SCENARIO.email });

    const reset = await request(app).post("/api/auth/athlete/reset-password").send({
      email: AUTH_SCENARIO.email,
      code: "918273",
      password: NEW_PASSWORD,
    });
    expect(reset.status).toBe(200);
    expect(reset.body.token).toBeTruthy();

    const oldPwd = await request(app).post("/api/auth/athlete/login").send({
      email: AUTH_SCENARIO.email,
      password: STRONG_PASSWORD,
    });
    expect(oldPwd.status).toBe(401);

    const newPwd = await request(app).post("/api/auth/athlete/login").send({
      email: AUTH_SCENARIO.email,
      password: NEW_PASSWORD,
    });
    expect(newPwd.status).toBe(200);

    const reuse = await request(app).post("/api/auth/athlete/reset-password").send({
      email: AUTH_SCENARIO.email,
      code: "918273",
      password: NEW_PASSWORD,
    });
    expect(reuse.status).toBe(400);
  });

  it("social-only user can set password via reset and then login with email", async () => {
    const { app } = await mountAthleteAuthScenario({ passwordHash: null, hasSocial: true });
    const hooks = await import("../../api/testHooks");
    hooks.setTestResetCodeGenerator(() => "334455");

    await request(app)
      .post("/api/auth/athlete/forgot-password")
      .send({ email: AUTH_SCENARIO.email });

    const reset = await request(app).post("/api/auth/athlete/reset-password").send({
      email: AUTH_SCENARIO.email,
      code: "334455",
      password: STRONG_PASSWORD,
    });
    expect(reset.status).toBe(200);

    const login = await request(app).post("/api/auth/athlete/login").send({
      email: AUTH_SCENARIO.email,
      password: STRONG_PASSWORD,
    });
    expect(login.status).toBe(200);

    const check = await request(app)
      .post("/api/auth/athlete/check-email")
      .send({ email: AUTH_SCENARIO.email });
    expect(check.body.hasPassword).toBe(true);
    expect(check.body.hasSocialLogin).toBe(true);
  });
});

describe("HTTP smoke: athlete auth — social (Clerk) linking", () => {
  afterEach(async () => {
    await teardownAthleteAuthScenario();
  });

  it("creates new athlete when Google email is unknown", async () => {
    const { app } = await mountAthleteAuthScenario();
    await clerkResolverFor({
      clerkUserId: "clerk-new-1",
      email: "google-new@test.local",
    });

    const res = await request(app)
      .post("/api/auth/clerk/athlete")
      .send({ sessionToken: "valid-google-token" });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
    expect(res.body.isNew).toBe(true);
    expect(res.body.athlete.email).toBe("google-new@test.local");
  });

  it("links Google sign-in to existing email/password account", async () => {
    const hash = await hashForDb(STRONG_PASSWORD);
    const { app } = await mountAthleteAuthScenario({ passwordHash: hash });
    await clerkResolverFor({
      clerkUserId: "clerk-link-1",
      email: AUTH_SCENARIO.email,
      googleId: "google-linked-1",
    });

    const res = await request(app)
      .post("/api/auth/clerk/athlete")
      .send({ sessionToken: "valid-link-token" });
    expect(res.status).toBe(200);
    expect(res.body.isNew).toBe(false);
    expect(res.body.athlete.email).toBe(AUTH_SCENARIO.email);

    const check = await request(app)
      .post("/api/auth/athlete/check-email")
      .send({ email: AUTH_SCENARIO.email });
    expect(check.body.hasPassword).toBe(true);
    expect(check.body.hasSocialLogin).toBe(true);
  });

  it("rejects invalid Clerk session token", async () => {
    const { app } = await mountAthleteAuthScenario();
    await clerkResolverFor({ clerkUserId: "x", email: "x@test.local" });
    const hooks = await import("../../api/testHooks");
    hooks.setTestClerkProfileResolver(async () => ({
      error: "Invalid or expired social session. Please try again.",
    }));

    const res = await request(app)
      .post("/api/auth/clerk/athlete")
      .send({ sessionToken: "bad-token" });
    expect(res.status).toBe(401);
  });

  it("requires sessionToken for clerk sync", async () => {
    const { app } = await mountAthleteAuthScenario();
    const res = await request(app).post("/api/auth/clerk/athlete").send({});
    expect(res.status).toBe(400);
  });
});

describe("unit smoke: password policy", () => {
  it("enforces all strength requirements", async () => {
    const { validateAthletePassword } = await import("../../shared/passwordPolicy");
    expect(validateAthletePassword("short").valid).toBe(false);
    expect(validateAthletePassword("alllowercase1!").valid).toBe(false);
    expect(validateAthletePassword("NoNumber!!").valid).toBe(false);
    expect(validateAthletePassword("TribooTest1!").valid).toBe(true);
  });

  it("hash + verify round-trip", async () => {
    const { hashAthletePassword, verifyAthletePassword } = await import("../../server/password");
    const hash = await hashAthletePassword(STRONG_PASSWORD);
    expect(await verifyAthletePassword(STRONG_PASSWORD, hash)).toBe(true);
    expect(await verifyAthletePassword("WrongPass1!", hash)).toBe(false);
  });
});

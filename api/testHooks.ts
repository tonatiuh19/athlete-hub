import type { Pool } from "mysql2/promise";

export type TestActorType = "athlete" | "organizer" | "admin";

export interface TestAuthPayload {
  actor: TestActorType;
  id: number;
  email: string;
  organizerId?: number;
  jti: string;
}

let testPoolOverride: Pool | null = null;
let testAuthBypass: TestAuthPayload | null = null;

export function isTestMode(): boolean {
  return process.env.ATHLETE_HUB_TEST_MODE === "1";
}

export function setTestPool(pool: Pool | null): void {
  testPoolOverride = pool;
}

export function getTestPoolOverride(): Pool | null {
  return testPoolOverride;
}

export function setTestAuthBypass(payload: TestAuthPayload | null): void {
  testAuthBypass = payload;
}

export function getTestAuthBypass(): TestAuthPayload | null {
  return testAuthBypass;
}

export function resetTestEnvironment(): void {
  testPoolOverride = null;
  testAuthBypass = null;
  testResetCodeGenerator = null;
  testClerkProfileResolver = null;
  capturedTestEmails.length = 0;
}

let testResetCodeGenerator: (() => string) | null = null;

export function setTestResetCodeGenerator(fn: (() => string) | null): void {
  testResetCodeGenerator = fn;
}

export function getTestResetCodeGenerator(): (() => string) | null {
  return testResetCodeGenerator;
}

export interface CapturedTestEmail {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

const capturedTestEmails: CapturedTestEmail[] = [];

export function getCapturedTestEmails(): CapturedTestEmail[] {
  return capturedTestEmails.slice();
}

export function resetCapturedTestEmails(): void {
  capturedTestEmails.length = 0;
}

export function pushCapturedTestEmail(email: CapturedTestEmail): void {
  capturedTestEmails.push(email);
}

/** Mock Clerk profile resolution in ATHLETE_HUB_TEST_MODE=1 HTTP tests. */
export interface TestClerkAthleteProfile {
  clerkUserId: string;
  email: string;
  firstName: string;
  lastName: string;
  googleId?: string | null;
  appleId?: string | null;
  avatarUrl?: string | null;
}

export type TestClerkProfileResolver = (
  sessionToken: string,
) => Promise<{ profile: TestClerkAthleteProfile } | { error: string }>;

let testClerkProfileResolver: TestClerkProfileResolver | null = null;

export function setTestClerkProfileResolver(
  resolver: TestClerkProfileResolver | null,
): void {
  testClerkProfileResolver = resolver;
}

export function getTestClerkProfileResolver(): TestClerkProfileResolver | null {
  return testClerkProfileResolver;
}

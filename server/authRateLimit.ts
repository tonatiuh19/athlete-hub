import type { Request } from "express";

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

function isTestMode(): boolean {
  return process.env.ATHLETE_HUB_TEST_MODE === "1";
}

/** @internal Test helper — clears in-memory buckets. */
export function resetAuthRateLimitsForTests(): void {
  buckets.clear();
}

function clientIp(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length > 0) {
    return forwarded.split(",")[0]!.trim().slice(0, 45);
  }
  return (req.ip || "unknown").slice(0, 45);
}

export function consumeRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): { allowed: true } | { allowed: false; retryAfterSec: number } {
  const now = Date.now();
  let bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + windowMs };
    buckets.set(key, bucket);
  }
  bucket.count += 1;
  if (bucket.count > limit) {
    return {
      allowed: false,
      retryAfterSec: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    };
  }
  return { allowed: true };
}

export type AthleteAuthRateLimitScope =
  | "check-email"
  | "register"
  | "login"
  | "forgot-password"
  | "reset-password";

export type PublicOrganizerRateLimitScope = "organizer-register";

const LIMITS: Record<
  AthleteAuthRateLimitScope,
  { limit: number; windowMs: number; emailKey?: boolean }
> = {
  "check-email": { limit: 40, windowMs: 15 * 60 * 1000 },
  register: { limit: 8, windowMs: 60 * 60 * 1000 },
  login: { limit: 12, windowMs: 15 * 60 * 1000, emailKey: true },
  "forgot-password": { limit: 6, windowMs: 60 * 60 * 1000, emailKey: true },
  "reset-password": { limit: 12, windowMs: 15 * 60 * 1000, emailKey: true },
};

export function checkAthleteAuthRateLimit(
  req: Request,
  scope: AthleteAuthRateLimitScope,
): { ok: true } | { ok: false; retryAfterSec: number } {
  if (isTestMode()) return { ok: true };

  const cfg = LIMITS[scope];
  const ip = clientIp(req);
  const email = String(req.body?.email ?? "")
    .trim()
    .toLowerCase();

  const keys: string[] = [`${scope}:ip:${ip}`];
  if (cfg.emailKey && email && /.+@.+\..+/.test(email)) {
    keys.push(`${scope}:email:${email}`);
  }

  for (const key of keys) {
    const result = consumeRateLimit(key, cfg.limit, cfg.windowMs);
    if (result.allowed === false) {
      return { ok: false, retryAfterSec: result.retryAfterSec };
    }
  }
  return { ok: true };
}

const ORGANIZER_REGISTER_LIMITS: Record<
  PublicOrganizerRateLimitScope,
  { limit: number; windowMs: number; emailKey?: boolean }
> = {
  "organizer-register": { limit: 5, windowMs: 60 * 60 * 1000, emailKey: true },
};

export function checkPublicOrganizerRateLimit(
  req: Request,
  scope: PublicOrganizerRateLimitScope,
): { ok: true } | { ok: false; retryAfterSec: number } {
  if (isTestMode()) return { ok: true };

  const cfg = ORGANIZER_REGISTER_LIMITS[scope];
  const ip = clientIp(req);
  const email = String(
    req.body?.owner_email ?? req.body?.email ?? "",
  )
    .trim()
    .toLowerCase();

  const keys: string[] = [`${scope}:ip:${ip}`];
  if (cfg.emailKey && email && /.+@.+\..+/.test(email)) {
    keys.push(`${scope}:email:${email}`);
  }

  for (const key of keys) {
    const result = consumeRateLimit(key, cfg.limit, cfg.windowMs);
    if (result.allowed === false) {
      return { ok: false, retryAfterSec: result.retryAfterSec };
    }
  }
  return { ok: true };
}

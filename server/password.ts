import crypto from "crypto";
import {
  PASSWORD_MAX_LENGTH,
  validateAthletePassword,
} from "../shared/passwordPolicy.js";

const SCRYPT_KEY_LEN = 64;

/** Production params; lighter in vitest so parallel forks don't starve CI (flakes as socket hang-up). */
function scryptOptions(): crypto.ScryptOptions {
  if (process.env.ATHLETE_HUB_TEST_MODE === "1") {
    return { N: 1024, r: 8, p: 1, maxmem: 32 * 1024 * 1024 };
  }
  return { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
}

export async function hashAthletePassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16);
  const derived = await scryptAsync(password, salt, SCRYPT_KEY_LEN);
  return `scrypt$${salt.toString("hex")}$${derived.toString("hex")}`;
}

export async function verifyAthletePassword(
  password: string,
  stored: string | null | undefined,
): Promise<boolean> {
  if (!stored || !password) return false;
  const parts = stored.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  const salt = Buffer.from(parts[1], "hex");
  const expected = Buffer.from(parts[2], "hex");
  const derived = await scryptAsync(password, salt, expected.length);
  return crypto.timingSafeEqual(derived, expected);
}

export function assertStrongAthletePassword(password: string): void {
  if (!password || password.length > PASSWORD_MAX_LENGTH) {
    throw new Error("Invalid password");
  }
  const result = validateAthletePassword(password);
  if (!result.valid) {
    throw new Error("Password does not meet security requirements");
  }
}

function scryptAsync(
  password: string,
  salt: Buffer,
  keyLen: number,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, keyLen, scryptOptions(), (err, derivedKey) => {
      if (err) reject(err);
      else resolve(derivedKey);
    });
  });
}

export function newPasswordResetToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export function hashPasswordResetToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

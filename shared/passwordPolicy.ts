/** Shared athlete password rules — keep client and server in sync. */

export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_LENGTH = 128;

export type PasswordRequirementKey =
  | "minLength"
  | "uppercase"
  | "lowercase"
  | "number"
  | "special";

export interface PasswordValidationResult {
  valid: boolean;
  score: 0 | 1 | 2 | 3 | 4;
  failedRequirements: PasswordRequirementKey[];
}

const SPECIAL_CHARS = /[^A-Za-z0-9]/;

export function validateAthletePassword(password: string): PasswordValidationResult {
  const failedRequirements: PasswordRequirementKey[] = [];

  if (password.length < PASSWORD_MIN_LENGTH) failedRequirements.push("minLength");
  if (!/[A-Z]/.test(password)) failedRequirements.push("uppercase");
  if (!/[a-z]/.test(password)) failedRequirements.push("lowercase");
  if (!/[0-9]/.test(password)) failedRequirements.push("number");
  if (!SPECIAL_CHARS.test(password)) failedRequirements.push("special");

  const passed = 5 - failedRequirements.length;
  const score = Math.min(4, Math.max(0, passed - 1)) as 0 | 1 | 2 | 3 | 4;

  return {
    valid: failedRequirements.length === 0 && password.length <= PASSWORD_MAX_LENGTH,
    score,
    failedRequirements,
  };
}

export function passwordPolicyErrorMessage(
  failed: PasswordRequirementKey[],
  t: (key: string) => string,
): string {
  if (failed.length === 0) return t("auth.password.invalid");
  return failed.map((key) => t(`auth.password.requirements.${key}`)).join(". ");
}

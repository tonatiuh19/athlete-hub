/** Age/gender rules for event category eligibility — shared by client and server. */

export type CategoryRestrictionLike = {
  min_age?: number | null;
  max_age?: number | null;
  gender_restriction?: string | null;
};

export type AthleteEligibilityLike = {
  date_of_birth?: string | Date | null;
  gender?: string | null;
};

export type CategoryEligibilityResult =
  | { eligible: true }
  | { eligible: false; reason: "missing_profile" | "age" | "gender" };

/**
 * Coerce mysql2 Date objects / ISO datetimes to YYYY-MM-DD.
 * Critical: never use String(date).slice(0, 10) — that yields "Tue Jul 14".
 */
function toDateOnly(value: unknown): string | null {
  if (value == null) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  const raw = String(value).trim();
  if (!raw) return null;
  const match = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
}

/** Age in full years on a reference date (YYYY-MM-DD). */
export function ageOnReferenceDate(
  dateOfBirth: string | Date,
  referenceDate: string | Date,
): number | null {
  const dob = toDateOnly(dateOfBirth);
  const ref = toDateOnly(referenceDate);
  if (!dob || !ref) return null;
  const [by, bm, bd] = dob.split("-").map(Number);
  const [ry, rm, rd] = ref.split("-").map(Number);
  let age = ry - by;
  if (rm < bm || (rm === bm && rd < bd)) age -= 1;
  return age >= 0 ? age : null;
}

export function evaluateCategoryEligibility(
  category: CategoryRestrictionLike,
  athlete: AthleteEligibilityLike,
  referenceDate: string | Date,
): CategoryEligibilityResult {
  const dateOfBirth = toDateOnly(athlete.date_of_birth);
  const needsAge = category.min_age != null || category.max_age != null;
  const needsGender =
    category.gender_restriction != null && category.gender_restriction !== "any";

  if ((needsAge && !dateOfBirth) || (needsGender && !athlete.gender)) {
    return { eligible: false, reason: "missing_profile" };
  }

  if (needsAge && dateOfBirth) {
    const age = ageOnReferenceDate(dateOfBirth, referenceDate);
    if (age == null) return { eligible: false, reason: "age" };
    if (category.min_age != null && age < category.min_age) {
      return { eligible: false, reason: "age" };
    }
    if (category.max_age != null && age > category.max_age) {
      return { eligible: false, reason: "age" };
    }
  }

  if (needsGender && athlete.gender) {
    const restriction = category.gender_restriction!;
    if (
      (restriction === "male" || restriction === "female") &&
      athlete.gender !== restriction
    ) {
      return { eligible: false, reason: "gender" };
    }
  }

  return { eligible: true };
}

/** Pick the first eligible category by sort_order (caller should pre-sort). */
export function suggestCategoryId<T extends CategoryRestrictionLike & { id: number }>(
  categories: T[],
  athlete: AthleteEligibilityLike,
  referenceDate: string | Date,
): number | null {
  for (const cat of categories) {
    if (evaluateCategoryEligibility(cat, athlete, referenceDate).eligible) {
      return cat.id;
    }
  }
  return null;
}

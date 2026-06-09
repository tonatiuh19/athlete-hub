/** Age/gender rules for event category eligibility — shared by client and server. */

export type CategoryRestrictionLike = {
  min_age?: number | null;
  max_age?: number | null;
  gender_restriction?: string | null;
};

export type AthleteEligibilityLike = {
  date_of_birth?: string | null;
  gender?: string | null;
};

export type CategoryEligibilityResult =
  | { eligible: true }
  | { eligible: false; reason: "missing_profile" | "age" | "gender" };

/** Age in full years on a reference date (YYYY-MM-DD), using UTC noon to avoid TZ drift. */
export function ageOnReferenceDate(
  dateOfBirth: string,
  referenceDate: string,
): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth) || !/^\d{4}-\d{2}-\d{2}$/.test(referenceDate)) {
    return null;
  }
  const [by, bm, bd] = dateOfBirth.split("-").map(Number);
  const [ry, rm, rd] = referenceDate.split("-").map(Number);
  let age = ry - by;
  if (rm < bm || (rm === bm && rd < bd)) age -= 1;
  return age >= 0 ? age : null;
}

export function evaluateCategoryEligibility(
  category: CategoryRestrictionLike,
  athlete: AthleteEligibilityLike,
  referenceDate: string,
): CategoryEligibilityResult {
  const needsAge = category.min_age != null || category.max_age != null;
  const needsGender =
    category.gender_restriction != null && category.gender_restriction !== "any";

  if ((needsAge && !athlete.date_of_birth) || (needsGender && !athlete.gender)) {
    return { eligible: false, reason: "missing_profile" };
  }

  if (needsAge && athlete.date_of_birth) {
    const age = ageOnReferenceDate(athlete.date_of_birth, referenceDate);
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
  referenceDate: string,
): number | null {
  for (const cat of categories) {
    if (evaluateCategoryEligibility(cat, athlete, referenceDate).eligible) {
      return cat.id;
    }
  }
  return null;
}

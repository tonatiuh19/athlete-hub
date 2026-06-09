import type { TFunction } from "i18next";
import {
  evaluateCategoryEligibility,
  type CategoryEligibilityResult,
} from "@shared/categoryEligibility";
import type { AthleteUser, EventCategory } from "@shared/api";

export function getCategoryEligibilityForAthlete(
  category: EventCategory,
  athlete: Pick<AthleteUser, "dateOfBirth" | "gender"> | null | undefined,
  eventStartDate: string,
): CategoryEligibilityResult {
  return evaluateCategoryEligibility(
    category,
    {
      date_of_birth: athlete?.dateOfBirth ?? null,
      gender: athlete?.gender ?? null,
    },
    eventStartDate.slice(0, 10),
  );
}

export function categoryIneligibilityMessage(
  result: Extract<CategoryEligibilityResult, { eligible: false }>,
  t: TFunction,
): string {
  if (result.reason === "missing_profile") {
    return t("eventDetail.categoryNotEligibleProfile");
  }
  if (result.reason === "gender") {
    return t("eventDetail.categoryNotEligibleGender");
  }
  return t("eventDetail.categoryNotEligibleAge");
}

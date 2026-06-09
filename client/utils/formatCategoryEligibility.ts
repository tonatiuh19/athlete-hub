import type { TFunction } from "i18next";

type CategoryLike = {
  distance_km?: number | null;
  gender_restriction?: string | null;
  min_age?: number | null;
  max_age?: number | null;
  difficulty?: string | null;
};

export function formatCategoryEligibility(
  category: CategoryLike,
  t: TFunction,
): string[] {
  const parts: string[] = [];

  if (category.distance_km != null) {
    parts.push(`${category.distance_km} km`);
  }

  if (category.gender_restriction && category.gender_restriction !== "any") {
    parts.push(
      t(`staffPortal.eventEdit.categoryGender.${category.gender_restriction}`),
    );
  }

  if (category.min_age != null || category.max_age != null) {
    if (category.min_age != null && category.max_age != null) {
      parts.push(
        t("staffPortal.eventEdit.categoryAgeRange", {
          min: category.min_age,
          max: category.max_age,
        }),
      );
    } else if (category.min_age != null) {
      parts.push(t("staffPortal.eventEdit.categoryAgeMin", { min: category.min_age }));
    } else if (category.max_age != null) {
      parts.push(t("staffPortal.eventEdit.categoryAgeMax", { max: category.max_age }));
    }
  }

  if (category.difficulty) {
    parts.push(
      t(`staffPortal.eventEdit.categoryDifficulty.${category.difficulty}`),
    );
  }

  return parts;
}

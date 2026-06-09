import * as Yup from "yup";
import type { TFunction } from "i18next";
import { ageOnReferenceDate } from "@shared/categoryEligibility";

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function athleteDateOfBirthSchema(t: TFunction) {
  return Yup.string()
    .required(t("auth.athlete.dobRequired"))
    .matches(/^\d{4}-\d{2}-\d{2}$/, t("athletePortal.profile.validation.dateFormat"))
    .test("reasonable-age", t("auth.athlete.dobInvalid"), (value) => {
      if (!value) return false;
      const age = ageOnReferenceDate(value, todayIsoDate());
      return age != null && age >= 5 && age <= 100;
    });
}

export function athleteGenderSchema(t: TFunction) {
  return Yup.string()
    .oneOf(["", "male", "female", "other", "prefer_not_to_say"], t("auth.athlete.genderInvalid"))
    .optional();
}

/** Profile completion requires an explicit gender choice (including prefer_not_to_say). */
export function athleteGenderRequiredSchema(t: TFunction) {
  return Yup.string()
    .oneOf(["male", "female", "other", "prefer_not_to_say"], t("auth.athlete.genderInvalid"))
    .required(t("auth.athlete.genderRequired"));
}

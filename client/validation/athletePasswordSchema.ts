import * as Yup from "yup";
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  validateAthletePassword,
} from "@shared/passwordPolicy";

export function athletePasswordFieldSchema(
  t: (key: string) => string,
  fieldName = "password",
) {
  return Yup.string()
    .required(t("common.required"))
    .max(PASSWORD_MAX_LENGTH, t("auth.password.tooLong"))
    .test("strong-password", t("auth.password.weak"), (value) => {
      if (!value) return false;
      return validateAthletePassword(value).valid;
    });
}

export function athletePasswordConfirmSchema(
  t: (key: string) => string,
  passwordField = "password",
  confirmField = "confirmPassword",
) {
  return Yup.object({
    [passwordField]: athletePasswordFieldSchema(t, passwordField),
    [confirmField]: Yup.string()
      .required(t("common.required"))
      .oneOf([Yup.ref(passwordField)], t("auth.password.mismatch")),
  });
}

export { PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH };

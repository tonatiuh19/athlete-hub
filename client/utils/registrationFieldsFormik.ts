import type { TFunction } from "i18next";
import * as Yup from "yup";
import type { NormalizedRegistrationField } from "@shared/registrationFields";

/** Yup schema for registration Campos extra — shared by solo checkout and group wizard. */
export function buildRegistrationFieldsYupSchema(
  fields: NormalizedRegistrationField[],
  t: TFunction,
) {
  const shape: Record<string, Yup.AnySchema> = {};
  for (const f of fields) {
    if (f.field_type === "file") {
      if (f.is_required) {
        shape[f.field_key] = Yup.mixed().test(
          "file-required",
          t("registrationWizard.checkout.fileNotSupported"),
          () => false,
        );
      }
      continue;
    }
    if (f.field_type === "checkbox") {
      shape[f.field_key] = f.is_required
        ? Yup.boolean().oneOf([true], t("common.required"))
        : Yup.boolean();
      continue;
    }
    let schema = Yup.string().trim();
    if (f.is_required) schema = schema.required(t("common.required"));
    if (f.field_type === "select" && (f.options_json?.length ?? 0) > 0) {
      const opts = f.options_json!;
      schema = f.is_required
        ? schema.oneOf(opts, t("registrationWizard.checkout.invalidOption"))
        : schema.test(
            "optional-select",
            t("registrationWizard.checkout.invalidOption"),
            (v) => !v || opts.includes(v),
          );
    }
    if (f.field_type === "number") {
      const numberPattern = /^-?\d+(\.\d+)?$/;
      schema = f.is_required
        ? schema.matches(numberPattern, t("registrationWizard.checkout.invalidNumber"))
        : schema.test(
            "optional-number",
            t("registrationWizard.checkout.invalidNumber"),
            (v) => !v || numberPattern.test(v),
          );
    }
    if (f.field_type === "date") {
      const datePattern = /^\d{4}-\d{2}-\d{2}$/;
      schema = f.is_required
        ? schema.matches(datePattern, t("registrationWizard.checkout.invalidDate"))
        : schema.test(
            "optional-date",
            t("registrationWizard.checkout.invalidDate"),
            (v) => !v || datePattern.test(v),
          );
    }
    shape[f.field_key] = schema;
  }
  return Yup.object(shape);
}

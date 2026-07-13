import * as Yup from "yup";

export function legalTermsAcceptanceSchema(t: (key: string) => string) {
  return Yup.boolean()
    .oneOf([true], t("legal.errors.mustAccept"))
    .required(t("legal.errors.mustAccept"));
}

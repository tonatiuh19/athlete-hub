import type { TFunction } from "i18next";

export type CheckoutErrorPayload =
  | "ALREADY_REGISTERED"
  | "WAITLIST_AVAILABLE"
  | { code?: string; message: string };

export function isCheckoutErrorPayload(
  payload: unknown,
): payload is { code?: string; message: string } {
  return (
    typeof payload === "object" &&
    payload !== null &&
    "message" in payload &&
    typeof (payload as { message: unknown }).message === "string"
  );
}

export function checkoutErrorMessage(payload: CheckoutErrorPayload, t: TFunction): string {
  if (payload === "ALREADY_REGISTERED") {
    return t("registrationWizard.checkout.alreadyRegistered");
  }
  if (payload === "WAITLIST_AVAILABLE") {
    return t("registrationWizard.checkout.soldOutWaitlistHint");
  }
  if (!isCheckoutErrorPayload(payload)) {
    return t("registrationWizard.checkout.genericError");
  }

  switch (payload.code) {
    case "profile_incomplete":
      return t("registrationWizard.checkout.errors.profileIncomplete");
    case "category_gender_ineligible":
      return t("registrationWizard.checkout.errors.genderIneligible");
    case "category_age_ineligible":
      return t("registrationWizard.checkout.errors.ageIneligible");
    case "registration_not_open":
      return t("registrationWizard.checkout.errors.notOpen");
    case "registration_closed":
      return t("registrationWizard.checkout.errors.closed");
    case "already_registered":
      return t("registrationWizard.checkout.alreadyRegistered");
    case "waitlist_available":
      return t("registrationWizard.checkout.soldOutWaitlistHint");
    default:
      return payload.message || t("registrationWizard.checkout.genericError");
  }
}

export function checkoutErrorNeedsProfile(payload: CheckoutErrorPayload): boolean {
  return isCheckoutErrorPayload(payload) && payload.code === "profile_incomplete";
}

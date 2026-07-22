import type { RegistrationCheckoutResponse } from "@shared/api";

/** Checkout session matches the current totals and is ready to show Stripe/MP or confirm $0. */
export function registrationCheckoutIsReady(
  checkout: RegistrationCheckoutResponse | null,
  totalCents: number,
  appliedDiscountCode?: string,
): boolean {
  if (!checkout) return false;
  if (checkout.amountCents !== totalCents) return false;
  if ((checkout.discountCode ?? undefined) !== (appliedDiscountCode ?? undefined)) {
    return false;
  }
  if (totalCents === 0) return Boolean(checkout.paymentPublicUuid);
  if (checkout.provider === "mercadopago") {
    return Boolean(checkout.mpPreferenceId && checkout.mpPublicKey);
  }
  return Boolean(checkout.clientSecret);
}

export function registrationCheckoutEnsureKey(
  totalCents: number,
  appliedDiscountCode?: string,
): string {
  return `${appliedDiscountCode ?? ""}:${totalCents}`;
}

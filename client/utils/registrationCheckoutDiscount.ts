import type { DiscountValidateResponse, RegistrationCheckoutResponse } from "@shared/api";

/** Only send discount to checkout when explicitly validated via Apply. */
export function resolveAppliedDiscountCode(
  discountPreview: DiscountValidateResponse | null,
  discountCode: string,
): string | undefined {
  if (!discountPreview?.valid || !discountCode.trim()) return undefined;
  if (discountPreview.code.toUpperCase() !== discountCode.trim().toUpperCase()) {
    return undefined;
  }
  return discountPreview.code;
}

/** Stale Stripe intent must be recreated when discount changes totals. */
export function shouldInvalidateCheckoutForDiscount(
  checkout: RegistrationCheckoutResponse | null,
  preview: DiscountValidateResponse | null,
  discountCode: string,
): boolean {
  if (!checkout) return false;
  const nextCode = resolveAppliedDiscountCode(preview, discountCode);
  const prevCode = checkout.discountCode ?? undefined;
  if (prevCode !== nextCode) return true;
  if (preview?.valid && checkout.amountCents !== preview.totalCents) return true;
  if (!preview?.valid && !nextCode && checkout.discountAmountCents) return true;
  return false;
}

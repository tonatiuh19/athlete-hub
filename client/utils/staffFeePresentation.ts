import {
  computeCheckoutBreakdown,
  resolveFeePresentation,
  resolveServiceFeePercent,
  type FeePresentation,
} from "@shared/checkoutBreakdown";

export function resolveStaffEventFeePresentation(
  eventFee: FeePresentation | null | undefined,
  organizerFee: FeePresentation | undefined,
): FeePresentation {
  return resolveFeePresentation(eventFee, organizerFee);
}

export function resolveStaffEventServiceFeePercent(
  eventFee?: number | string | null,
  organizerFee?: number | string | null,
): number {
  return resolveServiceFeePercent(eventFee, organizerFee);
}

export function athleteFacingCategoryTotalCents(
  priceCents: number,
  serviceFeePercent: number,
  feePresentation: FeePresentation,
): number {
  return computeCheckoutBreakdown({
    listPriceCents: priceCents,
    serviceFeePercent,
    feePresentation,
  }).athleteTotalCents;
}

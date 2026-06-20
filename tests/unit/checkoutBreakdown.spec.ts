import { describe, expect, it } from "vitest";
import {
  applyDiscountToCheckout,
  athleteFacingTotalCents,
  computeCheckoutBreakdown,
  resolveFeePresentation,
  validateCheckoutBreakdown,
  validatePaidCategoryPricing,
} from "../../shared/checkoutBreakdown.js";

describe("computeCheckoutBreakdown", () => {
  it("pass_through: $1000 inscription → athlete $1110, organizer $1000", () => {
    const b = computeCheckoutBreakdown({
      listPriceCents: 100_000,
      serviceFeePercent: 11,
      feePresentation: "pass_through",
    });
    expect(b.mode).toBe("pass_through");
    expect(b.athleteTotalCents).toBe(111_000);
    expect(b.serviceFeeCents).toBe(11_000);
    expect(b.stripeOrganizerTransferCents).toBe(100_000);
    expect(b.organizerFiscalNetCents).toBe(100_000);
    expect(b.displayIvaCents).toBe(16_000 + 1_760);
    expect(validateCheckoutBreakdown(b)).toBeNull();
  });

  it("absorb_all: $1000 sticker → athlete $1000, net $730, stripe $890", () => {
    const b = computeCheckoutBreakdown({
      listPriceCents: 100_000,
      serviceFeePercent: 11,
      feePresentation: "absorb_all",
    });
    expect(b.mode).toBe("absorb_all");
    expect(b.athleteTotalCents).toBe(100_000);
    expect(b.serviceFeeCents).toBe(11_000);
    expect(b.displayIvaCents).toBe(16_000);
    expect(b.organizerFiscalNetCents).toBe(73_000);
    expect(b.stripeOrganizerTransferCents).toBe(89_000);
    expect(b.serviceFeeCents + b.displayIvaCents + b.organizerFiscalNetCents).toBe(100_000);
    expect(validateCheckoutBreakdown(b)).toBeNull();
  });

  it("resolveFeePresentation inherits organizer when event is null", () => {
    expect(resolveFeePresentation(null, "absorb_all")).toBe("absorb_all");
    expect(resolveFeePresentation(null, null)).toBe("pass_through");
    expect(resolveFeePresentation("absorb_all", "pass_through")).toBe("absorb_all");
  });

  it("athleteFacingTotalCents adds fee for pass_through only", () => {
    expect(athleteFacingTotalCents(100_000, 11, "pass_through")).toBe(111_000);
    expect(athleteFacingTotalCents(100_000, 11, "absorb_all")).toBe(100_000);
  });

  it("validatePaidCategoryPricing rejects absorb-all sticker that nets negative", () => {
    const err = validatePaidCategoryPricing({
      name: "VIP",
      priceCents: 100,
      serviceFeePercent: 99,
      feePresentation: "absorb_all",
    });
    expect(err).toContain("VIP");
  });
});

describe("applyDiscountToCheckout", () => {
  it("absorb_all registration discount reduces sticker and recomputes", () => {
    const { breakdown, discountAmountCents } = applyDiscountToCheckout({
      listPriceCents: 100_000,
      serviceFeePercent: 11,
      feePresentation: "absorb_all",
      discount: {
        discount_type: "percent",
        discount_value: 10,
        applies_to: "registration",
        min_purchase_cents: null,
      },
    });
    expect(discountAmountCents).toBe(10_000);
    expect(breakdown.listPriceCents).toBe(90_000);
    expect(breakdown.athleteTotalCents).toBe(90_000);
    expect(breakdown.organizerFiscalNetCents).toBe(65_700);
  });

  it("pass_through total discount splits across inscription and fee", () => {
    const { breakdown, discountAmountCents } = applyDiscountToCheckout({
      listPriceCents: 100_000,
      serviceFeePercent: 11,
      feePresentation: "pass_through",
      discount: {
        discount_type: "fixed_cents",
        discount_value: 15_000,
        applies_to: "total",
        min_purchase_cents: null,
      },
    });
    expect(discountAmountCents).toBe(15_000);
    expect(breakdown.athleteTotalCents).toBe(96_000);
    expect(breakdown.listPriceCents).toBe(85_000);
    expect(breakdown.serviceFeeCents).toBe(11_000);
  });
});

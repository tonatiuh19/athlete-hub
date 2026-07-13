import { describe, expect, it } from "vitest";
import { athleteFacingTotalCents, computeCheckoutWithExtras } from "../../shared/checkoutBreakdown";

describe("computeCheckoutWithExtras", () => {
  it("combines category and extras into athlete total with pass-through fees", () => {
    const breakdown = computeCheckoutWithExtras({
      categoryListPriceCents: 30_000,
      extrasSubtotalCents: 4_500,
      serviceFeePercent: 11,
      feePresentation: "pass_through",
    });

    expect(breakdown.extrasSubtotalCents).toBe(4_500);
    expect(breakdown.categoryListPriceCents).toBe(30_000);
    expect(breakdown.athleteTotalCents).toBe(
      athleteFacingTotalCents(34_500, 11, "pass_through"),
    );
  });

  it("returns category-only breakdown when extras subtotal is zero", () => {
    const breakdown = computeCheckoutWithExtras({
      categoryListPriceCents: 10_000,
      extrasSubtotalCents: 0,
      serviceFeePercent: 11,
      feePresentation: "pass_through",
    });

    expect(breakdown.athleteTotalCents).toBe(
      athleteFacingTotalCents(10_000, 11, "pass_through"),
    );
  });

  it("handles absorb_all fee presentation for combined list", () => {
    const breakdown = computeCheckoutWithExtras({
      categoryListPriceCents: 100_000,
      extrasSubtotalCents: 5_000,
      serviceFeePercent: 11,
      feePresentation: "absorb_all",
    });

    expect(breakdown.athleteTotalCents).toBe(105_000);
    expect(breakdown.serviceFeeCents).toBeGreaterThan(0);
  });

  it("extras-only checkout (free category) charges athlete-facing fee on extras", () => {
    const breakdown = computeCheckoutWithExtras({
      categoryListPriceCents: 0,
      extrasSubtotalCents: 1_200,
      serviceFeePercent: 11,
      feePresentation: "pass_through",
    });

    expect(breakdown.athleteTotalCents).toBe(
      athleteFacingTotalCents(1_200, 11, "pass_through"),
    );
  });

  it("clamps negative inputs to zero", () => {
    const breakdown = computeCheckoutWithExtras({
      categoryListPriceCents: -100,
      extrasSubtotalCents: -50,
      serviceFeePercent: 11,
      feePresentation: "pass_through",
    });

    expect(breakdown.categoryListPriceCents).toBe(0);
    expect(breakdown.extrasSubtotalCents).toBe(0);
    expect(breakdown.athleteTotalCents).toBe(0);
  });
});

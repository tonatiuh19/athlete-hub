import { describe, it, expect } from "vitest";
import {
  resolveCheckoutRail,
  resolveServiceFeePercentForRail,
} from "../../shared/payoutRail";

describe("payout rail", () => {
  it("prefers ready preferred rail", () => {
    expect(
      resolveCheckoutRail({
        preferred: "mercadopago",
        stripeReady: true,
        mpReady: true,
      }),
    ).toEqual({ ok: true, rail: "mercadopago", fallback: false });
  });

  it("falls back to the other rail", () => {
    expect(
      resolveCheckoutRail({
        preferred: "mercadopago",
        stripeReady: true,
        mpReady: false,
      }),
    ).toEqual({ ok: true, rail: "stripe", fallback: true });
  });

  it("blocks when neither ready", () => {
    const r = resolveCheckoutRail({
      preferred: "stripe",
      stripeReady: false,
      mpReady: false,
    });
    expect(r.ok).toBe(false);
  });

  it("uses 13% for MP when no event override", () => {
    expect(
      resolveServiceFeePercentForRail({
        organizerFee: 11,
        rail: "mercadopago",
      }),
    ).toBe(13);
  });

  it("keeps event override over rail default", () => {
    expect(
      resolveServiceFeePercentForRail({
        eventFee: 9,
        organizerFee: 11,
        rail: "mercadopago",
      }),
    ).toBe(9);
  });
});

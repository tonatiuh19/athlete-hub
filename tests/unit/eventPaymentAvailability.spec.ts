import { describe, expect, it } from "vitest";
import {
  eventHasPaidCategories,
  isCategoryPaidCheckoutBlocked,
  isPaidCheckoutUnavailable,
} from "@/utils/eventPaymentAvailability";

describe("eventPaymentAvailability", () => {
  const paid = { price_cents: 30_000 };
  const free = { price_cents: 0 };

  it("detects paid categories", () => {
    expect(eventHasPaidCategories([free])).toBe(false);
    expect(eventHasPaidCategories([paid])).toBe(true);
  });

  it("blocks paid checkout when payments_available is false", () => {
    expect(isPaidCheckoutUnavailable([paid], false)).toBe(true);
    expect(isPaidCheckoutUnavailable([paid], true)).toBe(false);
    expect(isPaidCheckoutUnavailable([free], false)).toBe(false);
  });

  it("blocks only paid categories individually", () => {
    expect(isCategoryPaidCheckoutBlocked(paid, false)).toBe(true);
    expect(isCategoryPaidCheckoutBlocked(free, false)).toBe(false);
  });
});

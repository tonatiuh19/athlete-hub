import { describe, it, expect } from "vitest";
import { registrationCheckoutIsReady } from "@/utils/registrationCheckoutPayment";

const baseCheckout = {
  paymentPublicUuid: "pay-1",
  clientSecret: "pi_secret",
  amountCents: 72200,
  registrationAmountCents: 65000,
  serviceFeeCents: 7200,
  currency: "MXN",
  categoryName: "Trail 10K",
  eventTitle: "Trail Nevado",
};

describe("smoke: registration checkout payment readiness", () => {
  it("requires clientSecret for paid checkout", () => {
    expect(registrationCheckoutIsReady(baseCheckout, 72200)).toBe(true);
    expect(
      registrationCheckoutIsReady({ ...baseCheckout, clientSecret: null }, 72200),
    ).toBe(false);
  });

  it("requires matching discount code and total", () => {
    expect(
      registrationCheckoutIsReady(
        { ...baseCheckout, discountCode: "EARLY10", amountCents: 65000 },
        65000,
        "EARLY10",
      ),
    ).toBe(true);
    expect(
      registrationCheckoutIsReady(
        { ...baseCheckout, discountCode: "EARLY10", amountCents: 65000 },
        72200,
        "EARLY10",
      ),
    ).toBe(false);
  });

  it("allows $0 checkout without clientSecret", () => {
    expect(
      registrationCheckoutIsReady(
        {
          ...baseCheckout,
          amountCents: 0,
          clientSecret: null,
          discountCode: "FREE100",
        },
        0,
        "FREE100",
      ),
    ).toBe(true);
  });
});

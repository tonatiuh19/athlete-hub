import { describe, it, expect } from "vitest";
import registrationCheckoutReducer, {
  setDiscountCodeInput,
  validateDiscountCode,
} from "@/store/slices/registrationCheckoutSlice";
import {
  resolveAppliedDiscountCode,
  shouldInvalidateCheckoutForDiscount,
} from "@/utils/registrationCheckoutDiscount";
import type { DiscountValidateResponse } from "@shared/api";

const preview: DiscountValidateResponse = {
  valid: true,
  code: "EARLY10",
  discountCodeId: 5,
  discountType: "percent",
  discountValue: 10,
  appliesTo: "total",
  discountAmountCents: 10550,
  priceCents: 85500,
  serviceFeeCents: 9450,
  totalCents: 94950,
  originalPriceCents: 95000,
  originalServiceFeeCents: 10450,
  originalTotalCents: 105450,
};

describe("smoke: registration checkout discount helpers", () => {
  it("resolveAppliedDiscountCode only returns code after successful validation", () => {
    expect(resolveAppliedDiscountCode(preview, "EARLY10")).toBe("EARLY10");
    expect(resolveAppliedDiscountCode(null, "EARLY10")).toBeUndefined();
    expect(resolveAppliedDiscountCode(preview, "OTHER")).toBeUndefined();
    expect(resolveAppliedDiscountCode(preview, "  ")).toBeUndefined();
  });

  it("shouldInvalidateCheckoutForDiscount when code or total changes", () => {
    const checkout = {
      paymentPublicUuid: "pay-1",
      clientSecret: "pi_secret",
      amountCents: 105450,
      registrationAmountCents: 95000,
      serviceFeeCents: 10450,
      currency: "MXN",
      categoryName: "Trail 21K",
      eventTitle: "Trail",
      discountCode: "OLD",
      discountAmountCents: 0,
    };

    expect(
      shouldInvalidateCheckoutForDiscount(checkout, preview, preview.code),
    ).toBe(true);
    expect(shouldInvalidateCheckoutForDiscount(null, preview, preview.code)).toBe(
      false,
    );
    expect(
      shouldInvalidateCheckoutForDiscount(
        { ...checkout, amountCents: preview.totalCents, discountCode: "EARLY10" },
        preview,
        preview.code,
      ),
    ).toBe(false);
  });
});

describe("smoke: registration checkout discount Redux invalidation", () => {
  it("setDiscountCodeInput clears preview but keeps checkout while user is typing", () => {
    let state = registrationCheckoutReducer(undefined, { type: "@@INIT" });
    state = {
      ...state,
      checkout: {
        paymentPublicUuid: "pay-1",
        clientSecret: "pi_secret",
        amountCents: 105450,
        registrationAmountCents: 95000,
        serviceFeeCents: 10450,
        currency: "MXN",
        categoryName: "Trail 21K",
        eventTitle: "Trail",
        discountCode: "EARLY10",
        discountAmountCents: 10550,
      },
      discountCode: "EARLY10",
      discountPreview: preview,
    };

    state = registrationCheckoutReducer(state, setDiscountCodeInput("NEWCODE"));
    expect(state.discountPreview).toBeNull();
    expect(state.discountCode).toBe("NEWCODE");
    expect(state.checkout?.paymentPublicUuid).toBe("pay-1");
  });

  it("validateDiscountCode.fulfilled invalidates checkout when totals change", () => {
    let state = registrationCheckoutReducer(undefined, { type: "@@INIT" });
    state = {
      ...state,
      checkout: {
        paymentPublicUuid: "pay-1",
        clientSecret: "pi_secret",
        amountCents: 105450,
        registrationAmountCents: 95000,
        serviceFeeCents: 10450,
        currency: "MXN",
        categoryName: "Trail 21K",
        eventTitle: "Trail",
      },
    };

    state = registrationCheckoutReducer(
      state,
      validateDiscountCode.fulfilled(preview, "", {
        slug: "trail",
        code: "EARLY10",
        categoryId: 10,
      }),
    );

    expect(state.discountPreview?.code).toBe("EARLY10");
    expect(state.checkout).toBeNull();
  });
});

// @vitest-environment jsdom
/**
 * End-to-end registration flow invariants (today's implementation).
 * Documents and enforces contracts across auth → checkout → payment layers.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { registrationCheckoutIsReady } from "@/utils/registrationCheckoutPayment";
import { resolveAppliedDiscountCode } from "@/utils/registrationCheckoutDiscount";
import { clerkSsoCallbackUrl } from "@/utils/clerkSso";
import { resolveSsoReturnTo, stashSsoReturnTo } from "@/utils/ssoReturnStorage";
import { loadRegistrationSession, saveRegistrationSession } from "@/utils/registrationSessionStorage";
import registrationCheckoutReducer, {
  openRegistrationWizard,
  setDiscountCodeInput,
  validateDiscountCode,
} from "@/store/slices/registrationCheckoutSlice";
import type { DiscountValidateResponse } from "@shared/api";

const preview: DiscountValidateResponse = {
  valid: true,
  code: "PROMO2026",
  discountCodeId: 1,
  discountType: "percent",
  discountValue: 10,
  appliesTo: "total",
  discountAmountCents: 7220,
  priceCents: 58500,
  serviceFeeCents: 6480,
  totalCents: 64980,
  originalPriceCents: 65000,
  originalServiceFeeCents: 7200,
  originalTotalCents: 72200,
  feePresentation: "pass_through",
  displayIvaCents: 11552,
  organizerFiscalNetCents: 58500,
};

describe("audit: registration flow invariants", () => {
  const store = new Map<string, string>();

  beforeEach(() => {
    vi.stubGlobal("sessionStorage", {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
    });
    store.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    store.clear();
  });

  describe("checkout payment UX", () => {
    it("paid checkout is not UI-ready without clientSecret", () => {
      expect(
        registrationCheckoutIsReady(
          {
            paymentPublicUuid: "pay-1",
            clientSecret: null,
            amountCents: 72200,
            registrationAmountCents: 65000,
            serviceFeeCents: 7200,
            currency: "MXN",
            categoryName: "10K",
            eventTitle: "Trail",
          },
          72200,
        ),
      ).toBe(false);
    });

    it("unapplied promo text must not affect checkout payload", () => {
      expect(resolveAppliedDiscountCode(null, "PROMO2026")).toBeUndefined();
      expect(resolveAppliedDiscountCode(preview, "PROMO2026")).toBe("PROMO2026");
    });

    it("typing promo must not drop checkout before Apply", () => {
      let state = registrationCheckoutReducer(undefined, { type: "@@INIT" });
      state = {
        ...state,
        checkout: {
          paymentPublicUuid: "pay-1",
          clientSecret: "pi_secret",
          amountCents: 72200,
          registrationAmountCents: 65000,
          serviceFeeCents: 7200,
          currency: "MXN",
          categoryName: "10K",
          eventTitle: "Trail",
        },
      };
      state = registrationCheckoutReducer(state, setDiscountCodeInput("PROMO2026"));
      expect(state.checkout?.clientSecret).toBe("pi_secret");
    });

    it("Apply promo invalidates stale payment intent totals", () => {
      let state = registrationCheckoutReducer(undefined, { type: "@@INIT" });
      state = {
        ...state,
        checkout: {
          paymentPublicUuid: "pay-1",
          clientSecret: "pi_secret",
          amountCents: 72200,
          registrationAmountCents: 65000,
          serviceFeeCents: 7200,
          currency: "MXN",
          categoryName: "10K",
          eventTitle: "Trail",
        },
      };
      state = registrationCheckoutReducer(
        state,
        validateDiscountCode.fulfilled(preview, "", {
          slug: "trail",
          code: "PROMO2026",
          categoryId: 3,
        }),
      );
      expect(state.checkout).toBeNull();
      expect(state.discountPreview?.totalCents).toBe(64980);
    });
  });

  describe("session persistence", () => {
    it("persists payment sub-step for reload resume", () => {
      saveRegistrationSession({
        eventSlug: "trail-nevado-toluca-2026",
        categoryId: 3,
        idempotencyKey: "idem-audit",
        step: "checkout",
        checkoutPaymentReady: true,
        fieldValues: { shirt_size: "M" },
      });
      const restored = loadRegistrationSession("trail-nevado-toluca-2026", 3);
      expect(restored?.checkoutPaymentReady).toBe(true);
      expect(restored?.fieldValues?.shirt_size).toBe("M");
    });
  });

  describe("OAuth return path", () => {
    it("keeps Clerk callback URL clean and stashes returnTo separately", () => {
      stashSsoReturnTo("/events/trail-nevado-toluca-2026");
      expect(clerkSsoCallbackUrl()).not.toContain("returnTo");
      expect(resolveSsoReturnTo(null)).toBe("/events/trail-nevado-toluca-2026");
    });
  });

  describe("wizard open resets transient payment state", () => {
    it("clears checkout and discount when opening a new registration", () => {
      let state = registrationCheckoutReducer(undefined, { type: "@@INIT" });
      state = {
        ...state,
        checkout: {
          paymentPublicUuid: "old",
          clientSecret: "pi",
          amountCents: 100,
          registrationAmountCents: 100,
          serviceFeeCents: 0,
          currency: "MXN",
          categoryName: "X",
          eventTitle: "Y",
        },
        discountCode: "OLD",
        discountPreview: preview,
      };
      state = registrationCheckoutReducer(
        state,
        openRegistrationWizard({
          slug: "trail",
          category: {
            id: 3,
            name: "10K",
            sold_count: 0,
            price_cents: 65000,
            gender_restriction: "all",
            sort_order: 0,
          },
        }),
      );
      expect(state.checkout).toBeNull();
      expect(state.discountCode).toBe("");
      expect(state.discountPreview).toBeNull();
    });
  });
});

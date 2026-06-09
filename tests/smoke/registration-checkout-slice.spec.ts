import { describe, it, expect } from "vitest";
import registrationCheckoutReducer, {
  confirmRegistration,
  openRegistrationResult,
  openRegistrationWizard,
  resumeRegistrationCheckout,
} from "@/store/slices/registrationCheckoutSlice";
import fixtures from "../fixtures/registration-flow.json";

const mockCategory = {
  id: 10,
  name: "10K Elite",
  sold_count: 0,
  price_cents: 80000,
  gender_restriction: "all",
  sort_order: 0,
};

describe("smoke: registration checkout Redux state machine", () => {
  it("openRegistrationWizard resets transient checkout state", () => {
    let state = registrationCheckoutReducer(undefined, { type: "@@INIT" });
    state = registrationCheckoutReducer(
      state,
      openRegistrationWizard({ slug: "mock-event", category: mockCategory }),
    );
    expect(state.open).toBe(true);
    expect(state.step).toBe("auth");
    expect(state.checkout).toBeNull();
    expect(state.pending3dsClientSecret).toBeNull();
  });

  it("confirmRegistration.rejected with requiresAction keeps user on checkout (saved-card 3DS)", () => {
    let state = registrationCheckoutReducer(undefined, { type: "@@INIT" });
    state = {
      ...state,
      open: true,
      step: "checkout",
      checkout: {
        paymentPublicUuid: "pay-mock",
        clientSecret: "pi_secret",
        amountCents: 85000,
        registrationAmountCents: 80000,
        serviceFeeCents: 5000,
        currency: "MXN",
        categoryName: "10K Elite",
        eventTitle: "Mock Marathon",
      },
    };

    state = registrationCheckoutReducer(
      state,
      confirmRegistration.rejected(
        {
          name: "registrationCheckout/confirm",
          message: "Rejected",
        },
        "",
        undefined,
        {
          message: fixtures.confirmRequiresAction.error,
          requiresAction: true,
          clientSecret: fixtures.confirmRequiresAction.clientSecret,
        },
      ),
    );

    expect(state.step).toBe("checkout");
    expect(state.pending3dsClientSecret).toBe("pi_mock_secret_requires_action");
    expect(state.paymentFailed).toBe(false);
  });

  it("confirmRegistration.fulfilled clears pending checkout banner state", () => {
    let state = registrationCheckoutReducer(undefined, { type: "@@INIT" });
    state = {
      ...state,
      pendingCheckout: fixtures.pendingCheckoutResponse.pending[0],
      step: "checkout",
    };

    state = registrationCheckoutReducer(
      state,
      confirmRegistration.fulfilled(fixtures.confirmSuccess, "", {
        slug: "mock-marathon-2026",
        paymentPublicUuid: "pay-mock-uuid-001",
      }),
    );

    expect(state.step).toBe("result");
    expect(state.pendingCheckout).toBeNull();
    expect(state.confirmResult?.registration?.registration_number).toMatch(/^EVT-/);
  });

  it("resumeRegistrationCheckout complete transitions to result", () => {
    let state = registrationCheckoutReducer(undefined, { type: "@@INIT" });
    state = registrationCheckoutReducer(
      state,
      resumeRegistrationCheckout.fulfilled(
        {
          status: "complete",
          registration: fixtures.confirmSuccess.registration,
        },
        "",
        { slug: "mock-marathon-2026", paymentPublicUuid: "pay-mock-uuid-001" },
      ),
    );
    expect(state.step).toBe("result");
    expect(state.paymentFailed).toBe(false);
    expect(state.pendingCheckout).toBeNull();
  });

  it("openRegistrationResult opens wizard on 3DS return without losing category context", () => {
    let state = registrationCheckoutReducer(undefined, { type: "@@INIT" });
    state = registrationCheckoutReducer(
      state,
      openRegistrationResult({
        slug: "mock-marathon-2026",
        category: mockCategory,
        confirmResult: fixtures.confirmSuccess,
      }),
    );
    expect(state.open).toBe(true);
    expect(state.step).toBe("result");
    expect(state.category?.name).toBe("10K Elite");
  });
});

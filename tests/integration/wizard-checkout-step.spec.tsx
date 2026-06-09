// @vitest-environment jsdom
/**
 * UI integration audit — registration wizard checkout step.
 * Catches regressions the API-only smoke suite cannot (Stripe visibility, phase layout).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { MemoryRouter } from "react-router-dom";
import registrationCheckoutReducer, {
  createRegistrationCheckout,
  fetchPaymentConfig,
} from "@/store/slices/registrationCheckoutSlice";
import athleteAuthReducer from "@/store/slices/athleteAuthSlice";
import paymentMethodsReducer from "@/store/slices/paymentMethodsSlice";
import WizardCheckoutStep from "@/components/events/registration/WizardCheckoutStep";
import type { EventCategory } from "@shared/api";

const checkoutResponse = {
  paymentPublicUuid: "pay-auto",
  clientSecret: "pi_auto_secret",
  amountCents: 72200,
  registrationAmountCents: 65000,
  serviceFeeCents: 7200,
  currency: "MXN",
  categoryName: "Trail 10K",
  eventTitle: "Trail Nevado de Toluca 2026",
};

const mockPost = vi.fn().mockResolvedValue({ data: checkoutResponse });

vi.mock("@/lib/api", () => ({
  default: {
    get: vi.fn().mockResolvedValue({ data: { publishableKey: "pk_test_mock", currency: "MXN" } }),
    post: (...args: unknown[]) => mockPost(...args),
  },
  getAthleteToken: () => "token",
  isClerkEnabled: false,
}));

vi.mock("react-i18next", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-i18next")>();
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string, params?: Record<string, string>) => {
        const labels: Record<string, string> = {
          "eventDetail.inscription": "Registration",
          "eventDetail.serviceFee": "Service fee",
          "eventDetail.total": "Total",
          "registrationWizard.checkout.continueToPayment": "Continue to payment",
          "registrationWizard.checkout.discountLabel": "Discount code",
          "registrationWizard.checkout.discountApply": "Apply",
          "registrationWizard.checkout.discountPlaceholder": "PROMO2026",
          "registrationWizard.checkout.paymentSectionHint": "Enter card below",
          "registrationWizard.checkout.backToDetails": "Back to details",
          "registrationWizard.checkout.retryPaymentSetup": "Retry payment setup",
          "registrationWizard.payment.title": "Payment",
          "registrationWizard.payment.preparing": "Preparing secure card form…",
          "registrationWizard.payment.unavailable": "Payment unavailable",
          "registrationWizard.payment.pay": `Pay ${params?.amount ?? ""}`,
        };
        return labels[key] ?? key;
      },
      i18n: { language: "en" },
    }),
  };
});

vi.mock("@/components/events/registration/StripePaymentForm", () => ({
  default: () => <div data-testid="stripe-payment-form">Stripe card form</div>,
}));

const category: EventCategory = {
  id: 3,
  name: "Trail 10K",
  sold_count: 0,
  price_cents: 65000,
  service_fee_cents: 7200,
  total_cents: 72200,
  gender_restriction: "all",
  sort_order: 0,
};

const paymentConfig = {
  publishableKey: "pk_test_mock",
  currency: "MXN",
};

function makeStore() {
  return configureStore({
    reducer: {
      registrationCheckout: registrationCheckoutReducer,
      athleteAuth: athleteAuthReducer,
      paymentMethods: paymentMethodsReducer,
    },
  });
}

function seedPaymentReadyStore() {
  const store = makeStore();
  store.dispatch(fetchPaymentConfig.fulfilled(paymentConfig, "", undefined));
  store.dispatch(
    createRegistrationCheckout.fulfilled(
      { ...checkoutResponse, fieldValues: {} },
      "",
      {
        slug: "trail-nevado-toluca-2026",
        categoryId: category.id,
        fieldValues: {},
        idempotencyKey: "test-idem-001",
      },
    ),
  );
  return store;
}

function renderStep(
  store: ReturnType<typeof makeStore>,
  props?: Partial<{
    checkoutPaymentReady: boolean;
    onCheckoutPaymentReady: (v: boolean) => void;
  }>,
) {
  const onReady = props?.onCheckoutPaymentReady ?? vi.fn();
  render(
    <Provider store={store}>
      <MemoryRouter>
        <WizardCheckoutStep
          slug="trail-nevado-toluca-2026"
          eventTitle="Trail Nevado de Toluca 2026"
          category={category}
          fields={[]}
          serviceFeePercent={11}
          idempotencyKey="test-idem-001"
          checkoutPaymentReady={props?.checkoutPaymentReady ?? false}
          onCheckoutPaymentReady={onReady}
        />
      </MemoryRouter>
    </Provider>,
  );
  return { onReady };
}

describe("integration: WizardCheckoutStep UI audit", () => {
  beforeEach(() => {
    cleanup();
    mockPost.mockClear();
    mockPost.mockResolvedValue({ data: checkoutResponse });
  });

  afterEach(() => {
    cleanup();
  });

  it("details phase: no discount field, shows Continue to payment", () => {
    const store = makeStore();
    store.dispatch(fetchPaymentConfig.fulfilled(paymentConfig, "", undefined));
    renderStep(store);

    expect(screen.getByRole("button", { name: "Continue to payment" })).toBeTruthy();
    expect(screen.queryByText("Discount code")).toBeNull();
    expect(screen.queryByTestId("stripe-payment-form")).toBeNull();
  });

  it("payment phase: shows discount + Stripe form when checkout is ready", () => {
    const store = seedPaymentReadyStore();
    renderStep(store, { checkoutPaymentReady: true });

    expect(screen.getByText("Discount code")).toBeTruthy();
    expect(screen.getByTestId("stripe-payment-form")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Continue to payment/i })).toBeNull();
  });

  it("payment phase: auto-creates checkout and mounts Stripe without a pre-pay button", async () => {
    const store = makeStore();
    store.dispatch(fetchPaymentConfig.fulfilled(paymentConfig, "", undefined));
    renderStep(store, { checkoutPaymentReady: true });

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith(
        "/events/trail-nevado-toluca-2026/register/checkout",
        expect.objectContaining({
          categoryId: category.id,
          idempotencyKey: "test-idem-001",
        }),
      );
    });

    await waitFor(() => {
      expect(screen.getByTestId("stripe-payment-form")).toBeTruthy();
    });

    expect(screen.queryByRole("button", { name: /^Pay /i })).toBeNull();
  });

  it("transition: Continue to payment reveals discount section", async () => {
    const user = userEvent.setup();
    const store = makeStore();
    store.dispatch(fetchPaymentConfig.fulfilled(paymentConfig, "", undefined));
    const { onReady } = renderStep(store);

    await user.click(screen.getByRole("button", { name: "Continue to payment" }));
    expect(onReady).toHaveBeenCalledWith(true);

    await waitFor(() => {
      expect(screen.getByText("Discount code")).toBeTruthy();
    });
  });
});

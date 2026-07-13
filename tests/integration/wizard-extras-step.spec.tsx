// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import registrationCheckoutReducer from "@/store/slices/registrationCheckoutSlice";
import WizardExtrasStep from "@/components/events/registration/WizardExtrasStep";
import type { EventExtra } from "@shared/api";

const extras: EventExtra[] = [
  {
    id: 1,
    public_uuid: "e-1",
    name: "Official Tee",
    description: "Race shirt",
    price_cents: 4_500,
    currency: "MXN",
    image_url: null,
    extra_type: "merch",
    max_per_athlete: 2,
    capacity: null,
    sold_count: 0,
    sort_order: 0,
  },
];

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "en" },
  }),
}));

function renderStep(overrides?: Partial<Parameters<typeof WizardExtrasStep>[0]>) {
  const store = configureStore({
    reducer: { registrationCheckout: registrationCheckoutReducer },
  });
  const view = render(
    <Provider store={store}>
      <WizardExtrasStep
        extras={extras}
        serviceFeePercent={11}
        feePresentation="pass_through"
        {...overrides}
      />
    </Provider>,
  );
  return { store, ...view };
}

describe("integration: WizardExtrasStep", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("starts with zero quantity for optional extras", () => {
    renderStep();
    expect(screen.getByText("Official Tee")).toBeTruthy();
    expect(screen.getAllByText("0").length).toBeGreaterThanOrEqual(1);
  });

  it("skip clears selection and advances to checkout step", async () => {
    const user = userEvent.setup();
    const { store } = renderStep();

    await user.click(
      screen.getByRole("button", { name: "registrationWizard.extras.skip" }),
    );

    expect(store.getState().registrationCheckout.selectedExtras).toEqual([]);
    expect(store.getState().registrationCheckout.step).toBe("checkout");
  });

  it("continue stores selected extras and advances to checkout", async () => {
    const user = userEvent.setup();
    const { store } = renderStep();

    const plusButtons = screen.getAllByRole("button").filter((btn) => {
      return btn.querySelector("svg")?.getAttribute("class")?.includes("lucide-plus");
    });
    await user.click(plusButtons[0]!);

    await user.click(
      screen.getByRole("button", { name: "registrationWizard.extras.continue" }),
    );

    const selected = store.getState().registrationCheckout.selectedExtras;
    expect(selected).toContainEqual({ extraId: 1, quantity: 1 });
    expect(store.getState().registrationCheckout.step).toBe("checkout");
  });

  it("shows sold-out state and hides quantity controls", () => {
    const soldOutExtras: EventExtra[] = [
      {
        ...extras[0],
        id: 3,
        name: "VIP Parking",
        capacity: 2,
        sold_count: 2,
      },
    ];
    renderStep({ extras: soldOutExtras });

    expect(screen.getByText("registrationWizard.extras.soldOut")).toBeTruthy();
  });
});

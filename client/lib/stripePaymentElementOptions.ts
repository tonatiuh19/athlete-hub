import type { StripePaymentElementOptions } from "@stripe/stripe-js";

const STRIPE_BUSINESS_DISPLAY_NAME =
  import.meta.env.VITE_STRIPE_BUSINESS_DISPLAY_NAME?.trim() || "Triboo Sport";

/** Shared Payment Element config — card only, no Stripe Link "save for faster checkout". */
export const stripePaymentElementOptions: StripePaymentElementOptions = {
  layout: "tabs",
  wallets: {
    link: "never",
  },
  business: {
    name: STRIPE_BUSINESS_DISPLAY_NAME,
  },
};

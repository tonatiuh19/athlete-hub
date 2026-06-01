import type { StripePaymentElementOptions } from "@stripe/stripe-js";

/** Shared Payment Element config — card only, no Stripe Link "save for faster checkout". */
export const stripePaymentElementOptions: StripePaymentElementOptions = {
  layout: "tabs",
  wallets: {
    link: "never",
  },
};

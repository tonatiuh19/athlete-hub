import { describe, expect, it } from "vitest";
import {
  buildStripeRefundParams,
  isConnectDestinationPayment,
} from "../../server/stripeRefunds.js";

describe("stripeRefunds", () => {
  it("detects destination charges via transfer id", () => {
    expect(
      isConnectDestinationPayment({
        stripe_payment_intent_id: "pi_test",
        stripe_transfer_id: "tr_test",
      }),
    ).toBe(true);
  });

  it("detects destination charges via metadata", () => {
    expect(
      isConnectDestinationPayment({
        stripe_payment_intent_id: "pi_test",
        metadata_json: { connect_charge_mode: "destination" },
      }),
    ).toBe(true);
  });

  it("treats platform charges as non-destination", () => {
    expect(
      isConnectDestinationPayment({
        stripe_payment_intent_id: "pi_test",
        metadata_json: { connect_charge_mode: "platform_legacy" },
      }),
    ).toBe(false);
  });

  it("adds transfer reversal only for destination charges", () => {
    expect(
      buildStripeRefundParams("pi_dest", {
        stripe_payment_intent_id: "pi_dest",
        metadata_json: { connect_charge_mode: "destination" },
      }),
    ).toEqual({
      payment_intent: "pi_dest",
      reverse_transfer: true,
      refund_application_fee: true,
    });

    expect(
      buildStripeRefundParams("pi_plat", {
        stripe_payment_intent_id: "pi_plat",
        metadata_json: { connect_charge_mode: "platform_legacy" },
      }),
    ).toEqual({ payment_intent: "pi_plat" });
  });
});

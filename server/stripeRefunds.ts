import type Stripe from "stripe";

type PaymentRefundRow = {
  stripe_payment_intent_id: string | null;
  stripe_transfer_id?: string | null;
  metadata_json?: unknown;
};

function parseConnectChargeMode(metadata: unknown): string | null {
  if (!metadata) return null;
  try {
    const parsed =
      typeof metadata === "string" ? (JSON.parse(metadata) as Record<string, unknown>) : metadata;
    const mode = (parsed as Record<string, unknown>)?.connect_charge_mode;
    return typeof mode === "string" ? mode : null;
  } catch {
    return null;
  }
}

/** Destination Connect charges need transfer/fee reversal; platform charges do not. */
export function isConnectDestinationPayment(payment: PaymentRefundRow): boolean {
  if (payment.stripe_transfer_id) return true;
  return parseConnectChargeMode(payment.metadata_json) === "destination";
}

export function buildStripeRefundParams(
  paymentIntentId: string,
  payment: PaymentRefundRow,
): Stripe.RefundCreateParams {
  if (isConnectDestinationPayment(payment)) {
    return {
      payment_intent: paymentIntentId,
      reverse_transfer: true,
      refund_application_fee: true,
    };
  }
  return { payment_intent: paymentIntentId };
}

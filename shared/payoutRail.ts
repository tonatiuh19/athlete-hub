/** Payout/checkout rail resolution — Stripe vs Mercado Pago. */

export type PayoutRail = "stripe" | "mercadopago";

export type MercadoPagoOauthStatus =
  | "not_started"
  | "pending"
  | "ready"
  | "revoked"
  | "error";

export const DEFAULT_MP_SERVICE_FEE_PERCENT = 13;

export function isPayoutRail(value: unknown): value is PayoutRail {
  return value === "stripe" || value === "mercadopago";
}

/**
 * When event override is set, it wins.
 * Else MP rail uses fixed 13%; Stripe uses org percent (default 11%).
 */
export function resolveServiceFeePercentForRail(opts: {
  eventFee?: number | string | null;
  organizerFee?: number | string | null;
  rail: PayoutRail;
  defaultStripePercent?: number;
  defaultMpPercent?: number;
}): number {
  const eventNum =
    opts.eventFee != null && opts.eventFee !== "" ? Number(opts.eventFee) : NaN;
  if (Number.isFinite(eventNum) && eventNum >= 0) return eventNum;

  if (opts.rail === "mercadopago") {
    return opts.defaultMpPercent ?? DEFAULT_MP_SERVICE_FEE_PERCENT;
  }

  const orgNum =
    opts.organizerFee != null && opts.organizerFee !== ""
      ? Number(opts.organizerFee)
      : NaN;
  if (Number.isFinite(orgNum) && orgNum >= 0) return orgNum;
  return opts.defaultStripePercent ?? 11;
}

export type CheckoutRailResolution =
  | { ok: true; rail: PayoutRail; fallback: boolean }
  | { ok: false; code: "organizer_payouts_not_ready"; message: string };

/**
 * Preferred rail if ready; else the other rail if ready; else blocked.
 * Simulations should force Stripe/mock and skip this helper.
 */
export function resolveCheckoutRail(opts: {
  preferred: PayoutRail;
  stripeReady: boolean;
  mpReady: boolean;
}): CheckoutRailResolution {
  const preferred = opts.preferred;
  const other: PayoutRail = preferred === "stripe" ? "mercadopago" : "stripe";
  const ready = (rail: PayoutRail) =>
    rail === "stripe" ? opts.stripeReady : opts.mpReady;

  if (ready(preferred)) {
    return { ok: true, rail: preferred, fallback: false };
  }
  if (ready(other)) {
    return { ok: true, rail: other, fallback: true };
  }
  return {
    ok: false,
    code: "organizer_payouts_not_ready",
    message: "Registration payments are temporarily unavailable for this event",
  };
}

export function isMercadoPagoReady(status: MercadoPagoOauthStatus | string | null | undefined): boolean {
  return status === "ready";
}

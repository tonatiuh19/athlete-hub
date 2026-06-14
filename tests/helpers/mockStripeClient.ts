import { vi } from "vitest";
import type Stripe from "stripe";

export type MockStripeOptions = {
  accountId?: string;
  paymentIntentId?: string;
  clientSecret?: string;
  transferId?: string;
  applicationFeeId?: string;
  chargeId?: string;
  accountReady?: boolean;
};

export type MockStripeClient = Stripe & {
  createdPaymentIntents: Stripe.PaymentIntentCreateParams[];
  refundCalls: Stripe.RefundCreateParams[];
};

export function createMockStripeClient(
  opts: MockStripeOptions = {},
): MockStripeClient {
  const accountId = opts.accountId ?? "acct_test_ready";
  const piId = opts.paymentIntentId ?? "pi_test_mock";
  const clientSecret = opts.clientSecret ?? "pi_test_mock_secret";
  const chargeId = opts.chargeId ?? "ch_test_mock";
  const transferId = opts.transferId ?? "tr_test_mock";
  const applicationFeeId = opts.applicationFeeId ?? "fee_test_mock";
  const accountReady = opts.accountReady !== false;

  const createdPaymentIntents: Stripe.PaymentIntentCreateParams[] = [];
  const refundCalls: Stripe.RefundCreateParams[] = [];

  const paymentIntentBase = (): Stripe.PaymentIntent =>
    ({
      id: piId,
      object: "payment_intent",
      client_secret: clientSecret,
      status: "requires_payment_method",
      amount: 88_800,
      currency: "mxn",
      metadata: {},
      latest_charge: chargeId,
    }) as Stripe.PaymentIntent;

  return {
    createdPaymentIntents,
    refundCalls,
    paymentIntents: {
      create: vi.fn(async (params: Stripe.PaymentIntentCreateParams) => {
        createdPaymentIntents.push(params);
        return {
          ...paymentIntentBase(),
          amount: params.amount ?? 0,
          currency: params.currency ?? "mxn",
          metadata: params.metadata ?? {},
        };
      }),
      retrieve: vi.fn(async (id: string) => ({
        ...paymentIntentBase(),
        id,
        status: "succeeded",
        metadata: { payment_public_uuid: "pay-from-webhook" },
      })),
      update: vi.fn(async (id: string, params: Stripe.PaymentIntentUpdateParams) => ({
        ...paymentIntentBase(),
        id,
        ...params,
      })),
      confirm: vi.fn(async (id: string) => ({
        ...paymentIntentBase(),
        id,
        status: "succeeded",
      })),
      cancel: vi.fn(async (id: string) => ({
        ...paymentIntentBase(),
        id,
        status: "canceled",
      })),
    },
    accounts: {
      retrieve: vi.fn(async (id: string) =>
        ({
          id,
          object: "account",
          charges_enabled: accountReady,
          payouts_enabled: accountReady,
          details_submitted: accountReady,
          requirements: {
            currently_due: accountReady ? [] : ["individual.verification.document"],
            disabled_reason: accountReady ? null : "requirements.past_due",
          },
        }) as Stripe.Account,
      ),
    },
    customers: {
      create: vi.fn(async () => ({ id: "cus_test_mock" }) as Stripe.Customer),
      retrieve: vi.fn(async (id: string) =>
        ({
          id,
          object: "customer",
          invoice_settings: { default_payment_method: null },
        }) as Stripe.Customer,
      ),
      update: vi.fn(async (id: string) => ({ id }) as Stripe.Customer),
    },
    charges: {
      retrieve: vi.fn(async () =>
        ({
          id: chargeId,
          transfer: transferId,
          application_fee: applicationFeeId,
        }) as Stripe.Charge,
      ),
    },
    refunds: {
      create: vi.fn(async (params: Stripe.RefundCreateParams) => {
        refundCalls.push(params);
        return { id: "re_test_mock", ...params } as Stripe.Refund;
      }),
    },
    webhooks: {
      constructEvent: vi.fn(
        (body: Buffer | string, _sig: string, _secret: string) =>
          JSON.parse(typeof body === "string" ? body : body.toString()),
      ),
    },
  } as unknown as MockStripeClient;
}

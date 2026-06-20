/**
 * @vitest-environment node
 *
 * HTTP smoke: Stripe Connect destination charges, payout gating, webhooks.
 * Uses in-memory ScenarioDb + mock Stripe client — no TiDB or live Stripe API.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import request from "supertest";
import type { Express } from "express";
import type Stripe from "stripe";
import { seeds, SCENARIO } from "../helpers/scenarioDb";
import {
  mountRegistrationScenario,
  teardownHttpScenario,
} from "../helpers/httpHarness";
import {
  createMockStripeClient,
  type MockStripeClient,
} from "../helpers/mockStripeClient";

describe("HTTP smoke: Stripe Connect checkout gating", () => {
  afterEach(async () => {
    await teardownHttpScenario();
  });

  it("blocks checkout when organizer is not Connect-ready (no platform fallback)", async () => {
    const stripe = createMockStripeClient({ accountReady: false });
    const { app, authHeader } = await mountRegistrationScenario(
      seeds.paidConnectNotReady(),
      { stripe },
    );

    const res = await request(app)
      .post(`/api/events/${SCENARIO.slug}/register/checkout`)
      .set("Authorization", authHeader)
      .send({
        categoryId: SCENARIO.categoryId,
        fieldValues: {},
        idempotencyKey: "idem-connect-not-ready",
      });

    expect(res.status).toBe(503);
    expect(res.body.code).toBe("organizer_payouts_not_ready");
    expect(stripe.paymentIntents.create).not.toHaveBeenCalled();
  });

  it("returns 503 organizer_payouts_disabled when admin disabled payouts", async () => {
    const stripe = createMockStripeClient();
    const { app, authHeader } = await mountRegistrationScenario(
      seeds.paidConnectDisabled(),
      { stripe },
    );

    const res = await request(app)
      .post(`/api/events/${SCENARIO.slug}/register/checkout`)
      .set("Authorization", authHeader)
      .send({
        categoryId: SCENARIO.categoryId,
        fieldValues: {},
        idempotencyKey: "idem-connect-disabled",
      });

    expect(res.status).toBe(503);
    expect(res.body.code).toBe("organizer_payouts_disabled");
  });

  it("creates Connect destination charge when organizer is payout-ready", async () => {
    const stripe = createMockStripeClient({ accountId: "acct_test_ready" });
    const { app, authHeader } = await mountRegistrationScenario(
      seeds.paidConnectReady(),
      { stripe },
    );

    const res = await request(app)
      .post(`/api/events/${SCENARIO.slug}/register/checkout`)
      .set("Authorization", authHeader)
      .send({
        categoryId: SCENARIO.categoryId,
        fieldValues: {},
        idempotencyKey: "idem-connect-ready",
      });

    expect(res.status).toBe(200);
    expect(res.body.clientSecret).toBe("pi_test_mock_secret");
    expect(res.body.amountCents).toBe(88_800);
    expect(res.body.serviceFeeCents).toBe(8_800);

    expect(stripe.createdPaymentIntents).toHaveLength(1);
    const piParams = stripe.createdPaymentIntents[0]!;
    expect(piParams.transfer_data).toEqual({ destination: "acct_test_ready" });
    expect(piParams.application_fee_amount).toBe(8_800);
    expect(stripe.customers.create).toHaveBeenCalled();
  });

  it("creates absorb-all checkout: athlete pays sticker, organizer transfer = sticker − fee", async () => {
    const stripe = createMockStripeClient({ accountId: "acct_test_ready" });
    const { app, authHeader, db } = await mountRegistrationScenario(
      seeds.paidConnectAbsorbAll(),
      { stripe },
    );

    const res = await request(app)
      .post(`/api/events/${SCENARIO.slug}/register/checkout`)
      .set("Authorization", authHeader)
      .send({
        categoryId: SCENARIO.categoryId,
        fieldValues: {},
        idempotencyKey: "idem-absorb-all",
      });

    expect(res.status).toBe(200);
    expect(res.body.amountCents).toBe(100_000);
    expect(res.body.serviceFeeCents).toBe(11_000);
    expect(res.body.registrationAmountCents).toBe(89_000);
    expect(res.body.feePresentation).toBe("absorb_all");

    const piParams = stripe.createdPaymentIntents[0]!;
    expect(piParams.amount).toBe(100_000);
    expect(piParams.application_fee_amount).toBe(11_000);

    const pay = db.payments.find((p) => p.public_uuid === res.body.paymentPublicUuid);
    expect(pay?.amount_cents).toBe(100_000);
    expect(pay?.registration_amount_cents).toBe(89_000);
    expect(pay?.service_fee_cents).toBe(11_000);
    const meta = JSON.parse(String(pay?.metadata_json ?? "{}")) as {
      breakdown?: { organizerFiscalNetCents?: number };
    };
    expect(meta.breakdown?.organizerFiscalNetCents).toBe(73_000);
  });

  it("confirm completes registration and stores Connect transfer/fee ids", async () => {
    const stripe = createMockStripeClient({
      transferId: "tr_confirm_test",
      applicationFeeId: "fee_confirm_test",
    });
    const { app, authHeader, db } = await mountRegistrationScenario(
      seeds.paidConnectReady(),
      { stripe },
    );

    const checkout = await request(app)
      .post(`/api/events/${SCENARIO.slug}/register/checkout`)
      .set("Authorization", authHeader)
      .send({
        categoryId: SCENARIO.categoryId,
        fieldValues: {},
        idempotencyKey: "idem-connect-confirm",
      });

    expect(checkout.status).toBe(200);
    const payUuid = checkout.body.paymentPublicUuid as string;

    vi.mocked(stripe.paymentIntents.retrieve).mockImplementation(
      (async (id: string) =>
        ({
          id,
          object: "payment_intent",
          status: "succeeded",
          amount: checkout.body.amountCents,
          latest_charge: "ch_test_mock",
          metadata: { payment_public_uuid: payUuid },
        }) as unknown as Stripe.PaymentIntent) as never,
    );

    const confirm = await request(app)
      .post(`/api/events/${SCENARIO.slug}/register/confirm`)
      .set("Authorization", authHeader)
      .send({ paymentPublicUuid: payUuid });

    expect(confirm.status).toBe(200);
    expect(confirm.body.success).toBe(true);
    expect(confirm.body.registration.status).toBe("confirmed");

    const pay = db.payments.find((p) => p.public_uuid === payUuid);
    expect(pay?.status).toBe("succeeded");
    expect(pay?.stripe_transfer_id).toBe("tr_confirm_test");
    expect(pay?.stripe_application_fee_id).toBe("fee_confirm_test");
  });

  it("marks payment failed when Stripe PI creation fails", async () => {
    const stripe = createMockStripeClient();
    vi.mocked(stripe.paymentIntents.create).mockRejectedValueOnce(
      new Error("Stripe API unavailable"),
    );
    const { app, authHeader, db } = await mountRegistrationScenario(
      seeds.paidConnectReady(),
      { stripe },
    );

    const res = await request(app)
      .post(`/api/events/${SCENARIO.slug}/register/checkout`)
      .set("Authorization", authHeader)
      .send({
        categoryId: SCENARIO.categoryId,
        fieldValues: {},
        idempotencyKey: "idem-pi-fail",
      });

    expect(res.status).toBe(503);
    expect(res.body.code).toBe("payment_setup_failed");
    const failed = db.payments.find((p) => p.idempotency_key === "idem-pi-fail");
    expect(failed?.status).toBe("failed");
  });
});

describe("HTTP smoke: Stripe webhook", () => {
  let stripe: MockStripeClient;
  let app: Express;
  let db: Awaited<ReturnType<typeof mountRegistrationScenario>>["db"];

  beforeEach(async () => {
    stripe = createMockStripeClient();
    const mounted = await mountRegistrationScenario(seeds.paidConnectReady(), {
      stripe,
      auth: true,
    });
    app = mounted.app;
    db = mounted.db;

    const checkout = await request(app)
      .post(`/api/events/${SCENARIO.slug}/register/checkout`)
      .set("Authorization", mounted.authHeader)
      .send({
        categoryId: SCENARIO.categoryId,
        fieldValues: {},
        idempotencyKey: "idem-webhook-pi",
      });

    const payUuid = checkout.body.paymentPublicUuid as string;
    db.payments.find((p) => p.public_uuid === payUuid)!.stripe_payment_intent_id =
      "pi_webhook_test";

    vi.mocked(stripe.webhooks.constructEvent).mockImplementation((body) =>
      JSON.parse(typeof body === "string" ? body : body.toString()),
    );
  });

  afterEach(async () => {
    await teardownHttpScenario();
  });

  it("payment_intent.succeeded webhook finalizes registration", async () => {
    const pay = db.payments.find((p) => p.stripe_payment_intent_id === "pi_webhook_test");
    expect(pay).toBeTruthy();

    const event = {
      id: "evt_test_1",
      type: "payment_intent.succeeded",
      data: {
        object: {
          id: "pi_webhook_test",
          status: "succeeded",
          amount: pay!.amount_cents,
          latest_charge: "ch_test_mock",
          metadata: { payment_public_uuid: pay!.public_uuid },
        },
      },
    };

    const res = await request(app)
      .post("/api/webhooks/stripe")
      .set("stripe-signature", "sig_test")
      .set("Content-Type", "application/json")
      .send(JSON.stringify(event));

    expect(res.status).toBe(200);
    expect(res.body.received).toBe(true);
    expect(db.registrations.some((r) => r.athlete_id === SCENARIO.athleteId)).toBe(true);
    expect(pay!.status).toBe("succeeded");
  });

  it("account.updated webhook syncs organizer when not admin-disabled", async () => {
    const event = {
      id: "evt_test_2",
      type: "account.updated",
      data: {
        object: {
          id: "acct_test_ready",
          metadata: { organizer_id: String(SCENARIO.organizerId) },
          charges_enabled: true,
          payouts_enabled: true,
          details_submitted: true,
          requirements: { currently_due: [], disabled_reason: null },
        },
      },
    };

    const res = await request(app)
      .post("/api/webhooks/stripe")
      .set("stripe-signature", "sig_test")
      .set("Content-Type", "application/json")
      .send(JSON.stringify(event));

    expect(res.status).toBe(200);
    expect(db.organizer.stripe_connect_status).toBe("ready");
  });

  it("account.updated does not re-enable admin-disabled organizer", async () => {
    db.organizer.stripe_connect_status = "disabled";

    const event = {
      id: "evt_test_3",
      type: "account.updated",
      data: {
        object: {
          id: "acct_test_disabled",
          metadata: { organizer_id: String(SCENARIO.organizerId) },
          charges_enabled: true,
          payouts_enabled: true,
          details_submitted: true,
          requirements: { currently_due: [], disabled_reason: null },
        },
      },
    };

    await request(app)
      .post("/api/webhooks/stripe")
      .set("stripe-signature", "sig_test")
      .set("Content-Type", "application/json")
      .send(JSON.stringify(event));

    expect(db.organizer.stripe_connect_status).toBe("disabled");
  });

  it("returns duplicate response for already processed webhook events", async () => {
    const event = {
      id: "evt_duplicate_test",
      type: "account.updated",
      data: {
        object: {
          id: "acct_test_ready",
          metadata: { organizer_id: String(SCENARIO.organizerId) },
          charges_enabled: true,
          payouts_enabled: true,
          details_submitted: true,
          requirements: { currently_due: [], disabled_reason: null },
        },
      },
    };

    db.webhookEvents.set("evt_duplicate_test", {
      status: "processed",
      event_type: "account.updated",
      error_message: null,
    });

    const res = await request(app)
      .post("/api/webhooks/stripe")
      .set("stripe-signature", "sig_test")
      .set("Content-Type", "application/json")
      .send(JSON.stringify(event));

    expect(res.status).toBe(200);
    expect(res.body.duplicate).toBe(true);
    expect(db.organizer.stripe_connect_status).toBe("ready");
  });
});

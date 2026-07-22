/**
 * @vitest-environment node
 */
import { describe, it, expect, afterEach } from "vitest";
import request from "supertest";
import {
  mountRegistrationScenario,
  teardownHttpScenario,
  SCENARIO,
} from "../helpers/httpHarness";
import { seeds } from "../helpers/scenarioDb";

describe("HTTP smoke: registration discount in payment flow", () => {
  afterEach(async () => {
    await teardownHttpScenario();
  });

  it("POST discount/validate returns adjusted totals for category", async () => {
    const { app } = await mountRegistrationScenario(seeds.paidWithDiscount());

    const res = await request(app)
      .post(`/api/events/${SCENARIO.slug}/discount/validate`)
      .send({ code: "EARLY10", categoryId: SCENARIO.categoryId });

    expect(res.status).toBe(200);
    expect(res.body.valid).toBe(true);
    expect(res.body.code).toBe("EARLY10");
    expect(res.body.discountAmountCents).toBeGreaterThan(0);
    expect(res.body.totalCents).toBeLessThan(res.body.originalTotalCents);
  });

  it("rejects invalid discount codes", async () => {
    const { app } = await mountRegistrationScenario(seeds.paidWithDiscount());

    const res = await request(app)
      .post(`/api/events/${SCENARIO.slug}/discount/validate`)
      .send({ code: "NOTREAL", categoryId: SCENARIO.categoryId });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/invalid|expired/i);
  });

  it("rejects checkout when discount code is invalid", async () => {
    const { app, authHeader } = await mountRegistrationScenario(seeds.paidWithDiscount());

    const res = await request(app)
      .post(`/api/events/${SCENARIO.slug}/register/checkout`)
      .set("Authorization", authHeader)
      .send({
        categoryId: SCENARIO.categoryId,
        fieldValues: {},
        idempotencyKey: "idem-bad-discount",
        discountCode: "NOTREAL",
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/invalid|expired/i);
  });

  it("idempotent checkout replay updates stored amount when discount is added", async () => {
    const { app, authHeader, db } = await mountRegistrationScenario(
      seeds.paidWithDiscount(),
    );

    db.seedPendingStripeCheckout({
      publicUuid: "pay-discount-replay",
      idempotencyKey: "idem-discount-replay",
      amountCents: 105450,
      metadata: {
        categoryId: SCENARIO.categoryId,
        categoryName: "10K Elite",
        fieldValues: {},
      },
    });

    const validate = await request(app)
      .post(`/api/events/${SCENARIO.slug}/discount/validate`)
      .send({ code: "EARLY10", categoryId: SCENARIO.categoryId });
    expect(validate.status).toBe(200);

    const discounted = await request(app)
      .post(`/api/events/${SCENARIO.slug}/register/checkout`)
      .set("Authorization", authHeader)
      .send({
        categoryId: SCENARIO.categoryId,
        fieldValues: {},
        idempotencyKey: "idem-discount-replay",
        discountCode: "EARLY10",
      });

    expect(discounted.status).toBe(503);
    const pay = db.payments.find((p) => p.public_uuid === "pay-discount-replay");
    expect(pay?.amount_cents).toBe(validate.body.totalCents);
    const meta =
      typeof pay?.metadata_json === "string"
        ? JSON.parse(pay.metadata_json)
        : pay?.metadata_json;
    expect(meta.discountCode).toBe("EARLY10");
  });

  it("100% discount checkout completes without Stripe", async () => {
    const { app, authHeader } = await mountRegistrationScenario(seeds.freeWithFullDiscount());

    const checkout = await request(app)
      .post(`/api/events/${SCENARIO.slug}/register/checkout`)
      .set("Authorization", authHeader)
      .send({
        categoryId: SCENARIO.categoryId,
        fieldValues: {},
        idempotencyKey: "idem-free-discount",
        discountCode: "FREE100",
      });

    expect(checkout.status).toBe(200);
    expect(checkout.body.amountCents).toBe(0);
    expect(checkout.body.clientSecret).toBeNull();

    const confirm = await request(app)
      .post(`/api/events/${SCENARIO.slug}/register/confirm`)
      .set("Authorization", authHeader)
      .send({ paymentPublicUuid: checkout.body.paymentPublicUuid });

    expect(confirm.status).toBe(200);
    expect(confirm.body.success).toBe(true);
  });

  it("paid Stripe checkout resume with 100% discount converts to mock and confirms", async () => {
    const { app, authHeader, db } = await mountRegistrationScenario(
      seeds.freeWithFullDiscount(),
    );

    db.seedPendingStripeCheckout({
      publicUuid: "pay-paid-to-free",
      idempotencyKey: "idem-paid-to-free",
      amountCents: 55500,
      metadata: {
        categoryId: SCENARIO.categoryId,
        categoryName: "10K Elite",
        fieldValues: {},
      },
    });

    const checkout = await request(app)
      .post(`/api/events/${SCENARIO.slug}/register/checkout`)
      .set("Authorization", authHeader)
      .send({
        categoryId: SCENARIO.categoryId,
        fieldValues: {},
        idempotencyKey: "idem-paid-to-free",
        discountCode: "FREE100",
      });

    expect(checkout.status).toBe(200);
    expect(checkout.body.amountCents).toBe(0);
    expect(checkout.body.clientSecret).toBeNull();
    expect(checkout.body.provider).toBe("mock");

    const pay = db.payments.find((p) => p.public_uuid === "pay-paid-to-free");
    expect(pay?.provider).toBe("mock");
    expect(pay?.status).toBe("succeeded");
    expect(pay?.amount_cents).toBe(0);
    expect(pay?.stripe_payment_intent_id).toBeNull();

    const confirm = await request(app)
      .post(`/api/events/${SCENARIO.slug}/register/confirm`)
      .set("Authorization", authHeader)
      .send({ paymentPublicUuid: "pay-paid-to-free" });

    expect(confirm.status).toBe(200);
    expect(confirm.body.success).toBe(true);
  });
});

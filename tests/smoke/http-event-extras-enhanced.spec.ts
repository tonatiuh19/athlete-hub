/**
 * @vitest-environment node
 */
import { describe, it, expect, afterEach } from "vitest";
import request from "supertest";
import { parseCheckoutPaymentMetadata } from "../../server/checkoutMetadata";
import { seeds, SCENARIO } from "../helpers/scenarioDb";
import {
  mountRegistrationScenario,
  teardownHttpScenario,
} from "../helpers/httpHarness";
import { createMockStripeClient } from "../helpers/mockStripeClient";

describe("HTTP smoke: enhanced athlete extras", () => {
  afterEach(async () => {
    await teardownHttpScenario();
  });

  it("GET event detail includes fields on extras", async () => {
    const { app } = await mountRegistrationScenario(seeds.withExtrasAndFields());

    const res = await request(app).get(`/api/events/${SCENARIO.slug}`);

    expect(res.status).toBe(200);
    expect(res.body.extras[0].fields).toHaveLength(1);
    expect(res.body.extras[0].fields[0].field_key).toBe("shirt_size");
  });

  it("rejects checkout when required extra field answers are missing", async () => {
    const { app, authHeader } = await mountRegistrationScenario(seeds.withExtrasAndFields());

    const res = await request(app)
      .post(`/api/events/${SCENARIO.slug}/register/checkout`)
      .set("Authorization", authHeader)
      .send({
        categoryId: SCENARIO.categoryId,
        fieldValues: {},
        idempotencyKey: "idem-missing-extra-answers",
        selectedExtras: [{ extraId: 210, quantity: 1 }],
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/shirt size|required/i);
  });

  it("checkout persists extraFieldAnswers in payment metadata", async () => {
    const stripe = createMockStripeClient({ accountId: "acct_test_ready" });
    const { app, authHeader, db } = await mountRegistrationScenario(
      {
        ...seeds.withExtrasAndFields(),
        organizer: seeds.paidConnectReadyWithExtras().organizer,
        category: { price_cents: 0, capacity: 100 },
      },
      { stripe },
    );

    const res = await request(app)
      .post(`/api/events/${SCENARIO.slug}/register/checkout`)
      .set("Authorization", authHeader)
      .send({
        categoryId: SCENARIO.categoryId,
        fieldValues: {},
        idempotencyKey: "idem-extra-answers",
        selectedExtras: [{ extraId: 210, quantity: 1 }],
        extraFieldAnswers: [{ extraId: 210, values: { shirt_size: "L" } }],
      });

    expect(res.status).toBe(200);

    const pay = db.payments.find((p) => p.idempotency_key === "idem-extra-answers");
    expect(pay).toBeTruthy();
    const meta = parseCheckoutPaymentMetadata(
      typeof pay!.metadata_json === "string"
        ? JSON.parse(pay!.metadata_json)
        : pay!.metadata_json,
    );
    expect(meta?.extraFieldAnswers).toEqual([
      { extraId: 210, values: { shirt_size: "L" } },
    ]);
  });

  it("rejects checkout for category-scoped extra on wrong category", async () => {
    const { app, authHeader } = await mountRegistrationScenario(seeds.withCategoryScopedExtras());

    const res = await request(app)
      .post(`/api/events/${SCENARIO.slug}/register/checkout`)
      .set("Authorization", authHeader)
      .send({
        categoryId: SCENARIO.categoryId,
        fieldValues: {},
        idempotencyKey: "idem-wrong-scope",
        selectedExtras: [{ extraId: 212, quantity: 1 }],
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/not available for this category/i);
  });

  it("allows free extra checkout without Stripe", async () => {
    const { app, authHeader } = await mountRegistrationScenario(seeds.withFreeExtra());

    const res = await request(app)
      .post(`/api/events/${SCENARIO.slug}/register/checkout`)
      .set("Authorization", authHeader)
      .send({
        categoryId: SCENARIO.categoryId,
        fieldValues: {},
        idempotencyKey: "idem-free-extra",
        selectedExtras: [{ extraId: 215, quantity: 1 }],
      });

    expect(res.status).toBe(200);
    expect(res.body.amountCents).toBe(0);
    expect(res.body.extrasSubtotalCents).toBe(0);
  });

  it("rejects checkout for expired sales window extra", async () => {
    const { app, authHeader } = await mountRegistrationScenario(seeds.withExpiredSalesExtra());

    const res = await request(app)
      .post(`/api/events/${SCENARIO.slug}/register/checkout`)
      .set("Authorization", authHeader)
      .send({
        categoryId: SCENARIO.categoryId,
        fieldValues: {},
        idempotencyKey: "idem-expired-extra",
        selectedExtras: [{ extraId: 213, quantity: 1 }],
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/no longer available/i);
  });
});

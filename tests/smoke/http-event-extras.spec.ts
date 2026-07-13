/**
 * @vitest-environment node
 *
 * HTTP smoke: event registration add-ons (extras) — public API + checkout edge cases.
 */
import { describe, it, expect, afterEach } from "vitest";
import request from "supertest";
import {
  computeCheckoutWithExtras,
  applyDiscountToCheckout,
} from "../../shared/checkoutBreakdown";
import { parseCheckoutPaymentMetadata } from "../../server/checkoutMetadata";
import { seeds, SCENARIO } from "../helpers/scenarioDb";
import {
  mountRegistrationScenario,
  teardownHttpScenario,
} from "../helpers/httpHarness";
import { createMockStripeClient } from "../helpers/mockStripeClient";

describe("HTTP smoke: public event extras", () => {
  afterEach(async () => {
    await teardownHttpScenario();
  });

  it("GET event detail includes active extras sorted", async () => {
    const { app } = await mountRegistrationScenario(seeds.withOptionalExtras());

    const res = await request(app).get(`/api/events/${SCENARIO.slug}`);

    expect(res.status).toBe(200);
    expect(res.body.extras).toHaveLength(2);
    expect(res.body.extras[0].name).toBe("Official Tee");
    expect(res.body.extras[0].price_cents).toBe(4_500);
    expect(res.body.extras[1].name).toBe("Gold Folio");
  });

  it("GET event detail omits inactive extras", async () => {
    const { app } = await mountRegistrationScenario(seeds.withInactiveExtra());

    const res = await request(app).get(`/api/events/${SCENARIO.slug}`);

    expect(res.status).toBe(200);
    expect(res.body.extras).toHaveLength(1);
    expect(res.body.extras[0].id).toBe(206);
  });

  it("checkout without extras succeeds when all are optional (free category)", async () => {
    const { app, authHeader } = await mountRegistrationScenario({
      requiresWaiver: false,
      category: { price_cents: 0, capacity: 100 },
      extras: [
        {
          id: 201,
          name: "Official Tee",
          price_cents: 4_500,
          extra_type: "merch",
          max_per_athlete: 2,
        },
      ],
    });

    const res = await request(app)
      .post(`/api/events/${SCENARIO.slug}/register/checkout`)
      .set("Authorization", authHeader)
      .send({
        categoryId: SCENARIO.categoryId,
        fieldValues: {},
        idempotencyKey: "idem-no-extras-free",
      });

    expect(res.status).toBe(200);
    expect(res.body.amountCents).toBe(0);
    expect(res.body.extrasSubtotalCents ?? 0).toBe(0);
  });

  it("rejects checkout when max_per_athlete exceeded", async () => {
    const { app, authHeader } = await mountRegistrationScenario(seeds.withOptionalExtras());

    const res = await request(app)
      .post(`/api/events/${SCENARIO.slug}/register/checkout`)
      .set("Authorization", authHeader)
      .send({
        categoryId: SCENARIO.categoryId,
        fieldValues: {},
        idempotencyKey: "idem-max-extra",
        selectedExtras: [{ extraId: 202, quantity: 3 }],
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/maximum/i);
  });

  it("rejects checkout when extra capacity exceeded", async () => {
    const { app, authHeader } = await mountRegistrationScenario(seeds.withLimitedExtra());

    const res = await request(app)
      .post(`/api/events/${SCENARIO.slug}/register/checkout`)
      .set("Authorization", authHeader)
      .send({
        categoryId: SCENARIO.categoryId,
        fieldValues: {},
        idempotencyKey: "idem-capacity",
        selectedExtras: [{ extraId: 204, quantity: 2 }],
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/sold out/i);
  });

  it("rejects checkout for unknown extra id", async () => {
    const { app, authHeader } = await mountRegistrationScenario(seeds.withOptionalExtras());

    const res = await request(app)
      .post(`/api/events/${SCENARIO.slug}/register/checkout`)
      .set("Authorization", authHeader)
      .send({
        categoryId: SCENARIO.categoryId,
        fieldValues: {},
        idempotencyKey: "idem-unknown-extra",
        selectedExtras: [{ extraId: 99999, quantity: 1 }],
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/no longer available/i);
  });

  it("rejects invalid extra quantity in checkout body", async () => {
    const { app, authHeader } = await mountRegistrationScenario(seeds.withOptionalExtras());

    const res = await request(app)
      .post(`/api/events/${SCENARIO.slug}/register/checkout`)
      .set("Authorization", authHeader)
      .send({
        categoryId: SCENARIO.categoryId,
        fieldValues: {},
        idempotencyKey: "idem-bad-qty",
        selectedExtras: [{ extraId: 201, quantity: 0 }],
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/invalid extra quantity/i);
  });
});

describe("HTTP smoke: checkout with extras (Connect-ready)", () => {
  afterEach(async () => {
    await teardownHttpScenario();
  });

  it("includes extras in checkout response and payment metadata", async () => {
    const stripe = createMockStripeClient({ accountId: "acct_test_ready" });
    const { app, authHeader, db } = await mountRegistrationScenario(
      seeds.paidConnectReadyWithExtras(),
      { stripe },
    );

    const expected = computeCheckoutWithExtras({
      categoryListPriceCents: 80_000,
      extrasSubtotalCents: 2_800,
      serviceFeePercent: 11,
      feePresentation: "pass_through",
    });

    const res = await request(app)
      .post(`/api/events/${SCENARIO.slug}/register/checkout`)
      .set("Authorization", authHeader)
      .send({
        categoryId: SCENARIO.categoryId,
        fieldValues: {},
        idempotencyKey: "idem-with-extras",
        selectedExtras: [{ extraId: 208, quantity: 1 }],
      });

    expect(res.status).toBe(200);
    expect(res.body.extrasSubtotalCents).toBe(2_800);
    expect(res.body.extras).toHaveLength(1);
    expect(res.body.extras[0].name).toBe("Recovery Kit");
    expect(res.body.amountCents).toBe(expected.athleteTotalCents);

    const pay = db.payments.find((p) => p.idempotency_key === "idem-with-extras");
    expect(pay).toBeTruthy();
    const meta = parseCheckoutPaymentMetadata(
      typeof pay!.metadata_json === "string"
        ? JSON.parse(pay!.metadata_json)
        : pay!.metadata_json,
    );
    expect(meta?.extrasSubtotalCents).toBe(2_800);
    expect(meta?.selectedExtras).toHaveLength(1);
    expect(meta?.selectedExtras![0].extraId).toBe(208);
  });

  it("idempotent replay updates amount when extras are added to existing checkout", async () => {
    const stripe = createMockStripeClient({ accountId: "acct_test_ready" });
    const { app, authHeader, db } = await mountRegistrationScenario(
      seeds.paidConnectReadyWithExtras(),
      { stripe },
    );

    const categoryOnly = computeCheckoutWithExtras({
      categoryListPriceCents: 80_000,
      extrasSubtotalCents: 0,
      serviceFeePercent: 11,
      feePresentation: "pass_through",
    });

    db.seedPendingStripeCheckout({
      publicUuid: "pay-extras-replay",
      idempotencyKey: "idem-extras-replay",
      amountCents: categoryOnly.athleteTotalCents,
      metadata: {
        categoryId: SCENARIO.categoryId,
        categoryName: "10K Elite",
        fieldValues: {},
      },
    });

    const withExtras = computeCheckoutWithExtras({
      categoryListPriceCents: 80_000,
      extrasSubtotalCents: 2_800,
      serviceFeePercent: 11,
      feePresentation: "pass_through",
    });

    const res = await request(app)
      .post(`/api/events/${SCENARIO.slug}/register/checkout`)
      .set("Authorization", authHeader)
      .send({
        categoryId: SCENARIO.categoryId,
        fieldValues: {},
        idempotencyKey: "idem-extras-replay",
        selectedExtras: [{ extraId: 208, quantity: 1 }],
      });

    expect(res.status).toBe(200);
    expect(res.body.amountCents).toBe(withExtras.athleteTotalCents);

    const pay = db.payments.find((p) => p.public_uuid === "pay-extras-replay");
    expect(pay?.amount_cents).toBe(withExtras.athleteTotalCents);
  });

  it("discount + extras: discount applies to category only, extras added on top", async () => {
    const stripe = createMockStripeClient({ accountId: "acct_test_ready" });
    const { app, authHeader } = await mountRegistrationScenario(
      {
        ...seeds.paidWithExtrasAndDiscount(),
        organizer: seeds.paidConnectReady().organizer,
      },
      { stripe },
    );

    const applied = applyDiscountToCheckout({
      listPriceCents: 95_000,
      serviceFeePercent: 11,
      feePresentation: "pass_through",
      discount: {
        discount_type: "percent",
        discount_value: 10,
        applies_to: "total",
        min_purchase_cents: null,
      },
    });

    const expected = computeCheckoutWithExtras({
      categoryListPriceCents: applied.breakdown.listPriceCents,
      extrasSubtotalCents: 3_000,
      serviceFeePercent: 11,
      feePresentation: "pass_through",
    });

    const res = await request(app)
      .post(`/api/events/${SCENARIO.slug}/register/checkout`)
      .set("Authorization", authHeader)
      .send({
        categoryId: SCENARIO.categoryId,
        fieldValues: {},
        idempotencyKey: "idem-discount-extras",
        discountCode: "EARLY10",
        selectedExtras: [{ extraId: 207, quantity: 1 }],
      });

    expect(res.status).toBe(200);
    expect(res.body.extrasSubtotalCents).toBe(3_000);
    expect(res.body.amountCents).toBe(expected.athleteTotalCents);
    expect(res.body.amountCents).toBeGreaterThan(applied.breakdown.athleteTotalCents);
  });
});

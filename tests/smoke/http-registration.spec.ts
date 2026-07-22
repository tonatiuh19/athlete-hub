/**
 * @vitest-environment node
 *
 * HTTP integration smoke tests — Supertest against Express with in-memory ScenarioDb.
 * No TiDB, Stripe, or real athlete data touched.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import request from "supertest";
import {
  defaultWaiverSignatures,
  seeds,
} from "../helpers/scenarioDb";
import {
  mountRegistrationScenario,
  teardownHttpScenario,
  SCENARIO,
} from "../helpers/httpHarness";

describe("HTTP smoke: registration checkout & confirm ($0 mock)", () => {
  afterEach(async () => {
    await teardownHttpScenario();
  });

  it("POST checkout → confirm completes free registration end-to-end", async () => {
    const { app, authHeader } = await mountRegistrationScenario(seeds.freeOpen());

    const checkout = await request(app)
      .post(`/api/events/${SCENARIO.slug}/register/checkout`)
      .set("Authorization", authHeader)
      .send({
        categoryId: SCENARIO.categoryId,
        fieldValues: {},
        idempotencyKey: "idem-free-001",
      });

    expect(checkout.status).toBe(200);
    expect(checkout.body.paymentPublicUuid).toBeTruthy();
    expect(checkout.body.amountCents).toBe(0);
    expect(checkout.body.clientSecret).toBeNull();

    const confirm = await request(app)
      .post(`/api/events/${SCENARIO.slug}/register/confirm`)
      .set("Authorization", authHeader)
      .send({ paymentPublicUuid: checkout.body.paymentPublicUuid });

    expect(confirm.status).toBe(200);
    expect(confirm.body.success).toBe(true);
    expect(confirm.body.registration.status).toBe("confirmed");
    expect(confirm.body.registration.registration_number).toMatch(/^REG-/);
    expect(confirm.body.registration.event_slug).toBe(SCENARIO.slug);
  });

  it("requires waiver signatures when event.requires_waiver", async () => {
    const { app, authHeader } = await mountRegistrationScenario(seeds.freeWithWaiver());

    const missing = await request(app)
      .post(`/api/events/${SCENARIO.slug}/register/checkout`)
      .set("Authorization", authHeader)
      .send({
        categoryId: SCENARIO.categoryId,
        fieldValues: {},
        idempotencyKey: "idem-waiver-missing",
      });
    expect(missing.status).toBe(400);
    expect(missing.body.error).toMatch(/waiver/i);

    const stale = await request(app)
      .post(`/api/events/${SCENARIO.slug}/register/checkout`)
      .set("Authorization", authHeader)
      .send({
        categoryId: SCENARIO.categoryId,
        fieldValues: {},
        idempotencyKey: "idem-waiver-stale",
        waiverSignatures: [
          { waiverId: 1, signature: "ACCEPTED", waiverVersion: 1 },
          { waiverId: 2, signature: "ACCEPTED", waiverVersion: 1 },
        ],
      });
    expect(stale.status).toBe(400);
    expect(stale.body.error).toMatch(/updated/i);

    const ok = await request(app)
      .post(`/api/events/${SCENARIO.slug}/register/checkout`)
      .set("Authorization", authHeader)
      .send({
        categoryId: SCENARIO.categoryId,
        fieldValues: {},
        idempotencyKey: "idem-waiver-ok",
        waiverSignatures: defaultWaiverSignatures(),
      });
    expect(ok.status).toBe(200);
  });

  it("returns 409 already_registered when athlete has confirmed reg", async () => {
    const { app, authHeader } = await mountRegistrationScenario(seeds.alreadyRegistered());

    const res = await request(app)
      .post(`/api/events/${SCENARIO.slug}/register/checkout`)
      .set("Authorization", authHeader)
      .send({
        categoryId: SCENARIO.categoryId,
        fieldValues: {},
        idempotencyKey: "idem-dup",
      });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("already_registered");
  });

  it("returns 401 without auth bypass / token", async () => {
    const { app } = await mountRegistrationScenario(seeds.freeOpen(), { auth: false });

    const res = await request(app)
      .post(`/api/events/${SCENARIO.slug}/register/checkout`)
      .send({
        categoryId: SCENARIO.categoryId,
        fieldValues: {},
        idempotencyKey: "idem-no-auth",
      });

    expect(res.status).toBe(401);
  });

  it("confirm is idempotent when payment already linked to registration", async () => {
    const { app, authHeader } = await mountRegistrationScenario(seeds.freeOpen());

    const checkout = await request(app)
      .post(`/api/events/${SCENARIO.slug}/register/checkout`)
      .set("Authorization", authHeader)
      .send({
        categoryId: SCENARIO.categoryId,
        fieldValues: {},
        idempotencyKey: "idem-idempotent",
      });

    const first = await request(app)
      .post(`/api/events/${SCENARIO.slug}/register/confirm`)
      .set("Authorization", authHeader)
      .send({ paymentPublicUuid: checkout.body.paymentPublicUuid });
    expect(first.status).toBe(200);

    const second = await request(app)
      .post(`/api/events/${SCENARIO.slug}/register/confirm`)
      .set("Authorization", authHeader)
      .send({ paymentPublicUuid: checkout.body.paymentPublicUuid });
    expect(second.status).toBe(200);
    expect(second.body.registration.registration_number).toBe(
      first.body.registration.registration_number,
    );
  });

  it("rejects checkout without idempotencyKey", async () => {
    const { app, authHeader } = await mountRegistrationScenario(seeds.freeOpen());

    const res = await request(app)
      .post(`/api/events/${SCENARIO.slug}/register/checkout`)
      .set("Authorization", authHeader)
      .send({ categoryId: SCENARIO.categoryId, fieldValues: {} });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/idempotencyKey/i);
  });
});

describe("HTTP smoke: sold-out & waitlist", () => {
  afterEach(async () => {
    await teardownHttpScenario();
  });

  it("returns waitlist_available when sold out and waitlist enabled", async () => {
    const { app, authHeader } = await mountRegistrationScenario(seeds.soldOutWaitlist());

    const res = await request(app)
      .post(`/api/events/${SCENARIO.slug}/register/checkout`)
      .set("Authorization", authHeader)
      .send({
        categoryId: SCENARIO.categoryId,
        fieldValues: {},
        idempotencyKey: "idem-soldout",
      });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("waitlist_available");
    expect(res.body.categoryId).toBe(SCENARIO.categoryId);
  });

  it("allows waitlist claim checkout when valid offer exists", async () => {
    const { app, authHeader } = await mountRegistrationScenario(seeds.waitlistClaim());

    const checkout = await request(app)
      .post(`/api/events/${SCENARIO.slug}/register/checkout`)
      .set("Authorization", authHeader)
      .send({
        categoryId: SCENARIO.categoryId,
        fieldValues: {},
        idempotencyKey: "idem-claim",
        waitlistEntryId: 501,
      });

    expect(checkout.status).toBe(200);
    expect(checkout.body.amountCents).toBe(0);

    const confirm = await request(app)
      .post(`/api/events/${SCENARIO.slug}/register/confirm`)
      .set("Authorization", authHeader)
      .send({ paymentPublicUuid: checkout.body.paymentPublicUuid });

    expect(confirm.status).toBe(200);
    expect(confirm.body.registration.status).toBe("confirmed");
  });

  it("rejects waitlist claim with invalid waitlistEntryId on sold-out category", async () => {
    const { app, authHeader } = await mountRegistrationScenario(seeds.soldOutWaitlist());

    const res = await request(app)
      .post(`/api/events/${SCENARIO.slug}/register/checkout`)
      .set("Authorization", authHeader)
      .send({
        categoryId: SCENARIO.categoryId,
        fieldValues: {},
        idempotencyKey: "idem-bad-claim",
        waitlistEntryId: 9999,
      });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("waitlist_available");
  });
});

describe("HTTP smoke: resume & pending checkout", () => {
  afterEach(async () => {
    await teardownHttpScenario();
  });

  it("GET pending-checkout returns orphan payment for event slug", async () => {
    const { app, authHeader, db } = await mountRegistrationScenario(seeds.freeOpen());

    const checkout = await request(app)
      .post(`/api/events/${SCENARIO.slug}/register/checkout`)
      .set("Authorization", authHeader)
      .send({
        categoryId: SCENARIO.categoryId,
        fieldValues: { shirt_size: "M" },
        idempotencyKey: "idem-pending",
      });
    expect(checkout.status).toBe(200);

    const pending = await request(app)
      .get(`/api/athlete/pending-checkout?eventSlug=${SCENARIO.slug}`)
      .set("Authorization", authHeader);

    expect(pending.status).toBe(200);
    expect(pending.body.pending).toHaveLength(1);
    expect(pending.body.pending[0].public_uuid).toBe(checkout.body.paymentPublicUuid);
    expect(pending.body.pending[0].category_id).toBe(SCENARIO.categoryId);
    expect(db.payments).toHaveLength(1);
    expect(db.payments[0].registration_id).toBeNull();
  });

  it("POST resume on $0 mock returns checkout (no auto-confirm)", async () => {
    const { app, authHeader, db } = await mountRegistrationScenario(seeds.freeOpen());

    const checkout = await request(app)
      .post(`/api/events/${SCENARIO.slug}/register/checkout`)
      .set("Authorization", authHeader)
      .send({
        categoryId: SCENARIO.categoryId,
        fieldValues: {},
        idempotencyKey: "idem-resume",
      });

    const resumed = await request(app)
      .post(`/api/events/${SCENARIO.slug}/register/resume`)
      .set("Authorization", authHeader)
      .send({
        paymentPublicUuid: checkout.body.paymentPublicUuid,
        idempotencyKey: "idem-resume",
      });

    expect(resumed.status).toBe(200);
    expect(resumed.body.status).toBe("checkout");
    expect(resumed.body.checkout.paymentPublicUuid).toBe(checkout.body.paymentPublicUuid);
    expect(resumed.body.checkout.amountCents).toBe(0);
    expect(db.registrations).toHaveLength(0);

    const confirmed = await request(app)
      .post(`/api/events/${SCENARIO.slug}/register/confirm`)
      .set("Authorization", authHeader)
      .send({ paymentPublicUuid: checkout.body.paymentPublicUuid });

    expect(confirmed.status).toBe(200);
    expect(confirmed.body.success).toBe(true);
    expect(confirmed.body.registration.status).toBe("confirmed");

    const again = await request(app)
      .post(`/api/events/${SCENARIO.slug}/register/resume`)
      .set("Authorization", authHeader)
      .send({ paymentPublicUuid: checkout.body.paymentPublicUuid });

    expect(again.status).toBe(200);
    expect(again.body.status).toBe("complete");
  });
});

describe("HTTP smoke: paid path without Stripe configured", () => {
  afterEach(async () => {
    await teardownHttpScenario();
  });

  it("supersedes stale pending payments without SQL enum errors on retry", async () => {
    const { app, authHeader, db } = await mountRegistrationScenario(seeds.paidNoStripe());

    db.seedPendingStripeCheckout({
      publicUuid: "pay-stale-mock",
      idempotencyKey: "idem-stale-old",
    });

    const res = await request(app)
      .post(`/api/events/${SCENARIO.slug}/register/checkout`)
      .set("Authorization", authHeader)
      .send({
        categoryId: SCENARIO.categoryId,
        fieldValues: {},
        idempotencyKey: "idem-stale-new",
      });

    expect(res.status).toBe(503);
    expect(res.body.error).toMatch(
      /payment service unavailable|temporarily unavailable/i,
    );
    expect(res.status).not.toBe(500);
  });

  it("returns 503 when category has price but Stripe is not configured", async () => {
    const { app, authHeader } = await mountRegistrationScenario(seeds.paidNoStripe());

    const res = await request(app)
      .post(`/api/events/${SCENARIO.slug}/register/checkout`)
      .set("Authorization", authHeader)
      .send({
        categoryId: SCENARIO.categoryId,
        fieldValues: {},
        idempotencyKey: "idem-paid-no-stripe",
      });

    expect(res.status).toBe(503);
    expect(res.body.error).toMatch(
      /payment service unavailable|temporarily unavailable/i,
    );
  });
});

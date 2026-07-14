/**
 * @vitest-environment node
 */
import { describe, it, expect, afterEach } from "vitest";
import request from "supertest";
import { seeds } from "../helpers/scenarioDb";
import {
  mountRegistrationScenario,
  setRegistrationScenarioAuth,
  teardownHttpScenario,
  SCENARIO,
  TEST_AUTH,
} from "../helpers/httpHarness";

const guestLine = {
  lineId: "guest-1",
  participantType: "guest" as const,
  categoryId: SCENARIO.categoryId,
  fieldValues: {},
  guest: {
    firstName: "Family",
    lastName: "Guest",
    email: "family-guest@test.local",
    dateOfBirth: "1992-06-01",
    gender: "female",
  },
};

describe("HTTP smoke: group registration checkout & claim", () => {
  afterEach(async () => {
    await teardownHttpScenario();
  });

  it("rejects group checkout without idempotencyKey", async () => {
    const { app, authHeader } = await mountRegistrationScenario(seeds.groupFreeOpen());

    const res = await request(app)
      .post(`/api/events/${SCENARIO.slug}/register/checkout`)
      .set("Authorization", authHeader)
      .send({
        lineItems: [{ lineId: "self", participantType: "self", categoryId: SCENARIO.categoryId, fieldValues: {} }],
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/idempotencyKey/i);
  });

  it("rejects duplicate participant emails in one order", async () => {
    const { app, authHeader } = await mountRegistrationScenario(seeds.groupFreeOpen());

    const res = await request(app)
      .post(`/api/events/${SCENARIO.slug}/register/checkout`)
      .set("Authorization", authHeader)
      .send({
        idempotencyKey: "grp-dup-email",
        lineItems: [
          {
            lineId: "g1",
            participantType: "guest",
            categoryId: SCENARIO.categoryId,
            fieldValues: {},
            guest: {
              firstName: "A",
              lastName: "One",
              email: "dup@test.local",
              dateOfBirth: "1990-01-01",
              gender: "male",
            },
          },
          {
            lineId: "g2",
            participantType: "guest",
            categoryId: SCENARIO.categoryId,
            fieldValues: {},
            guest: {
              firstName: "B",
              lastName: "Two",
              email: "dup@test.local",
              dateOfBirth: "1991-01-01",
              gender: "female",
            },
          },
        ],
      });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("duplicate_participant");
  });

  it("rejects orders above max_registrations_per_order", async () => {
    const { app, authHeader } = await mountRegistrationScenario(seeds.groupFreeMaxTwo());

    const res = await request(app)
      .post(`/api/events/${SCENARIO.slug}/register/checkout`)
      .set("Authorization", authHeader)
      .send({
        idempotencyKey: "grp-over-limit",
        lineItems: [
          {
            lineId: "g1",
            participantType: "guest",
            categoryId: SCENARIO.categoryId,
            fieldValues: {},
            guest: {
              firstName: "A",
              lastName: "One",
              email: "a1@test.local",
              dateOfBirth: "1990-01-01",
              gender: "male",
            },
          },
          {
            lineId: "g2",
            participantType: "guest",
            categoryId: SCENARIO.categoryId,
            fieldValues: {},
            guest: {
              firstName: "B",
              lastName: "Two",
              email: "b1@test.local",
              dateOfBirth: "1991-01-01",
              gender: "female",
            },
          },
          {
            lineId: "g3",
            participantType: "guest",
            categoryId: SCENARIO.categoryId,
            fieldValues: {},
            guest: {
              firstName: "C",
              lastName: "Three",
              email: "c1@test.local",
              dateOfBirth: "1992-01-01",
              gender: "male",
            },
          },
        ],
      });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("order_limit_exceeded");
  });

  it("completes free self + guest checkout and confirm with order payload", async () => {
    const { app, authHeader, db } = await mountRegistrationScenario(seeds.groupFreeOpen());

    const checkout = await request(app)
      .post(`/api/events/${SCENARIO.slug}/register/checkout`)
      .set("Authorization", authHeader)
      .send({
        idempotencyKey: "grp-free-001",
        lineItems: [
          { lineId: "self", participantType: "self", categoryId: SCENARIO.categoryId, fieldValues: {} },
          guestLine,
        ],
      });

    expect(checkout.status).toBe(200);
    expect(checkout.body.orderMode).toBe("group");
    expect(checkout.body.itemCount).toBe(2);
    expect(checkout.body.amountCents).toBe(0);

    const confirm = await request(app)
      .post(`/api/events/${SCENARIO.slug}/register/confirm`)
      .set("Authorization", authHeader)
      .send({ paymentPublicUuid: checkout.body.paymentPublicUuid });

    expect(confirm.status).toBe(200);
    expect(confirm.body.success).toBe(true);
    expect(confirm.body.order).toBeTruthy();
    expect(confirm.body.order.itemCount).toBe(2);
    expect(confirm.body.order.registrations).toHaveLength(2);

    const guestReg = confirm.body.order.registrations.find(
      (r: { participant_email?: string }) => r.participant_email === guestLine.guest.email,
    );
    expect(guestReg?.guest_claim_token).toBeTruthy();
    expect(db.registrations.filter((r) => r.status === "confirmed")).toHaveLength(2);
  });

  it("claim-guest returns 403 on email mismatch", async () => {
    const { app, authHeader } = await mountRegistrationScenario(seeds.groupFreeOpen());

    const checkout = await request(app)
      .post(`/api/events/${SCENARIO.slug}/register/checkout`)
      .set("Authorization", authHeader)
      .send({
        idempotencyKey: "grp-claim-mismatch",
        lineItems: [guestLine],
      });
    expect(checkout.status).toBe(200);

    const confirm = await request(app)
      .post(`/api/events/${SCENARIO.slug}/register/confirm`)
      .set("Authorization", authHeader)
      .send({ paymentPublicUuid: checkout.body.paymentPublicUuid });
    expect(confirm.status).toBe(200);

    const claimToken = confirm.body.order.registrations[0].guest_claim_token as string;

    const res = await request(app)
      .post("/api/athlete/registrations/claim-guest")
      .set("Authorization", authHeader)
      .send({ claimToken });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe("email_mismatch");
  });

  it("claim-guest reassigns registration when emails match", async () => {
    const { app, authHeader, db } = await mountRegistrationScenario(seeds.groupFreeOpen());

    const checkout = await request(app)
      .post(`/api/events/${SCENARIO.slug}/register/checkout`)
      .set("Authorization", authHeader)
      .send({
        idempotencyKey: "grp-claim-ok",
        lineItems: [guestLine],
      });
    expect(checkout.status).toBe(200);

    const confirm = await request(app)
      .post(`/api/events/${SCENARIO.slug}/register/confirm`)
      .set("Authorization", authHeader)
      .send({ paymentPublicUuid: checkout.body.paymentPublicUuid });
    expect(confirm.status).toBe(200);

    const guestRegBefore = db.registrations.find((r) => r.guest_claim_token);
    expect(guestRegBefore).toBeTruthy();
    const guestAthleteId = guestRegBefore!.athlete_id;
    const claimToken = String(guestRegBefore!.guest_claim_token);

    await setRegistrationScenarioAuth({
      ...TEST_AUTH,
      id: guestAthleteId,
      email: guestLine.guest.email,
    });

    const res = await request(app)
      .post("/api/athlete/registrations/claim-guest")
      .set("Authorization", authHeader)
      .send({ claimToken });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.registration.public_uuid).toBe(guestRegBefore!.public_uuid);
    expect(guestRegBefore!.guest_claim_token).toBeNull();
    expect(guestRegBefore!.athlete_id).toBe(guestAthleteId);
  });

  it("claim-guest returns 404 for unknown token", async () => {
    const { app, authHeader } = await mountRegistrationScenario(seeds.groupFreeOpen());

    const res = await request(app)
      .post("/api/athlete/registrations/claim-guest")
      .set("Authorization", authHeader)
      .send({ claimToken: "00000000-0000-4000-8000-000000000099" });

    expect(res.status).toBe(404);
    expect(res.body.code).toBe("claim_not_found");
  });

  it("rejects group checkout when required Campos extra are missing", async () => {
    const { app, authHeader } = await mountRegistrationScenario(
      seeds.withRequiredRegistrationField(),
    );

    const res = await request(app)
      .post(`/api/events/${SCENARIO.slug}/register/checkout`)
      .set("Authorization", authHeader)
      .send({
        idempotencyKey: "grp-fields-missing",
        lineItems: [
          {
            lineId: "self",
            participantType: "self",
            categoryId: SCENARIO.categoryId,
            fieldValues: {},
          },
        ],
      });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("registration_fields_invalid");
    expect(res.body.error).toMatch(/Emergency contact/i);
  });

  it("accepts group checkout when required Campos extra are provided per line", async () => {
    const { app, authHeader, db } = await mountRegistrationScenario(
      seeds.withRequiredRegistrationField(),
    );

    const res = await request(app)
      .post(`/api/events/${SCENARIO.slug}/register/checkout`)
      .set("Authorization", authHeader)
      .send({
        idempotencyKey: "grp-fields-ok",
        lineItems: [
          {
            lineId: "self",
            participantType: "self",
            categoryId: SCENARIO.categoryId,
            fieldValues: { emergency_contact: "Ana +521555" },
          },
          {
            ...guestLine,
            fieldValues: { emergency_contact: "Luis +521666" },
          },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.orderMode).toBe("group");
    expect(res.body.itemCount).toBe(2);

    const confirm = await request(app)
      .post(`/api/events/${SCENARIO.slug}/register/confirm`)
      .set("Authorization", authHeader)
      .send({ paymentPublicUuid: res.body.paymentPublicUuid });

    expect(confirm.status).toBe(200);
    expect(confirm.body.success).toBe(true);
    expect(db.fieldValues.length).toBeGreaterThanOrEqual(2);
  });

  it("minor guest gets no claim token (managed by purchaser)", async () => {
    const { app, authHeader } = await mountRegistrationScenario(seeds.groupFreeOpen());

    const minorLine = {
      ...guestLine,
      lineId: "minor-1",
      guest: {
        ...guestLine.guest,
        firstName: "Kid",
        lastName: "Runner",
        email: "kid-guest@test.local",
        dateOfBirth: "2015-01-15",
      },
      guardianRelationship: "Parent",
    };

    const checkout = await request(app)
      .post(`/api/events/${SCENARIO.slug}/register/checkout`)
      .set("Authorization", authHeader)
      .send({
        idempotencyKey: "grp-minor-managed",
        lineItems: [
          {
            lineId: "self",
            participantType: "self",
            categoryId: SCENARIO.categoryId,
            fieldValues: {},
          },
          minorLine,
        ],
      });
    expect(checkout.status).toBe(200);

    const confirm = await request(app)
      .post(`/api/events/${SCENARIO.slug}/register/confirm`)
      .set("Authorization", authHeader)
      .send({ paymentPublicUuid: checkout.body.paymentPublicUuid });

    expect(confirm.status).toBe(200);
    const kid = confirm.body.order.registrations.find(
      (r: { participant_email?: string }) => r.participant_email === "kid-guest@test.local",
    );
    expect(kid).toBeTruthy();
    expect(kid.guest_claim_token).toBeFalsy();
    expect(kid.is_managed_participant).toBe(true);
    expect(kid.wallet_held_by_purchaser).toBe(true);
  });

  it("managedByPurchaser adult guest skips claim token", async () => {
    const { app, authHeader } = await mountRegistrationScenario(seeds.groupFreeOpen());

    const checkout = await request(app)
      .post(`/api/events/${SCENARIO.slug}/register/checkout`)
      .set("Authorization", authHeader)
      .send({
        idempotencyKey: "grp-force-managed",
        lineItems: [
          {
            ...guestLine,
            managedByPurchaser: true,
            guardianRelationship: "Guardian",
          },
        ],
      });
    expect(checkout.status).toBe(200);

    const confirm = await request(app)
      .post(`/api/events/${SCENARIO.slug}/register/confirm`)
      .set("Authorization", authHeader)
      .send({ paymentPublicUuid: checkout.body.paymentPublicUuid });

    expect(confirm.status).toBe(200);
    const guest = confirm.body.order.registrations[0];
    expect(guest.guest_claim_token).toBeFalsy();
    expect(guest.is_managed_participant).toBe(true);
    expect(guest.wallet_held_by_purchaser).toBe(true);
  });
});

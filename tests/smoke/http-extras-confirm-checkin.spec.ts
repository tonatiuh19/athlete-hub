/**
 * @vitest-environment node
 *
 * End-to-end: checkout → confirm persists extra field answers → organizer check-in lookup.
 */
import { describe, it, expect, afterEach } from "vitest";
import request from "supertest";
import { seeds } from "../helpers/scenarioDb";
import {
  mountRegistrationScenario,
  setRegistrationScenarioAuth,
  teardownHttpScenario,
  SCENARIO,
  ORGANIZER_TEST_AUTH,
} from "../helpers/httpHarness";

describe("HTTP integration: extras confirm + check-in lookup", () => {
  afterEach(async () => {
    await teardownHttpScenario();
  });

  it("confirm persists registration_extra_field_values for purchased add-ons", async () => {
    const { app, authHeader, db } = await mountRegistrationScenario(
      seeds.withFreeExtraAndFields(),
    );

    const checkout = await request(app)
      .post(`/api/events/${SCENARIO.slug}/register/checkout`)
      .set("Authorization", authHeader)
      .send({
        categoryId: SCENARIO.categoryId,
        fieldValues: {},
        idempotencyKey: "idem-confirm-extra-fields",
        selectedExtras: [{ extraId: 216, quantity: 1 }],
        extraFieldAnswers: [{ extraId: 216, values: { shirt_size: "L" } }],
      });

    expect(checkout.status).toBe(200);

    const confirm = await request(app)
      .post(`/api/events/${SCENARIO.slug}/register/confirm`)
      .set("Authorization", authHeader)
      .send({ paymentPublicUuid: checkout.body.paymentPublicUuid });

    expect(confirm.status).toBe(200);
    expect(confirm.body.success).toBe(true);

    expect(db.registrationExtras).toHaveLength(1);
    expect(db.registrationExtras[0]).toMatchObject({
      event_extra_id: 216,
      name: "Finisher Tee",
      quantity: 1,
    });

    expect(db.registrationExtraFieldValues).toHaveLength(1);
    expect(db.registrationExtraFieldValues[0]).toMatchObject({
      field_key: "shirt_size",
      label: "T-shirt size",
      value_text: "L",
    });
    expect(db.registrationExtraFieldValues[0]?.registration_extra_id).toBe(
      db.registrationExtras[0]?.id,
    );
  });

  it("organizer global lookup returns purchased_extras with field answers after confirm", async () => {
    const { app, authHeader, db } = await mountRegistrationScenario(
      seeds.withFreeExtraAndFields(),
    );

    const checkout = await request(app)
      .post(`/api/events/${SCENARIO.slug}/register/checkout`)
      .set("Authorization", authHeader)
      .send({
        categoryId: SCENARIO.categoryId,
        fieldValues: {},
        idempotencyKey: "idem-lookup-global",
        selectedExtras: [{ extraId: 216, quantity: 1 }],
        extraFieldAnswers: [{ extraId: 216, values: { shirt_size: "M" } }],
      });
    expect(checkout.status).toBe(200);

    const confirm = await request(app)
      .post(`/api/events/${SCENARIO.slug}/register/confirm`)
      .set("Authorization", authHeader)
      .send({ paymentPublicUuid: checkout.body.paymentPublicUuid });
    expect(confirm.status).toBe(200);

    const reg = db.registrations.find((row) => row.status === "confirmed");
    expect(reg?.qr_code_token).toBeTruthy();

    await setRegistrationScenarioAuth(ORGANIZER_TEST_AUTH);

    const lookup = await request(app)
      .get("/api/organizer/registrations/lookup")
      .set("Authorization", "Bearer smoke-test-token")
      .query({ q: reg!.qr_code_token });

    expect(lookup.status).toBe(200);
    expect(lookup.body.registration.purchased_extras).toHaveLength(1);
    expect(lookup.body.registration.purchased_extras[0]).toMatchObject({
      name: "Finisher Tee",
      quantity: 1,
    });
    expect(lookup.body.registration.purchased_extras[0].field_answers).toEqual([
      expect.objectContaining({
        field_key: "shirt_size",
        label: "T-shirt size",
        value_text: "M",
      }),
    ]);
  });

  it("organizer event-scoped lookup returns purchased_extras with field answers", async () => {
    const { app, authHeader, db } = await mountRegistrationScenario(
      seeds.withFreeExtraAndFields(),
    );

    const checkout = await request(app)
      .post(`/api/events/${SCENARIO.slug}/register/checkout`)
      .set("Authorization", authHeader)
      .send({
        categoryId: SCENARIO.categoryId,
        fieldValues: {},
        idempotencyKey: "idem-lookup-event",
        selectedExtras: [{ extraId: 216, quantity: 1 }],
        extraFieldAnswers: [{ extraId: 216, values: { shirt_size: "XL" } }],
      });
    expect(checkout.status).toBe(200);

    const confirm = await request(app)
      .post(`/api/events/${SCENARIO.slug}/register/confirm`)
      .set("Authorization", authHeader)
      .send({ paymentPublicUuid: checkout.body.paymentPublicUuid });
    expect(confirm.status).toBe(200);

    const reg = db.registrations.find((row) => row.status === "confirmed");
    expect(reg?.registration_number).toMatch(/^REG-/);

    await setRegistrationScenarioAuth(ORGANIZER_TEST_AUTH);

    const lookup = await request(app)
      .get(`/api/organizer/events/${SCENARIO.eventId}/registrations/lookup`)
      .set("Authorization", "Bearer smoke-test-token")
      .query({ q: reg!.registration_number });

    expect(lookup.status).toBe(200);
    expect(lookup.body.registration.registration_number).toBe(reg!.registration_number);
    expect(lookup.body.registration.purchased_extras[0].field_answers[0]).toMatchObject({
      field_key: "shirt_size",
      value_text: "XL",
    });
  });

  it("rejects confirm when required extra answers were stripped from metadata", async () => {
    const { app, authHeader, db } = await mountRegistrationScenario(
      seeds.withFreeExtraAndFields(),
    );

    const checkout = await request(app)
      .post(`/api/events/${SCENARIO.slug}/register/checkout`)
      .set("Authorization", authHeader)
      .send({
        categoryId: SCENARIO.categoryId,
        fieldValues: {},
        idempotencyKey: "idem-confirm-missing-answers",
        selectedExtras: [{ extraId: 216, quantity: 1 }],
      });
    expect(checkout.status).toBe(400);
    expect(checkout.body.error).toMatch(/shirt size|required/i);
    expect(db.registrations).toHaveLength(0);
  });
});

/**
 * @vitest-environment node
 */
import { describe, it, expect, afterEach } from "vitest";
import request from "supertest";
import { seeds } from "../helpers/scenarioDb";
import {
  mountRegistrationScenario,
  teardownHttpScenario,
  SCENARIO,
} from "../helpers/httpHarness";

describe("HTTP smoke: athlete registration fields category scope", () => {
  afterEach(async () => {
    await teardownHttpScenario();
  });

  it("event detail exposes scope_type and category_ids on registration fields", async () => {
    const { app } = await mountRegistrationScenario(seeds.withCategoryScopedRegistrationFields());

    const detail = await request(app).get(`/api/events/${SCENARIO.slug}`);
    expect(detail.status).toBe(200);
    const elite = detail.body.registrationFields.find(
      (f: { field_key: string }) => f.field_key === "elite_bib_name",
    );
    expect(elite.scope_type).toBe("selected_categories");
    expect(elite.category_ids).toEqual([SCENARIO.categoryId]);
  });

  it("checkout requires only fields visible for selected category", async () => {
    const { app, authHeader } = await mountRegistrationScenario(
      seeds.withCategoryScopedRegistrationFields(),
    );

    const missing = await request(app)
      .post(`/api/events/${SCENARIO.slug}/register/checkout`)
      .set("Authorization", authHeader)
      .send({
        categoryId: SCENARIO.categoryId,
        fieldValues: {},
        idempotencyKey: "idem-reg-field-scope-missing",
      });
    expect(missing.status).toBe(400);
    expect(missing.body.error).toMatch(/elite bib name/i);

    const ok = await request(app)
      .post(`/api/events/${SCENARIO.slug}/register/checkout`)
      .set("Authorization", authHeader)
      .send({
        categoryId: SCENARIO.categoryId,
        fieldValues: { elite_bib_name: "Felix G" },
        idempotencyKey: "idem-reg-field-scope-ok",
      });
    expect(ok.status).toBe(200);
  });

  it("checkout ignores required fields scoped to other categories", async () => {
    const { app, authHeader } = await mountRegistrationScenario(
      seeds.withCategoryScopedRegistrationFields(),
    );

    const checkout = await request(app)
      .post(`/api/events/${SCENARIO.slug}/register/checkout`)
      .set("Authorization", authHeader)
      .send({
        categoryId: SCENARIO.categoryId,
        fieldValues: { elite_bib_name: "Felix G" },
        idempotencyKey: "idem-reg-field-other-ignored",
      });
    expect(checkout.status).toBe(200);

    const confirm = await request(app)
      .post(`/api/events/${SCENARIO.slug}/register/confirm`)
      .set("Authorization", authHeader)
      .send({ paymentPublicUuid: checkout.body.paymentPublicUuid });
    expect(confirm.status).toBe(200);
  });

  it("checkout rejects answers for fields outside category scope", async () => {
    const { app, authHeader, db } = await mountRegistrationScenario(
      seeds.withCategoryScopedRegistrationFields(),
    );

    const checkout = await request(app)
      .post(`/api/events/${SCENARIO.slug}/register/checkout`)
      .set("Authorization", authHeader)
      .send({
        categoryId: SCENARIO.categoryId,
        fieldValues: {
          elite_bib_name: "Felix G",
          other_distance_note: "should not be required",
        },
        idempotencyKey: "idem-reg-field-extra-answer",
      });
    expect(checkout.status).toBe(200);

    const confirm = await request(app)
      .post(`/api/events/${SCENARIO.slug}/register/confirm`)
      .set("Authorization", authHeader)
      .send({ paymentPublicUuid: checkout.body.paymentPublicUuid });
    expect(confirm.status).toBe(200);

    const stored = db.fieldValues.filter((row) => row.field_id === 30011);
    expect(stored).toHaveLength(0);
  });
});

/**
 * @vitest-environment node
 */
import { describe, it, expect, afterEach } from "vitest";
import request from "supertest";
import {
  mountStaffPortalScenario,
  teardownStaffPortalScenario,
  STAFF_SCENARIO,
} from "../helpers/staffPortalHarness";
import { staffSeeds } from "../helpers/staffPortalScenarioDb";

describe("HTTP smoke: enhanced staff event extras", () => {
  afterEach(async () => {
    await teardownStaffPortalScenario();
  });

  it("POST creates free extra with custom fields", async () => {
    const { app, authHeader } = await mountStaffPortalScenario(staffSeeds.draftWithCategory());

    const res = await request(app)
      .post(`/api/organizer/events/${STAFF_SCENARIO.defaultEventId}/extras`)
      .set("Authorization", authHeader)
      .send({
        name: "Finisher Sticker",
        price_cents: 0,
        is_free: true,
        extra_type: "merch",
        fields: [
          {
            field_key: "shirt_size",
            label: "T-shirt size",
            field_type: "select",
            options_json: ["S", "M", "L"],
            is_required: true,
            sort_order: 0,
          },
        ],
      });

    expect(res.status).toBe(201);
    const extra = res.body.extras.find((row: { name: string }) => row.name === "Finisher Sticker");
    expect(extra.price_cents).toBe(0);
    expect(extra.fields).toHaveLength(1);
    expect(extra.fields_locked).toBe(false);
  });

  it("POST rejects selected_categories scope without category_ids", async () => {
    const { app, authHeader } = await mountStaffPortalScenario(staffSeeds.draftWithCategory());

    const res = await request(app)
      .post(`/api/organizer/events/${STAFF_SCENARIO.defaultEventId}/extras`)
      .set("Authorization", authHeader)
      .send({
        name: "Scoped Item",
        price_cents: 0,
        is_free: true,
        scope_type: "selected_categories",
        category_ids: [],
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/at least one category/i);
  });

  it("POST creates category-scoped extra", async () => {
    const { app, authHeader, db } = await mountStaffPortalScenario(staffSeeds.draftWithCategory());
    const categoryId = db.categories[0]!.id;

    const res = await request(app)
      .post(`/api/organizer/events/${STAFF_SCENARIO.defaultEventId}/extras`)
      .set("Authorization", authHeader)
      .send({
        name: "10K Hoodie",
        price_cents: 0,
        is_free: true,
        scope_type: "selected_categories",
        category_ids: [categoryId],
      });

    expect(res.status).toBe(201);
    const extra = res.body.extras.find((row: { name: string }) => row.name === "10K Hoodie");
    expect(extra.scope_type).toBe("selected_categories");
    expect(extra.category_ids).toEqual([categoryId]);
  });

  it("POST rejects more than five fields per extra", async () => {
    const { app, authHeader } = await mountStaffPortalScenario(staffSeeds.draftWithCategory());

    const fields = Array.from({ length: 6 }, (_, i) => ({
      field_key: `field_${i}`,
      label: `Field ${i}`,
      field_type: "text",
      is_required: false,
      sort_order: i,
    }));

    const res = await request(app)
      .post(`/api/organizer/events/${STAFF_SCENARIO.defaultEventId}/extras`)
      .set("Authorization", authHeader)
      .send({
        name: "Too Many Fields",
        price_cents: 0,
        is_free: true,
        fields,
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/maximum 5/i);
  });

  it("PATCH rejects field changes after sales exist", async () => {
    const { app, authHeader, db } = await mountStaffPortalScenario(staffSeeds.draftWithCategory());

    const created = await request(app)
      .post(`/api/organizer/events/${STAFF_SCENARIO.defaultEventId}/extras`)
      .set("Authorization", authHeader)
      .send({
        name: "Sold Item",
        price_cents: 0,
        is_free: true,
        fields: [
          {
            field_key: "note",
            label: "Note",
            field_type: "text",
            is_required: false,
            sort_order: 0,
          },
        ],
      });
    const extraId = created.body.extras[0].id;
    const extra = db.extras.find((row) => Number(row.id) === Number(extraId));
    if (extra) extra.sold_count = 1;

    const patched = await request(app)
      .patch(`/api/organizer/events/${STAFF_SCENARIO.defaultEventId}/extras/${extraId}`)
      .set("Authorization", authHeader)
      .send({
        fields: [
          {
            field_key: "note2",
            label: "Other",
            field_type: "text",
            is_required: false,
            sort_order: 0,
          },
        ],
      });

    expect(patched.status).toBe(409);
    expect(patched.body.error).toMatch(/locked|sales exist/i);
  });

  it("PATCH still allows description update after sales", async () => {
    const { app, authHeader, db } = await mountStaffPortalScenario(staffSeeds.draftWithCategory());

    const created = await request(app)
      .post(`/api/organizer/events/${STAFF_SCENARIO.defaultEventId}/extras`)
      .set("Authorization", authHeader)
      .send({ name: "Mutable Meta", price_cents: 0, is_free: true });
    const extraId = created.body.extras[0].id;
    const extra = db.extras.find((row) => Number(row.id) === Number(extraId));
    if (extra) extra.sold_count = 2;

    const patched = await request(app)
      .patch(`/api/organizer/events/${STAFF_SCENARIO.defaultEventId}/extras/${extraId}`)
      .set("Authorization", authHeader)
      .send({ description: "Updated pickup info" });

    expect(patched.status).toBe(200);
    expect(
      patched.body.extras.find((row: { id: number }) => row.id === extraId)?.description,
    ).toBe("Updated pickup info");
  });
});

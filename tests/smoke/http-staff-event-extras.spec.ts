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

describe("HTTP smoke: organizer event extras CRUD", () => {
  afterEach(async () => {
    await teardownStaffPortalScenario();
  });

  it("POST creates a custom extra on draft event", async () => {
    const { app, authHeader } = await mountStaffPortalScenario(
      staffSeeds.draftWithCategory(),
    );

    const res = await request(app)
      .post(`/api/organizer/events/${STAFF_SCENARIO.defaultEventId}/extras`)
      .set("Authorization", authHeader)
      .send({
        name: "Finisher Hoodie",
        price_cents: 75000,
        extra_type: "merch",
        max_per_athlete: 2,
        description: "Limited edition",
      });

    expect(res.status).toBe(201);
    expect(res.body.extras).toHaveLength(1);
    expect(res.body.extras[0].name).toBe("Finisher Hoodie");
    expect(res.body.extras[0].price_cents).toBe(75000);
  });

  it("rejects extra without name", async () => {
    const { app, authHeader } = await mountStaffPortalScenario(
      staffSeeds.draftWithCategory(),
    );

    const res = await request(app)
      .post(`/api/organizer/events/${STAFF_SCENARIO.defaultEventId}/extras`)
      .set("Authorization", authHeader)
      .send({ price_cents: 1000 });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/name required/i);
  });

  it("DELETE removes unsold extra", async () => {
    const { app, authHeader, db } = await mountStaffPortalScenario(
      staffSeeds.draftWithCategory(),
    );

    await request(app)
      .post(`/api/organizer/events/${STAFF_SCENARIO.defaultEventId}/extras`)
      .set("Authorization", authHeader)
      .send({ name: "Temp Item", price_cents: 0, extra_type: "custom" });

    const extraId = Number(db.extras[0]?.id);
    expect(extraId).toBeGreaterThan(0);

    const deleted = await request(app)
      .delete(
        `/api/organizer/events/${STAFF_SCENARIO.defaultEventId}/extras/${extraId}`,
      )
      .set("Authorization", authHeader);

    expect(deleted.status).toBe(200);
    expect(db.extras).toHaveLength(0);
    expect(deleted.body.extras).toHaveLength(0);
  });

  it("DELETE soft-deactivates extra with sales instead of hard delete", async () => {
    const { app, authHeader, db } = await mountStaffPortalScenario(
      staffSeeds.draftWithCategory(),
    );

    await request(app)
      .post(`/api/organizer/events/${STAFF_SCENARIO.defaultEventId}/extras`)
      .set("Authorization", authHeader)
      .send({ name: "Sold Tee", price_cents: 0, extra_type: "merch" });

    const extraId = Number(db.extras[0]?.id);
    const extra = db.extras.find((row) => Number(row.id) === extraId);
    if (extra) extra.sold_count = 3;

    const deleted = await request(app)
      .delete(
        `/api/organizer/events/${STAFF_SCENARIO.defaultEventId}/extras/${extraId}`,
      )
      .set("Authorization", authHeader);

    expect(deleted.status).toBe(200);
    expect(db.extras).toHaveLength(1);
    expect(Number(db.extras[0]?.is_active)).toBe(0);
    expect(deleted.body.extras.some((row: { id: number }) => row.id === extraId)).toBe(
      true,
    );
  });

  it("DELETE is idempotent when extra already removed", async () => {
    const { app, authHeader, db } = await mountStaffPortalScenario(
      staffSeeds.draftWithCategory(),
    );

    await request(app)
      .post(`/api/organizer/events/${STAFF_SCENARIO.defaultEventId}/extras`)
      .set("Authorization", authHeader)
      .send({ name: "One-time Item", price_cents: 0, extra_type: "custom" });

    const extraId = Number(db.extras[0]?.id);

    const first = await request(app)
      .delete(
        `/api/organizer/events/${STAFF_SCENARIO.defaultEventId}/extras/${extraId}`,
      )
      .set("Authorization", authHeader);
    expect(first.status).toBe(200);
    expect(db.extras).toHaveLength(0);

    const second = await request(app)
      .delete(
        `/api/organizer/events/${STAFF_SCENARIO.defaultEventId}/extras/${extraId}`,
      )
      .set("Authorization", authHeader);
    expect(second.status).toBe(200);
    expect(second.body.extras).toHaveLength(0);
  });

  it("GET event detail for organizer includes extras list", async () => {
    const { app, authHeader } = await mountStaffPortalScenario(
      staffSeeds.draftWithCategory(),
    );

    await request(app)
      .post(`/api/organizer/events/${STAFF_SCENARIO.defaultEventId}/extras`)
      .set("Authorization", authHeader)
      .send({ name: "Parking Pass", price_cents: 25000, extra_type: "service" });

    const detail = await request(app)
      .get(`/api/organizer/events/${STAFF_SCENARIO.defaultEventId}`)
      .set("Authorization", authHeader);

    expect(detail.status).toBe(200);
    expect(detail.body.extras).toHaveLength(1);
    expect(detail.body.extras[0].name).toBe("Parking Pass");
  });
});

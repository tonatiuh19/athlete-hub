/**
 * @vitest-environment node
 *
 * HTTP smoke: paginated staff events list (admin + organizer) with filters,
 * sorting clamps, empty pages, and member access edges.
 */
import { describe, it, expect, afterEach } from "vitest";
import request from "supertest";
import {
  mountStaffPortalScenario,
  teardownStaffPortalScenario,
  STAFF_SCENARIO,
} from "../helpers/staffPortalHarness";
import { staffSeeds } from "../helpers/staffPortalScenarioDb";

describe("HTTP smoke: staff events list pagination", () => {
  afterEach(async () => {
    await teardownStaffPortalScenario();
  });

  it("admin list returns pagination envelope with defaults", async () => {
    const { app, authHeader } = await mountStaffPortalScenario(
      staffSeeds.draftWithCategory(),
      { actor: "admin" },
    );

    const res = await request(app)
      .get("/api/admin/events")
      .set("Authorization", authHeader);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.events)).toBe(true);
    expect(res.body.pagination).toMatchObject({
      page: 1,
      limit: 20,
      total: expect.any(Number),
      totalPages: expect.any(Number),
    });
    expect(res.body.events.length).toBeGreaterThan(0);
    expect(res.body.events[0]).toMatchObject({
      id: expect.any(Number),
      title: expect.any(String),
      status: expect.any(String),
      has_paid_categories: expect.any(Boolean),
      payments_available: expect.any(Boolean),
    });
  });

  it("admin filters by status and search query", async () => {
    const { app, authHeader } = await mountStaffPortalScenario(
      {
        events: [
          { id: 100, status: "draft", title: "Alpha Draft", slug: "alpha-draft" },
          { id: 101, status: "published", title: "Beta Race", slug: "beta-race" },
          { id: 102, status: "published", title: "Gamma Trail", slug: "gamma-trail" },
        ],
      },
      { actor: "admin" },
    );

    const byStatus = await request(app)
      .get("/api/admin/events")
      .query({ status: "published" })
      .set("Authorization", authHeader);

    expect(byStatus.status).toBe(200);
    expect(byStatus.body.events.every((e: { status: string }) => e.status === "published")).toBe(
      true,
    );
    expect(byStatus.body.pagination.total).toBe(2);

    const byQuery = await request(app)
      .get("/api/admin/events")
      .query({ q: "gamma" })
      .set("Authorization", authHeader);

    expect(byQuery.status).toBe(200);
    expect(byQuery.body.events).toHaveLength(1);
    expect(byQuery.body.events[0].slug).toBe("gamma-trail");
  });

  it("ignores invalid status values instead of erroring", async () => {
    const { app, authHeader } = await mountStaffPortalScenario(
      staffSeeds.draftWithCategory(),
      { actor: "admin" },
    );

    const res = await request(app)
      .get("/api/admin/events")
      .query({ status: "not_a_real_status" })
      .set("Authorization", authHeader);

    expect(res.status).toBe(200);
    expect(res.body.pagination.total).toBeGreaterThanOrEqual(1);
  });

  it("returns 400 for invalid organizerId", async () => {
    const { app, authHeader } = await mountStaffPortalScenario(
      staffSeeds.empty(),
      { actor: "admin" },
    );

    const res = await request(app)
      .get("/api/admin/events")
      .query({ organizerId: "abc" })
      .set("Authorization", authHeader);

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/organizerId/i);
  });

  it("paginates across pages and clamps oversized limit", async () => {
    const many = Array.from({ length: 25 }, (_, i) => ({
      id: 200 + i,
      status: "draft" as const,
      title: `Event ${i + 1}`,
      slug: `event-${i + 1}`,
    }));
    const { app, authHeader } = await mountStaffPortalScenario(
      { events: many },
      { actor: "admin" },
    );

    const page1 = await request(app)
      .get("/api/admin/events")
      .query({ page: 1, limit: 10, sortBy: "title", sortDir: "ASC" })
      .set("Authorization", authHeader);

    expect(page1.status).toBe(200);
    expect(page1.body.events).toHaveLength(10);
    expect(page1.body.pagination).toMatchObject({
      page: 1,
      limit: 10,
      total: 25,
      totalPages: 3,
    });

    const page3 = await request(app)
      .get("/api/admin/events")
      .query({ page: 3, limit: 10 })
      .set("Authorization", authHeader);

    expect(page3.status).toBe(200);
    expect(page3.body.events).toHaveLength(5);
    expect(page3.body.pagination.page).toBe(3);

    const pastEnd = await request(app)
      .get("/api/admin/events")
      .query({ page: 99, limit: 10 })
      .set("Authorization", authHeader);

    expect(pastEnd.status).toBe(200);
    expect(pastEnd.body.events).toHaveLength(0);
    expect(pastEnd.body.pagination.total).toBe(25);

    const clamped = await request(app)
      .get("/api/admin/events")
      .query({ limit: 500 })
      .set("Authorization", authHeader);

    expect(clamped.status).toBe(200);
    expect(clamped.body.pagination.limit).toBe(100);
    expect(clamped.body.events.length).toBeLessThanOrEqual(100);
  });

  it("organizer list is paginated and scoped to organizer", async () => {
    const { app, authHeader } = await mountStaffPortalScenario(
      staffSeeds.draftWithCategory(),
    );

    const res = await request(app)
      .get("/api/organizer/events")
      .query({ page: 1, limit: 20 })
      .set("Authorization", authHeader);

    expect(res.status).toBe(200);
    expect(res.body.pagination).toMatchObject({
      page: 1,
      limit: 20,
      total: expect.any(Number),
    });
    expect(
      res.body.events.every(
        (e: { organizer_id: number }) => e.organizer_id === STAFF_SCENARIO.organizerId,
      ),
    ).toBe(true);
  });

  it("empty organizer catalog returns empty page with total 0", async () => {
    const { app, authHeader } = await mountStaffPortalScenario(staffSeeds.empty());

    const res = await request(app)
      .get("/api/organizer/events")
      .set("Authorization", authHeader);

    expect(res.status).toBe(200);
    expect(res.body.events).toEqual([]);
    expect(res.body.pagination.total).toBe(0);
    expect(res.body.pagination.totalPages).toBe(1);
  });
});

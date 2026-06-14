/**
 * @vitest-environment node
 *
 * HTTP smoke: organizer event create → submit for approval → admin publish/reject.
 * Uses in-memory StaffPortalScenarioDb — no TiDB or live data.
 */
import { describe, it, expect, afterEach } from "vitest";
import request from "supertest";
import {
  mountStaffPortalScenario,
  teardownStaffPortalScenario,
  STAFF_SCENARIO,
} from "../helpers/staffPortalHarness";
import { staffSeeds } from "../helpers/staffPortalScenarioDb";

const eventBody = {
  title: "Smoke Test Marathon",
  sport_type_id: STAFF_SCENARIO.sportTypeId,
  start_date: "2026-10-01T08:00:00",
  status: "draft",
  visibility: "public",
  requires_waiver: false,
};

describe("HTTP smoke: organizer event approval workflow", () => {
  afterEach(async () => {
    await teardownStaffPortalScenario();
  });

  it("organizer creates draft with ISO check-in datetimes", async () => {
    const { app, authHeader } = await mountStaffPortalScenario(staffSeeds.empty());

    const res = await request(app)
      .post("/api/organizer/events")
      .set("Authorization", authHeader)
      .send({
        ...eventBody,
        end_date: "2026-10-02T18:00:00.000Z",
        check_in_opens_at: "2026-10-01T08:00:00.000Z",
        check_in_closes_at: "2026-10-02T18:00:00.000Z",
      });

    expect(res.status).toBe(201);
    expect(res.body.event.status).toBe("draft");
  });

  it("organizer owner creates a draft event", async () => {
    const { app, db, authHeader } = await mountStaffPortalScenario(staffSeeds.empty());

    const res = await request(app)
      .post("/api/organizer/events")
      .set("Authorization", authHeader)
      .send(eventBody);

    expect(res.status).toBe(201);
    expect(res.body.event.status).toBe("draft");
    expect(res.body.event.title).toBe("Smoke Test Marathon");
    expect(db.getEvent(res.body.event.id)?.status).toBe("draft");
  });

  it("finance role cannot create events", async () => {
    const { app, authHeader } = await mountStaffPortalScenario(staffSeeds.financeUser());

    const res = await request(app)
      .post("/api/organizer/events")
      .set("Authorization", authHeader)
      .send(eventBody);

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/insufficient permissions/i);
  });

  it("organizer cannot PATCH status to published directly", async () => {
    const { app, authHeader } = await mountStaffPortalScenario(staffSeeds.draftWithCategory());

    const res = await request(app)
      .patch(`/api/organizer/events/${STAFF_SCENARIO.defaultEventId}`)
      .set("Authorization", authHeader)
      .send({ ...eventBody, title: "Updated", status: "published" });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe("organizer_publish_requires_approval");
  });

  it("organizer can save edits while event is pending approval", async () => {
    const { app, db, authHeader } = await mountStaffPortalScenario(
      staffSeeds.pendingApproval(),
    );

    const res = await request(app)
      .patch(`/api/organizer/events/${STAFF_SCENARIO.defaultEventId}`)
      .set("Authorization", authHeader)
      .send({
        ...eventBody,
        title: "Pending title tweak",
        status: "draft",
      });

    expect(res.status).toBe(200);
    expect(res.body.event.status).toBe("draft");
    expect(db.getEvent(STAFF_SCENARIO.defaultEventId)?.title).toBe("Pending title tweak");
  });

  it("organizer cannot PATCH status to pending_approval directly", async () => {
    const { app, authHeader } = await mountStaffPortalScenario(staffSeeds.draftWithCategory());

    const res = await request(app)
      .patch(`/api/organizer/events/${STAFF_SCENARIO.defaultEventId}`)
      .set("Authorization", authHeader)
      .send({ ...eventBody, status: "pending_approval" });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe("organizer_submit_requires_publish_endpoint");
  });

  it("organizer create rejects end_date before start_date", async () => {
    const { app, authHeader } = await mountStaffPortalScenario(staffSeeds.empty());

    const res = await request(app)
      .post("/api/organizer/events")
      .set("Authorization", authHeader)
      .send({
        ...eventBody,
        end_date: "2026-09-01T08:00:00.000Z",
        start_date: "2026-10-01T08:00:00.000Z",
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/end_date/i);
  });

  it("organizer submits draft for admin approval", async () => {
    const { app, db, authHeader } = await mountStaffPortalScenario(
      staffSeeds.draftWithCategory(),
    );

    const res = await request(app)
      .post(`/api/organizer/events/${STAFF_SCENARIO.defaultEventId}/publish`)
      .set("Authorization", authHeader)
      .send();

    expect(res.status).toBe(200);
    expect(res.body.event.status).toBe("pending_approval");
    expect(db.getEvent(STAFF_SCENARIO.defaultEventId)?.status).toBe("pending_approval");
    expect(db.publishedSlugs()).not.toContain("test-event-100");
  });

  it("rejects duplicate submit while already pending", async () => {
    const { app, authHeader } = await mountStaffPortalScenario(staffSeeds.pendingApproval());

    const res = await request(app)
      .post(`/api/organizer/events/${STAFF_SCENARIO.defaultEventId}/publish`)
      .set("Authorization", authHeader)
      .send();

    expect(res.status).toBe(409);
  });

  it("rejects submit without active categories", async () => {
    const { app, authHeader } = await mountStaffPortalScenario(staffSeeds.empty());

    const created = await request(app)
      .post("/api/organizer/events")
      .set("Authorization", authHeader)
      .send(eventBody);
    expect(created.status).toBe(201);

    const res = await request(app)
      .post(`/api/organizer/events/${created.body.event.id}/publish`)
      .set("Authorization", authHeader)
      .send();

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/category/i);
  });

  it("admin approves pending event → published (not public until published)", async () => {
    const { app, db, authHeader } = await mountStaffPortalScenario(
      staffSeeds.pendingApproval(),
      { actor: "admin" },
    );

    const res = await request(app)
      .post(`/api/admin/events/${STAFF_SCENARIO.defaultEventId}/publish`)
      .set("Authorization", authHeader)
      .send();

    expect(res.status).toBe(200);
    expect(res.body.event.status).toBe("published");
    expect(db.publishedSlugs()).toContain("test-event-100");
  });

  it("admin rejects pending event back to draft", async () => {
    const { app, db, authHeader } = await mountStaffPortalScenario(
      staffSeeds.pendingApproval(),
      { actor: "admin" },
    );

    const res = await request(app)
      .post(`/api/admin/events/${STAFF_SCENARIO.defaultEventId}/reject`)
      .set("Authorization", authHeader)
      .send({ reason: "Needs more detail" });

    expect(res.status).toBe(200);
    expect(res.body.event.status).toBe("draft");
    expect(db.getEvent(STAFF_SCENARIO.defaultEventId)?.status).toBe("draft");
    expect(db.publishedSlugs()).toHaveLength(0);
  });

  it("admin cannot reject a draft event", async () => {
    const { app, authHeader } = await mountStaffPortalScenario(
      staffSeeds.draftWithCategory(),
      { actor: "admin" },
    );

    const res = await request(app)
      .post(`/api/admin/events/${STAFF_SCENARIO.defaultEventId}/reject`)
      .set("Authorization", authHeader)
      .send();

    expect(res.status).toBe(400);
  });

  it("admin cannot publish a draft event directly", async () => {
    const { app, authHeader } = await mountStaffPortalScenario(
      staffSeeds.draftWithCategory(),
      { actor: "admin" },
    );

    const res = await request(app)
      .post(`/api/admin/events/${STAFF_SCENARIO.defaultEventId}/publish`)
      .set("Authorization", authHeader)
      .send();

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/pending approval/i);
  });

  it("finance role cannot add categories", async () => {
    const { app, authHeader } = await mountStaffPortalScenario({
      memberId: STAFF_SCENARIO.financeMemberId,
      memberRole: "finance",
      events: [{ id: STAFF_SCENARIO.defaultEventId, status: "draft" }],
    });

    const res = await request(app)
      .post(`/api/organizer/events/${STAFF_SCENARIO.defaultEventId}/categories`)
      .set("Authorization", authHeader)
      .send({ name: "10K", price_cents: 0, is_active: true });

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/insufficient permissions/i);
  });

  it("organizer can upload event asset payload above default JSON limit", async () => {
    const { app, authHeader } = await mountStaffPortalScenario(staffSeeds.empty());

    const largePayload = Buffer.alloc(150 * 1024, 0xff).toString("base64");

    const res = await request(app)
      .post("/api/organizer/events/upload-asset")
      .set("Authorization", authHeader)
      .send({
        dataBase64: largePayload,
        filename: "large.png",
        mimeType: "image/png",
        uploadId: "smoke_large",
        assetKind: "image",
      });

    expect(res.status).not.toBe(413);
  });

  it("finance role cannot upload event assets", async () => {
    const { app, authHeader } = await mountStaffPortalScenario({
      memberId: STAFF_SCENARIO.financeMemberId,
      memberRole: "finance",
      events: [{ id: STAFF_SCENARIO.defaultEventId, status: "draft" }],
    });

    const res = await request(app)
      .post("/api/organizer/events/upload-asset")
      .set("Authorization", authHeader)
      .send({
        dataBase64: Buffer.from("test").toString("base64"),
        filename: "test.png",
        mimeType: "image/png",
      });

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/insufficient permissions/i);
  });

  it("finance role cannot bulk-import bibs on event hub route", async () => {
    const { app, authHeader } = await mountStaffPortalScenario({
      memberId: STAFF_SCENARIO.financeMemberId,
      memberRole: "finance",
      events: [{ id: STAFF_SCENARIO.defaultEventId, status: "draft" }],
    });

    const res = await request(app)
      .post(
        `/api/organizer/events/${STAFF_SCENARIO.defaultEventId}/registrations/bulk-bib`,
      )
      .set("Authorization", authHeader)
      .send({ rows: [{ folio: "REG-001", bib: "101" }] });

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/insufficient permissions/i);
  });

  it("legacy bulk-bib route is removed", async () => {
    const { app, authHeader } = await mountStaffPortalScenario(
      staffSeeds.draftWithCategory(),
    );

    const res = await request(app)
      .post("/api/organizer/registrations/bulk-bib")
      .set("Authorization", authHeader)
      .send({ rows: [{ folio: "REG-001", bib: "101" }] });

    expect(res.status).toBe(404);
  });

  it("organizer create rejects location_city not in geo catalog", async () => {
    const { app, authHeader } = await mountStaffPortalScenario(staffSeeds.empty());

    const res = await request(app)
      .post("/api/organizer/events")
      .set("Authorization", authHeader)
      .send({
        ...eventBody,
        location_city: "Not A Real City",
        location_state: "XX",
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/geo catalog/i);
  });

  it("admin reject persists rejection reason on event", async () => {
    const { app, db, authHeader } = await mountStaffPortalScenario(
      staffSeeds.pendingApproval(),
      { actor: "admin" },
    );

    const res = await request(app)
      .post(`/api/admin/events/${STAFF_SCENARIO.defaultEventId}/reject`)
      .set("Authorization", authHeader)
      .send({ reason: "Missing waiver PDF" });

    expect(res.status).toBe(200);
    expect(db.getEvent(STAFF_SCENARIO.defaultEventId)?.approval_rejection_reason).toBe(
      "Missing waiver PDF",
    );
  });
});

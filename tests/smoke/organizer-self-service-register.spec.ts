/**
 * @vitest-environment node
 *
 * HTTP smoke: self-service organizer registration → draft event create.
 */
import { describe, it, expect, afterEach } from "vitest";
import request from "supertest";
import {
  mountStaffPortalScenario,
  setStaffPortalAuthBypass,
  teardownStaffPortalScenario,
  STAFF_SCENARIO,
} from "../helpers/staffPortalHarness";
import { staffSeeds } from "../helpers/staffPortalScenarioDb";

const registerBody = {
  owner_first_name: "Maria",
  owner_last_name: "Lopez",
  owner_email: "maria.selfservice@test.local",
  name: "Carrera Self Service",
  city: "Ciudad de México",
  country: "MX",
  locale: "es",
  intake: {
    sport_type_id: STAFF_SCENARIO.sportTypeId,
    rough_date: "2026-11",
    expected_size: "100-500",
  },
};

const eventBody = {
  title: "Self-Service Smoke Marathon",
  sport_type_id: STAFF_SCENARIO.sportTypeId,
  start_date: "2026-10-01T08:00:00",
  status: "draft",
  visibility: "public",
  requires_waiver: false,
};

describe("HTTP smoke: organizer self-service registration", () => {
  afterEach(async () => {
    await teardownStaffPortalScenario();
  });

  it("registers a new organizer with catalog city", async () => {
    const { app } = await mountStaffPortalScenario(staffSeeds.empty());

    const res = await request(app)
      .post("/api/public/organizers/register")
      .send(registerBody);

    expect(res.status).toBe(201);
    expect(res.body.organizer.name).toBe("Carrera Self Service");
    expect(res.body.next).toBe("verify_otp");
  });

  it("rejects duplicate owner email", async () => {
    const { app } = await mountStaffPortalScenario(staffSeeds.empty());

    await request(app).post("/api/public/organizers/register").send(registerBody);
    const res = await request(app).post("/api/public/organizers/register").send({
      ...registerBody,
      name: "Another Org",
      email: "other-org@test.local",
    });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("organizer_member_email_exists");
  });

  it("registered organizer can create a draft event", async () => {
    const { app, db, authHeader } = await mountStaffPortalScenario(staffSeeds.empty());

    const reg = await request(app)
      .post("/api/public/organizers/register")
      .send(registerBody);
    expect(reg.status).toBe(201);

    const organizerId = db.getLastRegisteredOrganizerId();
    const memberId = db.getLastRegisteredMemberId();

    await setStaffPortalAuthBypass({
      actor: "organizer",
      id: memberId,
      email: registerBody.owner_email,
      organizerId,
      jti: "staff-smoke-self-service",
    });

    const eventRes = await request(app)
      .post("/api/organizer/events")
      .set("Authorization", authHeader)
      .send(eventBody);

    expect(eventRes.status).toBe(201);
    expect(eventRes.body.event.status).toBe("draft");
    expect(eventRes.body.event.organizer_id).toBe(organizerId);
  });

  it("blocks event create for suspended organizer", async () => {
    const { app, db, authHeader } = await mountStaffPortalScenario(staffSeeds.empty());

    await request(app).post("/api/public/organizers/register").send(registerBody);
    const organizerId = db.getLastRegisteredOrganizerId();
    const memberId = db.getLastRegisteredMemberId();
    const org = db.organizers.find((o) => o.id === organizerId);
    if (org) org.status = "suspended";

    await setStaffPortalAuthBypass({
      actor: "organizer",
      id: memberId,
      email: registerBody.owner_email,
      organizerId,
      jti: "staff-smoke-suspended",
    });

    const eventRes = await request(app)
      .post("/api/organizer/events")
      .set("Authorization", authHeader)
      .send(eventBody);

    expect(eventRes.status).toBe(403);
    expect(eventRes.body.code).toBe("organizer_suspended");
  });
});

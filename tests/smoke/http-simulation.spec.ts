/**
 * @vitest-environment node
 *
 * Robust HTTP smoke for organizer simulation events:
 * create/list/quota/owner gate, public magic URL, checkout/confirm flags,
 * expiry, resume token, portal exclusion, publish block.
 */
import { describe, it, expect, afterEach, beforeEach } from "vitest";
import request from "supertest";
import {
  mountRegistrationScenario,
  teardownHttpScenario,
  SCENARIO,
} from "../helpers/httpHarness";
import {
  mountStaffPortalScenario,
  teardownStaffPortalScenario,
  STAFF_SCENARIO,
} from "../helpers/staffPortalHarness";
import { seeds } from "../helpers/scenarioDb";
import { staffSeeds } from "../helpers/staffPortalScenarioDb";

const SIM_TOKEN = "a".repeat(64);

describe("HTTP smoke: simulation events", () => {
  const prevTestSecret = process.env.STRIPE_TEST_SECRET_KEY;
  const prevTestPk = process.env.STRIPE_TEST_PUBLISHABLE_KEY;

  beforeEach(() => {
    process.env.STRIPE_TEST_SECRET_KEY = "sk_test_simulation_smoke";
    process.env.STRIPE_TEST_PUBLISHABLE_KEY = "pk_test_simulation_smoke";
  });

  afterEach(async () => {
    await teardownHttpScenario();
    await teardownStaffPortalScenario();
    if (prevTestSecret === undefined) delete process.env.STRIPE_TEST_SECRET_KEY;
    else process.env.STRIPE_TEST_SECRET_KEY = prevTestSecret;
    if (prevTestPk === undefined) delete process.env.STRIPE_TEST_PUBLISHABLE_KEY;
    else process.env.STRIPE_TEST_PUBLISHABLE_KEY = prevTestPk;
  });

  describe("staff CRUD & gates", () => {
    it("owner creates a blank simulation and receives magic link", async () => {
      const { app, db, authHeader } = await mountStaffPortalScenario(staffSeeds.empty());

      const res = await request(app)
        .post("/api/organizer/simulations")
        .set("Authorization", authHeader)
        .send({
          title: "Smoke Sim",
          sportTypeId: STAFF_SCENARIO.sportTypeId,
          startDate: "2026-11-01",
        });

      expect(res.status).toBe(201);
      expect(res.body.token).toMatch(/^[a-f0-9]{64}$/);
      expect(res.body.access_url).toContain("/events/sim/");
      expect(res.body.simulation?.is_simulation).toBe(true);
      expect(db.events.some((e) => Number(e.is_simulation) === 1)).toBe(true);
    });

    it("non-owner organizer cannot create simulations", async () => {
      const { app, authHeader } = await mountStaffPortalScenario(
        staffSeeds.organizerNotOwner(),
      );

      const res = await request(app)
        .post("/api/organizer/simulations")
        .set("Authorization", authHeader)
        .send({
          title: "Nope",
          sportTypeId: STAFF_SCENARIO.sportTypeId,
          startDate: "2026-11-01",
        });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("simulation_owner_only");
    });

    it("enforces max 3 active simulations per organizer", async () => {
      const { app, authHeader } = await mountStaffPortalScenario(
        staffSeeds.simulationQuotaFull(),
      );

      const res = await request(app)
        .post("/api/organizer/simulations")
        .set("Authorization", authHeader)
        .send({
          title: "Over quota",
          sportTypeId: STAFF_SCENARIO.sportTypeId,
          startDate: "2026-11-01",
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("simulation_quota");
    });

    it("lists organizer simulations with quota metadata", async () => {
      const { app, authHeader } = await mountStaffPortalScenario(
        staffSeeds.simulationShell(),
      );

      const res = await request(app)
        .get("/api/organizer/simulations")
        .set("Authorization", authHeader);

      expect(res.status).toBe(200);
      expect(res.body.simulations.length).toBeGreaterThanOrEqual(1);
      expect(res.body.quota.max_active).toBe(3);
      expect(res.body.quota.max_regs_per_event).toBe(50);
      expect(res.body.quota.ttl_days).toBe(3);
    });

    it("admin can list all simulations", async () => {
      const { app, authHeader } = await mountStaffPortalScenario(
        staffSeeds.simulationShell(),
        { actor: "admin" },
      );

      const res = await request(app)
        .get("/api/admin/simulations")
        .set("Authorization", authHeader);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.simulations)).toBe(true);
      expect(res.body.simulations[0]?.is_simulation).toBe(true);
    });

    it("regenerates magic link token", async () => {
      const { app, db, authHeader } = await mountStaffPortalScenario(
        staffSeeds.simulationShell(),
      );
      const before = db.getEvent(STAFF_SCENARIO.defaultEventId)?.simulation_access_token;

      const res = await request(app)
        .post(`/api/organizer/simulations/${STAFF_SCENARIO.defaultEventId}/regenerate-link`)
        .set("Authorization", authHeader)
        .send();

      expect(res.status).toBe(200);
      expect(res.body.token).toMatch(/^[a-f0-9]{64}$/);
      expect(res.body.token).not.toBe(before);
      expect(db.getEvent(STAFF_SCENARIO.defaultEventId)?.simulation_access_token).toBe(
        res.body.token,
      );
    });

    it("owner can reset simulation generated data", async () => {
      const { app, authHeader } = await mountStaffPortalScenario(
        staffSeeds.simulationShell(),
      );

      const res = await request(app)
        .post(`/api/organizer/simulations/${STAFF_SCENARIO.defaultEventId}/reset`)
        .set("Authorization", authHeader)
        .send();

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.wiped).toBeTruthy();
    });

    it("lists simulations inside organizer events with filter", async () => {
      const { app, authHeader } = await mountStaffPortalScenario(
        staffSeeds.simulationShell(),
      );

      const all = await request(app)
        .get("/api/organizer/events")
        .set("Authorization", authHeader);
      expect(all.status).toBe(200);
      expect(
        all.body.events.some(
          (e: { is_simulation?: boolean }) => e.is_simulation === true,
        ),
      ).toBe(true);

      const simsOnly = await request(app)
        .get("/api/organizer/events")
        .query({ simulation: "1" })
        .set("Authorization", authHeader);
      expect(simsOnly.status).toBe(200);
      expect(simsOnly.body.events.length).toBeGreaterThanOrEqual(1);
      expect(
        simsOnly.body.events.every(
          (e: { is_simulation?: boolean }) => e.is_simulation === true,
        ),
      ).toBe(true);

      const liveOnly = await request(app)
        .get("/api/organizer/events")
        .query({ simulation: "0" })
        .set("Authorization", authHeader);
      expect(liveOnly.status).toBe(200);
      expect(
        liveOnly.body.events.every(
          (e: { is_simulation?: boolean }) => !e.is_simulation,
        ),
      ).toBe(true);
    });

    it("blocks publishing a simulation event", async () => {
      const { app, authHeader } = await mountStaffPortalScenario(
        staffSeeds.simulationShell(),
      );

      const res = await request(app)
        .post(`/api/organizer/events/${STAFF_SCENARIO.defaultEventId}/publish`)
        .set("Authorization", authHeader)
        .send();

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("simulation_not_publishable");
    });

    it("admin cannot publish a simulation either", async () => {
      const { app, authHeader } = await mountStaffPortalScenario(
        staffSeeds.simulationShell(),
        { actor: "admin" },
      );

      const res = await request(app)
        .post(`/api/admin/events/${STAFF_SCENARIO.defaultEventId}/publish`)
        .set("Authorization", authHeader)
        .send();

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("simulation_not_publishable");
    });
  });

  describe("public access + checkout", () => {
    it("loads gated simulation payload by token", async () => {
      const { app } = await mountRegistrationScenario(seeds.simulationFreeOpen(), {
        auth: false,
      });

      const res = await request(app).get(`/api/sim/${SIM_TOKEN}`);
      expect(res.status).toBe(200);
      expect(res.body.event.is_simulation).toBe(true);
      expect(res.body.event.simulation_expired).toBe(false);
      expect(res.body.simulation.do_not_share).toBe(true);
      expect(res.body.simulation.future_paid_feature).toBe(true);
      expect(res.body.categories.length).toBeGreaterThanOrEqual(1);
    });

    it("returns 404 for unknown simulation token", async () => {
      const { app } = await mountRegistrationScenario(seeds.simulationFreeOpen(), {
        auth: false,
      });

      const res = await request(app).get(`/api/sim/${"z".repeat(64)}`);
      expect(res.status).toBe(404);
      expect(res.body.code).toBe("simulation_not_found");
    });

    it("serves Stripe test publishable key for valid sim token", async () => {
      const { app } = await mountRegistrationScenario(seeds.simulationFreeOpen(), {
        auth: false,
      });

      const res = await request(app).get(`/api/sim/${SIM_TOKEN}/stripe-config`);
      expect(res.status).toBe(200);
      expect(res.body.mode).toBe("simulation");
      expect(res.body.publishableKey).toBe("pk_test_simulation_smoke");
    });

    it("rejects live checkout without simulation token on draft sim", async () => {
      const { app, authHeader } = await mountRegistrationScenario(
        seeds.simulationFreeOpen(),
      );

      const res = await request(app)
        .post(`/api/events/${SCENARIO.slug}/register/checkout`)
        .set("Authorization", authHeader)
        .send({
          categoryId: SCENARIO.categoryId,
          fieldValues: {},
          idempotencyKey: "sim-no-token",
        });

      expect(res.status).toBe(404);
    });

    it("completes free sim checkout+confirm and flags is_simulation", async () => {
      const { app, db, authHeader } = await mountRegistrationScenario(
        seeds.simulationFreeOpen(),
      );

      const checkout = await request(app)
        .post(`/api/events/${SCENARIO.slug}/register/checkout`)
        .set("Authorization", authHeader)
        .send({
          categoryId: SCENARIO.categoryId,
          fieldValues: {},
          idempotencyKey: "sim-free-001",
          simulationToken: SIM_TOKEN,
        });

      expect(checkout.status).toBe(200);
      expect(checkout.body.amountCents).toBe(0);
      expect(db.payments[0]?.is_simulation).toBe(1);

      const confirm = await request(app)
        .post(`/api/events/${SCENARIO.slug}/register/confirm`)
        .set("Authorization", authHeader)
        .send({ paymentPublicUuid: checkout.body.paymentPublicUuid });

      expect(confirm.status).toBe(200);
      expect(confirm.body.success).toBe(true);
      expect(confirm.body.registration.status).toBe("confirmed");
      const reg = db.registrations.find(
        (r) => r.public_uuid === confirm.body.registration.public_uuid,
      );
      expect(Number(reg?.is_simulation ?? 0)).toBe(1);
    });

    it("excludes simulation registrations from athlete portal list", async () => {
      const { app, authHeader } = await mountRegistrationScenario(
        seeds.simulationFreeOpen(),
      );

      const checkout = await request(app)
        .post(`/api/events/${SCENARIO.slug}/register/checkout`)
        .set("Authorization", authHeader)
        .send({
          categoryId: SCENARIO.categoryId,
          fieldValues: {},
          idempotencyKey: "sim-portal-hide",
          simulationToken: SIM_TOKEN,
        });
      expect(checkout.status).toBe(200);

      const confirm = await request(app)
        .post(`/api/events/${SCENARIO.slug}/register/confirm`)
        .set("Authorization", authHeader)
        .send({ paymentPublicUuid: checkout.body.paymentPublicUuid });
      expect(confirm.status).toBe(200);

      const list = await request(app)
        .get("/api/athlete/registrations")
        .set("Authorization", authHeader);
      expect(list.status).toBe(200);
      expect(list.body.registrations).toEqual([]);
    });

    it("rejects checkout with wrong simulation token", async () => {
      const { app, authHeader } = await mountRegistrationScenario(
        seeds.simulationFreeOpen(),
      );

      const res = await request(app)
        .post(`/api/events/${SCENARIO.slug}/register/checkout`)
        .set("Authorization", authHeader)
        .send({
          categoryId: SCENARIO.categoryId,
          fieldValues: {},
          idempotencyKey: "sim-wrong-token",
          simulationToken: "f".repeat(64),
        });

      expect(res.status).toBe(404);
    });

    it("rejects checkout when simulation is expired", async () => {
      const { app, authHeader } = await mountRegistrationScenario(
        seeds.simulationExpired(),
      );

      const res = await request(app)
        .post(`/api/events/${SCENARIO.slug}/register/checkout`)
        .set("Authorization", authHeader)
        .send({
          categoryId: SCENARIO.categoryId,
          fieldValues: {},
          idempotencyKey: "sim-expired",
          simulationToken: "b".repeat(64),
        });

      expect(res.status).toBe(404);
    });

    it("marks expired flag on public sim payload", async () => {
      const { app } = await mountRegistrationScenario(seeds.simulationExpired(), {
        auth: false,
      });

      const res = await request(app).get(`/api/sim/${"b".repeat(64)}`);
      expect(res.status).toBe(200);
      expect(res.body.event.simulation_expired).toBe(true);
    });

    it("enforces simulation registration quota", async () => {
      const { app, authHeader } = await mountRegistrationScenario(
        seeds.simulationAtRegQuota(),
      );

      const res = await request(app)
        .post(`/api/events/${SCENARIO.slug}/register/checkout`)
        .set("Authorization", authHeader)
        .send({
          categoryId: SCENARIO.categoryId,
          fieldValues: {},
          idempotencyKey: "sim-quota",
          simulationToken: "c".repeat(64),
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("simulation_reg_limit");
    });

    it("resume requires simulationToken for draft sims", async () => {
      const { app, authHeader } = await mountRegistrationScenario(
        seeds.simulationFreeOpen(),
      );

      const checkout = await request(app)
        .post(`/api/events/${SCENARIO.slug}/register/checkout`)
        .set("Authorization", authHeader)
        .send({
          categoryId: SCENARIO.categoryId,
          fieldValues: {},
          idempotencyKey: "sim-resume",
          simulationToken: SIM_TOKEN,
        });
      expect(checkout.status).toBe(200);

      const missing = await request(app)
        .post(`/api/events/${SCENARIO.slug}/register/resume`)
        .set("Authorization", authHeader)
        .send({ paymentPublicUuid: checkout.body.paymentPublicUuid });
      expect(missing.status).toBe(404);

      const ok = await request(app)
        .post(`/api/events/${SCENARIO.slug}/register/resume`)
        .set("Authorization", authHeader)
        .send({
          paymentPublicUuid: checkout.body.paymentPublicUuid,
          simulationToken: SIM_TOKEN,
        });
      expect(ok.status).toBe(200);
      expect(["checkout", "complete"]).toContain(ok.body.status);
    });

    it("live free checkout still works without simulation fields", async () => {
      const { app, db, authHeader } = await mountRegistrationScenario(seeds.freeOpen());

      const checkout = await request(app)
        .post(`/api/events/${SCENARIO.slug}/register/checkout`)
        .set("Authorization", authHeader)
        .send({
          categoryId: SCENARIO.categoryId,
          fieldValues: {},
          idempotencyKey: "live-regression",
        });
      expect(checkout.status).toBe(200);

      const confirm = await request(app)
        .post(`/api/events/${SCENARIO.slug}/register/confirm`)
        .set("Authorization", authHeader)
        .send({ paymentPublicUuid: checkout.body.paymentPublicUuid });
      expect(confirm.status).toBe(200);
      expect(Number(db.payments[0]?.is_simulation ?? 0)).toBe(0);
      expect(
        Number(db.registrations[db.registrations.length - 1]?.is_simulation ?? 0),
      ).toBe(0);
    });
  });

  describe("cron cleanup auth", () => {
    it("rejects cleanup without secret", async () => {
      process.env.CRON_SECRET = "cron-test-secret";
      await teardownHttpScenario();
      const { app } = await mountRegistrationScenario(seeds.simulationFreeOpen(), {
        auth: false,
      });

      const res = await request(app).post("/api/cron/cleanup-simulations");
      expect(res.status).toBe(401);
    });

    it("accepts cleanup with bearer secret (no expired shells)", async () => {
      process.env.CRON_SECRET = "cron-test-secret";
      await teardownHttpScenario();
      const { app } = await mountRegistrationScenario(seeds.simulationFreeOpen(), {
        auth: false,
      });

      const res = await request(app)
        .post("/api/cron/cleanup-simulations")
        .set("Authorization", "Bearer cron-test-secret");
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.cleaned_events).toBe(0);
    });
  });
});

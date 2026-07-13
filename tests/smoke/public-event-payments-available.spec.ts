/**
 * @vitest-environment node
 *
 * HTTP smoke: public event detail exposes payments_available for paid events.
 */
import { describe, it, expect, afterEach } from "vitest";
import request from "supertest";
import { seeds, SCENARIO } from "../helpers/scenarioDb";
import {
  mountRegistrationScenario,
  teardownHttpScenario,
} from "../helpers/httpHarness";
import { createMockStripeClient } from "../helpers/mockStripeClient";

describe("HTTP smoke: public event payments_available", () => {
  afterEach(async () => {
    await teardownHttpScenario();
  });

  it("returns payments_available false when organizer Connect is not ready", async () => {
    const stripe = createMockStripeClient({ accountReady: false });
    const { app } = await mountRegistrationScenario(seeds.paidConnectNotReady(), {
      auth: false,
      stripe,
    });

    const res = await request(app).get(`/api/events/${SCENARIO.slug}`);

    expect(res.status).toBe(200);
    expect(res.body.has_paid_categories).toBe(true);
    expect(res.body.payments_available).toBe(false);
  });

  it("returns payments_available true for free-only published events", async () => {
    const { app } = await mountRegistrationScenario(
      { requiresWaiver: false, category: { price_cents: 0, capacity: 100 } },
      { auth: false },
    );

    const res = await request(app).get(`/api/events/${SCENARIO.slug}`);

    expect(res.status).toBe(200);
    expect(res.body.has_paid_categories).toBe(false);
    expect(res.body.payments_available).toBe(true);
  });

  it("returns payments_available true when Connect is ready", async () => {
    const stripe = createMockStripeClient({ accountId: "acct_test_ready" });
    const { app } = await mountRegistrationScenario(seeds.paidConnectReady(), {
      auth: false,
      stripe,
    });

    const res = await request(app).get(`/api/events/${SCENARIO.slug}`);

    expect(res.status).toBe(200);
    expect(res.body.has_paid_categories).toBe(true);
    expect(res.body.payments_available).toBe(true);
  });
});

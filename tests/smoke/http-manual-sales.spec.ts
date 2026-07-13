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

describe("HTTP smoke: organizer manual sales", () => {
  afterEach(async () => {
    await teardownStaffPortalScenario();
  });

  it("owner can load seller sales summary with manual payment totals", async () => {
    const { app, authHeader } = await mountStaffPortalScenario(staffSeeds.withManualPayments());

    const res = await request(app)
      .get("/api/organizer/payments/seller-summary")
      .set("Authorization", authHeader);

    expect(res.status).toBe(200);
    expect(res.body.manual_sale_count).toBe(1);
    expect(res.body.manual_sale_total_cents).toBe(50000);
    expect(res.body.sellers).toHaveLength(1);
    expect(res.body.sellers[0].member_id).toBe(STAFF_SCENARIO.sellerMemberId);
    expect(res.body.sellers[0].sale_count).toBe(1);
  });

  it("seller cannot access seller sales summary", async () => {
    const { app, authHeader } = await mountStaffPortalScenario(
      staffSeeds.withManualPayments(),
      { memberId: STAFF_SCENARIO.sellerMemberId },
    );

    const res = await request(app)
      .get("/api/organizer/payments/seller-summary")
      .set("Authorization", authHeader);

    expect(res.status).toBe(403);
  });

  it("seller only sees own manual payments in list", async () => {
    const { app, authHeader } = await mountStaffPortalScenario(
      {
        ...staffSeeds.withManualPayments(),
        manualPayments: [
          { sellerMemberId: STAFF_SCENARIO.sellerMemberId, amount_cents: 50000 },
          { sellerMemberId: STAFF_SCENARIO.memberId, amount_cents: 30000 },
        ],
      },
      { memberId: STAFF_SCENARIO.sellerMemberId },
    );

    const res = await request(app)
      .get("/api/organizer/payments")
      .set("Authorization", authHeader);

    expect(res.status).toBe(200);
    expect(res.body.payments).toHaveLength(1);
    expect(res.body.payments[0].recorded_by_member_id).toBe(STAFF_SCENARIO.sellerMemberId);
    expect(res.body.payments[0].provider).toBe("manual");
    expect(res.body.payments[0].service_fee_cents).toBe(0);
  });

  it("owner can filter payments by seller member id", async () => {
    const { app, authHeader } = await mountStaffPortalScenario({
      ...staffSeeds.withManualPayments(),
      manualPayments: [
        { sellerMemberId: STAFF_SCENARIO.sellerMemberId, amount_cents: 50000 },
        { sellerMemberId: STAFF_SCENARIO.memberId, amount_cents: 30000 },
      ],
    });

    const res = await request(app)
      .get("/api/organizer/payments")
      .query({ sellerFilter: String(STAFF_SCENARIO.sellerMemberId) })
      .set("Authorization", authHeader);

    expect(res.status).toBe(200);
    expect(res.body.payments).toHaveLength(1);
    expect(res.body.payments[0].recorded_by_member_id).toBe(STAFF_SCENARIO.sellerMemberId);
  });

  it("owner can filter payments by manual provider", async () => {
    const { app, authHeader } = await mountStaffPortalScenario({
      ...staffSeeds.withManualPayments(),
      manualPayments: [
        { sellerMemberId: STAFF_SCENARIO.sellerMemberId, amount_cents: 50000, provider: "manual" },
        {
          sellerMemberId: STAFF_SCENARIO.sellerMemberId,
          amount_cents: 10000,
          provider: "stripe",
        },
      ],
    });

    const res = await request(app)
      .get("/api/organizer/payments")
      .query({ provider: "manual" })
      .set("Authorization", authHeader);

    expect(res.status).toBe(200);
    expect(res.body.payments).toHaveLength(1);
    expect(res.body.payments[0].provider).toBe("manual");
  });

  it("owner can filter online checkout payments", async () => {
    const { app, authHeader, db } = await mountStaffPortalScenario(staffSeeds.withManualPayments());
    db.payments.push({
      id: 8999,
      public_uuid: "pay-online",
      registration_id: 7002,
      athlete_id: db.athletes[0].id,
      organizer_id: STAFF_SCENARIO.organizerId,
      event_id: STAFF_SCENARIO.defaultEventId,
      amount_cents: 75000,
      registration_amount_cents: 75000,
      service_fee_cents: 8000,
      currency: "MXN",
      status: "succeeded",
      provider: "stripe",
      recorded_by_member_id: null,
      stripe_payment_intent_id: "pi_test",
      paid_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      registration_number: "ON-001",
    } as never);

    const res = await request(app)
      .get("/api/organizer/payments")
      .query({ sellerFilter: "online" })
      .set("Authorization", authHeader);

    expect(res.status).toBe(200);
    expect(res.body.payments).toHaveLength(1);
    expect(res.body.payments[0].recorded_by_member_id).toBeNull();
    expect(res.body.payments[0].provider).toBe("stripe");
  });
});

import { describe, it, expect } from "vitest";
import { validateAndPriceGroupCheckout } from "../../server/groupRegistration";
import { WAIVER_ACCEPTANCE_SIGNATURE } from "../../shared/waiverConstants";
import { GroupRegistrationMemoryPool } from "../helpers/groupRegistrationMemoryPool";
import { SCENARIO } from "../helpers/scenarioDb";

const waiverSig = [
  {
    waiverId: 1,
    signature: WAIVER_ACCEPTANCE_SIGNATURE,
    waiverVersion: 1,
  },
];

describe("validateAndPriceGroupCheckout edge cases", () => {
  it("rejects empty line items", async () => {
    const pool = new GroupRegistrationMemoryPool().asPool();
    const result = await validateAndPriceGroupCheckout(pool, {
      eventId: SCENARIO.eventId,
      eventStartDate: "2026-12-01",
      purchaserAthleteId: SCENARIO.athleteId,
      maxPerOrder: 10,
      feePercent: 11,
      feePresentation: "pass_through",
      requiresWaiver: false,
      lineItems: [],
    });
    expect(result.ok).toBe(false);
    if (result.ok === false) expect(result.error.status).toBe(400);
  });

  it("rejects order above max per order", async () => {
    const pool = new GroupRegistrationMemoryPool({ maxPerOrder: 2 }).asPool();
    const result = await validateAndPriceGroupCheckout(pool, {
      eventId: SCENARIO.eventId,
      eventStartDate: "2026-12-01",
      purchaserAthleteId: SCENARIO.athleteId,
      maxPerOrder: 2,
      feePercent: 11,
      feePresentation: "pass_through",
      requiresWaiver: false,
      lineItems: [
        { lineId: "a", participantType: "guest", categoryId: SCENARIO.categoryId, fieldValues: {}, guest: { firstName: "A", lastName: "One", email: "a1@test.local", dateOfBirth: "1990-01-01", gender: "male" } },
        { lineId: "b", participantType: "guest", categoryId: SCENARIO.categoryId, fieldValues: {}, guest: { firstName: "B", lastName: "Two", email: "b1@test.local", dateOfBirth: "1990-01-01", gender: "male" } },
        { lineId: "c", participantType: "guest", categoryId: SCENARIO.categoryId, fieldValues: {}, guest: { firstName: "C", lastName: "Three", email: "c1@test.local", dateOfBirth: "1990-01-01", gender: "male" } },
      ],
    });
    expect(result.ok).toBe(false);
    if (result.ok === false) {
      expect(result.error.body.code).toBe("order_limit_exceeded");
    }
  });

  it("rejects duplicate participant emails in one order", async () => {
    const pool = new GroupRegistrationMemoryPool().asPool();
    const result = await validateAndPriceGroupCheckout(pool, {
      eventId: SCENARIO.eventId,
      eventStartDate: "2026-12-01",
      purchaserAthleteId: SCENARIO.athleteId,
      maxPerOrder: 10,
      feePercent: 11,
      feePresentation: "pass_through",
      requiresWaiver: false,
      lineItems: [
        { lineId: "a", participantType: "guest", categoryId: SCENARIO.categoryId, fieldValues: {}, guest: { firstName: "A", lastName: "One", email: "dup@test.local", dateOfBirth: "1990-01-01", gender: "male" } },
        { lineId: "b", participantType: "guest", categoryId: SCENARIO.categoryId, fieldValues: {}, guest: { firstName: "B", lastName: "Two", email: "dup@test.local", dateOfBirth: "1991-01-01", gender: "female" } },
      ],
    });
    expect(result.ok).toBe(false);
    if (result.ok === false) {
      expect(result.error.body.code).toBe("duplicate_participant");
    }
  });

  it("rejects purchaser self when already registered", async () => {
    const memory = new GroupRegistrationMemoryPool();
    memory.addConfirmedRegistration(SCENARIO.athleteId);
    const result = await validateAndPriceGroupCheckout(memory.asPool(), {
      eventId: SCENARIO.eventId,
      eventStartDate: "2026-12-01",
      purchaserAthleteId: SCENARIO.athleteId,
      maxPerOrder: 10,
      feePercent: 11,
      feePresentation: "pass_through",
      requiresWaiver: false,
      lineItems: [
        { lineId: "self", participantType: "self", categoryId: SCENARIO.categoryId, fieldValues: {} },
      ],
    });
    expect(result.ok).toBe(false);
    if (result.ok === false) {
      expect(result.error.body.code).toBe("already_registered");
    }
  });

  it("rejects unknown Triboo account email", async () => {
    const pool = new GroupRegistrationMemoryPool().asPool();
    const result = await validateAndPriceGroupCheckout(pool, {
      eventId: SCENARIO.eventId,
      eventStartDate: "2026-12-01",
      purchaserAthleteId: SCENARIO.athleteId,
      maxPerOrder: 10,
      feePercent: 11,
      feePresentation: "pass_through",
      requiresWaiver: false,
      lineItems: [
        {
          lineId: "acct",
          participantType: "account",
          accountEmail: "nobody@test.local",
          categoryId: SCENARIO.categoryId,
          fieldValues: {},
        },
      ],
    });
    expect(result.ok).toBe(false);
    if (result.ok === false) {
      expect(result.error.body.code).toBe("account_not_found");
    }
  });

  it("rejects account participant already registered", async () => {
    const memory = new GroupRegistrationMemoryPool();
    memory.addConfirmedRegistration(1002);
    const result = await validateAndPriceGroupCheckout(memory.asPool(), {
      eventId: SCENARIO.eventId,
      eventStartDate: "2026-12-01",
      purchaserAthleteId: SCENARIO.athleteId,
      maxPerOrder: 10,
      feePercent: 11,
      feePresentation: "pass_through",
      requiresWaiver: false,
      lineItems: [
        {
          lineId: "family",
          participantType: "account",
          accountEmail: "family@test.local",
          categoryId: SCENARIO.categoryId,
          fieldValues: {},
        },
      ],
    });
    expect(result.ok).toBe(false);
    if (result.ok === false) {
      expect(result.error.body.code).toBe("participant_already_registered");
    }
  });

  it("rejects sold out category without waitlist", async () => {
    const memory = new GroupRegistrationMemoryPool({
      categoryCapacity: 1,
    });
    memory.addConfirmedRegistration(SCENARIO.athleteId + 50);
    const result = await validateAndPriceGroupCheckout(memory.asPool(), {
      eventId: SCENARIO.eventId,
      eventStartDate: "2026-12-01",
      purchaserAthleteId: SCENARIO.athleteId,
      maxPerOrder: 10,
      feePercent: 11,
      feePresentation: "pass_through",
      requiresWaiver: false,
      lineItems: [
        { lineId: "self", participantType: "self", categoryId: SCENARIO.categoryId, fieldValues: {} },
      ],
    });
    expect(result.ok).toBe(false);
    if (result.ok === false) {
      expect(result.error.status).toBe(409);
      expect(String(result.error.body.error)).toMatch(/sold out/i);
    }
  });

  it("requires guardian relationship for minor guests", async () => {
    const pool = new GroupRegistrationMemoryPool().asPool();
    const result = await validateAndPriceGroupCheckout(pool, {
      eventId: SCENARIO.eventId,
      eventStartDate: "2026-12-01",
      purchaserAthleteId: SCENARIO.athleteId,
      maxPerOrder: 10,
      feePercent: 11,
      feePresentation: "pass_through",
      requiresWaiver: false,
      lineItems: [
        {
          lineId: "kid",
          participantType: "guest",
          categoryId: SCENARIO.categoryId,
          fieldValues: {},
          guest: {
            firstName: "Kid",
            lastName: "Runner",
            email: "kid@test.local",
            dateOfBirth: "2018-05-01",
            gender: "male",
          },
        },
      ],
    });
    expect(result.ok).toBe(false);
    if (result.ok === false) {
      expect(result.error.body.code).toBe("guardian_required");
    }
  });

  it("prices a valid self + guest order", async () => {
    const pool = new GroupRegistrationMemoryPool().asPool();
    const result = await validateAndPriceGroupCheckout(pool, {
      eventId: SCENARIO.eventId,
      eventStartDate: "2026-12-01",
      purchaserAthleteId: SCENARIO.athleteId,
      maxPerOrder: 10,
      feePercent: 11,
      feePresentation: "pass_through",
      requiresWaiver: false,
      lineItems: [
        { lineId: "self", participantType: "self", categoryId: SCENARIO.categoryId, fieldValues: {} },
        {
          lineId: "guest",
          participantType: "guest",
          categoryId: SCENARIO.categoryId,
          fieldValues: {},
          guest: {
            firstName: "Guest",
            lastName: "Runner",
            email: "guest-runner@test.local",
            dateOfBirth: "1990-03-03",
            gender: "female",
          },
          guardianRelationship: "Parent",
        },
      ],
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.resolved).toHaveLength(2);
      expect(result.totals.totalCents).toBe(0);
      expect(result.resolved[1].participantEmail).toBe("guest-runner@test.local");
    }
  });

  it("requires waiver signatures when event requires waiver", async () => {
    const pool = new GroupRegistrationMemoryPool({ requiresWaiver: true }).asPool();
    const result = await validateAndPriceGroupCheckout(pool, {
      eventId: SCENARIO.eventId,
      eventStartDate: "2026-12-01",
      purchaserAthleteId: SCENARIO.athleteId,
      maxPerOrder: 10,
      feePercent: 11,
      feePresentation: "pass_through",
      requiresWaiver: true,
      lineItems: [
        { lineId: "self", participantType: "self", categoryId: SCENARIO.categoryId, fieldValues: {} },
      ],
    });
    expect(result.ok).toBe(false);
    if (result.ok === false) expect(result.error.status).toBe(400);

    const ok = await validateAndPriceGroupCheckout(pool, {
      eventId: SCENARIO.eventId,
      eventStartDate: "2026-12-01",
      purchaserAthleteId: SCENARIO.athleteId,
      maxPerOrder: 10,
      feePercent: 11,
      feePresentation: "pass_through",
      requiresWaiver: true,
      lineItems: [
        {
          lineId: "self",
          participantType: "self",
          categoryId: SCENARIO.categoryId,
          fieldValues: {},
          waiverSignatures: waiverSig,
        },
      ],
    });
    expect(ok.ok).toBe(true);
  });
});

/**
 * @vitest-environment node
 */
import { describe, it, expect } from "vitest";
import { RegistrationScenarioDb, SCENARIO, seeds } from "../helpers/scenarioDb";
import { resolveSelectedExtras } from "../../server/eventExtras";

describe("resolveSelectedExtras", () => {
  it("returns empty lines when no extras selected", async () => {
    const db = new RegistrationScenarioDb(seeds.withOptionalExtras());
    const pool = db.asPool();

    const result = await resolveSelectedExtras(pool, SCENARIO.eventId, []);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.lines).toEqual([]);
  });

  it("resolves valid selections with correct line totals", async () => {
    const db = new RegistrationScenarioDb(seeds.withOptionalExtras());
    const pool = db.asPool();

    const result = await resolveSelectedExtras(pool, SCENARIO.eventId, [
      { extraId: 201, quantity: 2 },
      { extraId: 202, quantity: 1 },
    ]);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.lines).toHaveLength(2);
      const tee = result.lines.find((l) => l.extraId === 201);
      expect(tee?.quantity).toBe(2);
      expect(tee?.totalCents).toBe(9_000);
      expect(tee?.unitPriceCents).toBe(4_500);
    }
  });

  it("aggregates duplicate extraId rows into one quantity", async () => {
    const db = new RegistrationScenarioDb(seeds.withOptionalExtras());
    const pool = db.asPool();

    const result = await resolveSelectedExtras(pool, SCENARIO.eventId, [
      { extraId: 201, quantity: 1 },
      { extraId: 201, quantity: 1 },
    ]);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.lines).toHaveLength(1);
      expect(result.lines[0].quantity).toBe(2);
    }
  });

  it("rejects quantity above max_per_athlete", async () => {
    const db = new RegistrationScenarioDb(seeds.withOptionalExtras());
    const pool = db.asPool();

    const result = await resolveSelectedExtras(pool, SCENARIO.eventId, [
      { extraId: 202, quantity: 2 },
    ]);

    expect(result).toMatchObject({
      ok: false,
      error: expect.stringMatching(/maximum 1/i),
    });
  });

  it("rejects invalid quantity (zero)", async () => {
    const db = new RegistrationScenarioDb(seeds.withOptionalExtras());
    const pool = db.asPool();

    const result = await resolveSelectedExtras(pool, SCENARIO.eventId, [
      { extraId: 201, quantity: 0 },
    ]);

    expect(result).toMatchObject({
      ok: false,
      error: expect.stringMatching(/invalid extra quantity/i),
    });
  });

  it("rejects unknown extra ids", async () => {
    const db = new RegistrationScenarioDb(seeds.withOptionalExtras());
    const pool = db.asPool();

    const result = await resolveSelectedExtras(pool, SCENARIO.eventId, [
      { extraId: 9_999, quantity: 1 },
    ]);

    expect(result).toMatchObject({
      ok: false,
      error: expect.stringMatching(/no longer available/i),
    });
  });

  it("rejects when capacity would be exceeded", async () => {
    const db = new RegistrationScenarioDb(seeds.withLimitedExtra());
    const pool = db.asPool();

    const result = await resolveSelectedExtras(pool, SCENARIO.eventId, [
      { extraId: 204, quantity: 2 },
    ]);

    expect(result).toMatchObject({
      ok: false,
      error: expect.stringMatching(/sold out/i),
    });
  });

  it("allows purchase within remaining capacity", async () => {
    const db = new RegistrationScenarioDb(seeds.withLimitedExtra());
    const pool = db.asPool();

    const result = await resolveSelectedExtras(pool, SCENARIO.eventId, [
      { extraId: 204, quantity: 1 },
    ]);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.lines[0].totalCents).toBe(2_500);
  });

  it("ignores inactive extras in public resolution", async () => {
    const db = new RegistrationScenarioDb(seeds.withInactiveExtra());
    const pool = db.asPool();

    const hidden = await resolveSelectedExtras(pool, SCENARIO.eventId, [
      { extraId: 205, quantity: 1 },
    ]);
    expect(hidden.ok).toBe(false);

    const visible = await resolveSelectedExtras(pool, SCENARIO.eventId, [
      { extraId: 206, quantity: 1 },
    ]);
    expect(visible.ok).toBe(true);
  });
});

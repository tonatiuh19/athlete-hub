/**
 * @vitest-environment node
 */
import { describe, expect, it } from "vitest";
import { RegistrationScenarioDb, SCENARIO, seeds } from "../helpers/scenarioDb";
import { resolveSelectedExtras } from "../../server/eventExtras";

describe("resolveSelectedExtras enhanced", () => {
  it("rejects add-on scoped to a different category", async () => {
    const db = new RegistrationScenarioDb(seeds.withCategoryScopedExtras());
    const result = await resolveSelectedExtras(
      db.asPool(),
      SCENARIO.eventId,
      [{ extraId: 212, quantity: 1 }],
      { categoryId: SCENARIO.categoryId },
    );
    expect(result).toMatchObject({
      ok: false,
      error: expect.stringMatching(/not available for this category/i),
    });
  });

  it("allows add-on scoped to the checkout category", async () => {
    const db = new RegistrationScenarioDb(seeds.withCategoryScopedExtras());
    const result = await resolveSelectedExtras(
      db.asPool(),
      SCENARIO.eventId,
      [{ extraId: 211, quantity: 1 }],
      { categoryId: SCENARIO.categoryId },
    );
    expect(result.ok).toBe(true);
  });

  it("rejects add-on after sales close date", async () => {
    const db = new RegistrationScenarioDb(seeds.withExpiredSalesExtra());
    const result = await resolveSelectedExtras(
      db.asPool(),
      SCENARIO.eventId,
      [{ extraId: 213, quantity: 1 }],
      { categoryId: SCENARIO.categoryId },
    );
    expect(result).toMatchObject({
      ok: false,
      error: expect.stringMatching(/no longer available/i),
    });
  });

  it("rejects add-on before sales open date", async () => {
    const db = new RegistrationScenarioDb(seeds.withFutureSalesExtra());
    const result = await resolveSelectedExtras(
      db.asPool(),
      SCENARIO.eventId,
      [{ extraId: 214, quantity: 1 }],
      { categoryId: SCENARIO.categoryId },
    );
    expect(result).toMatchObject({
      ok: false,
      error: expect.stringMatching(/not available yet/i),
    });
  });

  it("allows free add-on at zero price", async () => {
    const db = new RegistrationScenarioDb(seeds.withFreeExtra());
    const result = await resolveSelectedExtras(
      db.asPool(),
      SCENARIO.eventId,
      [{ extraId: 215, quantity: 1 }],
      { categoryId: SCENARIO.categoryId },
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.lines[0]?.unitPriceCents).toBe(0);
      expect(result.lines[0]?.totalCents).toBe(0);
    }
  });
});

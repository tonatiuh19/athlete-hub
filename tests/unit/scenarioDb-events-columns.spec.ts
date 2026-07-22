import { describe, expect, it } from "vitest";
import { RegistrationScenarioDb } from "../helpers/scenarioDb.js";

describe("ScenarioDb events column guard", () => {
  it("rejects starts_at on events (schema uses start_date)", async () => {
    const db = new RegistrationScenarioDb();
    await expect(
      db.query("SELECT slug, starts_at FROM events WHERE id = ? LIMIT 1", [42]),
    ).rejects.toThrow(/start_date/);
  });

  it("allows start_date on events", async () => {
    const db = new RegistrationScenarioDb();
    const [rows] = (await db.query(
      "SELECT slug, start_date FROM events WHERE id = ? LIMIT 1",
      [42],
    )) as [Array<{ slug: string; start_date: string }>, unknown];
    expect(rows[0]?.slug).toBe("mock-marathon-2026");
    expect(rows[0]?.start_date).toBeTruthy();
  });
});

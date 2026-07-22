import { describe, expect, it } from "vitest";
import {
  SIMULATION_MAX_ACTIVE_PER_ORG,
  SIMULATION_MAX_REGS_PER_EVENT,
  SIMULATION_TTL_DAYS,
  isSimulationEventRow,
  simulationEmailSubjectPrefix,
  simulationExpiresAtFrom,
} from "../shared/simulation.js";
import { canOrganizerManageSimulations } from "../shared/staffRoles.js";

describe("simulation helpers", () => {
  it("exposes locked quotas and TTL", () => {
    expect(SIMULATION_TTL_DAYS).toBe(3);
    expect(SIMULATION_MAX_ACTIVE_PER_ORG).toBe(3);
    expect(SIMULATION_MAX_REGS_PER_EVENT).toBe(50);
  });

  it("adds TTL days from activity", () => {
    const start = new Date("2026-07-13T12:00:00.000Z");
    const expires = simulationExpiresAtFrom(start, 3);
    expect(expires.toISOString()).toBe("2026-07-16T12:00:00.000Z");
  });

  it("detects simulation rows", () => {
    expect(isSimulationEventRow({ is_simulation: 1 })).toBe(true);
    expect(isSimulationEventRow({ is_simulation: true })).toBe(true);
    expect(isSimulationEventRow({ is_simulation: 0 })).toBe(false);
  });

  it("prefixes simulation email subjects", () => {
    expect(simulationEmailSubjectPrefix("en")).toBe("[SIM TEST] ");
    expect(simulationEmailSubjectPrefix("es")).toBe("[SIM PRUEBA] ");
  });

  it("restricts sim management to owner role only", () => {
    expect(canOrganizerManageSimulations("owner")).toBe(true);
    expect(canOrganizerManageSimulations("organizer")).toBe(false);
    expect(canOrganizerManageSimulations("finance")).toBe(false);
    expect(canOrganizerManageSimulations("operations")).toBe(false);
  });
});

describe("simulation SQL exclusion fragments", () => {
  it("admin dashboard filters must exclude is_simulation", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const api = readFileSync(join(process.cwd(), "api/index.ts"), "utf8");
    expect(api).toMatch(
      /admin\/dashboard[\s\S]*?confirmed_registrations[\s\S]*?COALESCE\(is_simulation,\s*0\)\s*=\s*0/,
    );
    expect(api).toMatch(
      /admin\/analytics[\s\S]*?total_revenue_cents[\s\S]*?COALESCE\(is_simulation,\s*0\)\s*=\s*0/,
    );
  });

  it("checkout resume rebuild uses stripeClientForSimulation", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const api = readFileSync(join(process.cwd(), "api/index.ts"), "utf8");
    const fnStart = api.indexOf("async function buildCheckoutResponseForPayment");
    const fnBody = api.slice(fnStart, fnStart + 3500);
    expect(fnBody).toContain("is_simulation");
    expect(fnBody).toContain("stripeClientForSimulation");
    expect(fnBody).not.toMatch(/getStripeClient\(\)!\.paymentIntents\.create/);
  });

  it("expired simulations are rejected by loadEventRowForCheckout", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const api = readFileSync(join(process.cwd(), "api/index.ts"), "utf8");
    const fnStart = api.indexOf("async function loadEventRowForCheckout");
    const fnBody = api.slice(fnStart, fnStart + 2200);
    expect(fnBody).toContain("simulation_expires_at > NOW()");
  });

  it("solo registration INSERT includes is_simulation", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const api = readFileSync(join(process.cwd(), "api/index.ts"), "utf8");
    expect(api).toMatch(
      /INSERT INTO registrations \([\s\S]*?is_simulation[\s\S]*?\) VALUES/,
    );
  });

  it("group finalize INSERT includes is_simulation on orders and regs", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const group = readFileSync(join(process.cwd(), "server/groupRegistration.ts"), "utf8");
    expect(group).toMatch(
      /INSERT INTO registration_orders \([\s\S]*?is_simulation[\s\S]*?\) VALUES/,
    );
    expect(group).toMatch(
      /INSERT INTO registrations \([\s\S]*?is_simulation[\s\S]*?\) VALUES/,
    );
    expect(group).toContain("is_simulation");
    expect(group).toMatch(/createGuestAthlete\([\s\S]*?isSimulation/);
  });

  it("client resume and session persist simulationToken", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const slice = readFileSync(
      join(process.cwd(), "client/store/slices/registrationCheckoutSlice.ts"),
      "utf8",
    );
    const session = readFileSync(
      join(process.cwd(), "client/utils/registrationSessionStorage.ts"),
      "utf8",
    );
    expect(slice).toMatch(/resumeRegistrationCheckout[\s\S]*?simulationToken/);
    expect(session).toContain("simulationToken?: string");
  });
});

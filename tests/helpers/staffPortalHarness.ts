import type { Express } from "express";
import type { Pool } from "mysql2/promise";
import type { TestAuthPayload } from "../../api/testHooks";
import {
  StaffPortalScenarioDb,
  STAFF_SCENARIO,
  type StaffPortalSeed,
} from "./staffPortalScenarioDb";

let appModule: { createServer: () => Express } | null = null;
let hooksModule: {
  setTestPool: (pool: Pool | null) => void;
  setTestAuthBypass: (payload: TestAuthPayload | null) => void;
  resetTestEnvironment: () => void;
} | null = null;

async function loadApiModules() {
  if (!appModule) {
    hooksModule = await import("../../api/testHooks");
    appModule = await import("../../api/index");
  }
  return { appModule, hooksModule: hooksModule! };
}

export type StaffAuthActor = "organizer" | "admin";

export async function mountStaffPortalScenario(
  seed: StaffPortalSeed = {},
  options?: { actor?: StaffAuthActor; memberId?: number },
) {
  const { appModule: appMod, hooksModule: hooks } = await loadApiModules();
  hooks.resetTestEnvironment();

  const db = new StaffPortalScenarioDb(seed);
  hooks.setTestPool(db.asPool());

  const actor = options?.actor ?? "organizer";
  const memberId =
    options?.memberId ?? seed.memberId ?? STAFF_SCENARIO.memberId;

  const auth: TestAuthPayload =
    actor === "admin"
      ? {
          actor: "admin",
          id: 1,
          email: "admin@test.local",
          jti: "staff-smoke-admin",
        }
      : {
          actor: "organizer",
          id: memberId,
          email: "organizer@test.local",
          organizerId: STAFF_SCENARIO.organizerId,
          jti: "staff-smoke-organizer",
        };

  hooks.setTestAuthBypass(auth);

  const app = appMod.createServer();
  return { app, db, authHeader: "Bearer staff-smoke-token", auth };
}

export async function teardownStaffPortalScenario() {
  const { hooksModule: hooks } = await loadApiModules();
  hooks.resetTestEnvironment();
}

export { STAFF_SCENARIO };

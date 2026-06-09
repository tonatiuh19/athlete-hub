import type { Express } from "express";
import type { Pool } from "mysql2/promise";
import {
  RegistrationScenarioDb,
  SCENARIO,
  type ScenarioSeed,
} from "./scenarioDb";

const TEST_AUTH = {
  actor: "athlete" as const,
  id: SCENARIO.athleteId,
  email: "athlete@test.local",
  jti: "smoke-test-jti",
};

let appModule: { createServer: () => Express } | null = null;
let hooksModule: {
  setTestPool: (pool: Pool | null) => void;
  setTestAuthBypass: (payload: typeof TEST_AUTH | null) => void;
  resetTestEnvironment: () => void;
} | null = null;

async function loadApiModules() {
  if (!appModule) {
    hooksModule = await import("../../api/testHooks");
    appModule = await import("../../api/index");
  }
  return { appModule, hooksModule: hooksModule! };
}

export async function mountRegistrationScenario(seed: ScenarioSeed, options?: { auth?: boolean }) {
  const { appModule: appMod, hooksModule: hooks } = await loadApiModules();
  hooks.resetTestEnvironment();

  const db = new RegistrationScenarioDb(seed);
  hooks.setTestPool(db.asPool());
  if (options?.auth !== false) {
    hooks.setTestAuthBypass(TEST_AUTH);
  }

  const app = appMod.createServer();
  return { app, db, authHeader: "Bearer smoke-test-token" };
}

export async function teardownHttpScenario() {
  const { hooksModule: hooks } = await loadApiModules();
  hooks.resetTestEnvironment();
}

export { SCENARIO, TEST_AUTH };

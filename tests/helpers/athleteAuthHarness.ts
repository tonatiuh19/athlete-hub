import type { Express } from "express";
import type { Pool } from "mysql2/promise";
import {
  AthleteAuthScenarioDb,
  AUTH_SCENARIO,
  type AthleteAuthSeed,
} from "./athleteAuthScenarioDb";

let appModule: { createServer: () => Express } | null = null;
let hooksModule: {
  setTestPool: (pool: Pool | null) => void;
  setTestAuthBypass: (payload: null) => void;
  resetTestEnvironment: () => void;
  setTestResetCodeGenerator: (fn: (() => string) | null) => void;
  setTestClerkProfileResolver: (
    resolver: import("../../api/testHooks").TestClerkProfileResolver | null,
  ) => void;
} | null = null;

async function loadApiModules() {
  if (!appModule) {
    hooksModule = await import("../../api/testHooks");
    appModule = await import("../../api/index");
  }
  return { appModule, hooksModule: hooksModule! };
}

export async function mountAthleteAuthScenario(seed: AthleteAuthSeed = {}) {
  const { appModule: appMod, hooksModule: hooks } = await loadApiModules();
  hooks.resetTestEnvironment();
  hooks.setTestAuthBypass(null);
  hooks.setTestClerkProfileResolver(null);

  const db = new AthleteAuthScenarioDb(seed);
  hooks.setTestPool(db.asPool());

  const app = appMod.createServer();
  return { app, db, hooks };
}

export async function teardownAthleteAuthScenario() {
  const { hooksModule: hooks } = await loadApiModules();
  hooks.setTestResetCodeGenerator(null);
  hooks.resetTestEnvironment();
}

export { AUTH_SCENARIO };

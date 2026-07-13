import type { Express } from "express";
import type { Pool } from "mysql2/promise";
import type Stripe from "stripe";
import type { TestAuthPayload } from "../../api/testHooks";
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

export const ORGANIZER_TEST_AUTH = {
  actor: "organizer" as const,
  id: 2001,
  email: "organizer@test.local",
  organizerId: SCENARIO.organizerId,
  jti: "smoke-organizer-jti",
};

let appModule: { createServer: () => Express } | null = null;
let hooksModule: {
  setTestPool: (pool: Pool | null) => void;
  setTestAuthBypass: (payload: TestAuthPayload | null) => void;
  resetTestEnvironment: () => void;
  setTestStripeClient: (client: Stripe | null | undefined) => void;
} | null = null;

async function loadApiModules() {
  if (!appModule) {
    hooksModule = await import("../../api/testHooks");
    appModule = await import("../../api/index");
  }
  return { appModule, hooksModule: hooksModule! };
}

export async function mountRegistrationScenario(
  seed: ScenarioSeed,
  options?: { auth?: boolean; stripe?: Stripe | null },
) {
  const { appModule: appMod, hooksModule: hooks } = await loadApiModules();
  hooks.resetTestEnvironment();

  const db = new RegistrationScenarioDb(seed);
  hooks.setTestPool(db.asPool());
  if (options?.stripe !== undefined) {
    hooks.setTestStripeClient(options.stripe);
  }
  if (options?.auth !== false) {
    hooks.setTestAuthBypass(TEST_AUTH);
  }

  const app = appMod.createServer();
  return { app, db, authHeader: "Bearer smoke-test-token" };
}

export async function setRegistrationScenarioAuth(auth: TestAuthPayload) {
  const { hooksModule: hooks } = await loadApiModules();
  hooks.setTestAuthBypass(auth);
}

export async function teardownHttpScenario() {
  const { hooksModule: hooks } = await loadApiModules();
  hooks.resetTestEnvironment();
}

export { SCENARIO, TEST_AUTH };

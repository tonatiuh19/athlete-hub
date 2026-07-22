/** Organizer simulation events — Stripe test kit, no Connect, gated access. */

export const SIMULATION_TTL_DAYS = 3;
export const SIMULATION_MAX_ACTIVE_PER_ORG = 3;
export const SIMULATION_MAX_REGS_PER_EVENT = 50;

export const STRIPE_TEST_CARDS = [
  { brand: "Visa", number: "4242424242424242", note: "Success" },
  { brand: "Visa (debit)", number: "4000056655665556", note: "Success" },
  { brand: "Mastercard", number: "5555555555554444", note: "Success" },
  { brand: "Decline", number: "4000000000000002", note: "Card declined" },
  { brand: "3D Secure", number: "4000002500003155", note: "Requires authentication" },
] as const;

export function simulationExpiresAtFrom(activityAt: Date, ttlDays = SIMULATION_TTL_DAYS): Date {
  const d = new Date(activityAt.getTime());
  d.setUTCDate(d.getUTCDate() + ttlDays);
  return d;
}

export function isSimulationEventRow(row: {
  is_simulation?: unknown;
}): boolean {
  return Number(row.is_simulation) === 1 || row.is_simulation === true;
}

export function simulationEmailSubjectPrefix(locale?: string): string {
  const lang = (locale ?? "es").toLowerCase().startsWith("en") ? "en" : "es";
  return lang === "en" ? "[SIM TEST] " : "[SIM PRUEBA] ";
}

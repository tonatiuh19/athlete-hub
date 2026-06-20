/**
 * Regression: mock seed events must be registrable when requires_waiver = 1.
 * Prior audits covered waiver *logic* (mock DB scenarios) but not TiDB seed consistency.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import {
  getRegistrationWaivers,
  isWaiverMisconfigured,
} from "@/utils/eventRegistrationWaivers";
import type { EventDetailResponse } from "@shared/api";

const SEED_PATH = path.resolve(
  __dirname,
  "../../database/migrations/20260531_120001_seed_mock_data.sql",
);

/** Featured / commonly used dev slugs from docs/MOCK_DATA.md */
const FEATURED_DEV_EVENT_SLUGS = [
  "maraton-cdmx-2026",
  "trail-nevado-toluca-2026",
  "triatlon-acapulco-2026",
  "carrera-10k-polanco-2026",
] as const;

function loadSeedSql(): string {
  return readFileSync(SEED_PATH, "utf8");
}

function eventDetailFixture(
  slug: string,
  requiresWaiver: boolean,
  waivers: EventDetailResponse["waivers"],
): EventDetailResponse {
  return {
    event: {
      id: 1,
      slug,
      title: slug,
      requires_waiver: requiresWaiver,
      registration_count: 0,
      sport_name: "Running",
      sport_slug: "running",
      organizer_name: "Test",
      organizer_slug: "test",
      location_country: "MX",
      timezone: "America/Mexico_City",
      start_date: "2026-06-01T07:00:00.000Z",
      status: "published",
    },
    categories: [],
    registrationFields: [],
    sponsors: [],
    tags: [],
    scheduleWaves: [],
    serviceFeePercent: 5,
    feePresentation: "pass_through",
    course: null,
    media: [],
    waivers,
  };
}

describe("smoke: mock seed waiver integrity", () => {
  it("seed file seeds waivers for every requires_waiver event (not a single slug)", () => {
    const sql = loadSeedSql();
    const waiverSection = sql.slice(
      sql.indexOf("-- WAIVERS"),
      sql.indexOf("-- SPONSORS"),
    );
    expect(waiverSection).toMatch(/WHERE e\.requires_waiver = 1/);
    expect(waiverSection).not.toMatch(/WHERE e\.slug =/);
  });

  it("featured dev event slugs exist in seed data", () => {
    const sql = loadSeedSql();
    for (const slug of FEATURED_DEV_EVENT_SLUGS) {
      expect(sql, `missing seed event slug ${slug}`).toContain(`'${slug}'`);
    }
  });

  it("isWaiverMisconfigured blocks registration when waivers are missing", () => {
    const misconfigured = eventDetailFixture("trail-nevado-toluca-2026", true, []);
    expect(isWaiverMisconfigured(misconfigured)).toBe(true);
    expect(getRegistrationWaivers(misconfigured)).toHaveLength(0);
  });

  it("isWaiverMisconfigured allows registration when active waivers exist", () => {
    const ok = eventDetailFixture("trail-nevado-toluca-2026", true, [
      {
        id: 1,
        title: "Liability waiver",
        content_html: "<p>Test</p>",
        content_type: "html",
        version: 1,
      },
    ]);
    expect(isWaiverMisconfigured(ok)).toBe(false);
    expect(getRegistrationWaivers(ok)).toHaveLength(1);
  });
});

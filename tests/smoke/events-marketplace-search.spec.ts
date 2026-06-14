import { describe, it, expect } from "vitest";
import {
  appendEventTextSearchSql,
  filterMarketplaceEventsByFuzzyQuery,
  scoreMarketplaceEvent,
  sortMarketplaceEventRows,
} from "../../server/eventsMarketplaceSearch";
import type { RowDataPacket } from "mysql2/promise";

function mockEvent(overrides: Record<string, unknown> = {}): RowDataPacket {
  return {
    id: 1,
    slug: "maraton-cdmx",
    title: "Maratón CDMX 2026",
    sport_name: "Running",
    sport_slug: "running",
    location_city: "Ciudad de México",
    location_state: "CDMX",
    short_description: "42K through the capital",
    search_keywords: "marathon cdmx",
    organizer_name: "Triboo",
    featured: false,
    start_date: "2026-09-01",
    registration_count: 10,
    from_price_cents: 50000,
    ...overrides,
  } as RowDataPacket;
}

describe("smoke: marketplace event fuzzy search", () => {
  it("scores accent-folded queries against accented titles", () => {
    const row = mockEvent();
    expect(scoreMarketplaceEvent(row, "maraton")).toBeGreaterThanOrEqual(28);
    expect(scoreMarketplaceEvent(row, "Maratón")).toBeGreaterThanOrEqual(28);
  });

  it("filters events with partial-query fuzzy matching", () => {
    const row = mockEvent();
    const results = filterMarketplaceEventsByFuzzyQuery([row], "marato");
    expect(results).toHaveLength(1);
  });

  it("matches sport names in fuzzy scoring", () => {
    const row = mockEvent({ title: "City Race", sport_name: "Triatlón" });
    expect(scoreMarketplaceEvent(row, "triatlon")).toBeGreaterThanOrEqual(28);
  });

  it("sorts by relevance when q is present and sort is date_asc", () => {
    const high = mockEvent({ id: 1, title: "Maratón CDMX", slug: "a" });
    const low = mockEvent({ id: 2, title: "Trail Run Oaxaca", slug: "b" });
    const sorted = sortMarketplaceEventRows([low, high], "date_asc", "maraton");
    expect(sorted[0].slug).toBe("a");
  });

  it("builds token-based SQL OR clauses", () => {
    const params: unknown[] = [];
    const sql = appendEventTextSearchSql("WHERE 1=1", params, "maraton cdmx");
    expect(sql).toContain("e.title LIKE ?");
    expect(sql).toContain("st.slug LIKE ?");
    expect(params.length).toBeGreaterThan(0);
  });
});

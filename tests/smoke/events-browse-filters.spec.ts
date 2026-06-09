import { describe, it, expect } from "vitest";
import {
  buildMarketplaceQueryParams,
  filtersFromSearchParams,
  marketplaceFiltersToSearchParams,
  normalizeDateRange,
  normalizeMarketplaceFilters,
} from "@/utils/eventsBrowseFilters";
import type { MarketplaceFilters } from "@/store/slices/marketplaceSlice";
import { parseEventDateRange } from "../../server/eventsMarketplaceFilters";

const baseFilters: MarketplaceFilters = {
  q: "",
  sport: "",
  city: "",
  geoCityId: "",
  featured: false,
  dateFrom: "",
  dateTo: "",
  minPrice: "",
  maxPrice: "",
  sort: "date_asc",
};

describe("smoke: events browse filter utilities", () => {
  it("normalizes inverted date ranges", () => {
    expect(normalizeDateRange("2026-06-10", "2026-06-01")).toEqual({
      dateFrom: "2026-06-01",
      dateTo: "2026-06-10",
    });
  });

  it("parses inverted date ranges on the server", () => {
    expect(parseEventDateRange("2026-06-10", "2026-06-01")).toEqual({
      dateFrom: "2026-06-01",
      dateTo: "2026-06-10",
    });
  });

  it("rejects invalid ISO dates in URL params", () => {
    const params = new URLSearchParams({
      dateFrom: "06-01-2026",
      dateTo: "not-a-date",
      sort: "bogus",
    });
    const parsed = filtersFromSearchParams(params);
    expect(parsed.dateFrom).toBe("");
    expect(parsed.dateTo).toBe("");
    expect(parsed.sort).toBe("date_asc");
  });

  it("round-trips all active filters through URL", () => {
    const filters = normalizeMarketplaceFilters({
      ...baseFilters,
      q: "marathon",
      sport: "running",
      geoCityId: "12",
      dateFrom: "2026-07-01",
      dateTo: "2026-07-31",
      sort: "popular",
    });

    const params = marketplaceFiltersToSearchParams(filters);
    expect(params.get("q")).toBe("marathon");
    expect(params.get("sport")).toBe("running");
    expect(params.get("geoCityId")).toBe("12");
    expect(params.get("city")).toBeNull();
    expect(params.get("dateFrom")).toBe("2026-07-01");
    expect(params.get("dateTo")).toBe("2026-07-31");
    expect(params.get("sort")).toBe("popular");

    const restored = filtersFromSearchParams(params);
    expect(restored.q).toBe("marathon");
    expect(restored.sport).toBe("running");
    expect(restored.geoCityId).toBe("12");
    expect(restored.city).toBe("");
    expect(restored.dateFrom).toBe("2026-07-01");
    expect(restored.dateTo).toBe("2026-07-31");
    expect(restored.sort).toBe("popular");
  });

  it("prefers geoCityId over legacy city in API params", () => {
    const params = buildMarketplaceQueryParams(
      normalizeMarketplaceFilters({
        ...baseFilters,
        geoCityId: "5",
        city: "Guadalajara",
      }),
    );
    expect(params.geoCityId).toBe(5);
    expect(params.city).toBeUndefined();
  });

  it("falls back to legacy city when geoCityId is invalid", () => {
    const params = buildMarketplaceQueryParams(
      normalizeMarketplaceFilters({
        ...baseFilters,
        geoCityId: "abc",
        city: "Guadalajara",
      }),
    );
    expect(params.geoCityId).toBeUndefined();
    expect(params.city).toBe("Guadalajara");
  });

  it("omits default sort from URL", () => {
    const params = marketplaceFiltersToSearchParams(baseFilters);
    expect(params.get("sort")).toBeNull();
  });
});

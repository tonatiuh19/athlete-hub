import type { EventsQueryParams, EventsSort } from "@shared/api";
import type { MarketplaceFilters } from "@/store/slices/marketplaceSlice";
import { parseIsoDate } from "@/utils/datePickerValue";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const VALID_SORT: EventsSort[] = [
  "date_asc",
  "date_desc",
  "price_asc",
  "price_desc",
  "popular",
];

/** Ensure dateFrom <= dateTo when both are valid ISO dates. */
export function normalizeDateRange(
  dateFrom: string,
  dateTo: string,
): { dateFrom: string; dateTo: string } {
  if (!ISO_DATE.test(dateFrom) || !ISO_DATE.test(dateTo)) {
    return { dateFrom, dateTo };
  }
  if (dateFrom <= dateTo) return { dateFrom, dateTo };
  return { dateFrom: dateTo, dateTo: dateFrom };
}

export function normalizeMarketplaceFilters(
  filters: MarketplaceFilters,
): MarketplaceFilters {
  const { dateFrom, dateTo } = normalizeDateRange(
    filters.dateFrom,
    filters.dateTo,
  );

  let geoCityId = filters.geoCityId.trim();
  let city = filters.city.trim();

  if (geoCityId) {
    const id = Number(geoCityId);
    if (!Number.isFinite(id) || id <= 0) {
      geoCityId = "";
    } else {
      geoCityId = String(id);
      city = "";
    }
  }

  const sort = VALID_SORT.includes(filters.sort) ? filters.sort : "date_asc";

  return {
    ...filters,
    q: filters.q.trim(),
    sport: filters.sport.trim(),
    city,
    geoCityId,
    dateFrom,
    dateTo,
    sort,
  };
}

export function filtersFromSearchParams(
  params: URLSearchParams,
): Partial<MarketplaceFilters> {
  const q = params.get("q") ?? "";
  const sport = params.get("sport") ?? "";
  const geoCityId = params.get("geoCityId") ?? "";
  const city = geoCityId ? "" : (params.get("city") ?? "");
  const dateFrom = params.get("dateFrom") ?? "";
  const dateTo = params.get("dateTo") ?? "";
  const sortRaw = params.get("sort") ?? "date_asc";
  const sort = VALID_SORT.includes(sortRaw as EventsSort)
    ? (sortRaw as EventsSort)
    : "date_asc";

  return normalizeMarketplaceFilters({
    q,
    sport,
    city,
    geoCityId,
    featured: false,
    dateFrom: ISO_DATE.test(dateFrom) ? dateFrom : "",
    dateTo: ISO_DATE.test(dateTo) ? dateTo : "",
    minPrice: "",
    maxPrice: "",
    sort,
  });
}

export function marketplaceFiltersToSearchParams(
  filters: MarketplaceFilters,
): URLSearchParams {
  const normalized = normalizeMarketplaceFilters(filters);
  const params = new URLSearchParams();

  if (normalized.q) params.set("q", normalized.q);
  if (normalized.sport) params.set("sport", normalized.sport);
  if (normalized.geoCityId) params.set("geoCityId", normalized.geoCityId);
  else if (normalized.city) params.set("city", normalized.city);
  if (normalized.dateFrom) params.set("dateFrom", normalized.dateFrom);
  if (normalized.dateTo) params.set("dateTo", normalized.dateTo);
  if (normalized.sort && normalized.sort !== "date_asc") {
    params.set("sort", normalized.sort);
  }

  return params;
}

/** Maps Redux marketplace filters to GET /api/events query params. */
export function buildMarketplaceQueryParams(
  filters: MarketplaceFilters,
): EventsQueryParams {
  const f = normalizeMarketplaceFilters(filters);
  const params: EventsQueryParams = {
    sort: f.sort,
    limit: 48,
  };

  if (f.q) params.q = f.q;
  if (f.sport) params.sport = f.sport;

  const geoCityId = Number(f.geoCityId);
  if (f.geoCityId && Number.isFinite(geoCityId)) {
    params.geoCityId = geoCityId;
  } else if (f.city) {
    params.city = f.city;
  }

  if (f.dateFrom) params.dateFrom = f.dateFrom;
  if (f.dateTo) params.dateTo = f.dateTo;

  return params;
}

export function isValidIsoDateParam(value: string): boolean {
  return Boolean(value && parseIsoDate(value));
}

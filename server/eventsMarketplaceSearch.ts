import type { Pool, RowDataPacket } from "mysql2/promise";
import type { ResolvedGeoCity } from "./geo.js";
import { eventMatchesGeoCitySql } from "./geo.js";
import { fuzzyScore, likePatternsForTokens, searchTokens } from "./searchFuzzy.js";

export const MARKETPLACE_FUZZY_MIN_SCORE = 28;
export const MARKETPLACE_SEARCH_POOL_LIMIT = 500;
export const MARKETPLACE_SEARCH_MATCH_LIMIT = 200;

export type MarketplaceListFilters = {
  sport: string | null;
  city: string | null;
  resolvedGeoCity: ResolvedGeoCity | null;
  featured: boolean | null;
  dateFrom: string | null;
  dateTo: string | null;
  minPrice: number | null;
  maxPrice: number | null;
};

export function appendMarketplaceListFilters(
  sql: string,
  params: unknown[],
  filters: MarketplaceListFilters,
): string {
  if (filters.sport) {
    sql += " AND st.slug = ?";
    params.push(filters.sport);
  }
  if (filters.resolvedGeoCity) {
    sql += ` AND ${eventMatchesGeoCitySql("e")}`;
    params.push(
      filters.resolvedGeoCity.city,
      filters.resolvedGeoCity.state_name,
      filters.resolvedGeoCity.state_code,
    );
  } else if (filters.city) {
    sql += " AND (e.location_city LIKE ? OR e.location_state LIKE ?)";
    params.push(`%${filters.city}%`, `%${filters.city}%`);
  }
  if (filters.featured) {
    sql += " AND e.featured = 1";
  }
  if (filters.dateFrom) {
    sql += " AND DATE(e.start_date) >= ?";
    params.push(filters.dateFrom);
  }
  if (filters.dateTo) {
    sql += " AND DATE(e.start_date) <= ?";
    params.push(filters.dateTo);
  }
  if (filters.minPrice != null && !Number.isNaN(filters.minPrice)) {
    sql += " AND ec_min.from_price_cents >= ?";
    params.push(filters.minPrice);
  }
  if (filters.maxPrice != null && !Number.isNaN(filters.maxPrice)) {
    sql += " AND ec_min.from_price_cents <= ?";
    params.push(filters.maxPrice);
  }
  return sql;
}

/** Token-based text search (same fields as /api/search/suggest). */
export function appendEventTextSearchSql(
  sql: string,
  params: unknown[],
  q: string,
): string {
  const likePatterns = likePatternsForTokens(searchTokens(q));
  if (likePatterns.length === 0) return sql;

  const perPattern = [
    "e.title LIKE ?",
    "e.short_description LIKE ?",
    "e.search_keywords LIKE ?",
    "e.location_city LIKE ?",
    "e.location_name LIKE ?",
    "st.name LIKE ?",
    "st.slug LIKE ?",
  ];
  const orGroups = likePatterns.map((pattern) => `(${perPattern.join(" OR ")})`);
  sql += ` AND (${orGroups.join(" OR ")})`;
  for (const pattern of likePatterns) {
    params.push(...Array(7).fill(pattern));
  }
  return sql;
}

export function marketplaceEventScoreFields(
  row: RowDataPacket,
): (string | null | undefined)[] {
  return [
    row.title as string,
    row.sport_name as string,
    row.sport_slug as string,
    row.location_city as string,
    row.location_state as string,
    row.location_name as string,
    row.short_description as string,
    row.search_keywords as string,
    row.organizer_name as string,
  ];
}

export function scoreMarketplaceEvent(row: RowDataPacket, q: string): number {
  return fuzzyScore(q, ...marketplaceEventScoreFields(row));
}

export function filterMarketplaceEventsByFuzzyQuery(
  rows: RowDataPacket[],
  q: string,
): RowDataPacket[] {
  let matched = rows.filter(
    (row) => scoreMarketplaceEvent(row, q) >= MARKETPLACE_FUZZY_MIN_SCORE,
  );

  if (matched.length === 0) {
    matched = rows.filter(
      (row) =>
        fuzzyScore(q, row.title as string) >= MARKETPLACE_FUZZY_MIN_SCORE,
    );
  }

  return matched;
}

export function sortMarketplaceEventRows(
  rows: RowDataPacket[],
  sort: string,
  q: string | null,
): RowDataPacket[] {
  const copy = [...rows];

  if (q && q.length >= 2 && sort === "date_asc") {
    copy.sort((a, b) => {
      const scoreDiff = scoreMarketplaceEvent(b, q) - scoreMarketplaceEvent(a, q);
      if (scoreDiff !== 0) return scoreDiff;
      if (Boolean(b.featured) !== Boolean(a.featured)) {
        return b.featured ? 1 : -1;
      }
      return String(a.start_date).localeCompare(String(b.start_date));
    });
    return copy;
  }

  switch (sort) {
    case "date_desc":
      copy.sort((a, b) =>
        String(b.start_date).localeCompare(String(a.start_date)),
      );
      break;
    case "price_asc":
      copy.sort((a, b) => {
        const ap = a.from_price_cents ?? Number.MAX_SAFE_INTEGER;
        const bp = b.from_price_cents ?? Number.MAX_SAFE_INTEGER;
        return Number(ap) - Number(bp);
      });
      break;
    case "price_desc":
      copy.sort(
        (a, b) =>
          Number(b.from_price_cents ?? 0) - Number(a.from_price_cents ?? 0),
      );
      break;
    case "popular":
      copy.sort((a, b) => {
        const diff =
          Number(b.registration_count ?? 0) - Number(a.registration_count ?? 0);
        return diff !== 0
          ? diff
          : String(a.start_date).localeCompare(String(b.start_date));
      });
      break;
    default:
      copy.sort((a, b) => {
        if (Boolean(b.featured) !== Boolean(a.featured)) {
          return b.featured ? 1 : -1;
        }
        return String(a.start_date).localeCompare(String(b.start_date));
      });
  }

  return copy;
}

export function stripInternalSearchFields(row: RowDataPacket): RowDataPacket {
  const {
    search_keywords: _sk,
    location_name: _ln,
    ...rest
  } = row;
  return rest;
}

export function buildMarketplaceEventSelect(registrationCountSql: string): string {
  return `
    SELECT e.id, e.public_uuid, e.slug, e.title, e.short_description, e.start_date, e.end_date,
           e.location_city, e.location_state, e.location_country, e.location_lat, e.location_lng,
           e.location_name, e.search_keywords,
           e.featured, e.hero_image_url, ${registrationCountSql} AS registration_count, e.registration_closes_at,
           st.slug AS sport_slug, st.name AS sport_name,
           o.name AS organizer_name, o.slug AS organizer_slug,
           ec_min.from_price_cents
  `;
}

/** Athlete-facing minimum category total (pass-through includes service fee). */
export const MARKETPLACE_MIN_PRICE_JOIN_SQL = `
    LEFT JOIN (
      SELECT ec.event_id,
        MIN(
          CASE
            WHEN COALESCE(e_fp.fee_presentation, o_fp.fee_presentation, 'pass_through') = 'absorb_all'
            THEN ec.price_cents
            ELSE ec.price_cents + ROUND(
              ec.price_cents * COALESCE(e_fp.service_fee_percent, o_fp.service_fee_percent, 11) / 100
            )
          END
        ) AS from_price_cents
      FROM event_categories ec
      INNER JOIN events e_fp ON e_fp.id = ec.event_id
      INNER JOIN organizers o_fp ON o_fp.id = e_fp.organizer_id AND o_fp.deleted_at IS NULL
      WHERE ec.is_active = 1
      GROUP BY ec.event_id
    ) ec_min ON ec_min.event_id = e.id`;

export function buildMarketplaceEventFromClause(): string {
  return `
    FROM events e
    JOIN sport_types st ON st.id = e.sport_type_id
    JOIN organizers o ON o.id = e.organizer_id AND o.deleted_at IS NULL
    ${MARKETPLACE_MIN_PRICE_JOIN_SQL}
    WHERE e.status = 'published' AND e.visibility = 'public' AND e.deleted_at IS NULL
  `;
}

export async function listMarketplaceEventsWithFuzzySearch(
  pool: Pool,
  options: {
    registrationCountSql: string;
    filters: MarketplaceListFilters;
    q: string;
    sort: string;
    limit: number;
    offset: number;
  },
): Promise<{ events: RowDataPacket[]; total: number }> {
  const select = buildMarketplaceEventSelect(options.registrationCountSql);
  const from = buildMarketplaceEventFromClause();

  const baseParams: unknown[] = [];
  let baseWhere = from;
  baseWhere = appendMarketplaceListFilters(baseWhere, baseParams, options.filters);

  const matchedParams = [...baseParams];
  let matchedSql = select + baseWhere;
  matchedSql = appendEventTextSearchSql(matchedSql, matchedParams, options.q);
  matchedSql += ` ORDER BY e.featured DESC, e.start_date ASC LIMIT ${MARKETPLACE_SEARCH_MATCH_LIMIT}`;

  const broadParams = [...baseParams];
  const broadSql =
    select +
    baseWhere +
    ` ORDER BY e.featured DESC, e.start_date ASC LIMIT ${MARKETPLACE_SEARCH_POOL_LIMIT}`;

  const [[matchedRows], [broadRows]] = await Promise.all([
    pool.query<RowDataPacket[]>(matchedSql, matchedParams),
    pool.query<RowDataPacket[]>(broadSql, broadParams),
  ]);

  const seen = new Set<number>();
  const candidatePool: RowDataPacket[] = [];
  for (const row of [...matchedRows, ...broadRows]) {
    const id = Number(row.id);
    if (seen.has(id)) continue;
    seen.add(id);
    candidatePool.push(row);
  }

  const filtered = filterMarketplaceEventsByFuzzyQuery(candidatePool, options.q);
  const sorted = sortMarketplaceEventRows(filtered, options.sort, options.q);
  const total = sorted.length;
  const events = sorted
    .slice(options.offset, options.offset + options.limit)
    .map(stripInternalSearchFields);

  return { events, total };
}

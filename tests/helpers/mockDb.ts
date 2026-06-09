import type { Pool, RowDataPacket } from "mysql2/promise";

type QueryHandler = (
  sql: string,
  params?: unknown[],
) => [RowDataPacket[], unknown] | Promise<[RowDataPacket[], unknown]>;

/** In-memory mock MySQL pool — routes queries by SQL substring. No real connections. */
export function createMockPool(handler: QueryHandler): Pool {
  return {
    query: (sql: string, params?: unknown[]) => Promise.resolve(handler(sql, params)),
  } as unknown as Pool;
}

/** Fixture-driven pool: first matching pattern wins. */
export function createFixturePool(
  routes: Array<{
    match: RegExp | string;
    rows: RowDataPacket[];
    fields?: unknown;
  }>,
): Pool {
  return createMockPool((sql) => {
    for (const route of routes) {
      const hit =
        typeof route.match === "string" ? sql.includes(route.match) : route.match.test(sql);
      if (hit) {
        return [route.rows, route.fields ?? []];
      }
    }
    throw new Error(`Unmocked SQL in test: ${sql.slice(0, 120)}…`);
  });
}

export const FIXTURE_EVENT_ID = 42;
export const FIXTURE_REGISTRATION_ID = 9001;

export const activeWaiversFixture: RowDataPacket[] = [
  { id: 1, title: "General waiver", version: 2, sort_order: 0 } as RowDataPacket,
  { id: 2, title: "Medical waiver", version: 1, sort_order: 1 } as RowDataPacket,
];

export function waiverValidationPool(): Pool {
  return createFixturePool([
    {
      match: /FROM event_waivers[\s\S]*is_active = 1/,
      rows: activeWaiversFixture,
    },
  ]);
}

export function registrationWaiverStatusPool(opts: {
  requiresWaiver?: boolean;
  waiverSignedAt?: string | null;
  signatures?: Array<{ waiver_id: number; waiver_version_at_sign: number | null }>;
}): Pool {
  const {
    requiresWaiver = true,
    waiverSignedAt = "2026-01-01T00:00:00.000Z",
    signatures = [
      { waiver_id: 1, waiver_version_at_sign: 2 },
      { waiver_id: 2, waiver_version_at_sign: 1 },
    ],
  } = opts;

  return createFixturePool([
    {
      match: /FROM registrations r[\s\S]*JOIN events e/,
      rows: [
        {
          event_id: FIXTURE_EVENT_ID,
          waiver_signed_at: waiverSignedAt,
          requires_waiver: requiresWaiver ? 1 : 0,
        } as RowDataPacket,
      ],
    },
    {
      match: /FROM event_waivers[\s\S]*is_active = 1/,
      rows: activeWaiversFixture,
    },
    {
      match: /FROM registration_waiver_signatures/,
      rows: signatures as RowDataPacket[],
    },
  ]);
}

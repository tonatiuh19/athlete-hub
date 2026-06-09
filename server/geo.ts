import type { Pool, RowDataPacket } from "mysql2/promise";

export type ResolvedGeoCity = {
  id: number;
  city: string;
  state_name: string;
  state_code: string;
};

export async function resolveGeoCityById(
  pool: Pool,
  geoCityId: number,
): Promise<ResolvedGeoCity | null> {
  if (!Number.isFinite(geoCityId) || geoCityId <= 0) return null;
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT gc.id, gc.name AS city, gs.name AS state_name, gs.code AS state_code
     FROM geo_cities gc
     JOIN geo_states gs ON gs.id = gc.state_id
     WHERE gc.id = ? AND gc.is_active = 1 AND gs.is_active = 1`,
    [geoCityId],
  );
  const row = rows[0];
  if (!row) return null;
  return {
    id: Number(row.id),
    city: String(row.city),
    state_name: String(row.state_name),
    state_code: String(row.state_code),
  };
}

/** SQL clause matching events.location_* to a canonical geo city row */
export function eventMatchesGeoCitySql(alias = "e"): string {
  return `(
    ${alias}.location_city = ?
    AND (
      ${alias}.location_state = ?
      OR ${alias}.location_state = ?
    )
  )`;
}

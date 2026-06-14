import type { Pool, RowDataPacket } from "mysql2/promise";

export async function resolveEventCatalogLocation(
  pool: Pool,
  locationCity: string | null,
  country = "MX",
): Promise<
  | { ok: true; location_city: string | null; location_state: string | null }
  | { ok: false; error: string }
> {
  if (!locationCity?.trim()) {
    return { ok: true, location_city: null, location_state: null };
  }
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT gc.name, gs.name AS state_name
     FROM geo_cities gc
     JOIN geo_states gs ON gs.id = gc.state_id
     WHERE gc.is_active = 1
       AND gs.is_active = 1
       AND gs.country = ?
       AND LOWER(TRIM(gc.name)) = LOWER(?)
     LIMIT 1`,
    [country, locationCity.trim()],
  );
  if (rows.length === 0) {
    return {
      ok: false,
      error: "location_city must be selected from the geo catalog",
    };
  }
  return {
    ok: true,
    location_city: String(rows[0].name),
    location_state: String(rows[0].state_name),
  };
}

export function parseEventCoord(
  value: unknown,
  kind: "lat" | "lng",
): number | null | "invalid" {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return "invalid";
  if (kind === "lat" && (n < -90 || n > 90)) return "invalid";
  if (kind === "lng" && (n < -180 || n > 180)) return "invalid";
  return n;
}

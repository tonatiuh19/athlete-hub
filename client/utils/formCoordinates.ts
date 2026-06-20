/** Parse latitude/longitude from form fields (string, number, or empty). */
export function parseFormCoordinate(
  raw: string | number | null | undefined,
): number | null {
  if (raw == null) return null;
  const normalized = String(raw).trim().replace(",", ".");
  if (!normalized) return null;
  const n = Number(normalized);
  if (!Number.isFinite(n)) return null;
  return n;
}

export type FormCoordinateError = "pair_required" | "invalid_lat" | "invalid_lng";

export function validateFormCoordinatePair(
  lat: number | null,
  lng: number | null,
): FormCoordinateError | null {
  if (lat == null && lng == null) return null;
  if (lat == null || lng == null) return "pair_required";
  if (lat < -90 || lat > 90) return "invalid_lat";
  if (lng < -180 || lng > 180) return "invalid_lng";
  return null;
}

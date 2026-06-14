import { parseRouteGeoJson } from "./courseGeoJson.js";

export const MAX_GPX_FILE_BYTES = 8 * 1024 * 1024;
export const MAX_ROUTE_POINTS = 800;
export const MIN_ROUTE_POINTS = 2;

export function isValidGeoCoordinate(lat: unknown, lng: unknown): boolean {
  const la = Number(lat);
  const ln = Number(lng);
  if (!Number.isFinite(la) || !Number.isFinite(ln)) return false;
  if (la < -90 || la > 90 || ln < -180 || ln > 180) return false;
  if (Math.abs(la) < 0.0001 && Math.abs(ln) < 0.0001) return false;
  return true;
}

export type CoursePayloadInput = {
  routeGeojson: unknown;
  points: unknown;
  distanceKm?: unknown;
  elevationGainM?: unknown;
  elevationProfile?: unknown;
};

export function validateCoursePayload(
  body: CoursePayloadInput,
): { ok: true } | { ok: false; error: string } {
  const { routeGeojson, points } = body;
  if (!routeGeojson || typeof routeGeojson !== "object") {
    return { ok: false, error: "routeGeojson required" };
  }
  if (!Array.isArray(points)) {
    return { ok: false, error: "points array required" };
  }

  const route = parseRouteGeoJson(routeGeojson);
  if (route.length < MIN_ROUTE_POINTS) {
    return {
      ok: false,
      error: `route must have at least ${MIN_ROUTE_POINTS} points`,
    };
  }
  if (route.length > MAX_ROUTE_POINTS) {
    return { ok: false, error: `route exceeds ${MAX_ROUTE_POINTS} points` };
  }

  for (const point of route) {
    if (!isValidGeoCoordinate(point.lat, point.lng)) {
      return { ok: false, error: "route contains invalid coordinates" };
    }
  }

  for (const raw of points) {
    if (!raw || typeof raw !== "object") {
      return { ok: false, error: "invalid checkpoint entry" };
    }
    const p = raw as Record<string, unknown>;
    if (!isValidGeoCoordinate(p.lat, p.lng)) {
      return { ok: false, error: "checkpoint contains invalid coordinates" };
    }
    if (typeof p.type !== "string" || !p.type.trim()) {
      return { ok: false, error: "checkpoint type required" };
    }
    if (typeof p.name !== "string") {
      return { ok: false, error: "checkpoint name required" };
    }
  }

  const serialized = JSON.stringify(routeGeojson);
  if (serialized.length > 2_000_000) {
    return { ok: false, error: "route payload too large" };
  }

  return { ok: true };
}

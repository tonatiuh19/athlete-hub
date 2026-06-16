import type { CoursePoint, GeoJsonLineString } from "@shared/api";
import {
  buildRouteGeoJson,
  getRouteImportSource,
  parseRouteGeoJson,
  type RouteImportSource,
  type RouteLatLng,
} from "@shared/courseGeoJson";
import { MAX_ROUTE_POINTS } from "@shared/courseValidation";

export type LatLng = RouteLatLng;
export type { RouteImportSource };

const EARTH_RADIUS_KM = 6371;

export function haversineKm(a: LatLng, b: LatLng): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

export function polylineLengthKm(points: LatLng[]): number {
  if (points.length < 2) return 0;
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += haversineKm(points[i - 1], points[i]);
  }
  return Math.round(total * 1000) / 1000;
}

export function dedupeConsecutiveRoutePoints(route: LatLng[]): LatLng[] {
  if (route.length < 2) return route;
  const out: LatLng[] = [route[0]];
  for (let i = 1; i < route.length; i++) {
    const prev = out[out.length - 1];
    const cur = route[i];
    if (Math.abs(prev.lat - cur.lat) > 1e-7 || Math.abs(prev.lng - cur.lng) > 1e-7) {
      out.push(cur);
    }
  }
  return out;
}

/** Reduce dense GPS traces while preserving start/end. */
export function simplifyRoute(route: LatLng[], maxPoints = MAX_ROUTE_POINTS): LatLng[] {
  const deduped = dedupeConsecutiveRoutePoints(route);
  if (deduped.length <= maxPoints) return deduped;
  if (maxPoints < 2) return deduped.slice(0, 1);

  const out: LatLng[] = [deduped[0]];
  const innerSlots = maxPoints - 2;
  const step = (deduped.length - 2) / innerSlots;
  for (let i = 1; i <= innerSlots; i++) {
    out.push(deduped[Math.min(deduped.length - 2, Math.round(i * step))]);
  }
  out.push(deduped[deduped.length - 1]);
  return dedupeConsecutiveRoutePoints(out);
}

export function buildLineString(
  route: LatLng[],
  importSource?: RouteImportSource,
): GeoJsonLineString | Record<string, unknown> {
  return buildRouteGeoJson(route, importSource) as GeoJsonLineString | Record<string, unknown>;
}

export function parseLineString(route: GeoJsonLineString | Record<string, unknown>): LatLng[] {
  return parseRouteGeoJson(route);
}

/** Leaflet `[lat, lng]` positions from any supported route GeoJSON shape. */
export function routeToLeafletPositions(
  route: GeoJsonLineString | Record<string, unknown> | null | undefined,
): [number, number][] {
  return parseRouteGeoJson(route).map((p) => [p.lat, p.lng]);
}

export { getRouteImportSource };

/** Approximate km from start along the route polyline */
export function kmAlongRoute(route: LatLng[], point: LatLng): number {
  if (route.length < 2) return 0;
  let bestDist = Infinity;
  let bestKm = 0;
  let accumulated = 0;

  for (let i = 1; i < route.length; i++) {
    const segStart = route[i - 1];
    const segEnd = route[i];
    const segLen = haversineKm(segStart, segEnd);
    const projected = projectOnSegment(point, segStart, segEnd);
    const distToSeg = haversineKm(point, projected);
    if (distToSeg < bestDist) {
      bestDist = distToSeg;
      bestKm = accumulated + haversineKm(segStart, projected);
    }
    accumulated += segLen;
  }

  return Math.round(bestKm * 100) / 100;
}

function projectOnSegment(p: LatLng, a: LatLng, b: LatLng): LatLng {
  const ax = a.lng;
  const ay = a.lat;
  const bx = b.lng;
  const by = b.lat;
  const px = p.lng;
  const py = p.lat;
  const dx = bx - ax;
  const dy = by - ay;
  if (dx === 0 && dy === 0) return a;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return { lat: ay + t * dy, lng: ax + t * dx };
}

export function assignKmToPoints(route: LatLng[], points: CoursePoint[]): CoursePoint[] {
  if (route.length < 2) return points;
  return points.map((p) => ({
    ...p,
    km: kmAlongRoute(route, { lat: p.lat, lng: p.lng }),
  }));
}

export function inferRouteImportSource(
  route: LatLng[],
  points: CoursePoint[],
  geo: unknown,
): RouteImportSource {
  const stored = getRouteImportSource(geo);
  if (stored) return stored;
  if (route.length >= 20) return "gpx";
  const start = points.find((p) => p.type === "start");
  if (start && route.length >= 2) {
    const first = route[0];
    if (
      Math.abs(start.lat - first.lat) < 0.0001 &&
      Math.abs(start.lng - first.lng) < 0.0001
    ) {
      return "gpx";
    }
  }
  return "manual";
}

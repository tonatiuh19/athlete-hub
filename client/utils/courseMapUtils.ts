import type { CoursePoint, GeoJsonLineString, StaffEventCoursePayload } from "@shared/api";
import {
  buildRouteGeoJson,
  getRouteImportSource,
  parseRouteGeoJson,
  type RouteImportSource,
  type RouteLatLng,
} from "@shared/courseGeoJson";
import {
  alignCourseStartFinishPoints,
  inferRouteImportSource,
  shouldAlignCourseWithRoute,
} from "@shared/courseNormalize";
import {
  assignKmToPoints,
  haversineKm,
  kmAlongRoute,
  polylineLengthKm,
} from "@shared/courseRouteMetrics";
import { isValidGeoCoordinate, MAX_ROUTE_POINTS } from "@shared/courseValidation";

export type LatLng = RouteLatLng;
export type { RouteImportSource };
export { inferRouteImportSource, haversineKm, polylineLengthKm, kmAlongRoute, assignKmToPoints };

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

export function normalizeCoursePayloadForSave(
  course: StaffEventCoursePayload,
): StaffEventCoursePayload {
  const route = parseRouteGeoJson(course.routeGeojson);
  if (!shouldAlignCourseWithRoute(route, course.points ?? [], course.routeGeojson)) {
    return course;
  }

  const aligned = alignCourseStartFinishPoints(route, course.points ?? []);

  return {
    ...course,
    points: assignKmToPoints(route, aligned),
    distanceKm: polylineLengthKm(route) || course.distanceKm,
  };
}

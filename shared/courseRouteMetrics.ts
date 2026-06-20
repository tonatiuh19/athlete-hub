import type { CoursePoint } from "./api.js";
import type { RouteLatLng } from "./courseGeoJson.js";

const EARTH_RADIUS_KM = 6371;

export function haversineKm(a: RouteLatLng, b: RouteLatLng): number {
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

export function polylineLengthKm(points: RouteLatLng[]): number {
  if (points.length < 2) return 0;
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += haversineKm(points[i - 1], points[i]);
  }
  return Math.round(total * 1000) / 1000;
}

function projectOnSegment(p: RouteLatLng, a: RouteLatLng, b: RouteLatLng): RouteLatLng {
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

/** Approximate km from start along the route polyline */
export function kmAlongRoute(route: RouteLatLng[], point: RouteLatLng): number {
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

export function assignKmToPoints(route: RouteLatLng[], points: CoursePoint[]): CoursePoint[] {
  if (route.length < 2) return points;
  return points.map((p) => ({
    ...p,
    km: kmAlongRoute(route, { lat: p.lat, lng: p.lng }),
  }));
}

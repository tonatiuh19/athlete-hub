import type { CoursePoint, GeoJsonLineString } from "@shared/api";

export type LatLng = { lat: number; lng: number };

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

export function buildLineString(route: LatLng[]): GeoJsonLineString {
  return {
    type: "LineString",
    coordinates: route.map((p) => [p.lng, p.lat]),
  };
}

export function parseLineString(route: GeoJsonLineString | Record<string, unknown>): LatLng[] {
  if (route.type !== "LineString" || !Array.isArray(route.coordinates)) return [];
  return route.coordinates
    .map((c) => {
      if (!Array.isArray(c) || c.length < 2) return null;
      return { lat: Number(c[1]), lng: Number(c[0]) };
    })
    .filter((p): p is LatLng => p != null && Number.isFinite(p.lat) && Number.isFinite(p.lng));
}

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

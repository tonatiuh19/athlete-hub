import type { LatLng } from "@/utils/courseMapUtils";
import type { ElevationProfilePoint } from "@shared/api";
import { haversineKm, polylineLengthKm } from "@/utils/courseMapUtils";

export interface GpxParseResult {
  route: LatLng[];
  elevationProfile: ElevationProfilePoint[];
  elevationGainM: number;
}

/** Parse GPX track or route points into lat/lng pairs and elevation profile. */
export function parseGpxFile(text: string): GpxParseResult {
  const parser = new DOMParser();
  const doc = parser.parseFromString(text, "application/xml");
  if (doc.querySelector("parsererror")) {
    return { route: [], elevationProfile: [], elevationGainM: 0 };
  }

  const route: LatLng[] = [];
  const elevations: number[] = [];
  doc.querySelectorAll("trkpt, rtept").forEach((pt) => {
    const lat = parseFloat(pt.getAttribute("lat") || "");
    const lng = parseFloat(pt.getAttribute("lon") || "");
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    route.push({ lat, lng });
    const eleNode = pt.querySelector("ele");
    const ele = eleNode ? parseFloat(eleNode.textContent || "") : NaN;
    elevations.push(Number.isFinite(ele) ? ele : NaN);
  });

  const elevationProfile = buildElevationProfileFromRoute(route, elevations);
  const elevationGainM = computeElevationGain(elevationProfile);

  return { route, elevationProfile, elevationGainM };
}

/** @deprecated Use parseGpxFile */
export function parseGpxTrack(text: string): LatLng[] {
  return parseGpxFile(text).route;
}

export function buildElevationProfileFromRoute(
  route: LatLng[],
  elevations?: number[],
): ElevationProfilePoint[] {
  if (route.length < 2) return [];

  const profile: ElevationProfilePoint[] = [];
  let accumulatedKm = 0;
  let lastEle =
    elevations && Number.isFinite(elevations[0]) ? elevations[0] : 100;

  profile.push({ km: 0, elevation_m: Math.round(lastEle) });

  for (let i = 1; i < route.length; i++) {
    accumulatedKm += haversineKm(route[i - 1], route[i]);
    const rawEle = elevations?.[i];
    if (rawEle != null && Number.isFinite(rawEle)) {
      lastEle = rawEle;
    }
    profile.push({
      km: Math.round(accumulatedKm * 100) / 100,
      elevation_m: Math.round(lastEle),
    });
  }

  return downsampleProfile(profile, 120);
}

function downsampleProfile(
  profile: ElevationProfilePoint[],
  maxPoints: number,
): ElevationProfilePoint[] {
  if (profile.length <= maxPoints) return profile;
  const step = profile.length / maxPoints;
  const out: ElevationProfilePoint[] = [];
  for (let i = 0; i < maxPoints; i++) {
    out.push(profile[Math.floor(i * step)]);
  }
  if (out[out.length - 1]?.km !== profile[profile.length - 1]?.km) {
    out.push(profile[profile.length - 1]);
  }
  return out;
}

export function computeElevationGain(profile: ElevationProfilePoint[]): number {
  let gain = 0;
  for (let i = 1; i < profile.length; i++) {
    const delta = profile[i].elevation_m - profile[i - 1].elevation_m;
    if (delta > 0) gain += delta;
  }
  return Math.round(gain);
}

export function buildPaceHeatmapSegments(
  splits: Array<{ distance_km?: number | null; elapsed_ms: number; split_order: number }>,
  totalDistanceKm: number,
): Array<{ kmStart: number; kmEnd: number; pacePerKmMs: number; intensity: number }> {
  if (splits.length === 0 || totalDistanceKm <= 0) return [];

  const sorted = [...splits].sort((a, b) => a.split_order - b.split_order);
  const segments: Array<{
    kmStart: number;
    kmEnd: number;
    pacePerKmMs: number;
    intensity: number;
  }> = [];

  let prevKm = 0;
  let prevMs = 0;

  for (const split of sorted) {
    const km = split.distance_km ?? totalDistanceKm;
    const segmentKm = Math.max(0.01, km - prevKm);
    const segmentMs = Math.max(1, split.elapsed_ms - prevMs);
    const pace = segmentMs / segmentKm;
    segments.push({
      kmStart: prevKm,
      kmEnd: km,
      pacePerKmMs: Math.round(pace),
      intensity: 0,
    });
    prevKm = km;
    prevMs = split.elapsed_ms;
  }

  if (segments.length === 0) return segments;
  const paces = segments.map((s) => s.pacePerKmMs);
  const minPace = Math.min(...paces);
  const maxPace = Math.max(...paces);
  const span = Math.max(1, maxPace - minPace);

  return segments.map((s) => ({
    ...s,
    intensity: Math.round(((maxPace - s.pacePerKmMs) / span) * 100),
  }));
}

export function routeLengthKm(route: LatLng[]): number {
  return polylineLengthKm(route);
}

import type { LatLng } from "@/utils/courseMapUtils";
import type { ElevationProfilePoint } from "@shared/api";
import { MAX_GPX_FILE_BYTES } from "@shared/courseValidation";
import { haversineKm, polylineLengthKm, simplifyRoute } from "@/utils/courseMapUtils";

export interface GpxParseResult {
  route: LatLng[];
  elevationProfile: ElevationProfilePoint[];
  elevationGainM: number;
  simplified: boolean;
  source: "track" | "route" | "waypoints";
}

const GPX_MIME_TYPES = new Set([
  "application/gpx+xml",
  "application/xml",
  "text/xml",
  "application/octet-stream",
  "",
]);

/** iOS/iPad often sends GPX as octet-stream or with an empty MIME type. */
export function isGpxFile(file: File): boolean {
  if (file.name.toLowerCase().endsWith(".gpx")) return true;
  return GPX_MIME_TYPES.has(file.type.trim().toLowerCase());
}

export function isGpxFileWithinSizeLimit(file: File): boolean {
  return file.size > 0 && file.size <= MAX_GPX_FILE_BYTES;
}

export async function readGpxFileText(file: File): Promise<string> {
  if (typeof file.text === "function") {
    return file.text();
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read GPX file"));
    reader.readAsText(file);
  });
}

function findElementsByLocalName(root: ParentNode, localName: string): Element[] {
  const wanted = localName.toLowerCase();
  const out: Element[] = [];
  root.querySelectorAll("*").forEach((node) => {
    if (node.localName?.toLowerCase() === wanted) {
      out.push(node);
    }
  });
  return out;
}

function pointsFromTrackContainer(container: Element): Element[] {
  const direct = Array.from(container.querySelectorAll("trkpt"));
  if (direct.length > 0) return direct;
  return findElementsByLocalName(container, "trkpt");
}

function pointsFromRouteContainer(container: Element): Element[] {
  const direct = Array.from(container.querySelectorAll("rtept"));
  if (direct.length > 0) return direct;
  return findElementsByLocalName(container, "rtept");
}

function collectGpxTrackPoints(doc: Document): { points: Element[]; source: GpxParseResult["source"] } {
  const tracks = findElementsByLocalName(doc, "trk");
  if (tracks.length > 0) {
    const points = pointsFromTrackContainer(tracks[0]);
    if (points.length > 0) return { points, source: "track" };
  }

  const routes = findElementsByLocalName(doc, "rte");
  if (routes.length > 0) {
    const points = pointsFromRouteContainer(routes[0]);
    if (points.length > 0) return { points, source: "route" };
  }

  const waypoints = findElementsByLocalName(doc, "wpt");
  if (waypoints.length >= 2) {
    return { points: waypoints, source: "waypoints" };
  }

  return { points: [], source: "track" };
}

function readElevation(node: Element): number {
  const eleNode =
    node.querySelector("ele") ??
    Array.from(node.children).find((child) => child.localName?.toLowerCase() === "ele");
  const ele = eleNode ? parseFloat(eleNode.textContent || "") : NaN;
  return Number.isFinite(ele) ? ele : NaN;
}

/** Parse GPX track or route points into lat/lng pairs and elevation profile. */
export function parseGpxFile(text: string): GpxParseResult {
  const parser = new DOMParser();
  const doc = parser.parseFromString(text, "application/xml");
  if (doc.querySelector("parsererror")) {
    return { route: [], elevationProfile: [], elevationGainM: 0, simplified: false, source: "track" };
  }

  const { points: pointNodes, source } = collectGpxTrackPoints(doc);
  const route: LatLng[] = [];
  const elevations: number[] = [];

  pointNodes.forEach((pt) => {
    const lat = parseFloat(pt.getAttribute("lat") || "");
    const lng = parseFloat(pt.getAttribute("lon") || "");
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    route.push({ lat, lng });
    elevations.push(readElevation(pt));
  });

  const beforeCount = route.length;
  const simplifiedRoute = simplifyRoute(route);
  const simplifiedElevations =
    simplifiedRoute.length === beforeCount
      ? elevations
      : resampleElevations(route, elevations, simplifiedRoute);

  const elevationProfile = buildElevationProfileFromRoute(simplifiedRoute, simplifiedElevations);
  const elevationGainM = computeElevationGain(elevationProfile);

  return {
    route: simplifiedRoute,
    elevationProfile,
    elevationGainM,
    simplified: simplifiedRoute.length < beforeCount,
    source,
  };
}

function resampleElevations(
  originalRoute: LatLng[],
  elevations: number[],
  simplifiedRoute: LatLng[],
): number[] {
  return simplifiedRoute.map((point) => {
    let bestIdx = 0;
    let bestDist = Infinity;
    originalRoute.forEach((candidate, idx) => {
      const dist = haversineKm(point, candidate);
      if (dist < bestDist) {
        bestDist = dist;
        bestIdx = idx;
      }
    });
    return elevations[bestIdx];
  });
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

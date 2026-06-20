import { describe, expect, it } from "vitest";
import { simplifyRoute, normalizeCoursePayloadForSave } from "@/utils/courseMapUtils";
import { MAX_ROUTE_POINTS } from "@shared/courseValidation";
import { buildRouteGeoJson } from "@shared/courseGeoJson";

describe("simplifyRoute", () => {
  it("preserves start and end when simplifying", () => {
    const dense = Array.from({ length: 2000 }, (_, i) => ({
      lat: 19.4 + i * 0.0001,
      lng: -99.1 + i * 0.0001,
    }));
    const simplified = simplifyRoute(dense, MAX_ROUTE_POINTS);
    expect(simplified.length).toBeLessThanOrEqual(MAX_ROUTE_POINTS);
    expect(simplified[0]).toEqual(dense[0]);
    expect(simplified[simplified.length - 1]).toEqual(dense[dense.length - 1]);
  });

  it("returns short routes unchanged", () => {
    const route = [
      { lat: 19.43, lng: -99.13 },
      { lat: 19.44, lng: -99.12 },
    ];
    expect(simplifyRoute(route)).toEqual(route);
  });
});

describe("normalizeCoursePayloadForSave", () => {
  it("realigns GPX start/finish POIs with route endpoints", () => {
    const route = [
      { lat: 20.97, lng: -89.62 },
      { lat: 20.98, lng: -89.61 },
    ];
    const routeGeojson = buildRouteGeoJson(route, "gpx");
    const normalized = normalizeCoursePayloadForSave({
      routeGeojson,
      points: [
        { type: "start", name: "Start", lat: 20.67, lng: -103.35 },
        { type: "finish", name: "Finish", lat: 19.0, lng: -99.0 },
      ],
    });
    const start = normalized.points?.find((p) => p.type === "start");
    const finish = normalized.points?.find((p) => p.type === "finish");
    expect(start?.lat).toBeCloseTo(20.97);
    expect(start?.lng).toBeCloseTo(-89.62);
    expect(finish?.lat).toBeCloseTo(20.98);
    expect(finish?.lng).toBeCloseTo(-89.61);
  });

  it("realigns legacy dense LineString courses without gpx metadata", () => {
    const route = Array.from({ length: 40 }, (_, i) => ({
      lat: 20.97 + i * 0.0002,
      lng: -89.62 - i * 0.0002,
    }));
    const routeGeojson = { type: "LineString", coordinates: route.map((p) => [p.lng, p.lat]) };
    const normalized = normalizeCoursePayloadForSave({
      routeGeojson,
      points: [{ type: "start", name: "Start", lat: 20.67, lng: -103.35 }],
    });
    expect(normalized.points?.find((p) => p.type === "start")?.lat).toBeCloseTo(route[0]!.lat);
  });
});

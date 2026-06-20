import { describe, expect, it } from "vitest";
import type { CoursePoint } from "@shared/api";
import { buildRouteGeoJson } from "@shared/courseGeoJson";
import {
  alignCourseStartFinishPoints,
  inferRouteImportSource,
  normalizeEventCourse,
  shouldAlignCourseWithRoute,
} from "@shared/courseNormalize";

describe("courseNormalize", () => {
  const yucatanRoute = [
    { lat: 20.97, lng: -89.62 },
    { lat: 20.98, lng: -89.61 },
    { lat: 20.99, lng: -89.6 },
  ];

  it("infers GPX from dense legacy LineString without importSource metadata", () => {
    const dense = Array.from({ length: 50 }, (_, i) => ({
      lat: 20.97 + i * 0.0001,
      lng: -89.62 - i * 0.0001,
    }));
    const geo = { type: "LineString", coordinates: dense.map((p) => [p.lng, p.lat]) };
    expect(inferRouteImportSource(dense, [], geo)).toBe("gpx");
    expect(shouldAlignCourseWithRoute(dense, [], geo)).toBe(true);
  });

  it("realigns stale start POI for legacy GPX routes", () => {
    const route = Array.from({ length: 30 }, (_, i) => ({
      lat: 20.97 + i * 0.0002,
      lng: -89.62 - i * 0.0002,
    }));
    const routeGeojson = { type: "LineString", coordinates: route.map((p) => [p.lng, p.lat]) };
    const normalized = normalizeEventCourse({
      routeGeojson,
      points: [
        { type: "start", name: "Start", lat: 20.67, lng: -103.35 },
        { type: "finish", name: "Finish", lat: 19.0, lng: -99.0 },
      ],
    });
    const start = normalized.points?.find((p) => p.type === "start");
    expect(start?.lat).toBeCloseTo(route[0]!.lat);
    expect(start?.lng).toBeCloseTo(route[0]!.lng);
  });

  it("aligns when route is tagged as GPX Feature", () => {
    const routeGeojson = buildRouteGeoJson(yucatanRoute, "gpx");
    const aligned = alignCourseStartFinishPoints(yucatanRoute, [
      { type: "start", name: "Start", lat: 20.67, lng: -103.35 },
    ]);
    expect(aligned[0]?.lat).toBeCloseTo(20.97);
    expect(normalizeEventCourse({ routeGeojson, points: aligned }).points?.[0]?.lat).toBeCloseTo(
      20.97,
    );
  });

  it("does not align short manual courses", () => {
    const manual = [
      { lat: 19.43, lng: -99.13 },
      { lat: 19.44, lng: -99.12 },
    ];
    const geo = buildRouteGeoJson(manual, "manual");
    const points: CoursePoint[] = [
      { type: "start", name: "Start", lat: 19.4, lng: -99.1 },
      { type: "finish", name: "Finish", lat: 19.44, lng: -99.12 },
    ];
    expect(shouldAlignCourseWithRoute(manual, points, geo)).toBe(false);
    const normalized = normalizeEventCourse({ routeGeojson: geo, points });
    expect(normalized.points?.find((p) => p.type === "start")?.km).toBe(0);
    expect(normalized.points?.find((p) => p.type === "finish")?.km).toBeGreaterThan(0);
  });

  it("assigns km to finish after aligning stale POIs", () => {
    const route = Array.from({ length: 30 }, (_, i) => ({
      lat: 20.97 + i * 0.0002,
      lng: -89.62 - i * 0.0002,
    }));
    const routeGeojson = { type: "LineString", coordinates: route.map((p) => [p.lng, p.lat]) };
    const normalized = normalizeEventCourse({
      routeGeojson,
      points: [
        { type: "start", name: "Start", lat: 20.67, lng: -103.35 },
        { type: "finish", name: "Finish", lat: 19.0, lng: -99.0 },
      ],
    });
    const start = normalized.points?.find((p) => p.type === "start");
    const finish = normalized.points?.find((p) => p.type === "finish");
    expect(start?.km).toBe(0);
    expect(finish?.km).not.toBeNull();
    expect(finish?.km).toBeGreaterThan(0);
  });
});

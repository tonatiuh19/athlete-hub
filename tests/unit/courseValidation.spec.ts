import { describe, expect, it } from "vitest";
import { buildRouteGeoJson, getRouteImportSource, parseRouteGeoJson } from "@shared/courseGeoJson";
import { isValidGeoCoordinate, validateCoursePayload } from "@shared/courseValidation";

describe("isValidGeoCoordinate", () => {
  it("rejects null island", () => {
    expect(isValidGeoCoordinate(0, 0)).toBe(false);
  });

  it("accepts Mexico City coordinates", () => {
    expect(isValidGeoCoordinate(19.4326, -99.1332)).toBe(true);
  });
});

describe("validateCoursePayload", () => {
  const validRoute = buildRouteGeoJson(
    [
      { lat: 19.43, lng: -99.13 },
      { lat: 19.44, lng: -99.12 },
    ],
    "manual",
  );

  it("accepts a valid course", () => {
    const result = validateCoursePayload({
      routeGeojson: validRoute,
      points: [{ type: "start", name: "Start", lat: 19.43, lng: -99.13 }],
    });
    expect(result).toEqual({ ok: true });
  });

  it("rejects routes with invalid coordinates", () => {
    const badRoute = buildRouteGeoJson([
      { lat: 0, lng: 0 },
      { lat: 19.44, lng: -99.12 },
    ]);
    const result = validateCoursePayload({
      routeGeojson: badRoute,
      points: [],
    });
    expect(result.ok).toBe(false);
  });
});

describe("courseGeoJson", () => {
  it("round-trips route points", () => {
    const route = [
      { lat: 20.65, lng: -103.35 },
      { lat: 20.66, lng: -103.34 },
    ];
    const geo = buildRouteGeoJson(route, "gpx");
    expect(parseRouteGeoJson(geo)).toEqual(route);
    expect(getRouteImportSource(geo)).toBe("gpx");
  });
});

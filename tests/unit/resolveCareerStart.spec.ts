import { describe, expect, it } from "vitest";
import { resolveCareerStartCoords } from "@/utils/resolveCareerStart";

describe("resolveCareerStartCoords", () => {
  const gpxStart = { lat: 20.97, lng: -89.62 };
  const stalePoi = { lat: 20.67, lng: -103.35 };
  const venue = stalePoi;

  it("prefers GPX route start over stale start POI", () => {
    const result = resolveCareerStartCoords({
      points: [{ type: "start", name: "Start", lat: stalePoi.lat, lng: stalePoi.lng }],
      eventLat: venue.lat,
      eventLng: venue.lng,
      route: [gpxStart, { lat: 20.98, lng: -89.61 }],
      routeImportSource: "gpx",
    });
    expect(result).toEqual(gpxStart);
  });

  it("uses GPX route start when preferRouteStart and no POI", () => {
    const result = resolveCareerStartCoords({
      points: [],
      eventLat: venue.lat,
      eventLng: venue.lng,
      route: [gpxStart, { lat: 20.98, lng: -89.61 }],
      preferRouteStart: true,
    });
    expect(result).toEqual(gpxStart);
  });

  it("falls back to event venue only when no course data", () => {
    const result = resolveCareerStartCoords({
      points: [],
      eventLat: venue.lat,
      eventLng: venue.lng,
      route: [],
    });
    expect(result).toEqual(venue);
  });
});

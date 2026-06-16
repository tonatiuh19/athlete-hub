import { describe, expect, it } from "vitest";
import { buildGpxFromCourse } from "@/utils/gpxExport";

describe("buildGpxFromCourse", () => {
  it("returns null when route has fewer than 2 points", () => {
    expect(
      buildGpxFromCourse("Test", {
        routeGeojson: { type: "LineString", coordinates: [[-99.1, 19.4]] },
        points: [],
      }),
    ).toBeNull();
  });

  it("builds valid GPX with track and waypoints", () => {
    const gpx = buildGpxFromCourse("Marathon CDMX", {
      routeGeojson: {
        type: "LineString",
        coordinates: [
          [-99.1332, 19.4326],
          [-99.14, 19.44],
        ],
      },
      points: [
        { type: "start", name: "Start line", lat: 19.4326, lng: -99.1332 },
        { type: "hydration", name: "Aid 1", lat: 19.436, lng: -99.136 },
      ],
      distanceKm: 5,
      elevationProfile: [
        { km: 0, elevation_m: 2240 },
        { km: 5, elevation_m: 2260 },
      ],
    });

    expect(gpx).toContain('<?xml version="1.0"');
    expect(gpx).toContain("<name>Marathon CDMX</name>");
    expect(gpx).toContain('lat="19.4326000" lon="-99.1332000"');
    expect(gpx).toContain("<wpt");
    expect(gpx).toContain("Start line");
    expect(gpx).toContain("<ele>");
  });
});

/** @vitest-environment jsdom */
import { describe, expect, it } from "vitest";
import { isGpxFile, isGpxFileWithinSizeLimit, parseGpxFile } from "@/utils/gpxParse";
import { MAX_GPX_FILE_BYTES } from "@shared/courseValidation";

describe("parseGpxFile", () => {
  it("parses standard trkpt elements", () => {
    const xml = `<?xml version="1.0"?>
      <gpx><trk><trkseg>
        <trkpt lat="19.43" lon="-99.13"><ele>2240</ele></trkpt>
        <trkpt lat="19.44" lon="-99.12"><ele>2250</ele></trkpt>
      </trkseg></trk></gpx>`;
    const result = parseGpxFile(xml);
    expect(result.route).toHaveLength(2);
    expect(result.route[0]).toEqual({ lat: 19.43, lng: -99.13 });
  });

  it("parses namespaced GPX exports", () => {
    const xml = `<?xml version="1.0"?>
      <gpx xmlns="http://www.topografix.com/GPX/1/1">
        <trk><trkseg>
          <trkpt lat="20.65" lon="-103.35"><ele>1500</ele></trkpt>
          <trkpt lat="20.66" lon="-103.34"><ele>1510</ele></trkpt>
          <trkpt lat="20.67" lon="-103.33"><ele>1520</ele></trkpt>
        </trkseg></trk>
      </gpx>`;
    const result = parseGpxFile(xml);
    expect(result.route).toHaveLength(3);
    expect(result.route[0].lat).toBeCloseTo(20.65);
  });

  it("prefers the course loop over a commute segment when multiple tracks exist", () => {
    const commute = Array.from({ length: 50 }, (_, i) =>
      `<trkpt lat="${20.67 + i * 0.01}" lon="${-103.35 - i * 0.02}" />`,
    ).join("");
    const race = Array.from({ length: 40 }, (_, i) => {
      const angle = (i / 40) * Math.PI * 2;
      const lat = 20.97 + Math.sin(angle) * 0.05;
      const lng = -89.62 + Math.cos(angle) * 0.05;
      return `<trkpt lat="${lat}" lon="${lng}" />`;
    }).join("");
    const xml = `<?xml version="1.0"?>
      <gpx>
        <trk><trkseg>${commute}</trkseg></trk>
        <trk><trkseg>${race}</trkseg></trk>
      </gpx>`;
    const result = parseGpxFile(xml, { preferStartNear: { lat: 20.97, lng: -89.62 } });
    expect(result.route[0].lat).toBeCloseTo(20.97, 1);
    expect(result.route[0].lng).toBeCloseTo(-89.62, 1);
  });

  it("prefers the on-course track when a short segment starts far from its path", () => {
    const xml = `<?xml version="1.0"?>
      <gpx>
        <trk><trkseg>
          <trkpt lat="19.40" lon="-99.10" />
          <trkpt lat="25.00" lon="-90.00" />
        </trkseg></trk>
        <trk><trkseg>
          <trkpt lat="21.00" lon="-100.00" />
          <trkpt lat="21.01" lon="-100.01" />
          <trkpt lat="21.02" lon="-100.02" />
        </trkseg></trk>
      </gpx>`;
    const result = parseGpxFile(xml);
    expect(result.route[0]).toEqual({ lat: 21.0, lng: -100.0 });
    expect(result.route).toHaveLength(3);
    expect(result.source).toBe("track");
  });

  it("falls back to waypoints when no track exists", () => {
    const xml = `<?xml version="1.0"?>
      <gpx>
        <wpt lat="19.40" lon="-99.10" />
        <wpt lat="19.41" lon="-99.11" />
        <wpt lat="19.42" lon="-99.12" />
      </gpx>`;
    const result = parseGpxFile(xml);
    expect(result.route).toHaveLength(3);
    expect(result.source).toBe("waypoints");
  });

  it("simplifies dense tracks", () => {
    const points = Array.from({ length: 1200 }, (_, i) =>
      `<trkpt lat="${19.4 + i * 0.00001}" lon="${-99.1 - i * 0.00001}" />`,
    ).join("");
    const xml = `<?xml version="1.0"?><gpx><trk><trkseg>${points}</trkseg></trk></gpx>`;
    const result = parseGpxFile(xml);
    expect(result.route.length).toBeLessThanOrEqual(800);
    expect(result.simplified).toBe(true);
  });
});

describe("isGpxFile", () => {
  it("accepts .gpx extension even when MIME is empty (iOS)", () => {
    const file = new File(["<gpx></gpx>"], "course.gpx", { type: "" });
    expect(isGpxFile(file)).toBe(true);
  });

  it("accepts application/octet-stream when extension matches", () => {
    const file = new File(["<gpx></gpx>"], "route.gpx", {
      type: "application/octet-stream",
    });
    expect(isGpxFile(file)).toBe(true);
  });

  it("rejects non-gpx files", () => {
    const file = new File(["hello"], "notes.txt", { type: "text/plain" });
    expect(isGpxFile(file)).toBe(false);
  });

  it("enforces GPX file size limit", () => {
    const big = new File([new Uint8Array(MAX_GPX_FILE_BYTES + 1)], "big.gpx", {
      type: "application/gpx+xml",
    });
    expect(isGpxFileWithinSizeLimit(big)).toBe(false);
  });
});

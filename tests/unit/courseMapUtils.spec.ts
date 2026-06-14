import { describe, expect, it } from "vitest";
import { simplifyRoute } from "@/utils/courseMapUtils";
import { MAX_ROUTE_POINTS } from "@shared/courseValidation";

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

import { describe, expect, it } from "vitest";
import type { FilterCity } from "@shared/api";
import { findNearestFilterCity } from "@/utils/nearestFilterCity";

const cities: FilterCity[] = [
  { id: 1, city: "Ciudad de México", state: "CDMX", event_count: 10, lat: 19.4326, lng: -99.1332 },
  { id: 2, city: "Guadalajara", state: "Jalisco", event_count: 5, lat: 20.6597, lng: -103.3496 },
  { id: 3, city: "Monterrey", state: "Nuevo León", event_count: 4, lat: 25.6866, lng: -100.3161 },
];

describe("findNearestFilterCity", () => {
  it("returns the closest city with coordinates", () => {
    const nearest = findNearestFilterCity(cities, 19.35, -99.16);
    expect(nearest?.id).toBe(1);
  });

  it("skips cities without coordinates", () => {
    const sparse: FilterCity[] = [
      { id: 9, city: "Unknown", event_count: 1 },
      { id: 2, city: "Guadalajara", state: "Jalisco", event_count: 5, lat: 20.6597, lng: -103.3496 },
    ];
    const nearest = findNearestFilterCity(sparse, 20.67, -103.35);
    expect(nearest?.id).toBe(2);
  });

  it("returns null when no city has coordinates", () => {
    const sparse: FilterCity[] = [{ id: 9, city: "Unknown", event_count: 1 }];
    expect(findNearestFilterCity(sparse, 19.43, -99.13)).toBeNull();
  });
});

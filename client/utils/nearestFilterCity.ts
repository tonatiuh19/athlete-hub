import type { FilterCity } from "@shared/api";
import { haversineKm } from "@/utils/courseMapUtils";

function parseCoord(value: number | string | null | undefined): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

export function findNearestFilterCity(
  cities: FilterCity[],
  userLat: number,
  userLng: number,
): FilterCity | null {
  let nearest: FilterCity | null = null;
  let nearestKm = Infinity;

  for (const city of cities) {
    const lat = parseCoord(city.lat);
    const lng = parseCoord(city.lng);
    if (lat == null || lng == null) continue;

    const distanceKm = haversineKm({ lat: userLat, lng: userLng }, { lat, lng });
    if (distanceKm < nearestKm) {
      nearestKm = distanceKm;
      nearest = city;
    }
  }

  return nearest;
}

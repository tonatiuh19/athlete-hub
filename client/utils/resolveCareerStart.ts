import type { CoursePoint } from "@shared/api";
import { isValidGeoCoordinate } from "@shared/courseValidation";
import type { LatLng } from "@/utils/courseMapUtils";
import { parseFormCoordinate } from "@/utils/formCoordinates";

/** Resolve race start for map display — never prefer venue over course/GPX data. */
export function resolveCareerStartCoords(input: {
  points: CoursePoint[];
  startLatInput?: string;
  startLngInput?: string;
  eventLat?: unknown;
  eventLng?: unknown;
  route?: LatLng[];
  preferRouteStart?: boolean;
  routeImportSource?: "gpx" | "manual";
}): { lat: number; lng: number } | null {
  const trustRouteStart =
    input.routeImportSource === "gpx" || Boolean(input.preferRouteStart);

  if (trustRouteStart && input.route && input.route.length > 0) {
    const first = input.route[0]!;
    if (isValidGeoCoordinate(first.lat, first.lng)) {
      return { lat: first.lat, lng: first.lng };
    }
  }

  const startPoi = input.points.find((p) => p.type === "start");
  const poiLat = parseFormCoordinate(startPoi?.lat);
  const poiLng = parseFormCoordinate(startPoi?.lng);
  if (poiLat != null && poiLng != null && isValidGeoCoordinate(poiLat, poiLng)) {
    return { lat: poiLat, lng: poiLng };
  }

  const inputLat = parseFormCoordinate(input.startLatInput);
  const inputLng = parseFormCoordinate(input.startLngInput);
  if (inputLat != null && inputLng != null && isValidGeoCoordinate(inputLat, inputLng)) {
    return { lat: inputLat, lng: inputLng };
  }

  if (input.route && input.route.length > 0) {
    const first = input.route[0]!;
    if (isValidGeoCoordinate(first.lat, first.lng)) {
      return { lat: first.lat, lng: first.lng };
    }
  }

  const eventLat = parseFormCoordinate(
    input.eventLat as string | number | null | undefined,
  );
  const eventLng = parseFormCoordinate(
    input.eventLng as string | number | null | undefined,
  );
  if (eventLat != null && eventLng != null && isValidGeoCoordinate(eventLat, eventLng)) {
    return { lat: eventLat, lng: eventLng };
  }

  return null;
}

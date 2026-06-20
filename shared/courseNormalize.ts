import type { CoursePoint, EventCourse } from "./api.js";
import {
  getRouteImportSource,
  parseRouteGeoJson,
  type RouteImportSource,
  type RouteLatLng,
} from "./courseGeoJson.js";
import { isValidGeoCoordinate } from "./courseValidation.js";
import { assignKmToPoints, polylineLengthKm } from "./courseRouteMetrics.js";

export type CourseLike = EventCourse;

export function inferRouteImportSource(
  route: RouteLatLng[],
  points: CoursePoint[],
  geo: unknown,
): RouteImportSource {
  const stored = getRouteImportSource(geo);
  if (stored) return stored;
  if (route.length >= 20) return "gpx";
  const start = points.find((p) => p.type === "start");
  if (start && route.length >= 2) {
    const first = route[0];
    if (
      Math.abs(start.lat - first.lat) < 0.0001 &&
      Math.abs(start.lng - first.lng) < 0.0001
    ) {
      return "gpx";
    }
  }
  return "manual";
}

export function shouldAlignCourseWithRoute(
  route: RouteLatLng[],
  points: CoursePoint[],
  geo: unknown,
): boolean {
  if (route.length < 2) return false;
  const source = getRouteImportSource(geo) ?? inferRouteImportSource(route, points, geo);
  return source === "gpx";
}

/** Align start/finish checkpoint coords with GPX polyline endpoints (idempotent). */
export function alignCourseStartFinishPoints(
  route: RouteLatLng[],
  points: CoursePoint[],
): CoursePoint[] {
  if (route.length < 2) return points;

  const first = route[0]!;
  const last = route[route.length - 1]!;
  if (!isValidGeoCoordinate(first.lat, first.lng) || !isValidGeoCoordinate(last.lat, last.lng)) {
    return points;
  }

  const withoutStartFinish = points.filter((p) => p.type !== "start" && p.type !== "finish");
  const startIdx = points.findIndex((p) => p.type === "start");
  const finishIdx = points.findIndex((p) => p.type === "finish");
  const startName = startIdx >= 0 ? points[startIdx]!.name : "Start";
  const finishName = finishIdx >= 0 ? points[finishIdx]!.name : "Finish";

  return [
    {
      type: "start",
      name: startName,
      lat: first.lat,
      lng: first.lng,
      description: startIdx >= 0 ? points[startIdx]!.description ?? "" : "",
    },
    ...withoutStartFinish,
    {
      type: "finish",
      name: finishName,
      lat: last.lat,
      lng: last.lng,
      description: finishIdx >= 0 ? points[finishIdx]!.description ?? "" : "",
    },
  ];
}

/** Normalize course data for API responses and public maps (fixes legacy misaligned POIs). */
export function normalizeEventCourse(course: EventCourse): EventCourse {
  const route = parseRouteGeoJson(course.routeGeojson);
  if (route.length < 2) return course;

  const basePoints = course.points ?? [];
  const points = shouldAlignCourseWithRoute(route, basePoints, course.routeGeojson)
    ? alignCourseStartFinishPoints(route, basePoints)
    : basePoints;

  return {
    ...course,
    points: assignKmToPoints(route, points),
    distanceKm: course.distanceKm ?? polylineLengthKm(route),
  };
}

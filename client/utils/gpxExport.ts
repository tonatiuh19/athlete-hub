import type { CoursePoint, ElevationProfilePoint, EventCourse } from "@shared/api";
import { parseRouteGeoJson } from "@shared/courseGeoJson";
import { kmAlongRoute } from "@/utils/courseMapUtils";

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function slugifyFilename(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "course";
}

function elevationAtKm(
  km: number,
  profile: ElevationProfilePoint[],
): number | null {
  if (profile.length === 0) return null;
  if (profile.length === 1) return profile[0]!.elevation_m;

  for (let i = 0; i < profile.length - 1; i++) {
    const a = profile[i]!;
    const b = profile[i + 1]!;
    if (km >= a.km && km <= b.km) {
      const span = b.km - a.km;
      if (span <= 0) return a.elevation_m;
      const t = (km - a.km) / span;
      return Math.round(a.elevation_m + t * (b.elevation_m - a.elevation_m));
    }
  }
  return profile[profile.length - 1]!.elevation_m;
}

export function buildGpxFromCourse(
  eventTitle: string,
  course: EventCourse,
): string | null {
  const route = parseRouteGeoJson(course.routeGeojson);
  if (route.length < 2) return null;

  const title = escapeXml(eventTitle.trim() || "Event course");
  const profile = course.elevationProfile ?? [];
  const hasProfile = profile.length > 0;

  let cumulativeKm = 0;
  const trackPoints = route
    .map((point, index) => {
      if (index > 0) {
        cumulativeKm = kmAlongRoute(route, point);
      }
      const ele =
        hasProfile && Number.isFinite(cumulativeKm)
          ? elevationAtKm(cumulativeKm, profile)
          : null;
      const eleTag = ele != null ? `<ele>${ele}</ele>` : "";
      return `        <trkpt lat="${point.lat.toFixed(7)}" lon="${point.lng.toFixed(7)}">${eleTag}</trkpt>`;
    })
    .join("\n");

  const waypoints = (course.points ?? [])
    .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng))
    .map((p: CoursePoint) => {
      const name = escapeXml(p.name || p.type);
      const desc = p.description ? `<desc>${escapeXml(p.description)}</desc>` : "";
      return `  <wpt lat="${p.lat.toFixed(7)}" lon="${p.lng.toFixed(7)}">
    <name>${name}</name>${desc}
  </wpt>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Triboo Sport" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${title}</name>
    <desc>Course route exported from Triboo Sport</desc>
  </metadata>
${waypoints ? `${waypoints}\n` : ""}  <trk>
    <name>${title}</name>
    <type>course</type>
    <trkseg>
${trackPoints}
    </trkseg>
  </trk>
</gpx>
`;
}

export function downloadCourseGpx(options: {
  eventTitle: string;
  eventSlug: string;
  course: EventCourse;
}): boolean {
  const gpx = buildGpxFromCourse(options.eventTitle, options.course);
  if (!gpx) return false;

  const filename = `${slugifyFilename(options.eventSlug)}-course.gpx`;
  const blob = new Blob([gpx], { type: "application/gpx+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
  return true;
}

export type RouteImportSource = "gpx" | "manual";

export type RouteLatLng = { lat: number; lng: number };

function coordsFromLine(coordinates: unknown): RouteLatLng[] {
  if (!Array.isArray(coordinates)) return [];
  return coordinates
    .map((c) => {
      if (!Array.isArray(c) || c.length < 2) return null;
      const lng = Number(c[0]);
      const lat = Number(c[1]);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
      return { lat, lng };
    })
    .filter((p): p is RouteLatLng => p != null);
}

export function parseRouteGeoJson(geo: unknown): RouteLatLng[] {
  if (!geo || typeof geo !== "object") return [];
  const g = geo as Record<string, unknown>;
  if (g.type === "Feature") {
    const geometry = g.geometry as Record<string, unknown> | undefined;
    if (geometry?.type === "LineString") {
      return coordsFromLine(geometry.coordinates);
    }
    return [];
  }
  if (g.type === "LineString") {
    return coordsFromLine(g.coordinates);
  }
  return [];
}

export function getRouteImportSource(geo: unknown): RouteImportSource | null {
  if (!geo || typeof geo !== "object") return null;
  const g = geo as Record<string, unknown>;
  if (g.type !== "Feature") return null;
  const props = g.properties as Record<string, unknown> | undefined;
  const source = props?.importSource;
  return source === "gpx" || source === "manual" ? source : null;
}

export function buildRouteGeoJson(
  route: RouteLatLng[],
  importSource?: RouteImportSource,
): Record<string, unknown> {
  const geometry = {
    type: "LineString" as const,
    coordinates: route.map((p) => [p.lng, p.lat]),
  };
  if (importSource) {
    return {
      type: "Feature",
      properties: { importSource },
      geometry,
    };
  }
  return geometry;
}

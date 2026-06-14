import { useEffect } from "react";
import L from "leaflet";
import { useMap } from "react-leaflet";

type FitPoint = { lat: number; lng: number };

/** Fit map viewport to a route or point cluster (e.g. after GPX import). */
export function MapFitBounds({
  points,
  active = true,
  fitKey = 0,
  padding = 40,
}: {
  points: FitPoint[];
  active?: boolean;
  fitKey?: number;
  padding?: number;
}) {
  const map = useMap();

  useEffect(() => {
    if (!active || points.length === 0) return;

    if (points.length === 1) {
      map.setView([points[0].lat, points[0].lng], 15, { animate: true });
      return;
    }

    const bounds = L.latLngBounds(
      points.map((p) => [p.lat, p.lng] as [number, number]),
    );
    map.fitBounds(bounds, { padding: [padding, padding], maxZoom: 16, animate: true });
  }, [map, active, fitKey, padding, points]);

  return null;
}

/** Recompute map dimensions after mount, resize, and tab visibility changes. */
export function MapInvalidateSize({ active = true }: { active?: boolean }) {
  const map = useMap();

  useEffect(() => {
    if (!active) return;

    const invalidate = () => map.invalidateSize({ animate: false });

    invalidate();
    const timers = [0, 50, 150, 400, 800, 1200].map((ms) =>
      window.setTimeout(() => {
        invalidate();
        map.eachLayer((layer) => {
          if ("redraw" in layer && typeof layer.redraw === "function") {
            layer.redraw();
          }
        });
      }, ms),
    );

    const container = map.getContainer();
    const observer = new ResizeObserver(invalidate);
    observer.observe(container);
    if (container.parentElement) {
      observer.observe(container.parentElement);
    }

    return () => {
      timers.forEach(clearTimeout);
      observer.disconnect();
    };
  }, [map, active]);

  return null;
}

export const CARTO_DARK_TILE_URL =
  "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";

/** Brighter basemap for staff course editing (streets/labels easier to trace). */
export const CARTO_VOYAGER_TILE_URL =
  "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";

export const CARTO_TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>';

export const OSM_TILE_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
export const OSM_TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

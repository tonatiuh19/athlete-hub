import L from "leaflet";
import { getSportPinTheme, resolveSportKind } from "@/utils/sportKind";

export const MEXICO_CENTER: [number, number] = [19.4326, -99.1332];

export function parseCoord(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === "string" && v.trim() === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).trim());
  return Number.isFinite(n) ? n : null;
}

export function parseEventLatLng(event: {
  location_lat?: unknown;
  location_lng?: unknown;
}): [number, number] | null {
  const lat = parseCoord(event.location_lat);
  const lng = parseCoord(event.location_lng);
  if (lat == null || lng == null || !isValidLatLngPair(lat, lng)) return null;
  return [lat, lng];
}

export function isValidLatLngPair(lat: number, lng: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lng);
}

/** Fly map to a coordinate when the container is ready; falls back to setView on failure. */
export function safeMapFlyTo(
  map: L.Map,
  lat: number,
  lng: number,
  minZoom = 11,
): void {
  if (!isValidLatLngPair(lat, lng)) return;

  const run = () => {
    const container = map.getContainer();
    const { width, height } = container.getBoundingClientRect();
    if (width <= 0 || height <= 0) return;

    const currentZoom = map.getZoom();
    const targetZoom = Number.isFinite(currentZoom) ? Math.max(currentZoom, minZoom) : minZoom;

    try {
      map.flyTo(L.latLng(lat, lng), targetZoom, { duration: 0.75 });
    } catch {
      map.setView([lat, lng], targetZoom, { animate: false });
    }
  };

  if (map.whenReady) {
    map.whenReady(run);
  } else {
    run();
  }
}

export function pointColor(type: string): string {
  switch (type) {
    case "start":
      return "#00E676";
    case "finish":
      return "#FF6B6B";
    case "hydration":
      return "#00E5FF";
    case "aid":
      return "#7C4DFF";
    case "medical":
      return "#FF5252";
    case "restroom":
      return "#B388FF";
    case "spectator":
      return "#FFD54F";
    case "risk":
      return "#FF9100";
    default:
      return "#94A3B8";
  }
}

/** @deprecated Use getEventPinIcon — kept for backwards compat */
export function ensureLeafletIcons() {
  /* no-op: we use DivIcon SVG pins instead of default PNG assets */
}

const pinIconCache = new Map<string, L.DivIcon>();

export interface EventPinOptions {
  selected?: boolean;
  featured?: boolean;
  sportSlug?: string;
  sportName?: string;
}

function buildPinSvg(options: EventPinOptions): string {
  const { selected = false, featured = false, sportSlug, sportName } = options;
  const size = selected ? 38 : 32;
  const { fill, accent, icon } = getSportPinTheme(sportSlug, sportName, featured);
  const ringColor = featured ? "#FFD54F" : accent;
  const iconColor = "#0A0F1F";

  const selectedRing = selected
    ? `<circle cx="16" cy="12" r="14" fill="none" stroke="${ringColor}" stroke-width="1.75" opacity="0.7" class="event-map-pin-pulse"/>`
    : "";

  const featuredBadge = featured
    ? `<circle cx="26" cy="4" r="3.5" fill="#FFD54F" stroke="#0A0F1F" stroke-width="1.25"/>`
    : "";

  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size + 6}" viewBox="0 0 32 38" aria-hidden="true">
      ${selectedRing}
      <circle cx="16" cy="12" r="11.5" fill="${fill}" stroke="${featured ? "#FFD54F" : "#0A0F1F"}" stroke-width="${featured ? 2 : 1.5}"/>
      <g transform="translate(16,12) scale(0.52) translate(-12,-12)" color="${iconColor}">
        ${icon}
      </g>
      <path d="M16 34 L10 24.5 L22 24.5 Z" fill="${fill}" stroke="${featured ? "#FFD54F" : "#0A0F1F"}" stroke-width="1.25" stroke-linejoin="round"/>
      ${featuredBadge}
    </svg>
  `;
}

export function getEventPinIcon(options: EventPinOptions = {}): L.DivIcon {
  const { selected = false, featured = false, sportSlug, sportName } = options;
  const kind = resolveSportKind(sportSlug, sportName);
  const key = `${selected}-${featured}-${kind}`;
  const cached = pinIconCache.get(key);
  if (cached) return cached;

  const w = selected ? 38 : 32;
  const h = selected ? 44 : 38;

  const icon = L.divIcon({
    className: "event-map-pin-wrap",
    html: `<div class="event-map-pin${selected ? " event-map-pin--selected" : ""}${featured ? " event-map-pin--featured" : ""}">${buildPinSvg(options)}</div>`,
    iconSize: [w, h],
    iconAnchor: [w / 2, h - 2],
    popupAnchor: [0, -(h - 6)],
  });

  pinIconCache.set(key, icon);
  return icon;
}

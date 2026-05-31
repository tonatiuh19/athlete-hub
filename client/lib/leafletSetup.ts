import L from "leaflet";
import { getSportPinTheme, resolveSportKind } from "@/utils/sportKind";

export const MEXICO_CENTER: [number, number] = [19.4326, -99.1332];

export function parseCoord(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
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

import { useEffect, useMemo, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  CircleMarker,
  useMap,
} from "react-leaflet";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import "leaflet/dist/leaflet.css";
import type { CoursePoint, EventListItem } from "@shared/api";
import {
  getEventPinIcon,
  MEXICO_CENTER,
  parseEventLatLng,
  isValidLatLngPair,
  pointColor,
  safeMapFlyTo,
} from "@/lib/leafletSetup";
import type { GeoJsonLineString } from "@shared/api";
import { formatEventDate } from "@/utils/eventFormat";
import { routeToLeafletPositions } from "@/utils/courseMapUtils";
import { normalizeEventCourse } from "@shared/courseNormalize";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import {
  CARTO_DARK_TILE_URL,
  CARTO_TILE_ATTRIBUTION,
  MapInvalidateSize,
} from "@/components/maps/LeafletMapHelpers";

interface EventsMapProps {
  events?: EventListItem[];
  selectedSlug?: string | null;
  /** When provided, only this slug triggers flyTo (null = never fly). Omit to use selectedSlug. */
  flyToSlug?: string | null;
  onSelectEvent?: (slug: string) => void;
  courseRoute?: GeoJsonLineString | Record<string, unknown> | null;
  coursePoints?: CoursePoint[];
  className?: string;
  /** Explicit pixel height — Leaflet requires a defined size at mount time */
  height?: number;
  interactive?: boolean;
}

function FitBounds({
  events,
  courseRoute,
  coursePoints,
  selectedSlug,
}: {
  events: EventListItem[];
  courseRoute?: GeoJsonLineString | Record<string, unknown> | null;
  coursePoints?: CoursePoint[];
  selectedSlug?: string | null;
}) {
  const map = useMap();

  useEffect(() => {
    const coords: [number, number][] = [];

    events.forEach((ev) => {
      const pos = parseEventLatLng(ev);
      if (pos) coords.push(pos);
    });

    if (courseRoute) {
      for (const pos of routeToLeafletPositions(courseRoute)) {
        if (isValidLatLngPair(pos[0], pos[1])) coords.push(pos);
      }
    }

    coursePoints?.forEach((p) => {
      if (isValidLatLngPair(p.lat, p.lng)) coords.push([p.lat, p.lng]);
    });

    if (coords.length === 0) {
      map.setView(MEXICO_CENTER, 5);
      return;
    }
    if (coords.length === 1) {
      map.setView(coords[0], 12);
      return;
    }
    if (!selectedSlug) {
      map.fitBounds(coords, { padding: [48, 48], maxZoom: 12 });
    }
  }, [map, events, courseRoute, coursePoints, selectedSlug]);

  return null;
}

function FlyToSelected({
  slug,
  events,
}: {
  slug?: string | null;
  events: EventListItem[];
}) {
  const map = useMap();

  useEffect(() => {
    if (!slug) return;
    const ev = events.find((e) => e.slug === slug);
    if (!ev) return;
    const pos = parseEventLatLng(ev);
    if (!pos) return;
    safeMapFlyTo(map, pos[0], pos[1]);
  }, [slug, events, map]);

  return null;
}

function MapPopupContent({ event }: { event: EventListItem }) {
  const { i18n } = useTranslation();

  return (
    <div className="event-map-popup">
      <p className="font-bold text-white text-sm leading-snug mb-1">{event.title}</p>
      <p className="text-xs text-gray-400 mb-2">{event.location_city}</p>
      <p className="text-[11px] text-gray-500 mb-3">{formatEventDate(event.start_date, i18n.language)}</p>
      <Link
        to={`/events/${event.slug}`}
        className="inline-flex items-center gap-1 text-xs font-semibold text-cyan hover:text-cyan-light transition-colors"
      >
        View event
        <ArrowRight className="w-3 h-3" />
      </Link>
    </div>
  );
}

export default function EventsMap({
  events = [],
  selectedSlug,
  flyToSlug,
  onSelectEvent,
  courseRoute,
  coursePoints,
  className,
  height = 480,
  interactive = true,
}: EventsMapProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const routePositions = useMemo(
    () => routeToLeafletPositions(courseRoute),
    [courseRoute],
  );

  const displayCoursePoints = useMemo(() => {
    if (!courseRoute || !coursePoints?.length) return coursePoints;
    return normalizeEventCourse({
      routeGeojson: courseRoute,
      points: coursePoints,
    }).points;
  }, [courseRoute, coursePoints]);

  const mappableEvents = useMemo(
    () => events.filter((e) => parseEventLatLng(e) != null),
    [events],
  );

  const resolvedFlyToSlug = flyToSlug !== undefined ? flyToSlug : selectedSlug;
  const fitBoundsSelectionSlug = resolvedFlyToSlug ?? null;

  const shellClass = cn(
    "w-full overflow-hidden rounded-xl border border-gray-700/50",
    className,
  );

  if (!mounted) {
    return (
      <div className={shellClass} style={{ height }} aria-hidden>
        <div className="h-full w-full animate-pulse bg-gradient-to-br from-surface-dark to-bg-dark" />
      </div>
    );
  }

  return (
    <div className={shellClass} style={{ height }}>
      <MapContainer
        center={MEXICO_CENTER}
        zoom={5}
        scrollWheelZoom={interactive}
        dragging={interactive}
        touchZoom={interactive}
        doubleClickZoom={interactive}
        boxZoom={interactive}
        keyboard={interactive}
        zoomControl={interactive}
        className="events-leaflet-map z-0"
        style={{ height, width: "100%" }}
      >
        <TileLayer
          attribution={CARTO_TILE_ATTRIBUTION}
          url={CARTO_DARK_TILE_URL}
          subdomains="abcd"
          maxZoom={20}
        />
        <MapInvalidateSize />
        <FitBounds
          events={mappableEvents}
          courseRoute={courseRoute}
          coursePoints={displayCoursePoints}
          selectedSlug={fitBoundsSelectionSlug}
        />
        <FlyToSelected slug={resolvedFlyToSlug} events={mappableEvents} />

        {routePositions.length > 1 && (
          <>
            <Polyline
              positions={routePositions}
              pathOptions={{ color: "#00E5FF", weight: 5, opacity: 0.15 }}
            />
            <Polyline
              positions={routePositions}
              pathOptions={{ color: "#00E5FF", weight: 2.5, opacity: 0.9, dashArray: undefined }}
            />
          </>
        )}

        {displayCoursePoints?.map((p) => (
          <CircleMarker
            key={`${p.type}-${p.name}-${p.km}`}
            center={[p.lat, p.lng]}
            radius={p.type === "start" || p.type === "finish" ? 9 : 7}
            pathOptions={{
              color: pointColor(p.type),
              fillColor: pointColor(p.type),
              fillOpacity: 0.9,
              weight: 2,
            }}
          >
            <Popup className="event-map-popup-wrap">
              <div className="event-map-popup text-sm">
                <strong className="text-white">{p.name}</strong>
                {p.km != null && <div className="text-gray-400 text-xs mt-0.5">Km {p.km}</div>}
                {p.description && <div className="text-xs text-gray-500 mt-1">{p.description}</div>}
              </div>
            </Popup>
          </CircleMarker>
        ))}

        {mappableEvents.map((ev) => {
          const pos = parseEventLatLng(ev);
          if (!pos) return null;
          const [lat, lng] = pos;
          const isSelected = ev.slug === selectedSlug;
          return (
            <Marker
              key={ev.slug}
              position={[lat, lng]}
              icon={getEventPinIcon({
                selected: isSelected,
                featured: Boolean(ev.featured),
                sportSlug: ev.sport_slug,
                sportName: ev.sport_name,
              })}
              zIndexOffset={isSelected ? 1000 : ev.featured ? 500 : 0}
              eventHandlers={{
                click: () => onSelectEvent?.(ev.slug),
              }}
            >
              <Popup className="event-map-popup-wrap" closeButton={false}>
                <MapPopupContent event={ev} />
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}

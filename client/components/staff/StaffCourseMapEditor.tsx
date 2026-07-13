import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  MapContainer,
  Polyline,
  CircleMarker,
  Marker,
  Popup,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import {
  Bath,
  Droplets,
  Flag,
  Hand,
  HeartPulse,
  HelpCircle,
  MapPin,
  Mountain,
  Route,
  Trash2,
  Undo2,
  Upload,
  Users,
  AlertTriangle,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import "leaflet/dist/leaflet.css";
import type { CoursePoint, CoursePointType, StaffEventCoursePayload } from "@shared/api";
import EventsMap from "@/components/events/EventsMap";
import BasemapTileLayer, { MapDiagnostics } from "@/components/maps/BasemapTileLayer";
import {
  MapFitBounds,
  MapInvalidateSize,
} from "@/components/maps/LeafletMapHelpers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MEXICO_CENTER, parseCoord, pointColor } from "@/lib/leafletSetup";
import {
  assignKmToPoints,
  buildLineString,
  getRouteImportSource,
  inferRouteImportSource,
  normalizeCoursePayloadForSave,
  parseLineString,
  polylineLengthKm,
  type LatLng,
} from "@/utils/courseMapUtils";
import { parseGpxFile, isGpxFile, isGpxFileWithinSizeLimit, readGpxFileText } from "@/utils/gpxParse";
import { resolveCareerStartCoords } from "@/utils/resolveCareerStart";
import { cn } from "@/lib/utils";

type EditorMode = "route" | "poi" | "pan" | "start";

const POI_TYPES: CoursePointType[] = [
  "start",
  "finish",
  "hydration",
  "aid",
  "medical",
  "restroom",
  "spectator",
  "risk",
  "km_marker",
  "other",
];

type CourseEditorFocus = "full" | "route" | "checkpoints" | "review";
type RouteSource = "manual" | "gpx";

interface StaffCourseMapEditorProps {
  value: StaffEventCoursePayload | null;
  onChange: (course: StaffEventCoursePayload) => void;
  eventLat?: number | string | null;
  eventLng?: number | string | null;
  onEventLocationChange?: (lat: number, lng: number) => void;
  onRouteSourceChange?: (source: RouteSource) => void;
  /** When false, defer map mount until the parent panel is visible */
  active?: boolean;
  /** Wizard step — shows only the relevant controls */
  focus?: CourseEditorFocus;
  mapHeight?: number;
  mapClassName?: string;
  className?: string;
}

const MAP_HEIGHT = 520;

function MapCenter({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom, { animate: false });
  }, [map, center, zoom]);
  return null;
}

function MapClickHandler({
  mode,
  onClick,
}: {
  mode: EditorMode;
  onClick: (lat: number, lng: number) => void;
}) {
  useMapEvents({
    click(e) {
      if (mode === "pan") return;
      onClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function poiIcon(type: CoursePointType) {
  switch (type) {
    case "start":
    case "finish":
      return Flag;
    case "hydration":
      return Droplets;
    case "aid":
      return Mountain;
    case "medical":
      return HeartPulse;
    case "restroom":
      return Bath;
    case "spectator":
      return Users;
    case "risk":
      return AlertTriangle;
    default:
      return MapPin;
  }
}

function defaultPoiName(type: CoursePointType, t: (k: string) => string): string {
  return t(`staffPortal.courseEditor.poiTypes.${type}`);
}

export default function StaffCourseMapEditor({
  value,
  onChange,
  eventLat,
  eventLng,
  onEventLocationChange,
  onRouteSourceChange,
  active = true,
  focus = "full",
  mapHeight,
  mapClassName,
  className,
}: StaffCourseMapEditorProps) {
  const { t } = useTranslation();
  const [mounted, setMounted] = useState(false);
  const [mode, setMode] = useState<EditorMode>(focus === "checkpoints" ? "poi" : "route");
  const [poiType, setPoiType] = useState<CoursePointType>("hydration");
  const [route, setRoute] = useState<LatLng[]>([]);
  const [points, setPoints] = useState<CoursePoint[]>([]);
  const [elevationM, setElevationM] = useState("");
  const [elevationProfile, setElevationProfile] = useState<
    StaffEventCoursePayload["elevationProfile"]
  >(null);
  const [selectedPoiIndex, setSelectedPoiIndex] = useState<number | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [startLatInput, setStartLatInput] = useState("");
  const [startLngInput, setStartLngInput] = useState("");
  const [routeSource, setRouteSource] = useState<RouteSource>("manual");
  const [showManualStartEditor, setShowManualStartEditor] = useState(false);
  const [gpxFeedback, setGpxFeedback] = useState<{ type: "error" | "success"; key: string } | null>(
    null,
  );
  const [gpxImporting, setGpxImporting] = useState(false);
  const [routeFitKey, setRouteFitKey] = useState(0);
  const gpxInputRef = useRef<HTMLInputElement>(null);

  const mapCenter = useMemo((): [number, number] => {
    const resolved = resolveCareerStartCoords({
      points,
      startLatInput,
      startLngInput,
      eventLat,
      eventLng,
      route,
      preferRouteStart: routeSource === "gpx" || route.length >= 2,
      routeImportSource: routeSource,
    });
    if (resolved) return [resolved.lat, resolved.lng];
    if (route.length > 0) return [route[0].lat, route[0].lng];
    return MEXICO_CENTER;
  }, [points, startLatInput, startLngInput, eventLat, eventLng, route, routeSource]);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (focus === "route") setMode("route");
    if (focus === "checkpoints") setMode("poi");
  }, [focus]);

  useEffect(() => {
    if (routeSource === "gpx") return;
    const lat = parseCoord(eventLat);
    const lng = parseCoord(eventLng);
    setStartLatInput(lat != null ? String(lat) : "");
    setStartLngInput(lng != null ? String(lng) : "");
  }, [eventLat, eventLng, routeSource]);

  useEffect(() => {
    if (!value) {
      setRoute([]);
      setPoints([]);
      setElevationM("");
      setRouteSource("manual");
      setShowManualStartEditor(false);
      setGpxFeedback(null);
      return;
    }
    const parsedRoute = parseLineString(value.routeGeojson);
    const restoredSource =
      getRouteImportSource(value.routeGeojson) ??
      inferRouteImportSource(parsedRoute, value.points ?? [], value.routeGeojson);

    let loadedPoints = value.points ?? [];
    let loadedRoute = parsedRoute;
    if (restoredSource === "gpx" && parsedRoute.length >= 2) {
      const normalized = normalizeCoursePayloadForSave({
        routeGeojson: value.routeGeojson,
        points: loadedPoints,
        distanceKm: value.distanceKm,
        elevationGainM: value.elevationGainM,
        elevationProfile: value.elevationProfile,
      });
      loadedPoints = normalized.points ?? loadedPoints;
      loadedRoute = parseLineString(normalized.routeGeojson);
    }

    setRoute(loadedRoute);
    setPoints(loadedPoints);
    setElevationM(value.elevationGainM != null ? String(value.elevationGainM) : "");
    setElevationProfile(value.elevationProfile ?? null);
    setRouteSource(restoredSource);
    onRouteSourceChange?.(restoredSource);

    const resolvedStart = resolveCareerStartCoords({
      points: loadedPoints,
      eventLat,
      eventLng,
      route: loadedRoute,
      routeImportSource: restoredSource,
      preferRouteStart: restoredSource === "gpx",
    });
    if (resolvedStart) {
      setStartLatInput(String(resolvedStart.lat));
      setStartLngInput(String(resolvedStart.lng));
    }
  }, [value, onRouteSourceChange, eventLat, eventLng]);

  const distanceKm = useMemo(() => polylineLengthKm(route), [route]);

  const emitChange = useCallback(
    (
      nextRoute: LatLng[],
      nextPoints: CoursePoint[],
      elev?: string,
      profile?: StaffEventCoursePayload["elevationProfile"],
      importSource?: RouteSource,
    ) => {
      const withKm = assignKmToPoints(nextRoute, nextPoints);
      const gain = (elev ?? elevationM) ? Number(elev ?? elevationM) : null;
      const source = importSource ?? routeSource;
      let payload: StaffEventCoursePayload = {
        routeGeojson: buildLineString(nextRoute, source),
        points: withKm,
        distanceKm: polylineLengthKm(nextRoute) || null,
        elevationGainM: gain,
        elevationProfile: profile !== undefined ? profile : elevationProfile,
      };
      if (source === "gpx" && nextRoute.length >= 2) {
        payload = normalizeCoursePayloadForSave(payload);
      }
      onChange(payload);
    },
    [onChange, elevationM, elevationProfile, routeSource],
  );

  const syncStartToEventLocation = useCallback(
    (lat: number, lng: number) => {
      onEventLocationChange?.(lat, lng);
    },
    [onEventLocationChange],
  );

  const setCareerStart = useCallback(
    (lat: number, lng: number) => {
      if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return;

      setStartLatInput(String(lat));
      setStartLngInput(String(lng));
      syncStartToEventLocation(lat, lng);

      const startIdx = points.findIndex((p) => p.type === "start");
      let nextPoints: CoursePoint[];
      if (startIdx >= 0) {
        nextPoints = points.map((p, i) =>
          i === startIdx ? { ...p, lat, lng } : p,
        );
      } else {
        nextPoints = [
          {
            type: "start",
            name: defaultPoiName("start", t),
            lat,
            lng,
            description: "",
          },
          ...points,
        ];
      }

      // Start flag is separate from the traced route — moving it never adds extra vertices.
      const nextRoute =
        route.length === 0
          ? []
          : route.map((pt, idx) => (idx === 0 ? { lat, lng } : pt));

      setPoints(nextPoints);
      setRoute(nextRoute);
      emitChange(nextRoute, nextPoints);
    },
    [emitChange, points, route, syncStartToEventLocation, t],
  );

  const applyEventLocationAsStart = useCallback(() => {
    const lat = parseCoord(eventLat);
    const lng = parseCoord(eventLng);
    if (lat == null || lng == null) return;
    setCareerStart(lat, lng);
  }, [eventLat, eventLng, setCareerStart]);

  const commitStartFromInputs = useCallback(() => {
    const lat = Number(startLatInput);
    const lng = Number(startLngInput);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    setCareerStart(lat, lng);
  }, [setCareerStart, startLatInput, startLngInput]);

  const handleMapClick = (lat: number, lng: number) => {
    if (mode === "start") {
      setCareerStart(lat, lng);
      setMode("route");
      return;
    }
    if (mode === "route") {
      const resolvedStart = resolveCareerStartCoords({
        points,
        startLatInput,
        startLngInput,
        eventLat,
        eventLng,
        route,
        preferRouteStart: routeSource === "gpx",
        routeImportSource: routeSource,
      });
      const startLat = resolvedStart?.lat;
      const startLng = resolvedStart?.lng;
      const hasStart = startLat != null && startLng != null;

      let next: LatLng[];
      if (route.length === 0 && hasStart) {
        // First trace click: line from start flag → clicked point
        next = [{ lat: startLat, lng: startLng }, { lat, lng }];
      } else if (route.length === 0) {
        setCareerStart(lat, lng);
        setMode("route");
        return;
      } else {
        next = [...route, { lat, lng }];
      }
      setRoute(next);
      emitChange(next, points);
      return;
    }
    if (mode === "poi") {
      const name = defaultPoiName(poiType, t);
      const next = [
        ...points,
        { type: poiType, name, lat, lng, description: "" },
      ];
      setPoints(next);
      emitChange(route, next);
      setSelectedPoiIndex(next.length - 1);
      if (poiType === "start") {
        setCareerStart(lat, lng);
      }
    }
  };

  const undoRoute = () => {
    if (route.length === 0) return;
    const next = route.slice(0, -1);
    setRoute(next);
    emitChange(next, points);
  };

  const clearRoute = () => {
    setRoute([]);
    setRouteSource("manual");
    setShowManualStartEditor(false);
    onRouteSourceChange?.("manual");
    emitChange([], points, undefined, undefined, "manual");
  };

  const applyGpxRoute = useCallback(
    (parsed: ReturnType<typeof parseGpxFile>) => {
      if (parsed.route.length < 2) return false;

      const gpxRoute = parsed.route;
      const first = gpxRoute[0];
      const last = gpxRoute[gpxRoute.length - 1];

      let nextPoints = [...points];
      const startIdx = nextPoints.findIndex((p) => p.type === "start");
      const startPoint: CoursePoint = {
        type: "start",
        name: defaultPoiName("start", t),
        lat: first.lat,
        lng: first.lng,
      };
      if (startIdx >= 0) {
        nextPoints[startIdx] = { ...nextPoints[startIdx], ...startPoint };
      } else {
        nextPoints = [startPoint, ...nextPoints];
      }

      const finishIdx = nextPoints.findIndex((p) => p.type === "finish");
      const finishPoint: CoursePoint = {
        type: "finish",
        name: defaultPoiName("finish", t),
        lat: last.lat,
        lng: last.lng,
      };
      if (finishIdx >= 0) {
        nextPoints[finishIdx] = { ...nextPoints[finishIdx], ...finishPoint };
      } else {
        nextPoints.push(finishPoint);
      }

      setRoute(gpxRoute);
      setPoints(nextPoints);
      setRouteSource("gpx");
      setShowManualStartEditor(false);
      onRouteSourceChange?.("gpx");
      setStartLatInput(String(first.lat));
      setStartLngInput(String(first.lng));

      const gainStr =
        parsed.elevationGainM > 0 ? String(Math.round(parsed.elevationGainM)) : elevationM;
      if (parsed.elevationGainM > 0) setElevationM(gainStr);
      const profile =
        parsed.elevationProfile.length > 1 ? parsed.elevationProfile : elevationProfile;
      if (parsed.elevationProfile.length > 1) setElevationProfile(profile);
      emitChange(gpxRoute, nextPoints, gainStr, profile, "gpx");
      setRouteFitKey((k) => k + 1);
      setMode("route");
      return true;
    },
    [
      elevationM,
      elevationProfile,
      emitChange,
      onRouteSourceChange,
      points,
      t,
    ],
  );

  const gpxPreferStartNear = useMemo((): LatLng | null => {
    const lat = parseCoord(eventLat);
    const lng = parseCoord(eventLng);
    if (lat != null && lng != null) return { lat, lng };
    if (route.length > 0) return route[0];
    return null;
  }, [eventLat, eventLng, route]);

  const handleGpxImport = async (file: File) => {
    setGpxFeedback(null);
    if (!isGpxFile(file)) {
      setGpxFeedback({ type: "error", key: "staffPortal.courseEditor.gpxInvalidType" });
      return;
    }
    if (!isGpxFileWithinSizeLimit(file)) {
      setGpxFeedback({ type: "error", key: "staffPortal.courseEditor.gpxTooLarge" });
      return;
    }

    setGpxImporting(true);
    try {
      const text = await readGpxFileText(file);
      const hadRoute = route.length >= 2;
      const parsed = parseGpxFile(text, {
        preferStartNear: gpxPreferStartNear,
      });
      if (!applyGpxRoute(parsed)) {
        setGpxFeedback({
          type: "error",
          key: hadRoute
            ? "staffPortal.courseEditor.gpxParseFailedKeepPrevious"
            : "staffPortal.courseEditor.gpxParseFailed",
        });
        return;
      }
      const feedbackKey = parsed.simplified
        ? "staffPortal.courseEditor.gpxImportSimplified"
        : "staffPortal.courseEditor.gpxImportSuccess";
      setGpxFeedback({ type: "success", key: feedbackKey });
    } catch {
      setGpxFeedback({ type: "error", key: "staffPortal.courseEditor.gpxReadFailed" });
    } finally {
      setGpxImporting(false);
    }
  };

  const handleGpxDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files?.[0];
    if (file) void handleGpxImport(file);
  };

  const openGpxPicker = () => {
    gpxInputRef.current?.click();
  };

  const removePoi = (index: number) => {
    const next = points.filter((_, i) => i !== index);
    setPoints(next);
    emitChange(route, next);
    setSelectedPoiIndex(null);
  };

  const updatePoi = (index: number, patch: Partial<CoursePoint>) => {
    const next = points.map((p, i) => (i === index ? { ...p, ...patch } : p));
    setPoints(next);
    emitChange(route, next);
    const updated = next[index];
    if (updated?.type === "start" && updated.lat != null && updated.lng != null) {
      setCareerStart(updated.lat, updated.lng);
    }
  };

  const careerStart = useMemo(
    () =>
      resolveCareerStartCoords({
        points,
        startLatInput,
        startLngInput,
        eventLat,
        eventLng,
        route,
        preferRouteStart: routeSource === "gpx" || route.length >= 2,
        routeImportSource: routeSource,
      }),
    [points, startLatInput, startLngInput, eventLat, eventLng, route, routeSource],
  );
  const careerStartLat = careerStart?.lat;
  const careerStartLng = careerStart?.lng;
  const hasCareerStart = careerStart != null;
  const showCareerStartFlag = useMemo(() => {
    if (!careerStart) return false;
    const startPoi = points.find((p) => p.type === "start");
    if (!startPoi) return true;
    const same =
      Math.abs(startPoi.lat - careerStart.lat) < 0.00005 &&
      Math.abs(startPoi.lng - careerStart.lng) < 0.00005;
    return !same;
  }, [careerStart, points]);
  const routePointCount = route.length;
  const routeLineReady = routePointCount >= 2;
  const routePositions = route.map((p) => [p.lat, p.lng] as [number, number]);

  const routeStepHint = useMemo(() => {
    if (routeSource === "gpx" && routeLineReady) {
      return t("staffPortal.courseEditor.flowGpxReady", { count: routePointCount });
    }
    if (!hasCareerStart) {
      return t("staffPortal.courseEditor.flowNeedStart");
    }
    if (!routeLineReady) {
      return t("staffPortal.courseEditor.flowNeedRoute", { count: routePointCount });
    }
    return t("staffPortal.courseEditor.flowRouteReady", { count: routePointCount });
  }, [hasCareerStart, routeLineReady, routePointCount, routeSource, t]);

  const previewCourse = useMemo(
    () => ({
      routeGeojson: buildLineString(route, routeSource),
      points: assignKmToPoints(route, points),
      distanceKm,
      elevationGainM: elevationM ? Number(elevationM) : undefined,
      elevationProfile: elevationProfile ?? undefined,
    }),
    [route, points, distanceKm, elevationM, elevationProfile, routeSource],
  );

  const resolvedMapHeight = mapHeight ?? MAP_HEIGHT;
  const showMap = focus !== "review";
  const showRouteTools = focus === "full" || focus === "route";
  const showPoiTools = focus === "full" || focus === "checkpoints";
  const showGuide = focus === "full";
  const mapOnlyTools = focus === "route" || focus === "checkpoints";

  if (focus === "review") {
    return (
      <div className={cn("space-y-4", className)}>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="card-sport p-4 text-center">
            <p className="text-[10px] uppercase text-muted-foreground">{t("staffPortal.courseEditor.careerStart")}</p>
            <p className="text-sm font-mono font-semibold text-primary mt-1">
              {hasCareerStart
                ? `${careerStartLat!.toFixed(5)}, ${careerStartLng!.toFixed(5)}`
                : "—"}
            </p>
          </div>
          <div className="card-sport p-4 text-center">
            <p className="text-[10px] uppercase text-muted-foreground">{t("staffPortal.courseEditor.distance")}</p>
            <p className="text-2xl font-bold text-primary mt-1">{distanceKm || "—"} km</p>
          </div>
          <div className="card-sport p-4 text-center">
            <p className="text-[10px] uppercase text-muted-foreground">{t("staffPortal.courseEditor.elevation")}</p>
            <p className="text-2xl font-bold text-primary mt-1">{elevationM ? `${elevationM} m` : "—"}</p>
          </div>
          <div className="card-sport p-4 text-center">
            <p className="text-[10px] uppercase text-muted-foreground">{t("staffPortal.courseEditor.poiList")}</p>
            <p className="text-2xl font-bold text-primary mt-1">{points.length}</p>
          </div>
        </div>
        <div className="space-y-2">
          <p className="text-sm font-semibold text-muted-foreground">{t("staffPortal.courseEditor.previewLabel")}</p>
          <EventsMap
            courseRoute={previewCourse.routeGeojson}
            coursePoints={previewCourse.points}
            interactive
            height={Math.min(resolvedMapHeight, 420)}
            className="rounded-xl"
          />
        </div>
      </div>
    );
  }

  const mapBlock = (
    <div
      className={cn(
        "relative rounded-xl overflow-hidden border border-border",
        mapOnlyTools ? "flex-1 min-w-0" : "w-full",
        mapClassName,
      )}
      style={mapClassName ? undefined : { height: resolvedMapHeight }}
    >
        {!active || !mounted ? (
          <div className="h-full animate-pulse bg-card flex items-center justify-center">
            <p className="text-xs text-muted-foreground px-4 text-center">
              {t("staffPortal.courseEditor.mapLoading")}
            </p>
          </div>
        ) : (
          <MapContainer
            key={`staff-course-map-${focus}`}
            center={mapCenter}
            zoom={13}
            scrollWheelZoom
            dragging
            zoomControl
            className="events-leaflet-map events-leaflet-map--editor z-[1]"
            style={{ height: "100%", width: "100%" }}
          >
            <BasemapTileLayer traceLabel={`course-${focus}`} />
            <MapDiagnostics traceLabel={`course-${focus}`} active={active} />
            <MapInvalidateSize active={active} />
            <MapCenter center={mapCenter} zoom={route.length > 0 ? 14 : 13} />
            {route.length > 0 ? (
              <MapFitBounds points={route} active={active} fitKey={routeFitKey} />
            ) : null}
            <MapClickHandler mode={mode} onClick={handleMapClick} />

            {routePositions.length > 1 && (
              <>
                <Polyline
                  positions={routePositions}
                  pathOptions={{ color: "#0891b2", weight: 8, opacity: 0.2 }}
                />
                <Polyline
                  positions={routePositions}
                  pathOptions={{ color: "#0891b2", weight: 4, opacity: 0.95 }}
                />
              </>
            )}

            {route.map((p, i) => {
              const atStart =
                hasCareerStart &&
                i === 0 &&
                Math.abs(p.lat - careerStartLat!) < 0.00005 &&
                Math.abs(p.lng - careerStartLng!) < 0.00005;
              if (atStart) return null;
              return (
                <CircleMarker
                  key={`v-${i}`}
                  center={[p.lat, p.lng]}
                  radius={6}
                  pathOptions={{ color: "#fff", fillColor: "#0891b2", fillOpacity: 1, weight: 2 }}
                  eventHandlers={{
                    dragend: (e) => {
                      const ll = (e.target as L.CircleMarker).getLatLng();
                      const next = route.map((pt, idx) =>
                        idx === i ? { lat: ll.lat, lng: ll.lng } : pt,
                      );
                      setRoute(next);
                      emitChange(next, points);
                    },
                  }}
                />
              );
            })}

            {points.map((p, i) => (
              <CircleMarker
                key={`p-${i}-${p.name}`}
                center={[p.lat, p.lng]}
                radius={p.type === "start" || p.type === "finish" ? 10 : 8}
                pathOptions={{
                  color: "#fff",
                  fillColor: pointColor(p.type),
                  fillOpacity: 0.95,
                  weight: 2,
                }}
              >
                <Popup>
                  <strong>{p.name}</strong>
                  {p.km != null ? <div>Km {p.km}</div> : null}
                </Popup>
              </CircleMarker>
            ))}

            {showCareerStartFlag ? (
              <Marker
                position={[careerStartLat!, careerStartLng!]}
                draggable={mode !== "pan"}
                icon={L.divIcon({
                  className: "",
                  html: `<div style="display:flex;flex-direction:column;align-items:center;gap:2px"><div style="width:28px;height:28px;border-radius:50%;background:#10b981;border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;font-size:14px">🏁</div></div>`,
                  iconSize: [28, 28],
                  iconAnchor: [14, 14],
                })}
                eventHandlers={{
                  dragend: (e) => {
                    const ll = (e.target as L.Marker).getLatLng();
                    setCareerStart(ll.lat, ll.lng);
                  },
                }}
              >
                <Popup>
                  <strong>{t("staffPortal.courseEditor.careerStart")}</strong>
                  <div className="text-xs font-mono">
                    {careerStartLat!.toFixed(5)}, {careerStartLng!.toFixed(5)}
                  </div>
                </Popup>
              </Marker>
            ) : null}
          </MapContainer>
        )}

        <div className="absolute top-3 left-3 right-3 z-[1000] flex flex-col gap-1.5 pointer-events-none">
          <div className="px-3 py-1.5 rounded-full bg-background/90 border border-border text-[10px] text-muted-foreground backdrop-blur-sm w-fit max-w-full">
            {mode === "start"
              ? t("staffPortal.courseEditor.hintStart")
              : mode === "route"
                ? hasCareerStart && !routeLineReady
                  ? t("staffPortal.courseEditor.hintRouteAfterStart")
                  : t("staffPortal.courseEditor.hintRoute")
                : mode === "poi"
                  ? t("staffPortal.courseEditor.hintPoi")
                  : t("staffPortal.courseEditor.hintPan")}
          </div>
          {focus === "route" ? (
            <div
              className={cn(
                "px-3 py-2 rounded-lg border text-[10px] backdrop-blur-sm w-fit max-w-full",
                routeLineReady
                  ? "bg-cyan/10 border-cyan/30 text-primary"
                  : "bg-background/90 border-border text-muted-foreground",
              )}
            >
              {routeStepHint}
            </div>
          ) : null}
        </div>
      </div>
  );

  const modeButtons = (
    focus === "route"
      ? [{ key: "route" as const, icon: Route, label: t("staffPortal.courseEditor.modeRoute") }]
      : focus === "checkpoints"
        ? [
            { key: "poi" as const, icon: MapPin, label: t("staffPortal.courseEditor.modePoi") },
            { key: "pan" as const, icon: Hand, label: t("staffPortal.courseEditor.modePan") },
          ]
        : [
            { key: "route" as const, icon: Route, label: t("staffPortal.courseEditor.modeRoute") },
            { key: "poi" as const, icon: MapPin, label: t("staffPortal.courseEditor.modePoi") },
            { key: "pan" as const, icon: Hand, label: t("staffPortal.courseEditor.modePan") },
          ]
  );

  const toolsPanel = (
    <>
      {showGuide ? (
        <div className="card-sport p-4 space-y-3 border-cyan/15 bg-cyan/[0.03]">
          <div className="flex items-start gap-2">
            <HelpCircle className="w-4 h-4 text-primary shrink-0 mt-0.5" />
            <div className="space-y-2">
              <p className="text-sm font-semibold">{t("staffPortal.courseEditor.guideTitle")}</p>
              <ol className="text-xs text-muted-foreground space-y-1.5 list-decimal list-inside">
                <li>{t("staffPortal.courseEditor.guideStep1")}</li>
                <li>{t("staffPortal.courseEditor.guideStep2")}</li>
                <li>{t("staffPortal.courseEditor.guideStep3")}</li>
                <li>{t("staffPortal.courseEditor.guideStep4")}</li>
                <li>{t("staffPortal.courseEditor.guideStep5")}</li>
              </ol>
              <p className="text-[10px] text-muted-foreground/80 pt-1 border-t border-border/60">
                {t("staffPortal.courseEditor.guideTip")}
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {showRouteTools ? (
        <div className="card-sport p-3 space-y-2 border-border/60 bg-card/30">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {t("staffPortal.courseEditor.flowTitle")}
          </p>
          <ol className="space-y-1.5 text-xs">
            {routeSource === "gpx" ? (
              <>
                <li className="flex items-start gap-2 text-emerald-400">
                  <span className="shrink-0 w-4 text-center">✓</span>
                  <span>{t("staffPortal.courseEditor.flowStepGpxStart")}</span>
                </li>
                <li className={cn("flex items-start gap-2", routeLineReady && "text-primary")}>
                  <span className="shrink-0 w-4 text-center">{routeLineReady ? "✓" : "2"}</span>
                  <span>{t("staffPortal.courseEditor.flowStepGpxRoute")}</span>
                </li>
              </>
            ) : (
              <>
                <li className={cn("flex items-start gap-2", hasCareerStart && "text-emerald-400")}>
                  <span className="shrink-0 w-4 text-center">{hasCareerStart ? "✓" : "1"}</span>
                  <span>{t("staffPortal.courseEditor.flowStepStart")}</span>
                </li>
                <li className={cn("flex items-start gap-2", routeLineReady && "text-primary")}>
                  <span className="shrink-0 w-4 text-center">{routeLineReady ? "✓" : "2"}</span>
                  <span>{t("staffPortal.courseEditor.flowStepDraw")}</span>
                </li>
              </>
            )}
          </ol>
          <p className="text-[10px] text-muted-foreground leading-relaxed border-t border-border/60 pt-2">
            {routeSource === "gpx"
              ? t("staffPortal.courseEditor.flowGpxHint")
              : t("staffPortal.courseEditor.flowManualHint")}
          </p>
        </div>
      ) : null}

      {showRouteTools ? (
        <div
          className="card-sport p-4 space-y-3 border-cyan/15 bg-cyan/[0.03]"
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onDrop={handleGpxDrop}
        >
          <div className="flex items-center gap-2">
            <Upload className="h-4 w-4 shrink-0 text-primary" />
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("staffPortal.courseEditor.gpxImportTitle")}
            </p>
          </div>
          <p className="text-[10px] leading-relaxed text-muted-foreground">
            {t("staffPortal.courseEditor.gpxImportHint")}
          </p>
          <input
            ref={gpxInputRef}
            type="file"
            accept=".gpx,application/gpx+xml,application/xml,text/xml,application/octet-stream"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleGpxImport(file);
              e.target.value = "";
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full touch-manipulation"
            disabled={gpxImporting}
            onClick={openGpxPicker}
          >
            <Upload className="mr-1.5 h-3.5 w-3.5" />
            {gpxImporting
              ? t("staffPortal.courseEditor.gpxImporting")
              : t("staffPortal.courseEditor.importGpx")}
          </Button>
          {gpxFeedback ? (
            <p
              className={cn(
                "text-[10px] leading-relaxed",
                gpxFeedback.type === "error" ? "text-destructive" : "text-emerald-400",
              )}
            >
              {t(gpxFeedback.key)}
            </p>
          ) : null}
        </div>
      ) : null}

      {showRouteTools && routeSource === "gpx" && hasCareerStart && !showManualStartEditor ? (
        <div className="card-sport space-y-3 border-emerald-500/25 bg-emerald-500/[0.04] p-4">
          <div className="flex items-center gap-2">
            <Flag className="h-4 w-4 shrink-0 text-emerald-400" />
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("staffPortal.courseEditor.careerStart")}
            </p>
          </div>
          <p className="text-[10px] leading-relaxed text-muted-foreground">
            {t("staffPortal.courseEditor.gpxStartApplied")}
          </p>
          <p className="text-center font-mono text-[10px] text-emerald-400">
            {careerStartLat!.toFixed(5)}, {careerStartLng!.toFixed(5)}
          </p>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="w-full text-xs"
            onClick={() => setShowManualStartEditor(true)}
          >
            {t("staffPortal.courseEditor.adjustStartManually")}
          </Button>
        </div>
      ) : null}

      {showRouteTools && (routeSource !== "gpx" || showManualStartEditor) ? (
        <div className="card-sport p-4 space-y-3 border-emerald-500/20 bg-emerald-500/[0.03]">
          <div className="flex items-center gap-2">
            <Flag className="w-4 h-4 text-emerald-400 shrink-0" />
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("staffPortal.courseEditor.careerStart")}
            </p>
          </div>
          <p className="text-[10px] text-muted-foreground leading-relaxed">
            {t("staffPortal.courseEditor.careerStartHint")}
          </p>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label htmlFor="career-start-lat" className="text-[10px] uppercase text-muted-foreground">
                {t("staffPortal.eventEdit.fieldLat")}
              </Label>
              <Input
                id="career-start-lat"
                type="number"
                step="any"
                className="h-8 text-xs font-mono"
                value={startLatInput}
                onChange={(e) => setStartLatInput(e.target.value)}
                onBlur={commitStartFromInputs}
                placeholder="19.4326"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="career-start-lng" className="text-[10px] uppercase text-muted-foreground">
                {t("staffPortal.eventEdit.fieldLng")}
              </Label>
              <Input
                id="career-start-lng"
                type="number"
                step="any"
                className="h-8 text-xs font-mono"
                value={startLngInput}
                onChange={(e) => setStartLngInput(e.target.value)}
                onBlur={commitStartFromInputs}
                placeholder="-99.1332"
              />
            </div>
          </div>
          <Button
            type="button"
            size="sm"
            variant={mode === "start" ? "default" : "outline"}
            className={cn("w-full text-xs", mode === "start" && "bg-emerald-600 hover:bg-emerald-600/90")}
            onClick={() => setMode(mode === "start" ? "route" : "start")}
          >
            <MapPin className="w-3.5 h-3.5 mr-1.5" />
            {mode === "start"
              ? t("staffPortal.courseEditor.careerStartPlacing")
              : t("staffPortal.courseEditor.careerStartPlaceOnMap")}
          </Button>
          {hasCareerStart ? (
            <p className="text-[10px] text-muted-foreground font-mono text-center">
              {careerStartLat!.toFixed(5)}, {careerStartLng!.toFixed(5)}
            </p>
          ) : (
            <p className="text-[10px] text-muted-foreground text-center">
              {t("staffPortal.courseEditor.careerStartUnset")}
            </p>
          )}
          {routeSource === "gpx" && showManualStartEditor ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="w-full text-xs"
              onClick={() => setShowManualStartEditor(false)}
            >
              {t("staffPortal.courseEditor.backToGpxStart")}
            </Button>
          ) : null}
        </div>
      ) : null}

      {(showRouteTools || showPoiTools) && (
        <div className="card-sport p-4 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("staffPortal.courseEditor.tools")}
          </p>
          <div className={cn("grid gap-2", modeButtons.length === 1 ? "grid-cols-1" : "grid-cols-3")}>
            {modeButtons.map(({ key, icon: Icon, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => setMode(key)}
                className={cn(
                  "flex flex-col items-center gap-1 p-2 rounded-lg border text-[10px] font-medium transition-colors",
                  mode === key
                    ? "border-cyan/50 bg-cyan/10 text-primary"
                    : "border-border text-muted-foreground hover:border-primary/40",
                )}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </div>

          {showPoiTools && mode === "poi" ? (
            <div className="space-y-2">
              <Label className="text-xs">{t("staffPortal.courseEditor.poiType")}</Label>
              <Select value={poiType} onValueChange={(v) => setPoiType(v as CoursePointType)}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {POI_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {t(`staffPortal.courseEditor.poiTypes.${type}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground">{t("staffPortal.courseEditor.poiHint")}</p>
              {parseCoord(eventLat) != null && parseCoord(eventLng) != null ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="w-full text-xs"
                  onClick={applyEventLocationAsStart}
                >
                  <MapPin className="w-3.5 h-3.5 mr-1.5" />
                  {t("staffPortal.courseEditor.useEventLocationAsStart")}
                </Button>
              ) : null}
            </div>
          ) : null}

          {showRouteTools && mode === "route" ? (
            <div className="space-y-2">
              <p
                className={cn(
                  "text-[10px] rounded-md px-2 py-1.5 border",
                  routeLineReady
                    ? "border-cyan/30 bg-cyan/5 text-primary"
                    : "border-border bg-muted/30 text-muted-foreground",
                )}
              >
                {routeLineReady
                  ? t("staffPortal.courseEditor.routeDrawn", { count: routePointCount })
                  : hasCareerStart
                    ? t("staffPortal.courseEditor.routeClickToTrace")
                    : t("staffPortal.courseEditor.routeSetStartFirst")}
              </p>
              <div className="flex gap-2">
                <Button type="button" size="sm" variant="outline" className="flex-1" onClick={undoRoute}>
                  <Undo2 className="w-3 h-3 mr-1" />
                  {t("staffPortal.courseEditor.undo")}
                </Button>
                <Button type="button" size="sm" variant="ghost" className="text-destructive" onClick={clearRoute}>
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {showPoiTools && (focus === "full" || focus === "checkpoints") ? (
        <>
          <div className="card-sport p-4 grid grid-cols-2 gap-3">
            <div>
              <p className="text-[10px] uppercase text-muted-foreground">{t("staffPortal.courseEditor.distance")}</p>
              <p className="text-lg font-bold text-primary">{distanceKm || "—"} km</p>
            </div>
            <div>
              <Label className="text-[10px] uppercase text-muted-foreground">
                {t("staffPortal.courseEditor.elevation")}
              </Label>
              <Input
                type="number"
                className="h-8 mt-1"
                value={elevationM}
                onChange={(e) => {
                  setElevationM(e.target.value);
                  emitChange(route, points, e.target.value);
                }}
                placeholder="m"
              />
            </div>
          </div>

          <div className="card-sport p-4 space-y-2 max-h-64 overflow-y-auto">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("staffPortal.courseEditor.poiList")} ({points.length})
            </p>
            {points.length === 0 ? (
              <p className="text-xs text-muted-foreground">{t("staffPortal.courseEditor.noPois")}</p>
            ) : (
              points.map((p, i) => {
                const Icon = poiIcon(p.type);
                return (
                  <div
                    key={`${p.type}-${i}-${p.lat}`}
                    className={cn(
                      "flex items-start gap-2 p-2 rounded-lg border cursor-pointer transition-colors",
                      selectedPoiIndex === i
                        ? "border-cyan/40 bg-cyan/5"
                        : "border-border/60 hover:border-primary/40",
                    )}
                    onClick={() => setSelectedPoiIndex(i)}
                  >
                    <Icon className="w-4 h-4 shrink-0 mt-0.5" style={{ color: pointColor(p.type) }} />
                    <div className="flex-1 min-w-0">
                      <Input
                        className="h-7 text-xs mb-1"
                        value={p.name}
                        onChange={(e) => updatePoi(i, { name: e.target.value })}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <p className="text-[10px] text-muted-foreground truncate">
                        {p.km != null ? `${p.km} km · ` : ""}
                        {p.lat.toFixed(4)}, {p.lng.toFixed(4)}
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-destructive shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        removePoi(i);
                      }}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                );
              })
            )}
          </div>
        </>
      ) : null}

      {focus === "route" ? (
        <div className="card-sport p-4 space-y-3">
          <div>
            <p className="text-[10px] uppercase text-muted-foreground">{t("staffPortal.courseEditor.distance")}</p>
            <p className="text-2xl font-bold text-primary">
              {routeLineReady ? `${distanceKm} km` : "—"}
            </p>
            {!routeLineReady && hasCareerStart ? (
              <p className="text-[10px] text-muted-foreground mt-1">
                {t("staffPortal.courseEditor.distanceAfterRoute")}
              </p>
            ) : null}
          </div>
          {hasCareerStart ? (
            <div className="pt-2 border-t border-border/60">
              <p className="text-[10px] uppercase text-muted-foreground">{t("staffPortal.courseEditor.careerStart")}</p>
              <p className="text-xs font-mono text-emerald-400 mt-0.5">
                {careerStartLat!.toFixed(5)}, {careerStartLng!.toFixed(5)}
              </p>
            </div>
          ) : null}
        </div>
      ) : null}
    </>
  );

  return (
    <div className={cn("space-y-4", className)}>
      {mapOnlyTools ? (
        <div className="flex flex-col xl:flex-row gap-4 min-h-0">
          {mapBlock}
          <div className="xl:w-72 shrink-0 space-y-4">{toolsPanel}</div>
        </div>
      ) : (
        <>
          {mapBlock}
          <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-4">
            <div className="space-y-4">{toolsPanel}</div>
            {focus === "full" ? (
              <div className="space-y-4">
                <Button type="button" variant="outline" className="w-full" onClick={() => setShowPreview((v) => !v)}>
                  {showPreview
                    ? t("staffPortal.courseEditor.hidePreview")
                    : t("staffPortal.courseEditor.showPreview")}
                </Button>
              </div>
            ) : null}
          </div>
        </>
      )}

      {focus === "full" && showPreview ? (
        <div className="space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <p className="text-sm font-semibold text-muted-foreground">
            {t("staffPortal.courseEditor.previewLabel")}
          </p>
          <EventsMap
            courseRoute={previewCourse.routeGeojson}
            coursePoints={previewCourse.points}
            interactive
            height={360}
            className="rounded-xl"
          />
        </div>
      ) : null}
    </div>
  );
}

import { useCallback, useEffect, useMemo, useState } from "react";
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
  parseLineString,
  polylineLengthKm,
  type LatLng,
} from "@/utils/courseMapUtils";
import { parseGpxFile } from "@/utils/gpxParse";
import { cn } from "@/lib/utils";

type EditorMode = "route" | "poi" | "pan";

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

interface StaffCourseMapEditorProps {
  value: StaffEventCoursePayload | null;
  onChange: (course: StaffEventCoursePayload) => void;
  eventLat?: number | string | null;
  eventLng?: number | string | null;
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

  const mapCenter = useMemo((): [number, number] => {
    const lat = parseCoord(eventLat);
    const lng = parseCoord(eventLng);
    if (lat != null && lng != null) return [lat, lng];
    if (route.length > 0) return [route[0].lat, route[0].lng];
    return MEXICO_CENTER;
  }, [eventLat, eventLng, route]);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (focus === "route") setMode("route");
    if (focus === "checkpoints") setMode("poi");
  }, [focus]);

  useEffect(() => {
    if (!value) {
      setRoute([]);
      setPoints([]);
      setElevationM("");
      return;
    }
    setRoute(parseLineString(value.routeGeojson));
    setPoints(value.points ?? []);
    setElevationM(value.elevationGainM != null ? String(value.elevationGainM) : "");
    setElevationProfile(value.elevationProfile ?? null);
  }, [value]);

  const distanceKm = useMemo(() => polylineLengthKm(route), [route]);

  const emitChange = useCallback(
    (
      nextRoute: LatLng[],
      nextPoints: CoursePoint[],
      elev?: string,
      profile?: StaffEventCoursePayload["elevationProfile"],
    ) => {
      const withKm = assignKmToPoints(nextRoute, nextPoints);
      const gain = (elev ?? elevationM) ? Number(elev ?? elevationM) : null;
      onChange({
        routeGeojson: buildLineString(nextRoute),
        points: withKm,
        distanceKm: polylineLengthKm(nextRoute) || null,
        elevationGainM: gain,
        elevationProfile: profile !== undefined ? profile : elevationProfile,
      });
    },
    [onChange, elevationM, elevationProfile],
  );

  const handleMapClick = (lat: number, lng: number) => {
    if (mode === "route") {
      const next = [...route, { lat, lng }];
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
    emitChange([], points);
  };

  const handleGpxImport = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      const parsed = parseGpxFile(text);
      if (parsed.route.length < 2) return;
      setRoute(parsed.route);
      const gainStr =
        parsed.elevationGainM > 0 ? String(Math.round(parsed.elevationGainM)) : elevationM;
      if (parsed.elevationGainM > 0) setElevationM(gainStr);
      const profile =
        parsed.elevationProfile.length > 1 ? parsed.elevationProfile : elevationProfile;
      if (parsed.elevationProfile.length > 1) setElevationProfile(profile);
      emitChange(parsed.route, points, gainStr, profile);
    };
    reader.readAsText(file);
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
  };

  const routePositions = route.map((p) => [p.lat, p.lng] as [number, number]);

  const previewCourse = useMemo(
    () => ({
      routeGeojson: buildLineString(route),
      points: assignKmToPoints(route, points),
      distanceKm,
      elevationGainM: elevationM ? Number(elevationM) : undefined,
      elevationProfile: elevationProfile ?? undefined,
    }),
    [route, points, distanceKm, elevationM, elevationProfile],
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
        <div className="grid sm:grid-cols-3 gap-3">
          <div className="card-sport p-4 text-center">
            <p className="text-[10px] uppercase text-muted-foreground">{t("staffPortal.courseEditor.distance")}</p>
            <p className="text-2xl font-bold text-cyan mt-1">{distanceKm || "—"} km</p>
          </div>
          <div className="card-sport p-4 text-center">
            <p className="text-[10px] uppercase text-muted-foreground">{t("staffPortal.courseEditor.elevation")}</p>
            <p className="text-2xl font-bold text-cyan mt-1">{elevationM ? `${elevationM} m` : "—"}</p>
          </div>
          <div className="card-sport p-4 text-center">
            <p className="text-[10px] uppercase text-muted-foreground">{t("staffPortal.courseEditor.poiList")}</p>
            <p className="text-2xl font-bold text-cyan mt-1">{points.length}</p>
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
        "relative rounded-xl overflow-hidden border border-gray-700/50",
        mapOnlyTools ? "flex-1 min-w-0" : "w-full",
        mapClassName,
      )}
      style={mapClassName ? undefined : { height: resolvedMapHeight }}
    >
        {!active || !mounted ? (
          <div className="h-full animate-pulse bg-surface-dark flex items-center justify-center">
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

            {route.map((p, i) => (
              <CircleMarker
                key={`v-${i}`}
                center={[p.lat, p.lng]}
                radius={5}
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
            ))}

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

            {parseCoord(eventLat) != null && parseCoord(eventLng) != null ? (
              <Marker
                position={[parseCoord(eventLat)!, parseCoord(eventLng)!]}
                icon={L.divIcon({
                  className: "",
                  html: `<div style="width:14px;height:14px;border-radius:50%;background:#FFD54F;border:2px solid #0A0F1F;box-shadow:0 0 0 2px #FFD54F66"></div>`,
                  iconSize: [14, 14],
                  iconAnchor: [7, 7],
                })}
              />
            ) : null}
          </MapContainer>
        )}

        <div className="absolute top-3 left-3 z-[1000] px-3 py-1.5 rounded-full bg-bg-dark/90 border border-gray-700/60 text-[10px] text-gray-300 backdrop-blur-sm pointer-events-none">
          {mode === "route"
            ? t("staffPortal.courseEditor.hintRoute")
            : mode === "poi"
              ? t("staffPortal.courseEditor.hintPoi")
              : t("staffPortal.courseEditor.hintPan")}
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
            <HelpCircle className="w-4 h-4 text-cyan shrink-0 mt-0.5" />
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
                    ? "border-cyan/50 bg-cyan/10 text-cyan"
                    : "border-gray-700/50 text-muted-foreground hover:border-gray-600",
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
            </div>
          ) : null}

          {showRouteTools && mode === "route" ? (
            <div className="space-y-2">
              <div className="flex gap-2">
                <Button type="button" size="sm" variant="outline" className="flex-1" onClick={undoRoute}>
                  <Undo2 className="w-3 h-3 mr-1" />
                  {t("staffPortal.courseEditor.undo")}
                </Button>
                <Button type="button" size="sm" variant="ghost" className="text-destructive" onClick={clearRoute}>
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
              <label className="flex items-center justify-center gap-2 w-full py-2 px-3 rounded-lg border border-dashed border-gray-600 text-xs text-muted-foreground cursor-pointer hover:border-cyan/40 hover:text-cyan transition-colors">
                <Upload className="w-3.5 h-3.5" />
                {t("staffPortal.courseEditor.importGpx")}
                <input
                  type="file"
                  accept=".gpx,application/gpx+xml"
                  className="sr-only"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleGpxImport(file);
                    e.target.value = "";
                  }}
                />
              </label>
            </div>
          ) : null}
        </div>
      )}

      {showPoiTools && (focus === "full" || focus === "checkpoints") ? (
        <>
          <div className="card-sport p-4 grid grid-cols-2 gap-3">
            <div>
              <p className="text-[10px] uppercase text-muted-foreground">{t("staffPortal.courseEditor.distance")}</p>
              <p className="text-lg font-bold text-cyan">{distanceKm || "—"} km</p>
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
                        : "border-gray-700/40 hover:border-gray-600",
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
        <div className="card-sport p-4">
          <p className="text-[10px] uppercase text-muted-foreground">{t("staffPortal.courseEditor.distance")}</p>
          <p className="text-2xl font-bold text-cyan">{distanceKm || "—"} km</p>
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

import { useEffect, useMemo, useState } from "react";
import { MapContainer, Polyline, CircleMarker, useMap } from "react-leaflet";
import BasemapTileLayer from "@/components/maps/BasemapTileLayer";
import { Pause, Play, RotateCcw } from "lucide-react";
import { useTranslation } from "react-i18next";
import "leaflet/dist/leaflet.css";
import type { GeoJsonLineString } from "@shared/api";
import { MEXICO_CENTER } from "@/lib/leafletSetup";
import { routeToLeafletPositions } from "@/utils/courseMapUtils";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface CourseRouteReplayProps {
  route: GeoJsonLineString | Record<string, unknown> | null | undefined;
  finishTimeMs?: number | null;
  className?: string;
}

function FitRoute({ positions }: { positions: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (positions.length < 2) {
      map.setView(MEXICO_CENTER, 5);
      return;
    }
    map.fitBounds(positions, { padding: [32, 32], maxZoom: 14 });
  }, [map, positions]);
  return null;
}

export default function CourseRouteReplay({
  route,
  finishTimeMs,
  className,
}: CourseRouteReplayProps) {
  const { t } = useTranslation();
  const [progress, setProgress] = useState(0);
  const [playing, setPlaying] = useState(false);

  const positions = useMemo(
    () => routeToLeafletPositions(route),
    [route],
  );

  const durationMs = Math.max(5000, Math.min(60000, finishTimeMs ?? 20000));

  useEffect(() => {
    if (!playing || positions.length < 2) return;
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const elapsed = now - start;
      const p = Math.min(1, elapsed / durationMs);
      setProgress(p);
      if (p < 1) {
        frame = requestAnimationFrame(tick);
      } else {
        setPlaying(false);
      }
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, durationMs, positions.length]);

  const markerIndex = Math.min(
    positions.length - 1,
    Math.floor(progress * (positions.length - 1)),
  );
  const markerPos = positions[markerIndex];
  const trailEnd = Math.max(1, markerIndex + 1);
  const trail = positions.slice(0, trailEnd);

  if (positions.length < 2) return null;

  return (
    <div className={cn("rounded-xl border border-border overflow-hidden bg-card/40", className)}>
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-border/60">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {t("eventDetail.routeReplay")}
        </p>
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 border-cyan/30 text-primary"
            onClick={() => {
              if (playing) setPlaying(false);
              else setPlaying(true);
            }}
          >
            {playing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-8"
            onClick={() => {
              setPlaying(false);
              setProgress(0);
            }}
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
      <div className="h-56 sm:h-64">
        <MapContainer
          center={positions[0]}
          zoom={13}
          className="h-full w-full"
          scrollWheelZoom={false}
          zoomControl={false}
        >
          <BasemapTileLayer traceLabel="course-replay" />
          <FitRoute positions={positions} />
          <Polyline positions={positions} pathOptions={{ color: "#4b5563", weight: 4, opacity: 0.5 }} />
          <Polyline positions={trail} pathOptions={{ color: "#22d3ee", weight: 5, opacity: 0.95 }} />
          {markerPos ? (
            <CircleMarker
              center={markerPos}
              radius={8}
              pathOptions={{ color: "#fff", fillColor: "#22d3ee", fillOpacity: 1, weight: 2 }}
            />
          ) : null}
        </MapContainer>
      </div>
    </div>
  );
}

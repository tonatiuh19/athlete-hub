import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { GeoJsonLineString, PaceHeatmapSegment } from "@shared/api";
import { parseRouteGeoJson } from "@shared/courseGeoJson";
import { cn } from "@/lib/utils";

interface CoursePaceHeatmapProps {
  route: GeoJsonLineString | Record<string, unknown> | null | undefined;
  segments: PaceHeatmapSegment[];
  className?: string;
}

function intensityColor(intensity: number): string {
  const t = intensity / 100;
  const r = Math.round(239 * (1 - t) + 34 * t);
  const g = Math.round(68 * (1 - t) + 211 * t);
  const b = Math.round(68 * (1 - t) + 238 * t);
  return `rgb(${r},${g},${b})`;
}

export default function CoursePaceHeatmap({
  route,
  segments,
  className,
}: CoursePaceHeatmapProps) {
  const { t } = useTranslation();

  const coords = useMemo(
    () => parseRouteGeoJson(route).map((p) => [p.lng, p.lat] as [number, number]),
    [route],
  );

  const totalKm = segments.length > 0 ? segments[segments.length - 1].kmEnd : 0;

  if (segments.length === 0 || coords.length < 2) return null;

  return (
    <div className={cn("rounded-xl border border-border bg-card/40 p-4 space-y-3", className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {t("eventDetail.paceHeatmap")}
        </p>
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-sm bg-cyan" /> {t("eventDetail.paceFast")}
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-sm bg-red-400" /> {t("eventDetail.paceSlow")}
          </span>
        </div>
      </div>
      <div className="flex h-4 rounded-full overflow-hidden border border-border/60">
        {segments.map((seg, i) => {
          const widthPct =
            totalKm > 0 ? ((seg.kmEnd - seg.kmStart) / totalKm) * 100 : 100 / segments.length;
          return (
            <div
              key={i}
              style={{
                width: `${widthPct}%`,
                backgroundColor: intensityColor(seg.intensity),
              }}
              title={`Km ${seg.kmStart.toFixed(1)}–${seg.kmEnd.toFixed(1)}`}
            />
          );
        })}
      </div>
      <p className="text-[10px] text-muted-foreground">{t("eventDetail.paceHeatmapHint")}</p>
    </div>
  );
}

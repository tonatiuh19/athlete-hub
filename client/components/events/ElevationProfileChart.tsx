import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useTranslation } from "react-i18next";
import type { ElevationProfilePoint } from "@shared/api";
import { cn } from "@/lib/utils";

interface ElevationProfileChartProps {
  profile: ElevationProfilePoint[];
  className?: string;
  height?: number;
}

export default function ElevationProfileChart({
  profile,
  className,
  height = 160,
}: ElevationProfileChartProps) {
  const { t } = useTranslation();
  if (!profile || profile.length < 2) return null;

  return (
    <div className={cn("rounded-xl border border-gray-700/50 bg-surface-dark/40 p-4", className)}>
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">
        {t("eventDetail.elevationProfile")}
      </p>
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={profile} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="elevGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.45} />
                <stop offset="100%" stopColor="#22d3ee" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
            <XAxis
              dataKey="km"
              tick={{ fill: "#9ca3af", fontSize: 10 }}
              tickFormatter={(v) => `${v}`}
              label={{
                value: "km",
                position: "insideBottomRight",
                offset: -2,
                fill: "#6b7280",
                fontSize: 10,
              }}
            />
            <YAxis
              tick={{ fill: "#9ca3af", fontSize: 10 }}
              width={36}
              tickFormatter={(v) => `${v}m`}
            />
            <Tooltip
              contentStyle={{
                background: "#0f172a",
                border: "1px solid #374151",
                borderRadius: 8,
                fontSize: 12,
              }}
              formatter={(value: number) => [`${value} m`, t("eventDetail.elevation")]}
              labelFormatter={(label) => `Km ${label}`}
            />
            <Area
              type="monotone"
              dataKey="elevation_m"
              stroke="#22d3ee"
              strokeWidth={2}
              fill="url(#elevGrad)"
              dot={false}
              isAnimationActive
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

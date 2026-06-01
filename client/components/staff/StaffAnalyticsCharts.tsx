import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import type { AnalyticsTimeSeries } from "@shared/api";
import { getNumberLocale } from "@/utils/dateLocale";

const regConfig = {
  registrations: { label: "Registrations", color: "hsl(var(--cyan))" },
} satisfies ChartConfig;

const revConfig = {
  revenue: { label: "Revenue", color: "hsl(var(--cyan))" },
} satisfies ChartConfig;

interface StaffAnalyticsChartsProps {
  data: AnalyticsTimeSeries | null;
}

export default function StaffAnalyticsCharts({ data }: StaffAnalyticsChartsProps) {
  const { t, i18n } = useTranslation();
  const numLocale = getNumberLocale(i18n.language);

  const regChartData = useMemo(
    () =>
      (data?.registrations_by_day ?? []).map((d) => ({
        day: d.day.slice(5),
        registrations: d.registrations,
      })),
    [data],
  );

  const revChartData = useMemo(
    () =>
      (data?.revenue_by_day ?? []).map((d) => ({
        day: d.day.slice(5),
        revenue: Math.round(d.revenue_cents / 100),
      })),
    [data],
  );

  if (!data) return null;

  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <div className="card-sport p-6">
        <h2 className="text-sm font-semibold text-cyan uppercase tracking-wider mb-4">
          {t("staffPortal.analytics.registrationsChart")}
        </h2>
        {regChartData.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("staffPortal.analytics.noChartData")}</p>
        ) : (
          <ChartContainer config={regConfig} className="h-[220px] w-full aspect-auto">
            <BarChart data={regChartData} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="day" tickLine={false} axisLine={false} fontSize={11} />
              <YAxis tickLine={false} axisLine={false} fontSize={11} width={32} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="registrations" fill="var(--color-registrations)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartContainer>
        )}
      </div>

      <div className="card-sport p-6">
        <h2 className="text-sm font-semibold text-cyan uppercase tracking-wider mb-4">
          {t("staffPortal.analytics.revenueChart")}
        </h2>
        {revChartData.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("staffPortal.analytics.noChartData")}</p>
        ) : (
          <ChartContainer config={revConfig} className="h-[220px] w-full aspect-auto">
            <LineChart data={revChartData} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="day" tickLine={false} axisLine={false} fontSize={11} />
              <YAxis
                tickLine={false}
                axisLine={false}
                fontSize={11}
                width={48}
                tickFormatter={(v) => `$${Number(v).toLocaleString(numLocale)}`}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(value) =>
                      `$${Number(value).toLocaleString(numLocale)} MXN`
                    }
                  />
                }
              />
              <Line
                type="monotone"
                dataKey="revenue"
                stroke="var(--color-revenue)"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ChartContainer>
        )}
      </div>
    </div>
  );
}

import { useEffect } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Eye, MousePointerClick, TrendingUp } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchSponsorAnalytics } from "@/store/slices/staffPortalSlice";

interface SponsorAnalyticsPanelProps {
  eventId: number;
  role: "admin" | "organizer";
}

export default function SponsorAnalyticsPanel({ eventId, role }: SponsorAnalyticsPanelProps) {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const { sponsorAnalytics, loadingSponsorAnalytics, sponsorAnalyticsError } =
    useAppSelector((s) => s.staffPortal);

  useEffect(() => {
    dispatch(fetchSponsorAnalytics({ eventId, role }));
  }, [dispatch, eventId, role]);

  if (loadingSponsorAnalytics && !sponsorAnalytics) {
    return <p className="text-sm text-muted-foreground">{t("common.loading")}</p>;
  }

  if (sponsorAnalyticsError) {
    return <p className="text-sm text-destructive">{sponsorAnalyticsError}</p>;
  }

  if (!sponsorAnalytics || sponsorAnalytics.sponsors.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">{t("staffPortal.sponsorAnalytics.empty")}</p>
    );
  }

  const chartData = sponsorAnalytics.sponsors.map((s) => ({
    name: s.name.length > 14 ? `${s.name.slice(0, 12)}…` : s.name,
    impressions: s.impressions,
    clicks: s.clicks,
  }));

  return (
    <div className="space-y-6">
      <div className="grid sm:grid-cols-3 gap-3">
        <div className="rounded-xl border border-border p-4">
          <Eye className="w-5 h-5 text-primary mb-2" />
          <p className="text-2xl font-bold">{sponsorAnalytics.totals.impressions}</p>
          <p className="text-xs text-muted-foreground">{t("staffPortal.sponsorAnalytics.impressions")}</p>
        </div>
        <div className="rounded-xl border border-border p-4">
          <MousePointerClick className="w-5 h-5 text-primary mb-2" />
          <p className="text-2xl font-bold">{sponsorAnalytics.totals.clicks}</p>
          <p className="text-xs text-muted-foreground">{t("staffPortal.sponsorAnalytics.clicks")}</p>
        </div>
        <div className="rounded-xl border border-border p-4">
          <TrendingUp className="w-5 h-5 text-primary mb-2" />
          <p className="text-2xl font-bold">{sponsorAnalytics.totals.ctr}%</p>
          <p className="text-xs text-muted-foreground">{t("staffPortal.sponsorAnalytics.ctr")}</p>
        </div>
      </div>

      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#374151" />
            <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#9ca3af" }} />
            <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} width={32} />
            <Tooltip
              contentStyle={{
                background: "#0f172a",
                border: "1px solid #374151",
                borderRadius: 8,
                fontSize: 12,
              }}
            />
            <Bar dataKey="impressions" fill="#22d3ee" radius={[4, 4, 0, 0]} name={t("staffPortal.sponsorAnalytics.impressions")} />
            <Bar dataKey="clicks" fill="#a78bfa" radius={[4, 4, 0, 0]} name={t("staffPortal.sponsorAnalytics.clicks")} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-muted-foreground border-b border-border">
              <th className="py-2 pr-4">{t("staffPortal.sponsorAnalytics.sponsor")}</th>
              <th className="py-2 pr-4">{t("staffPortal.sponsorAnalytics.tier")}</th>
              <th className="py-2 pr-4">{t("staffPortal.sponsorAnalytics.impressions")}</th>
              <th className="py-2 pr-4">{t("staffPortal.sponsorAnalytics.clicks")}</th>
              <th className="py-2">{t("staffPortal.sponsorAnalytics.ctr")}</th>
            </tr>
          </thead>
          <tbody>
            {sponsorAnalytics.sponsors.map((s) => (
              <tr key={s.sponsor_id} className="border-b border-border/50">
                <td className="py-2 pr-4 font-medium">{s.name}</td>
                <td className="py-2 pr-4 capitalize text-muted-foreground">{s.tier}</td>
                <td className="py-2 pr-4">{s.impressions}</td>
                <td className="py-2 pr-4">{s.clicks}</td>
                <td className="py-2">{s.ctr}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

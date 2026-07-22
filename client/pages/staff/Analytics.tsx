import { useEffect } from "react";
import { BarChart3, DollarSign, TrendingUp, Users } from "lucide-react";
import { useTranslation } from "react-i18next";
import MetaHelmet from "@/components/MetaHelmet";
import PortalErrorAlert from "@/components/athlete/PortalErrorAlert";
import StaffAnalyticsCharts from "@/components/staff/StaffAnalyticsCharts";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  fetchAdminAnalyticsTimeSeries,
  fetchOrganizerAnalytics,
  fetchStaffAnalytics,
} from "@/store/slices/staffPortalSlice";
import { getNumberLocale } from "@/utils/dateLocale";
import {
  StaffChartSkeleton,
  StaffStatsCardsSkeleton,
} from "@/components/staff/skeletons/StaffSkeletons";

export default function StaffAnalytics() {
  const { t, i18n } = useTranslation();
  const dispatch = useAppDispatch();
  const { role } = useAppSelector((s) => s.staffAuth);
  const {
    analytics,
    analyticsTimeSeries,
    organizerAnalytics,
    loadingAnalytics,
    analyticsError,
  } = useAppSelector((s) => s.staffPortal);
  const numLocale = getNumberLocale(i18n.language);
  const isAdmin = role === "admin";

  useEffect(() => {
    if (role === "admin") {
      dispatch(fetchStaffAnalytics());
      dispatch(fetchAdminAnalyticsTimeSeries());
    } else if (role === "organizer") {
      dispatch(fetchOrganizerAnalytics());
    }
  }, [dispatch, role]);

  const adminStats = analytics?.stats;
  const orgStats = organizerAnalytics?.stats;
  const last30 = analytics?.last_30_days;
  const chartData = isAdmin
    ? analyticsTimeSeries
    : organizerAnalytics
      ? {
          registrations_by_day: organizerAnalytics.registrations_by_day,
          revenue_by_day: organizerAnalytics.revenue_by_day,
        }
      : null;

  const statCards = isAdmin
    ? [
        {
          label: t("staffPortal.dashboard.statAthletes"),
          value: adminStats?.athletes ?? 0,
          icon: Users,
        },
        {
          label: t("staffPortal.dashboard.statPublished"),
          value: adminStats?.published_events ?? 0,
          icon: BarChart3,
        },
        {
          label: t("staffPortal.analytics.confirmedRegs"),
          value: adminStats?.confirmed_registrations ?? 0,
          icon: TrendingUp,
        },
        {
          label: t("staffPortal.dashboard.statRevenue"),
          value: `$${((adminStats?.total_revenue_cents ?? 0) / 100).toLocaleString(numLocale)}`,
          icon: DollarSign,
        },
      ]
    : [
        {
          label: t("staffPortal.analytics.totalEvents"),
          value: orgStats?.total_events ?? 0,
          icon: BarChart3,
        },
        {
          label: t("staffPortal.dashboard.statPublished"),
          value: orgStats?.published_events ?? 0,
          icon: BarChart3,
        },
        {
          label: t("staffPortal.analytics.confirmedRegs"),
          value: orgStats?.confirmed_registrations ?? 0,
          icon: TrendingUp,
        },
        {
          label: t("staffPortal.dashboard.statRevenue"),
          value: `$${((orgStats?.total_revenue_cents ?? 0) / 100).toLocaleString(numLocale)}`,
          icon: DollarSign,
        },
      ];

  const reload = () => {
    if (isAdmin) {
      dispatch(fetchStaffAnalytics());
      dispatch(fetchAdminAnalyticsTimeSeries());
    } else {
      dispatch(fetchOrganizerAnalytics());
    }
  };

  return (
    <div className="max-w-6xl mx-auto w-full min-w-0 overflow-x-clip space-y-8">
      <MetaHelmet
        title={t("staffPortal.analytics.title")}
        description={t("staffPortal.analytics.subtitle")}
      />
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <BarChart3 className="w-7 h-7 text-primary" />
          {t("staffPortal.analytics.title")}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {isAdmin
            ? t("staffPortal.analytics.subtitle")
            : t("staffPortal.analytics.subtitleOrganizer")}
        </p>
      </div>

      <PortalErrorAlert error={analyticsError} onRetry={reload} />

      {loadingAnalytics ? (
        <div className="space-y-6" role="status" aria-busy="true">
          <StaffStatsCardsSkeleton />
          <div className="grid md:grid-cols-2 gap-4">
            <StaffChartSkeleton />
            <StaffChartSkeleton />
          </div>
        </div>
      ) : analyticsError ? null : (
        <>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {statCards.map(({ label, value, icon: Icon }) => (
              <div key={label} className="card-sport p-5">
                <Icon className="w-5 h-5 text-primary mb-3" />
                <div className="text-2xl font-bold">{value}</div>
                <div className="text-sm text-muted-foreground">{label}</div>
              </div>
            ))}
          </div>

          <StaffAnalyticsCharts data={chartData} />

          {isAdmin ? (
            <div className="grid md:grid-cols-2 gap-4">
              <div className="card-sport p-6">
                <h2 className="text-sm font-semibold text-primary uppercase tracking-wider mb-4">
                  {t("staffPortal.analytics.last30Title")}
                </h2>
                <div className="space-y-4">
                  <div>
                    <p className="text-xs text-muted-foreground">
                      {t("staffPortal.analytics.newRegistrations")}
                    </p>
                    <p className="text-3xl font-bold">{last30?.registrations ?? 0}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">
                      {t("staffPortal.analytics.revenue30")}
                    </p>
                    <p className="text-3xl font-bold text-primary">
                      ${((last30?.revenue_cents ?? 0) / 100).toLocaleString(numLocale)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="card-sport p-6">
                <h2 className="text-sm font-semibold text-primary uppercase tracking-wider mb-4">
                  {t("staffPortal.analytics.topEvents")}
                </h2>
                {(analytics?.top_events?.length ?? 0) === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {t("staffPortal.analytics.noTopEvents")}
                  </p>
                ) : (
                  <div className="space-y-3">
                    {analytics?.top_events.map((ev, i) => (
                      <div
                        key={ev.id}
                        className="flex items-center justify-between gap-3 text-sm border-b border-border/50 pb-3 last:border-0 last:pb-0"
                      >
                        <div className="min-w-0">
                          <span className="text-primary font-bold mr-2">#{i + 1}</span>
                          <span className="font-medium truncate">{ev.title}</span>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {ev.registration_count} {t("staffPortal.dashboard.registered")}
                          </p>
                        </div>
                        <div className="font-bold text-primary shrink-0">
                          ${(ev.revenue_cents / 100).toLocaleString(numLocale)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

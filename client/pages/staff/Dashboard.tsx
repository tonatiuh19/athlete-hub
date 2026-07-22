import { useEffect } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import MetaHelmet from "@/components/MetaHelmet";
import PortalErrorAlert from "@/components/athlete/PortalErrorAlert";
import StaffPaidEventPayoutAlert, {
  eventNeedsPayoutAlert,
} from "@/components/staff/StaffPaidEventPayoutAlert";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  fetchStaffDashboard,
  fetchOrganizerEvents,
  fetchOrganizerAnalytics,
} from "@/store/slices/staffPortalSlice";
import { Calendar, ChevronRight, DollarSign, Users, Trophy, QrCode } from "lucide-react";
import { getNumberLocale } from "@/utils/dateLocale";
import {
  StaffEventCardsSkeleton,
  StaffStatsCardsSkeleton,
} from "@/components/staff/skeletons/StaffSkeletons";

export default function StaffDashboard() {
  const { t, i18n } = useTranslation();
  const dispatch = useAppDispatch();
  const { role, user } = useAppSelector((s) => s.staffAuth);
  const { dashboardStats, events, organizerAnalytics, loadingDashboard, loadingEvents, loadingAnalytics, dashboardError, eventsError, analyticsError } =
    useAppSelector((s) => s.staffPortal);
  const numLocale = getNumberLocale(i18n.language);

  useEffect(() => {
    if (role === "admin") dispatch(fetchStaffDashboard());
    else if (role === "organizer") {
      dispatch(fetchOrganizerEvents({ limit: 100, sortBy: "start_date", sortDir: "DESC" }));
      dispatch(fetchOrganizerAnalytics());
    }
  }, [dispatch, role]);

  const isAdmin = role === "admin";
  const name = user?.firstName ?? "";

  const reload = () => {
    if (isAdmin) dispatch(fetchStaffDashboard());
    else {
      dispatch(fetchOrganizerEvents({ limit: 100, sortBy: "start_date", sortDir: "DESC" }));
      dispatch(fetchOrganizerAnalytics());
    }
  };

  return (
    <div className="max-w-6xl mx-auto w-full min-w-0 overflow-x-clip space-y-8">
      <MetaHelmet
        title={
          isAdmin
            ? t("staffPortal.dashboard.titleAdmin")
            : t("staffPortal.dashboard.titleOrganizer")
        }
        description={
          isAdmin
            ? t("staffPortal.dashboard.welcomeAdmin", { name })
            : t("staffPortal.dashboard.welcomeOrganizer", { name })
        }
      />
      <div>
        <h1 className="text-3xl font-bold">
          {isAdmin
            ? t("staffPortal.dashboard.titleAdmin")
            : t("staffPortal.dashboard.titleOrganizer")}
        </h1>
        <p className="text-muted-foreground mt-1">
          {isAdmin
            ? t("staffPortal.dashboard.welcomeAdmin", { name })
            : t("staffPortal.dashboard.welcomeOrganizer", { name })}
        </p>
      </div>

      <PortalErrorAlert error={dashboardError || eventsError || analyticsError} onRetry={reload} />

      {!isAdmin && events.some((ev) => eventNeedsPayoutAlert(ev)) ? (
        <StaffPaidEventPayoutAlert />
      ) : null}

      {isAdmin && (dashboardStats?.pending_approval_events ?? 0) > 0 ? (
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <p className="text-sm">
            {t("staffPortal.dashboard.pendingApprovalBanner", {
              count: dashboardStats?.pending_approval_events ?? 0,
            })}
          </p>
          <Link
            to="/staff/events?status=pending_approval"
            className="text-sm font-semibold text-primary hover:underline shrink-0"
          >
            {t("staffPortal.dashboard.reviewPendingEvents")}
          </Link>
        </div>
      ) : null}

      {isAdmin && (loadingDashboard && !dashboardStats) ? (
        <StaffStatsCardsSkeleton />
      ) : null}

      {!isAdmin && (loadingAnalytics && !organizerAnalytics) ? (
        <StaffStatsCardsSkeleton />
      ) : null}

      {isAdmin && dashboardStats && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              label: t("staffPortal.dashboard.statAthletes"),
              value: dashboardStats.athletes ?? 0,
              icon: Users,
            },
            {
              label: t("staffPortal.dashboard.statOrganizers"),
              value: dashboardStats.organizers ?? 0,
              icon: Trophy,
            },
            {
              label: t("staffPortal.dashboard.statPublished"),
              value: dashboardStats.published_events ?? 0,
              icon: Calendar,
            },
            {
              label: t("staffPortal.dashboard.statRevenue"),
              value: `$${((dashboardStats.total_revenue_cents ?? 0) / 100).toLocaleString(numLocale)}`,
              icon: DollarSign,
            },
          ].map(({ label, value, icon: Icon }) => (
            <div key={label} className="card-sport p-5">
              <Icon className="w-5 h-5 text-primary mb-3" />
              <div className="text-2xl font-bold">{value}</div>
              <div className="text-sm text-muted-foreground">{label}</div>
            </div>
          ))}
        </div>
      )}

      {isAdmin && dashboardStats ? (
        <div className="card-sport p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wider text-primary font-semibold">
              {t("staffPortal.analytics.confirmedRegs")}
            </p>
            <p className="text-3xl font-bold mt-1">
              {dashboardStats.confirmed_registrations ?? 0}
            </p>
          </div>
          <Link
            to="/staff/analytics"
            className="text-sm text-primary hover:underline inline-flex items-center gap-1"
          >
            {t("staffPortal.dashboard.viewAnalytics")}
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      ) : null}

      {!isAdmin && organizerAnalytics ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              label: t("staffPortal.analytics.totalEvents"),
              value: organizerAnalytics.stats.total_events ?? 0,
              icon: Calendar,
            },
            {
              label: t("staffPortal.dashboard.statPublished"),
              value: organizerAnalytics.stats.published_events ?? 0,
              icon: Trophy,
            },
            {
              label: t("staffPortal.analytics.confirmedRegs"),
              value: organizerAnalytics.stats.confirmed_registrations ?? 0,
              icon: Users,
            },
            {
              label: t("staffPortal.dashboard.statRevenue"),
              value: `$${((organizerAnalytics.stats.total_revenue_cents ?? 0) / 100).toLocaleString(numLocale)}`,
              icon: DollarSign,
            },
          ].map(({ label, value, icon: Icon }) => (
            <div key={label} className="card-sport p-5">
              <Icon className="w-5 h-5 text-primary mb-3" />
              <div className="text-2xl font-bold">{value}</div>
              <div className="text-sm text-muted-foreground">{label}</div>
            </div>
          ))}
        </div>
      ) : null}

      {!isAdmin && (
        <div className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-semibold">{t("staffPortal.dashboard.yourEvents")}</h2>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <Link to="/staff/analytics" className="text-sm text-primary hover:underline inline-flex items-center gap-1">
                {t("staffPortal.dashboard.viewAnalytics")}
                <ChevronRight className="w-4 h-4" />
              </Link>
              <Link to="/staff/registrations" className="text-sm text-primary hover:underline inline-flex items-center gap-1">
                {t("staffPortal.dashboard.viewRegistrations")}
                <QrCode className="w-4 h-4" />
              </Link>
            </div>
          </div>
          {loadingEvents ? (
            <StaffEventCardsSkeleton count={3} />
          ) : eventsError ? null : events.length === 0 ? (
            <p className="text-muted-foreground">{t("staffPortal.dashboard.noEvents")}</p>
          ) : (
            <div className="grid gap-3">
              {events.slice(0, 5).map((ev) => (
                <div
                  key={ev.id}
                  className="card-sport p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between min-w-0"
                >
                  <div className="min-w-0">
                    <h3 className="font-semibold truncate">{ev.title}</h3>
                    <p className="text-xs text-muted-foreground">
                      {ev.sport_name} · {ev.status}
                    </p>
                  </div>
                  <div className="flex items-center justify-between sm:block sm:text-right shrink-0">
                    <div className="text-lg font-bold text-primary">{ev.registration_count}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {t("staffPortal.dashboard.registered")}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {events.length > 5 ? (
            <Link to="/staff/events" className="text-sm text-primary hover:underline inline-flex items-center gap-1">
              {t("staffPortal.dashboard.viewAllEvents")}
              <ChevronRight className="w-4 h-4" />
            </Link>
          ) : null}
        </div>
      )}
    </div>
  );
}

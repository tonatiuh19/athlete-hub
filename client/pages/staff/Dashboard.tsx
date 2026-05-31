import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import MetaHelmet from "@/components/MetaHelmet";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  fetchStaffDashboard,
  fetchOrganizerEvents,
} from "@/store/slices/staffPortalSlice";
import { Calendar, DollarSign, Users, Trophy } from "lucide-react";
import { getNumberLocale } from "@/utils/dateLocale";

export default function StaffDashboard() {
  const { t, i18n } = useTranslation();
  const dispatch = useAppDispatch();
  const { role, user } = useAppSelector((s) => s.staffAuth);
  const { dashboardStats, events, loadingDashboard, loadingEvents } =
    useAppSelector((s) => s.staffPortal);
  const numLocale = getNumberLocale(i18n.language);

  useEffect(() => {
    if (role === "admin") dispatch(fetchStaffDashboard());
    else dispatch(fetchOrganizerEvents());
  }, [dispatch, role]);

  const isAdmin = role === "admin";
  const name = user?.firstName ?? "";

  return (
    <div className="max-w-6xl mx-auto space-y-8 min-w-0">
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
              <Icon className="w-5 h-5 text-cyan mb-3" />
              <div className="text-2xl font-bold">{value}</div>
              <div className="text-sm text-muted-foreground">{label}</div>
            </div>
          ))}
        </div>
      )}

      {!isAdmin && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">{t("staffPortal.dashboard.yourEvents")}</h2>
          {loadingEvents ? (
            <p className="text-muted-foreground">{t("common.loading")}</p>
          ) : events.length === 0 ? (
            <p className="text-muted-foreground">{t("staffPortal.dashboard.noEvents")}</p>
          ) : (
            <div className="grid gap-3">
              {events.map((ev) => (
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
                    <div className="text-lg font-bold text-cyan">
                      {ev.registration_count}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      {t("staffPortal.dashboard.registered")}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {loadingDashboard && isAdmin && (
        <p className="text-muted-foreground text-sm">
          {t("staffPortal.dashboard.loadingMetrics")}
        </p>
      )}
    </div>
  );
}

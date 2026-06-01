import { useEffect, useState } from "react";
import { format } from "date-fns";
import { Link, Navigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Calendar,
  ExternalLink,
  LayoutDashboard,
  MapPin,
  Pencil,
  TrendingUp,
  Trophy,
  Users,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import MetaHelmet from "@/components/MetaHelmet";
import PortalErrorAlert from "@/components/athlete/PortalErrorAlert";
import SponsorAnalyticsPanel from "@/components/staff/SponsorAnalyticsPanel";
import StaffCheckInPanel from "@/components/staff/StaffCheckInPanel";
import StaffEventRegistrationsPanel from "@/components/staff/StaffEventRegistrationsPanel";
import StaffStatusBadge from "@/components/staff/StaffStatusBadge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  clearEventHub,
  fetchEventHubSummary,
  fetchEventWaitlist,
  fetchStaffEventDetail,
  offerWaitlistSpot,
  revokeWaitlistEntry,
} from "@/store/slices/staffPortalSlice";
import { getDateFnsLocale, getNumberLocale } from "@/utils/dateLocale";
import type { StaffRole } from "@shared/api";

export default function StaffEventHub() {
  const { eventId: eventIdParam } = useParams<{ eventId: string }>();
  const eventId = Number(eventIdParam);
  const { t, i18n } = useTranslation();
  const dispatch = useAppDispatch();
  const { role } = useAppSelector((s) => s.staffAuth);
  const staffRole: StaffRole = role === "admin" ? "admin" : "organizer";
  const {
    eventDetail,
    eventHubSummary,
    waitlistEntries,
    loadingEventDetail,
    loadingEventHubSummary,
    loadingWaitlist,
    eventDetailError,
    eventHubSummaryError,
    waitlistError,
    offeringWaitlist,
  } = useAppSelector((s) => s.staffPortal);
  const [tab, setTab] = useState("overview");
  const dateLocale = getDateFnsLocale(i18n.language);
  const numLocale = getNumberLocale(i18n.language);

  useEffect(() => {
    if (!Number.isFinite(eventId)) return;
    dispatch(fetchStaffEventDetail({ eventId, role: staffRole }));
    dispatch(fetchEventHubSummary({ eventId, role: staffRole }));
    return () => {
      dispatch(clearEventHub());
    };
  }, [dispatch, eventId, staffRole]);

  useEffect(() => {
    if (tab === "waitlist" && Number.isFinite(eventId)) {
      dispatch(fetchEventWaitlist({ eventId, role: staffRole }));
    }
  }, [dispatch, tab, eventId, staffRole]);

  if (!role || (role !== "admin" && role !== "organizer")) {
    return <Navigate to="/staff" replace />;
  }

  if (!Number.isFinite(eventId)) {
    return <Navigate to="/staff/events" replace />;
  }

  const event = eventDetail?.event;
  const summary = eventHubSummary;
  const isLoading = loadingEventDetail && !event;
  const loadError = eventDetailError || eventHubSummaryError;

  const reload = () => {
    dispatch(fetchStaffEventDetail({ eventId, role: staffRole }));
    dispatch(fetchEventHubSummary({ eventId, role: staffRole }));
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 min-w-0">
      <MetaHelmet
        title={event?.title ?? t("staffPortal.eventHub.title")}
        description={t("staffPortal.eventHub.subtitle")}
      />

      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
        <div className="min-w-0">
          <Link
            to="/staff/events"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-cyan mb-2"
          >
            <ArrowLeft className="w-4 h-4" />
            {t("staffPortal.eventHub.back")}
          </Link>
          {isLoading ? (
            <p className="text-muted-foreground">{t("common.loading")}</p>
          ) : event ? (
            <>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-bold truncate">{event.title}</h1>
                <StaffStatusBadge status={event.status} />
              </div>
              <p className="text-sm text-muted-foreground mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                {event.sport_name ? <span>{event.sport_name}</span> : null}
                {event.organizer_name ? <span>{event.organizer_name}</span> : null}
                <span className="inline-flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  {format(new Date(event.start_date), "d MMM yyyy", { locale: dateLocale })}
                </span>
                {event.location_city ? (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5" />
                    {event.location_city}
                  </span>
                ) : null}
              </p>
            </>
          ) : null}
        </div>

        {event ? (
          <div className="flex flex-wrap gap-2 shrink-0">
            {event.status === "published" ? (
              <Button asChild variant="outline" size="sm">
                <Link to={`/events/${event.slug}`} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="w-4 h-4 mr-2" />
                  {t("staffPortal.events.viewPublic")}
                </Link>
              </Button>
            ) : null}
            <Button asChild variant="outline" size="sm">
              <Link to={`/staff/events/${eventId}/edit`}>
                <Pencil className="w-4 h-4 mr-2" />
                {t("staffPortal.events.edit")}
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link to={`/staff/events/${eventId}/results`}>
                <Trophy className="w-4 h-4 mr-2" />
                {t("staffPortal.results.manage")}
              </Link>
            </Button>
          </div>
        ) : null}
      </div>

      <PortalErrorAlert error={loadError} onRetry={reload} />

      {!loadError && event ? (
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="w-full sm:w-auto flex-wrap h-auto">
            <TabsTrigger value="overview">
              <LayoutDashboard className="w-4 h-4 mr-1.5 hidden sm:inline" />
              {t("staffPortal.eventHub.tabOverview")}
            </TabsTrigger>
            <TabsTrigger value="registrations">
              <Users className="w-4 h-4 mr-1.5 hidden sm:inline" />
              {t("staffPortal.people.titleRegistrations")}
            </TabsTrigger>
            <TabsTrigger value="waitlist">{t("staffPortal.eventHub.tabWaitlist")}</TabsTrigger>
            <TabsTrigger value="checkin">{t("staffPortal.eventHub.tabCheckIn")}</TabsTrigger>
            <TabsTrigger value="sponsor-analytics">
              <TrendingUp className="w-4 h-4 mr-1.5 hidden sm:inline" />
              {t("staffPortal.eventHub.tabSponsorAnalytics")}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-4 space-y-4">
            {loadingEventHubSummary && !summary ? (
              <p className="text-muted-foreground">{t("common.loading")}</p>
            ) : summary ? (
              <>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  {[
                    {
                      label: t("staffPortal.eventHub.statConfirmed"),
                      value: summary.confirmed_count,
                      accent: "text-cyan",
                    },
                    {
                      label: t("staffPortal.eventHub.statPending"),
                      value: summary.pending_count,
                      accent: "text-blue-electric",
                    },
                    {
                      label: t("staffPortal.eventHub.statCheckedIn"),
                      value: summary.checked_in_count,
                      accent: "text-success",
                    },
                    {
                      label: t("staffPortal.eventHub.statRevenue"),
                      value: `$${(summary.revenue_cents / 100).toLocaleString(numLocale)}`,
                      accent: "text-cyan",
                    },
                  ].map(({ label, value, accent }) => (
                    <div key={label} className="card-sport p-4">
                      <div className={`text-2xl font-bold ${accent}`}>{value}</div>
                      <div className="text-xs text-muted-foreground mt-1">{label}</div>
                    </div>
                  ))}
                </div>

                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="card-sport p-4">
                    <div className="text-lg font-bold">{summary.cancelled_count}</div>
                    <div className="text-xs text-muted-foreground">
                      {t("staffPortal.eventHub.statCancelled")}
                    </div>
                  </div>
                  <div className="card-sport p-4">
                    <div className="text-lg font-bold">{summary.waitlist_count}</div>
                    <div className="text-xs text-muted-foreground">
                      {t("staffPortal.eventHub.statWaitlist")}
                    </div>
                  </div>
                </div>

                {summary.categories.length > 0 ? (
                  <div className="card-sport p-5 space-y-3">
                    <h2 className="font-semibold">{t("staffPortal.eventHub.categoriesTitle")}</h2>
                    <div className="space-y-2">
                      {summary.categories.map((cat) => {
                        const pct =
                          cat.capacity != null && cat.capacity > 0
                            ? Math.min(100, Math.round((cat.sold_count / cat.capacity) * 100))
                            : null;
                        return (
                          <div
                            key={cat.id}
                            className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-xl border border-border"
                          >
                            <div>
                              <p className="font-medium">{cat.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {cat.sold_count}
                                {cat.capacity != null ? ` / ${cat.capacity}` : ""}{" "}
                                {t("staffPortal.dashboard.registered")}
                              </p>
                            </div>
                            {pct != null ? (
                              <div className="w-full sm:w-32">
                                <div className="h-2 bg-muted rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-cyan rounded-full transition-all"
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                {event.max_registrations ? (
                  <p className="text-sm text-muted-foreground">
                    {t("staffPortal.eventHub.eventCapacity", {
                      current: event.registration_count,
                      max: event.max_registrations,
                    })}
                  </p>
                ) : null}
              </>
            ) : null}
          </TabsContent>

          <TabsContent value="registrations" className="mt-4">
            <StaffEventRegistrationsPanel
              eventId={eventId}
              role={staffRole}
              categories={eventDetail?.categories ?? []}
            />
          </TabsContent>

          <TabsContent value="waitlist" className="mt-4">
            <div className="card-sport p-6 space-y-4">
              <h2 className="font-semibold">{t("staffPortal.eventEdit.waitlistTitle")}</h2>
              <p className="text-sm text-muted-foreground">
                {t("staffPortal.eventEdit.waitlistSubtitle")}
              </p>
              {waitlistError ? <p className="text-sm text-destructive">{waitlistError}</p> : null}
              {loadingWaitlist ? (
                <p className="text-muted-foreground">{t("common.loading")}</p>
              ) : waitlistEntries.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t("staffPortal.eventEdit.waitlistEmpty")}
                </p>
              ) : (
                <div className="space-y-2">
                  {waitlistEntries.map((entry) => (
                    <div
                      key={entry.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl border border-border"
                    >
                      <div>
                        <p className="font-medium">
                          {entry.athlete_first_name} {entry.athlete_last_name}
                        </p>
                        <p className="text-xs text-muted-foreground">{entry.athlete_email}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {entry.category_name} · #{entry.position} ·{" "}
                          {t(`staffPortal.eventEdit.waitlistStatus.${entry.status}`, {
                            defaultValue: entry.status,
                          })}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2 shrink-0">
                        {entry.status === "waiting" ? (
                          <Button
                            type="button"
                            size="sm"
                            disabled={offeringWaitlist}
                            onClick={() =>
                              dispatch(
                                offerWaitlistSpot({
                                  eventId,
                                  role: staffRole,
                                  waitlistEntryId: entry.id,
                                }),
                              )
                            }
                          >
                            {t("staffPortal.eventEdit.waitlistOffer")}
                          </Button>
                        ) : null}
                        {entry.status === "waiting" || entry.status === "offered" ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={offeringWaitlist}
                            className="text-destructive border-destructive/40"
                            onClick={() =>
                              dispatch(
                                revokeWaitlistEntry({
                                  eventId,
                                  role: staffRole,
                                  waitlistEntryId: entry.id,
                                }),
                              )
                            }
                          >
                            {t("staffPortal.eventEdit.waitlistRevoke")}
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="checkin" className="mt-4">
            <StaffCheckInPanel eventId={eventId} role={staffRole} />
          </TabsContent>

          <TabsContent value="sponsor-analytics" className="mt-4">
            <div className="card-sport p-6 space-y-4">
              <h2 className="font-semibold">{t("staffPortal.sponsorAnalytics.title")}</h2>
              <p className="text-sm text-muted-foreground">
                {t("staffPortal.sponsorAnalytics.subtitle")}
              </p>
              <SponsorAnalyticsPanel eventId={eventId} role={staffRole} />
            </div>
          </TabsContent>
        </Tabs>
      ) : null}
    </div>
  );
}

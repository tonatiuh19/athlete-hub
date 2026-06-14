import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { format } from "date-fns";
import { Calendar, ExternalLink, LayoutDashboard, LayoutGrid, List, MapPin, Pencil, Plus, Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import MetaHelmet from "@/components/MetaHelmet";
import PortalErrorAlert from "@/components/athlete/PortalErrorAlert";
import StaffStatusBadge from "@/components/staff/StaffStatusBadge";
import StaffPaidEventPayoutAlert, {
  eventNeedsPayoutAlert,
} from "@/components/staff/StaffPaidEventPayoutAlert";
import StaffEventsCalendarView from "@/components/staff/StaffEventsCalendarView";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  clearEventDetail,
  fetchAdminEvents,
  fetchOrganizerEvents,
} from "@/store/slices/staffPortalSlice";
import { getDateFnsLocale } from "@/utils/dateLocale";
import { canOrganizerCreateEvents } from "@/utils/staffNav";

export default function StaffEvents() {
  const { t, i18n } = useTranslation();
  const dispatch = useAppDispatch();
  const { role, user } = useAppSelector((s) => s.staffAuth);
  const { events, loadingEvents, eventsError } = useAppSelector((s) => s.staffPortal);
  const [searchParams] = useSearchParams();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState(() => searchParams.get("status") || "all");
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");
  const [debounced, setDebounced] = useState("");
  const dateLocale = getDateFnsLocale(i18n.language);
  const isAdmin = role === "admin";
  const canCreate =
    isAdmin ||
    (user?.type === "organizer" && canOrganizerCreateEvents(user.role));

  useEffect(() => {
    dispatch(clearEventDetail());
  }, [dispatch]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(query.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (role !== "admin") return;
    dispatch(
      fetchAdminEvents({
        q: debounced,
        status: status === "all" ? undefined : status,
      }),
    );
  }, [dispatch, role, debounced, status]);

  useEffect(() => {
    if (role === "organizer") {
      dispatch(fetchOrganizerEvents());
    }
  }, [dispatch, role]);

  const reload = () => {
    if (isAdmin) {
      dispatch(
        fetchAdminEvents({
          q: debounced,
          status: status === "all" ? undefined : status,
        }),
      );
    } else {
      dispatch(fetchOrganizerEvents());
    }
  };

  const filteredOrganizerEvents = events.filter((e) => {
    if (role !== "organizer") return true;
    if (status !== "all" && e.status !== status) return false;
    if (!debounced) return true;
    const q = debounced.toLowerCase();
    return (
      e.title.toLowerCase().includes(q) || e.slug.toLowerCase().includes(q)
    );
  });

  const list = isAdmin ? events : filteredOrganizerEvents;
  const blockedPaymentEvents = list.filter((ev) => eventNeedsPayoutAlert(ev));

  return (
    <div className="max-w-6xl mx-auto w-full min-w-0 overflow-x-clip space-y-6">
      <MetaHelmet
        title={isAdmin ? t("staffPortal.events.titleAdmin") : t("staffPortal.events.titleOrganizer")}
        description={t("staffPortal.events.subtitle")}
      />
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Calendar className="w-7 h-7 text-cyan" />
          {isAdmin ? t("staffPortal.events.titleAdmin") : t("staffPortal.events.titleOrganizer")}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">{t("staffPortal.events.subtitle")}</p>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-col sm:flex-row gap-3 flex-1">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("staffPortal.events.searchPlaceholder")}
            className="pl-9"
          />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder={t("staffPortal.events.statusFilter")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("staffPortal.events.statusAll")}</SelectItem>
            <SelectItem value="draft">{t("staffPortal.events.statusDraft")}</SelectItem>
            <SelectItem value="pending_approval">
              {t("staffPortal.events.statusPendingApproval")}
            </SelectItem>
            <SelectItem value="published">{t("staffPortal.events.statusPublished")}</SelectItem>
            <SelectItem value="completed">{t("staffPortal.events.statusCompleted")}</SelectItem>
            <SelectItem value="cancelled">{t("staffPortal.events.statusCancelled")}</SelectItem>
          </SelectContent>
        </Select>
        <div className="inline-flex rounded-xl border border-border p-0.5 bg-card/50 shrink-0">
          <Button
            type="button"
            size="sm"
            variant={viewMode === "list" ? "default" : "ghost"}
            className="h-9 px-3 rounded-lg"
            onClick={() => setViewMode("list")}
            aria-pressed={viewMode === "list"}
          >
            <List className="w-4 h-4 sm:mr-1.5" />
            <span className="hidden sm:inline">{t("staffPortal.events.viewList")}</span>
          </Button>
          <Button
            type="button"
            size="sm"
            variant={viewMode === "calendar" ? "default" : "ghost"}
            className="h-9 px-3 rounded-lg"
            onClick={() => setViewMode("calendar")}
            aria-pressed={viewMode === "calendar"}
          >
            <LayoutGrid className="w-4 h-4 sm:mr-1.5" />
            <span className="hidden sm:inline">{t("staffPortal.events.viewCalendar")}</span>
          </Button>
        </div>
        </div>
        {isAdmin ? (
          <Button asChild type="button" className="shrink-0">
            <Link to="/staff/events/create">
              <Plus className="w-4 h-4 mr-2" />
              {t("staffPortal.events.createAdmin")}
            </Link>
          </Button>
        ) : null}
        {!isAdmin && canCreate ? (
          <Button asChild className="shrink-0">
            <Link to="/staff/events/new">
              <Plus className="w-4 h-4 mr-2" />
              {t("staffPortal.events.create")}
            </Link>
          </Button>
        ) : null}
      </div>

      <PortalErrorAlert error={eventsError} onRetry={reload} />

      {blockedPaymentEvents.length > 0 ? (
        <StaffPaidEventPayoutAlert isAdmin={isAdmin} />
      ) : null}

      {loadingEvents ? (
        <p className="text-muted-foreground">{t("common.loading")}</p>
      ) : eventsError ? null : list.length === 0 ? (
        <div className="card-sport p-8 text-center space-y-4">
          <p className="text-muted-foreground">{t("staffPortal.events.empty")}</p>
          {!isAdmin && canCreate ? (
            <Button asChild>
              <Link to="/staff/events/new">
                <Plus className="w-4 h-4 mr-2" />
                {t("staffPortal.events.create")}
              </Link>
            </Button>
          ) : null}
        </div>
      ) : viewMode === "calendar" ? (
        <StaffEventsCalendarView events={list} isAdmin={isAdmin} />
      ) : (
        <div className="space-y-3">
          {list.map((ev) => (
            <div
              key={ev.id}
              className="card-sport p-5 flex flex-col lg:flex-row lg:items-center gap-4 min-w-0"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="font-semibold truncate">{ev.title}</h2>
                  <StaffStatusBadge status={ev.status} />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {ev.sport_name}
                  {isAdmin && ev.organizer_name ? ` · ${ev.organizer_name}` : ""}
                </p>
                <p className="text-xs text-muted-foreground flex items-center gap-3 mt-2 flex-wrap">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    {format(new Date(ev.start_date), "d MMM yyyy", { locale: dateLocale })}
                  </span>
                  {ev.location_city ? (
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5" />
                      {ev.location_city}
                    </span>
                  ) : null}
                </p>
                {eventNeedsPayoutAlert(ev) ? (
                  <StaffPaidEventPayoutAlert isAdmin={isAdmin} compact className="mt-3" />
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 lg:flex-col lg:items-end lg:gap-3 shrink-0">
                <div className="text-right">
                  <div className="text-xl font-bold text-cyan">{ev.registration_count}</div>
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
                    {t("staffPortal.dashboard.registered")}
                  </div>
                </div>
                {ev.status === "published" ? (
                  <Link
                    to={`/events/${ev.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-cyan hover:underline"
                  >
                    {t("staffPortal.events.viewPublic")}
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Link>
                ) : null}
                <Link
                  to={`/staff/events/${ev.id}`}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-cyan hover:underline"
                >
                  <LayoutDashboard className="w-3.5 h-3.5" />
                  {t("staffPortal.events.manage")}
                </Link>
                <Link
                  to={`/staff/events/${ev.id}/edit`}
                  className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-cyan"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  {t("staffPortal.events.edit")}
                </Link>
                {!isAdmin ? (
                  <Link
                    to={`/staff/events/${ev.id}/results`}
                    className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-cyan"
                  >
                    {t("staffPortal.results.manage")}
                  </Link>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

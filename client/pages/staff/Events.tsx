import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { format } from "date-fns";
import {
  Calendar,
  ExternalLink,
  LayoutDashboard,
  LayoutGrid,
  List,
  MapPin,
  Pencil,
  Plus,
  Search,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import type { StaffEventRow } from "@shared/api";
import MetaHelmet from "@/components/MetaHelmet";
import PortalErrorAlert from "@/components/athlete/PortalErrorAlert";
import StaffStatusBadge from "@/components/staff/StaffStatusBadge";
import StaffPaidEventPayoutAlert, {
  eventNeedsPayoutAlert,
} from "@/components/staff/StaffPaidEventPayoutAlert";
import StaffEventsCalendarView from "@/components/staff/StaffEventsCalendarView";
import { DataGrid, type DataGridColumn } from "@/components/ui/data-grid";
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
import { useGridListState } from "@/hooks/useGridListState";
import { getDateFnsLocale, getNumberLocale } from "@/utils/dateLocale";
import { canOrganizerCreateEvents } from "@/utils/staffNav";
import { cn } from "@/lib/utils";

const FILTER_OPTIONS_LIMIT = 100;
const CALENDAR_LIMIT = 100;

export default function StaffEvents() {
  const { t, i18n } = useTranslation();
  const dispatch = useAppDispatch();
  const { role, user } = useAppSelector((s) => s.staffAuth);
  const { events, eventsPagination, loadingEvents, eventsError } = useAppSelector(
    (s) => s.staffPortal,
  );
  const [searchParams] = useSearchParams();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState(() => searchParams.get("status") || "all");
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");
  const [debounced, setDebounced] = useState("");
  const { page, setPage, sortBy, sortDir, onSort, gridParams } = useGridListState(
    "start_date",
    20,
  );
  const dateLocale = getDateFnsLocale(i18n.language);
  const numLocale = getNumberLocale(i18n.language);
  const isAdmin = role === "admin";
  const canCreate =
    isAdmin ||
    (user?.type === "organizer" && canOrganizerCreateEvents(user.role));

  useEffect(() => {
    dispatch(clearEventDetail());
  }, [dispatch]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebounced(query.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [query, setPage]);

  useEffect(() => {
    setPage(1);
  }, [status, setPage]);

  const listFilters = useMemo(
    () => ({
      q: debounced || undefined,
      status: status === "all" ? undefined : status,
    }),
    [debounced, status],
  );

  useEffect(() => {
    if (role !== "admin" && role !== "organizer") return;

    if (viewMode === "calendar") {
      const calendarParams = {
        ...listFilters,
        page: 1,
        limit: CALENDAR_LIMIT,
        sortBy: "start_date" as const,
        sortDir: "ASC" as const,
      };
      if (role === "admin") {
        void dispatch(fetchAdminEvents(calendarParams));
      } else {
        void dispatch(fetchOrganizerEvents(calendarParams));
      }
      return;
    }

    const params = {
      ...listFilters,
      ...gridParams,
    };
    if (role === "admin") {
      void dispatch(fetchAdminEvents(params));
    } else {
      void dispatch(fetchOrganizerEvents(params));
    }
  }, [dispatch, role, viewMode, listFilters, gridParams]);

  const reload = () => {
    if (isAdmin) {
      void dispatch(
        fetchAdminEvents({
          ...listFilters,
          ...(viewMode === "calendar"
            ? { page: 1, limit: CALENDAR_LIMIT, sortBy: "start_date", sortDir: "ASC" as const }
            : gridParams),
        }),
      );
    } else {
      void dispatch(
        fetchOrganizerEvents({
          ...listFilters,
          ...(viewMode === "calendar"
            ? { page: 1, limit: CALENDAR_LIMIT, sortBy: "start_date", sortDir: "ASC" as const }
            : gridParams),
        }),
      );
    }
  };

  const list = events;
  const blockedPaymentEvents = list.filter((ev) => eventNeedsPayoutAlert(ev));

  const columns = useMemo((): DataGridColumn<StaffEventRow>[] => {
    const cols: DataGridColumn<StaffEventRow>[] = [
      {
        key: "title",
        label: t("staffPortal.events.colTitle"),
        sortable: true,
        sticky: true,
        render: (ev) => (
          <div className="min-w-0 max-w-[220px] sm:max-w-xs">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold truncate">{ev.title}</span>
              <StaffStatusBadge status={ev.status} />
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
              {ev.sport_name}
              {isAdmin && ev.organizer_name ? ` · ${ev.organizer_name}` : ""}
            </p>
            {eventNeedsPayoutAlert(ev) ? (
              <StaffPaidEventPayoutAlert isAdmin={isAdmin} compact className="mt-2" />
            ) : null}
          </div>
        ),
      },
      {
        key: "start_date",
        label: t("staffPortal.events.colDate"),
        sortable: true,
        render: (ev) => (
          <span className="text-sm tabular-nums whitespace-nowrap">
            {format(new Date(ev.start_date), "d MMM yyyy", { locale: dateLocale })}
          </span>
        ),
      },
      {
        key: "location_city",
        label: t("staffPortal.events.colCity"),
        sortable: true,
        render: (ev) =>
          ev.location_city ? (
            <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
              <MapPin className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate max-w-[8rem]">{ev.location_city}</span>
            </span>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      {
        key: "registration_count",
        label: t("staffPortal.events.colRegistrations"),
        sortable: true,
        render: (ev) => (
          <span className="font-bold text-primary tabular-nums">
            {ev.registration_count.toLocaleString(numLocale)}
          </span>
        ),
      },
      {
        key: "actions",
        label: t("staffPortal.events.colActions"),
        shrink: true,
        render: (ev) => (
          <div className="flex flex-wrap items-center gap-2 justify-end">
            {ev.status === "published" ? (
              <Link
                to={`/events/${ev.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                {t("staffPortal.events.viewPublic")}
                <ExternalLink className="w-3 h-3" />
              </Link>
            ) : null}
            <Link
              to={`/staff/events/${ev.id}`}
              className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              <LayoutDashboard className="w-3 h-3" />
              {t("staffPortal.events.manage")}
            </Link>
            <Link
              to={`/staff/events/${ev.id}/edit`}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"
              onClick={(e) => e.stopPropagation()}
            >
              <Pencil className="w-3 h-3" />
              {t("staffPortal.events.edit")}
            </Link>
          </div>
        ),
      },
    ];

    if (isAdmin) {
      cols.splice(1, 0, {
        key: "organizer_name",
        label: t("staffPortal.events.colOrganizer"),
        sortable: true,
        render: (ev) => (
          <span className="text-sm truncate max-w-[10rem] block">
            {ev.organizer_name || "—"}
          </span>
        ),
      });
    }

    return cols;
  }, [t, isAdmin, dateLocale, numLocale]);

  return (
    <div className="max-w-6xl mx-auto w-full min-w-0 overflow-x-clip space-y-6">
      <MetaHelmet
        title={isAdmin ? t("staffPortal.events.titleAdmin") : t("staffPortal.events.titleOrganizer")}
        description={t("staffPortal.events.subtitle")}
      />
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Calendar className="w-7 h-7 text-primary" />
          {isAdmin ? t("staffPortal.events.titleAdmin") : t("staffPortal.events.titleOrganizer")}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">{t("staffPortal.events.subtitle")}</p>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-col sm:flex-row gap-3 flex-1 min-w-0">
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

      {viewMode === "calendar" ? (
        loadingEvents && list.length === 0 ? (
          <p className="text-muted-foreground">{t("common.loading")}</p>
        ) : eventsError ? null : list.length === 0 ? (
          <div className="card-sport p-8 text-center space-y-4">
            <p className="text-muted-foreground">{t("staffPortal.events.empty")}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {(eventsPagination?.total ?? 0) > CALENDAR_LIMIT ? (
              <p className="text-xs text-muted-foreground">
                {t("staffPortal.events.calendarCapHint", { limit: CALENDAR_LIMIT })}
              </p>
            ) : null}
            <StaffEventsCalendarView events={list} isAdmin={isAdmin} />
          </div>
        )
      ) : (
        <DataGrid<StaffEventRow>
          data={list}
          columns={columns}
          rowKey={(ev) => ev.id}
          sortBy={sortBy}
          sortDir={sortDir}
          onSort={onSort}
          pagination={eventsPagination}
          onPageChange={setPage}
          isLoading={loadingEvents}
          emptyMessage={t("staffPortal.events.empty")}
          mobileCard={(ev) => (
            <div className="card-sport p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="font-semibold truncate">{ev.title}</h2>
                    <StaffStatusBadge status={ev.status} />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {ev.sport_name}
                    {isAdmin && ev.organizer_name ? ` · ${ev.organizer_name}` : ""}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-lg font-bold text-primary tabular-nums">
                    {ev.registration_count.toLocaleString(numLocale)}
                  </div>
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
                    {t("staffPortal.dashboard.registered")}
                  </div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground flex items-center gap-3 flex-wrap">
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
                <StaffPaidEventPayoutAlert isAdmin={isAdmin} compact />
              ) : null}
              <div className="flex flex-wrap gap-3 pt-1">
                {ev.status === "published" ? (
                  <Link
                    to={`/events/${ev.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-primary"
                  >
                    {t("staffPortal.events.viewPublic")}
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Link>
                ) : null}
                <Link
                  to={`/staff/events/${ev.id}`}
                  className={cn(
                    "inline-flex items-center gap-1 text-xs font-semibold text-primary",
                  )}
                >
                  <LayoutDashboard className="w-3.5 h-3.5" />
                  {t("staffPortal.events.manage")}
                </Link>
                <Link
                  to={`/staff/events/${ev.id}/edit`}
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  {t("staffPortal.events.edit")}
                </Link>
              </div>
            </div>
          )}
        />
      )}
    </div>
  );
}

/** Prefer this limit when loading events for filter dropdowns in other staff panels. */
export const STAFF_EVENT_FILTER_OPTIONS_LIMIT = FILTER_OPTIONS_LIMIT;

import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { CheckCircle2, Download, Search, Upload, XCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import PortalErrorAlert from "@/components/athlete/PortalErrorAlert";
import StaffAddRegistrationDialog from "@/components/staff/StaffAddRegistrationDialog";
import StaffCheckInPanel from "@/components/staff/StaffCheckInPanel";
import StaffRegistrationDetailSheet from "@/components/staff/StaffRegistrationDetailSheet";
import StaffStatusBadge from "@/components/staff/StaffStatusBadge";
import { DataGrid, type DataGridColumn } from "@/components/ui/data-grid";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  fetchAdminEvents,
  fetchOrganizerEvents,
  fetchOrganizerRegistrations,
  fetchStaffEventDetail,
  assignRegistrationBib,
  bulkAssignBibs,
  cancelRegistration,
} from "@/store/slices/staffPortalSlice";
import { useGridListState } from "@/hooks/useGridListState";
import { getDateFnsLocale, getNumberLocale } from "@/utils/dateLocale";
import { downloadCsv } from "@/utils/exportCsv";
import type { OrganizerRegistrationRow, StaffRole } from "@shared/api";

interface StaffGlobalRegistrationsPanelProps {
  role: StaffRole;
  /** Load data when tab becomes visible (admin merged view) */
  active?: boolean;
}

export default function StaffGlobalRegistrationsPanel({
  role,
  active = true,
}: StaffGlobalRegistrationsPanelProps) {
  const { t, i18n } = useTranslation();
  const dispatch = useAppDispatch();
  const {
    registrations,
    registrationsPagination,
    events,
    eventDetail,
    loadingRegistrations,
    registrationsError,
    cancellingRegistration,
    importingBulkBibs,
    bulkBibResult,
    bulkBibError,
  } = useAppSelector((s) => s.staffPortal);
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [eventId, setEventId] = useState("all");
  const [bibDrafts, setBibDrafts] = useState<Record<number, string>>({});
  const [bulkCsv, setBulkCsv] = useState("");
  const [selectedRegistrationId, setSelectedRegistrationId] = useState<number | null>(null);
  const [selectedRegistrationEventId, setSelectedRegistrationEventId] = useState<number | null>(
    null,
  );
  const { page, setPage, sortBy, sortDir, onSort, gridParams } = useGridListState();
  const dateLocale = getDateFnsLocale(i18n.language);
  const numLocale = getNumberLocale(i18n.language);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebounced(query.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [query, setPage]);

  useEffect(() => {
    if (!active) return;
    if (role === "admin") dispatch(fetchAdminEvents({}));
    else dispatch(fetchOrganizerEvents());
  }, [dispatch, role, active]);

  useEffect(() => {
    if (!active || eventId === "all") return;
    dispatch(fetchStaffEventDetail({ eventId: Number(eventId), role }));
  }, [dispatch, role, active, eventId]);

  useEffect(() => {
    if (!active) return;
    dispatch(
      fetchOrganizerRegistrations({
        role,
        q: debounced,
        eventId: eventId === "all" ? undefined : Number(eventId),
        ...gridParams,
      }),
    );
  }, [dispatch, role, debounced, eventId, gridParams, active]);

  const reload = () =>
    dispatch(
      fetchOrganizerRegistrations({
        role,
        q: debounced,
        eventId: eventId === "all" ? undefined : Number(eventId),
        ...gridParams,
      }),
    );

  const handleExport = () => {
    downloadCsv(
      "registrations.csv",
      ["folio", "bib", "athlete", "email", "event", "category", "status", "total_mxn", "checked_in"],
      registrations.map((r) => [
        r.registration_number,
        r.bib_number ?? "",
        `${r.athlete_first_name} ${r.athlete_last_name}`,
        r.athlete_email ?? "",
        r.event_title,
        r.category_name,
        r.status,
        String(r.total_cents / 100),
        r.checked_in_at ? "yes" : "no",
      ]),
    );
  };

  const parseBulkBibCsv = (text: string) => {
    const lines = text.trim().split(/\r?\n/).filter(Boolean);
    if (lines.length === 0) return [];
    const header = lines[0].toLowerCase().split(",").map((h) => h.trim());
    const folioIdx = header.findIndex((h) =>
      ["folio", "registration_number", "registration"].includes(h),
    );
    const bibIdx = header.findIndex((h) => ["bib", "bib_number"].includes(h));
    const dataLines = folioIdx >= 0 ? lines.slice(1) : lines;
    const folioCol = folioIdx >= 0 ? folioIdx : 0;
    const bibCol = bibIdx >= 0 ? bibIdx : 1;
    return dataLines
      .map((line) => {
        const cols = line.split(",").map((c) => c.trim());
        return { folio: cols[folioCol] ?? "", bib: cols[bibCol] ?? "" };
      })
      .filter((r) => r.folio && r.bib);
  };

  const handleBulkBibImport = async () => {
    const rows = parseBulkBibCsv(bulkCsv);
    if (rows.length === 0) return;
    const result = await dispatch(
      bulkAssignBibs({
        rows,
        eventId: eventId === "all" ? undefined : Number(eventId),
        role,
      }),
    );
    if (bulkAssignBibs.fulfilled.match(result)) {
      setBulkCsv("");
      reload();
    }
  };

  const columns = useMemo((): DataGridColumn<OrganizerRegistrationRow>[] => {
    return [
      {
        key: "athlete_last_name",
        label: t("staffPortal.people.colAthlete"),
        sortable: true,
        sticky: true,
        render: (r) => (
          <div>
            <div className="font-medium">
              {r.athlete_first_name} {r.athlete_last_name}
            </div>
            <div className="text-xs text-muted-foreground">{r.athlete_email || "—"}</div>
          </div>
        ),
      },
      {
        key: "event_title",
        label: t("staffPortal.people.colEvent"),
        wrap: true,
      },
      {
        key: "registration_number",
        label: t("staffPortal.registrations.folio"),
        sortable: true,
        shrink: true,
      },
      {
        key: "category_name",
        label: t("staffPortal.people.colCategory"),
        sortable: true,
      },
      {
        key: "status",
        label: t("staffPortal.people.colStatus"),
        sortable: true,
        shrink: true,
        render: (r) => <StaffStatusBadge status={r.status} />,
      },
      {
        key: "total_cents",
        label: t("staffPortal.people.colTotal"),
        sortable: true,
        shrink: true,
        render: (r) => (
          <span className="font-semibold text-cyan">
            ${(r.total_cents / 100).toLocaleString(numLocale)}
          </span>
        ),
      },
      {
        key: "created_at",
        label: t("staffPortal.people.colRegistered"),
        sortable: true,
        shrink: true,
        render: (r) => format(new Date(r.created_at), "d MMM yyyy", { locale: dateLocale }),
      },
      {
        key: "actions",
        label: "",
        shrink: true,
        render: (r) => (
          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            <Input
              className="h-7 w-16 text-xs"
              placeholder="#"
              value={bibDrafts[r.id] ?? r.bib_number ?? ""}
              onChange={(e) => setBibDrafts((prev) => ({ ...prev, [r.id]: e.target.value }))}
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={() =>
                dispatch(
                  assignRegistrationBib({
                    registrationId: r.id,
                    eventId: r.event_id,
                    role,
                    bib_number: (bibDrafts[r.id] ?? r.bib_number ?? "").trim() || null,
                  }),
                )
              }
            >
              {t("staffPortal.registrations.saveBib")}
            </Button>
            {(r.status === "confirmed" || r.status === "pending_payment") && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7 text-xs text-destructive"
                disabled={cancellingRegistration}
                onClick={() => {
                  if (window.confirm(t("staffPortal.registrations.cancelConfirm"))) {
                    dispatch(
                      cancelRegistration({
                        registrationId: r.id,
                        eventId: r.event_id,
                        role,
                      }),
                    );
                  }
                }}
              >
                <XCircle className="w-3 h-3" />
              </Button>
            )}
          </div>
        ),
      },
    ];
  }, [t, numLocale, dateLocale, bibDrafts, dispatch, role, cancellingRegistration]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("staffPortal.registrations.searchPlaceholder")}
            className="pl-9"
          />
        </div>
        <Select
          value={eventId}
          onValueChange={(v) => {
            setEventId(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-full sm:w-56">
            <SelectValue placeholder={t("staffPortal.registrations.eventFilter")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("staffPortal.registrations.allEvents")}</SelectItem>
            {events.map((ev) => (
              <SelectItem key={ev.id} value={String(ev.id)}>
                {ev.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {eventId !== "all" && (eventDetail?.categories?.length ?? 0) > 0 ? (
          <StaffAddRegistrationDialog
            eventId={Number(eventId)}
            role={role}
            categories={eventDetail?.categories ?? []}
            onCreated={reload}
          />
        ) : events.length > 0 ? (
          <StaffAddRegistrationDialog role={role} events={events} onCreated={reload} />
        ) : null}
        <Button
          type="button"
          variant="outline"
          onClick={handleExport}
          disabled={registrations.length === 0}
          className="shrink-0"
        >
          <Download className="w-4 h-4 mr-2" />
          {t("staffPortal.registrations.exportCsv")}
        </Button>
      </div>

      {role === "organizer" ? <StaffCheckInPanel /> : null}

      <div className="card-sport p-5 space-y-3">
        <h2 className="font-semibold text-sm">{t("staffPortal.registrations.bulkBibTitle")}</h2>
        <Textarea
          value={bulkCsv}
          onChange={(e) => setBulkCsv(e.target.value)}
          placeholder="folio,bib"
          rows={3}
          className="font-mono text-xs"
        />
        {bulkBibError ? <p className="text-sm text-destructive">{bulkBibError}</p> : null}
        {bulkBibResult ? (
          <p className="text-sm text-emerald-500">
            {t("staffPortal.registrations.bulkBibSuccess", { count: bulkBibResult.updated })}
          </p>
        ) : null}
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={importingBulkBibs || !bulkCsv.trim()}
          onClick={handleBulkBibImport}
        >
          <Upload className="w-4 h-4 mr-2" />
          {t("staffPortal.registrations.bulkBibImport")}
        </Button>
      </div>

      <PortalErrorAlert error={registrationsError} onRetry={reload} />

      <div className="card-sport p-6">
        <DataGrid<OrganizerRegistrationRow>
          data={registrations}
          columns={columns}
          rowKey={(r) => r.id}
          sortBy={sortBy}
          sortDir={sortDir}
          onSort={onSort}
          pagination={registrationsPagination}
          onPageChange={setPage}
          isLoading={loadingRegistrations}
          emptyMessage={t("staffPortal.registrations.empty")}
          onRowClick={(r) => {
            setSelectedRegistrationId(r.id);
            setSelectedRegistrationEventId(r.event_id);
          }}
          noBleeding
          mobileCard={(r) => (
            <div className="card-sport p-4 space-y-2">
              <div className="font-semibold">
                {r.athlete_first_name} {r.athlete_last_name}
              </div>
              <div className="text-xs text-muted-foreground">{r.event_title}</div>
              <StaffStatusBadge status={r.status} />
            </div>
          )}
        />
      </div>

      {selectedRegistrationEventId != null ? (
        <StaffRegistrationDetailSheet
          eventId={selectedRegistrationEventId}
          registrationId={selectedRegistrationId}
          role={role}
          open={selectedRegistrationId != null}
          onOpenChange={(open) => {
            if (!open) {
              setSelectedRegistrationId(null);
              setSelectedRegistrationEventId(null);
            }
          }}
          allowRefund={role === "admin"}
        />
      ) : null}
    </div>
  );
}

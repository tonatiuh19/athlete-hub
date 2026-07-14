import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { CheckCircle2, Download, Search, Upload, XCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import PortalErrorAlert from "@/components/athlete/PortalErrorAlert";
import StaffAddRegistrationDialog from "@/components/staff/StaffAddRegistrationDialog";
import StaffCheckInPanel from "@/components/staff/StaffCheckInPanel";
import StaffEventSearchPicker from "@/components/staff/StaffEventSearchPicker";
import StaffRegistrationDetailSheet from "@/components/staff/StaffRegistrationDetailSheet";
import StaffRegistrationExportDialog from "@/components/staff/StaffRegistrationExportDialog";
import StaffStatusBadge from "@/components/staff/StaffStatusBadge";
import { DataGrid, type DataGridColumn } from "@/components/ui/data-grid";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  fetchAdminEvents,
  fetchOrganizerEvents,
  fetchOrganizerRegistrations,
  fetchStaffEventDetail,
  bulkAssignBibs,
  cancelRegistration,
} from "@/store/slices/staffPortalSlice";
import { useGridListState } from "@/hooks/useGridListState";
import { getDateFnsLocale, getNumberLocale } from "@/utils/dateLocale";
import { downloadCsv } from "@/utils/exportCsv";
import { canRefundStaffPayments, canStaffManageRegistrations } from "@/utils/staffNav";
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
  const { user } = useAppSelector((s) => s.staffAuth);
  const canRefund = canRefundStaffPayments(role === "admin", user?.type === "organizer" ? user.role : undefined);
  const canOps = canStaffManageRegistrations(
    role === "admin",
    user?.type === "organizer" ? user.role : undefined,
  );
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [eventId, setEventId] = useState("all");
  const eventBibMode = eventDetail?.event?.bib_mode === "separate" ? "separate" : "folio";
  const folioEqualsBib = eventBibMode === "folio" && eventId !== "all";
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
    if (role === "admin") dispatch(fetchAdminEvents({ limit: 100, sortBy: "title", sortDir: "ASC" }));
    else dispatch(fetchOrganizerEvents({ limit: 100, sortBy: "title", sortDir: "ASC" }));
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

  const bulkBibEventId = eventId === "all" ? null : Number(eventId);
  const missingBibCount =
    bulkBibEventId != null &&
    eventDetail?.event?.id === bulkBibEventId &&
    eventBibMode === "separate"
      ? registrations.filter(
          (r) =>
            r.status === "confirmed" &&
            !(r.bib_number && String(r.bib_number).trim()),
        ).length
      : 0;

  const handleBulkBibImport = async () => {
    if (bulkBibEventId == null) return;
    const rows = parseBulkBibCsv(bulkCsv);
    if (rows.length === 0) return;
    const result = await dispatch(
      bulkAssignBibs({
        rows,
        eventId: bulkBibEventId,
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
            {r.is_managed_participant || r.guest_claim_pending ? (
              <div className="flex flex-wrap gap-1 mt-1">
                {r.is_managed_participant ? (
                  <span className="text-[10px] uppercase tracking-wide font-semibold px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                    {t("registrationWallet.badgeManaged")}
                  </span>
                ) : null}
                {r.guest_claim_pending ? (
                  <span className="text-[10px] uppercase tracking-wide font-semibold px-1.5 py-0.5 rounded bg-primary/15 text-primary">
                    {t("registrationWallet.badgeUnclaimed")}
                  </span>
                ) : null}
              </div>
            ) : null}
            {r.purchaser_first_name && r.purchaser_athlete_id ? (
              <div className="text-[10px] text-muted-foreground mt-0.5">
                {t("staffPortal.registrations.boughtBy")}: {r.purchaser_first_name}{" "}
                {r.purchaser_last_name}
              </div>
            ) : null}
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
          <span className="font-semibold text-primary">
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
        key: "bib_number",
        label: t("staffPortal.registrations.bib"),
        shrink: true,
        render: (r) => {
          const display = folioEqualsBib
            ? r.bib_number || r.registration_number
            : r.bib_number || "—";
          return <span className="font-mono text-xs">{display}</span>;
        },
      },
      {
        key: "actions",
        label: "",
        shrink: true,
        render: (r) =>
          canOps && (r.status === "confirmed" || r.status === "pending_payment") ? (
            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
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
            </div>
          ) : null,
      },
    ];
  }, [
    t,
    numLocale,
    dateLocale,
    dispatch,
    role,
    cancellingRegistration,
    canOps,
    folioEqualsBib,
  ]);

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
        <StaffEventSearchPicker
          events={events}
          value={eventId}
          onChange={(v) => {
            setEventId(v);
            setPage(1);
          }}
          allowAll
        />
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
        {eventId !== "all" ? (
          <StaffRegistrationExportDialog
            eventId={Number(eventId)}
            role={role}
            searchQuery={debounced}
          />
        ) : (
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
        )}
      </div>

      {role === "organizer" ? (
        <StaffCheckInPanel
          eventId={bulkBibEventId ?? undefined}
        />
      ) : null}

      {missingBibCount > 0 ? (
        <div className="rounded-xl border border-primary/30 bg-primary/10 px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground">
              {t("staffPortal.eventEdit.bibMode.missingBibsTitle", { count: missingBibCount })}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {t("staffPortal.eventEdit.bibMode.missingBibsHint")}
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="shrink-0"
            onClick={() => {
              document
                .getElementById("staff-bulk-bib-import")
                ?.scrollIntoView({ behavior: "smooth", block: "center" });
            }}
          >
            <Upload className="w-4 h-4 mr-1.5" />
            {t("staffPortal.eventEdit.bibMode.missingBibsImport")}
          </Button>
        </div>
      ) : null}

      <div id="staff-bulk-bib-import" className="card-sport p-5 space-y-3">
        <h2 className="font-semibold text-sm">{t("staffPortal.registrations.bulkBibTitle")}</h2>
        {bulkBibEventId == null ? (
          <p className="text-xs text-muted-foreground">
            {t("staffPortal.registrations.bulkBibSelectEvent")}
          </p>
        ) : null}
        {bulkBibEventId != null && eventBibMode === "folio" ? (
          <p className="text-xs rounded-lg border border-border/70 bg-muted/30 px-3 py-2 text-muted-foreground">
            {t("staffPortal.eventEdit.bibMode.importOverrideHint")}
          </p>
        ) : null}
        <Textarea
          value={bulkCsv}
          onChange={(e) => setBulkCsv(e.target.value)}
          placeholder="folio,bib"
          rows={3}
          className="font-mono text-xs"
        />
        {bulkBibError ? <p className="text-sm text-destructive">{bulkBibError}</p> : null}
        {bulkBibResult ? (
          <p className="text-sm text-accent">
            {t("staffPortal.registrations.bulkBibSuccess", { count: bulkBibResult.updated })}
          </p>
        ) : null}
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={importingBulkBibs || !bulkCsv.trim() || bulkBibEventId == null}
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
            if (eventDetail?.event?.id !== r.event_id) {
              dispatch(fetchStaffEventDetail({ eventId: r.event_id, role }));
            }
          }}
          noBleeding
          mobileCard={(r) => (
            <div className="card-sport p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-semibold truncate">
                    {r.athlete_first_name} {r.athlete_last_name}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">{r.event_title}</div>
                  <div className="text-xs font-mono text-primary mt-1">
                    {r.registration_number}
                    {r.bib_number || r.registration_number
                      ? ` · ${r.bib_number || r.registration_number}`
                      : ""}
                  </div>
                </div>
                <StaffStatusBadge status={r.status} />
              </div>
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
          allowRefund={canRefund}
          allowRegistrationOps={canOps}
          bibMode={
            eventDetail?.event?.id === selectedRegistrationEventId &&
            eventDetail.event.bib_mode === "separate"
              ? "separate"
              : "folio"
          }
          onChanged={reload}
        />
      ) : null}
    </div>
  );
}

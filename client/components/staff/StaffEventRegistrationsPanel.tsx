import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { CheckCircle2, Search, Upload, XCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import PortalErrorAlert from "@/components/athlete/PortalErrorAlert";
import StaffAddRegistrationDialog from "@/components/staff/StaffAddRegistrationDialog";
import StaffRegistrationDetailSheet from "@/components/staff/StaffRegistrationDetailSheet";
import StaffRegistrationExportDialog from "@/components/staff/StaffRegistrationExportDialog";
import StaffStatusBadge from "@/components/staff/StaffStatusBadge";
import { DataGrid, type DataGridColumn } from "@/components/ui/data-grid";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  bulkAssignBibs,
  cancelRegistration,
  fetchEventHubRegistrations,
  fetchEventHubSummary,
} from "@/store/slices/staffPortalSlice";
import { useGridListState } from "@/hooks/useGridListState";
import { getDateFnsLocale, getNumberLocale } from "@/utils/dateLocale";
import { canRefundStaffPayments, canStaffManageRegistrations } from "@/utils/staffNav";
import type { OrganizerRegistrationRow, StaffEventCategory, StaffRole } from "@shared/api";

interface StaffEventRegistrationsPanelProps {
  eventId: number;
  role: StaffRole;
  categories?: StaffEventCategory[];
}

export default function StaffEventRegistrationsPanel({
  eventId,
  role,
  categories = [],
}: StaffEventRegistrationsPanelProps) {
  const { t, i18n } = useTranslation();
  const dispatch = useAppDispatch();
  const {
    eventDetail,
    eventHubRegistrations,
    eventHubRegistrationsPagination,
    loadingEventHubRegistrations,
    eventHubRegistrationsError,
    cancellingRegistration,
    importingBulkBibs,
    bulkBibResult,
    bulkBibError,
  } = useAppSelector((s) => s.staffPortal);
  const eventBibMode =
    eventDetail?.event?.id === eventId && eventDetail.event.bib_mode === "separate"
      ? "separate"
      : "folio";
  const missingBibCount =
    eventBibMode === "separate"
      ? eventHubRegistrations.filter(
          (r) =>
            r.status === "confirmed" &&
            !(r.bib_number && String(r.bib_number).trim()),
        ).length
      : 0;
  const { user } = useAppSelector((s) => s.staffAuth);
  const canRefund = canRefundStaffPayments(role === "admin", user?.type === "organizer" ? user.role : undefined);
  const canOps = canStaffManageRegistrations(
    role === "admin",
    user?.type === "organizer" ? user.role : undefined,
  );
  const folioEqualsBib = eventBibMode === "folio";
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [bulkCsv, setBulkCsv] = useState("");
  const [selectedRegistrationId, setSelectedRegistrationId] = useState<number | null>(null);
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
    dispatch(
      fetchEventHubRegistrations({
        eventId,
        role,
        q: debounced,
        ...gridParams,
      }),
    );
  }, [dispatch, eventId, role, debounced, gridParams]);

  const reload = () =>
    dispatch(
      fetchEventHubRegistrations({
        eventId,
        role,
        q: debounced,
        ...gridParams,
      }),
    );

  const refreshSummary = () => dispatch(fetchEventHubSummary({ eventId, role }));

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
    const result = await dispatch(bulkAssignBibs({ rows, eventId, role }));
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
        key: "bib_number",
        label: t("staffPortal.registrations.bib"),
        sortable: true,
        shrink: true,
        render: (r) => (
          <span className="font-mono text-xs">
            {folioEqualsBib
              ? r.bib_number || r.registration_number
              : r.bib_number || "—"}
          </span>
        ),
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
        key: "waiver_signed_at",
        label: t("staffPortal.registrations.colWaiver"),
        sortable: true,
        shrink: true,
        render: (r) =>
          r.waiver_outdated ? (
            <span className="text-xs text-destructive font-medium">
              {t("staffPortal.registrations.waiverOutdated")}
            </span>
          ) : r.waiver_signed_at ? (
            <span className="text-xs text-accent font-medium">{t("common.yes")}</span>
          ) : (
            <span className="text-xs text-muted-foreground">{t("common.no")}</span>
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
        key: "checked_in_at",
        label: t("staffPortal.people.colCheckIn"),
        shrink: true,
        render: (r) =>
          r.checked_in_at ? (
            <CheckCircle2
              className="w-4 h-4 text-accent"
              aria-label={t("staffPortal.registrations.checkedIn")}
            />
          ) : (
            "—"
          ),
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
                    dispatch(cancelRegistration({ registrationId: r.id, eventId, role })).then(() =>
                      refreshSummary(),
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
    eventId,
    role,
    cancellingRegistration,
    refreshSummary,
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
        {categories.length > 0 ? (
          <StaffAddRegistrationDialog
            eventId={eventId}
            role={role}
            categories={categories}
            onCreated={() => {
              reload();
              refreshSummary();
            }}
          />
        ) : null}
        <StaffRegistrationExportDialog
          eventId={eventId}
          role={role}
          searchQuery={debounced}
        />
      </div>

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
                .getElementById("staff-event-bulk-bib-import")
                ?.scrollIntoView({ behavior: "smooth", block: "center" });
            }}
          >
            <Upload className="w-4 h-4 mr-1.5" />
            {t("staffPortal.eventEdit.bibMode.missingBibsImport")}
          </Button>
        </div>
      ) : null}

      <div id="staff-event-bulk-bib-import" className="card-sport p-5 space-y-3">
        <h2 className="font-semibold text-sm">{t("staffPortal.registrations.bulkBibTitle")}</h2>
        <p className="text-xs text-muted-foreground">{t("staffPortal.registrations.bulkBibHint")}</p>
        {eventBibMode === "folio" ? (
          <p className="text-xs rounded-lg border border-border/70 bg-muted/30 px-3 py-2 text-muted-foreground">
            {t("staffPortal.eventEdit.bibMode.importOverrideHint")}
          </p>
        ) : null}
        <Textarea
          value={bulkCsv}
          onChange={(e) => setBulkCsv(e.target.value)}
          placeholder="folio,bib&#10;REG-001,101"
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
          disabled={importingBulkBibs || !bulkCsv.trim()}
          onClick={handleBulkBibImport}
        >
          <Upload className="w-4 h-4 mr-2" />
          {importingBulkBibs ? t("common.loading") : t("staffPortal.registrations.bulkBibImport")}
        </Button>
      </div>

      <PortalErrorAlert error={eventHubRegistrationsError} onRetry={reload} />

      <div className="card-sport p-6">
        <DataGrid<OrganizerRegistrationRow>
          data={eventHubRegistrations}
          columns={columns}
          rowKey={(r) => r.id}
          sortBy={sortBy}
          sortDir={sortDir}
          onSort={onSort}
          pagination={eventHubRegistrationsPagination}
          onPageChange={setPage}
          isLoading={loadingEventHubRegistrations}
          emptyMessage={t("staffPortal.registrations.empty")}
          onRowClick={(r) => setSelectedRegistrationId(r.id)}
          noBleeding
          mobileCard={(r) => (
            <div className="card-sport p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-semibold truncate">
                    {r.athlete_first_name} {r.athlete_last_name}
                  </div>
                  <div className="text-xs font-mono text-primary mt-1">
                    {r.registration_number}
                    {folioEqualsBib || r.bib_number
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

      <StaffRegistrationDetailSheet
        eventId={eventId}
        registrationId={selectedRegistrationId}
        role={role}
        open={selectedRegistrationId != null}
        onOpenChange={(open) => !open && setSelectedRegistrationId(null)}
        allowRefund={canRefund}
        allowRegistrationOps={canOps}
        bibMode={eventBibMode}
        onChanged={() => {
          reload();
          refreshSummary();
        }}
      />
    </div>
  );
}

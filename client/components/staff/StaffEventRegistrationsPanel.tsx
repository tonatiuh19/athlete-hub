import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { CheckCircle2, Download, Search, Upload, XCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import PortalErrorAlert from "@/components/athlete/PortalErrorAlert";
import StaffAddRegistrationDialog from "@/components/staff/StaffAddRegistrationDialog";
import StaffRegistrationDetailSheet from "@/components/staff/StaffRegistrationDetailSheet";
import StaffStatusBadge from "@/components/staff/StaffStatusBadge";
import { DataGrid, type DataGridColumn } from "@/components/ui/data-grid";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  assignRegistrationBib,
  bulkAssignBibs,
  cancelRegistration,
  fetchEventHubRegistrations,
  fetchEventHubSummary,
} from "@/store/slices/staffPortalSlice";
import { useGridListState } from "@/hooks/useGridListState";
import { getDateFnsLocale, getNumberLocale } from "@/utils/dateLocale";
import { downloadCsv } from "@/utils/exportCsv";
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
    eventHubRegistrations,
    eventHubRegistrationsPagination,
    loadingEventHubRegistrations,
    eventHubRegistrationsError,
    cancellingRegistration,
    importingBulkBibs,
    bulkBibResult,
    bulkBibError,
  } = useAppSelector((s) => s.staffPortal);
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [bibDrafts, setBibDrafts] = useState<Record<number, string>>({});
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

  const handleExport = () => {
    downloadCsv(
      "registrations.csv",
      ["folio", "bib", "athlete", "email", "category", "status", "total_mxn", "waiver", "checked_in"],
      eventHubRegistrations.map((r) => [
        r.registration_number,
        r.bib_number ?? "",
        `${r.athlete_first_name} ${r.athlete_last_name}`,
        r.athlete_email ?? "",
        r.category_name,
        r.status,
        String(r.total_cents / 100),
        r.waiver_signed_at ? "yes" : "no",
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
        label: t("staffPortal.registrations.bibPlaceholder"),
        sortable: true,
        shrink: true,
        render: (r) => (
          <Input
            className="h-8 w-20 text-xs"
            value={bibDrafts[r.id] ?? r.bib_number ?? ""}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => setBibDrafts((prev) => ({ ...prev, [r.id]: e.target.value }))}
          />
        ),
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
            <CheckCircle2 className="w-4 h-4 text-emerald-500" aria-label={t("staffPortal.registrations.checkedIn")} />
          ) : (
            "—"
          ),
      },
      {
        key: "actions",
        label: "",
        shrink: true,
        render: (r) => (
          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={() =>
                dispatch(
                  assignRegistrationBib({
                    registrationId: r.id,
                    eventId,
                    role,
                    bib_number: (bibDrafts[r.id] ?? r.bib_number ?? "").trim() || null,
                  }),
                )
              }
            >
              {t("staffPortal.registrations.saveBib")}
            </Button>
            {r.status === "confirmed" || r.status === "pending_payment" ? (
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
            ) : null}
          </div>
        ),
      },
    ];
  }, [
    t,
    bibDrafts,
    numLocale,
    dateLocale,
    dispatch,
    eventId,
    role,
    cancellingRegistration,
    refreshSummary,
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
        <Button
          type="button"
          variant="outline"
          onClick={handleExport}
          disabled={eventHubRegistrations.length === 0}
          className="shrink-0"
        >
          <Download className="w-4 h-4 mr-2" />
          {t("staffPortal.registrations.exportCsv")}
        </Button>
      </div>

      <div className="card-sport p-5 space-y-3">
        <h2 className="font-semibold text-sm">{t("staffPortal.registrations.bulkBibTitle")}</h2>
        <p className="text-xs text-muted-foreground">{t("staffPortal.registrations.bulkBibHint")}</p>
        <Textarea
          value={bulkCsv}
          onChange={(e) => setBulkCsv(e.target.value)}
          placeholder="folio,bib&#10;REG-001,101"
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
        />
      </div>

      <StaffRegistrationDetailSheet
        eventId={eventId}
        registrationId={selectedRegistrationId}
        role={role}
        open={selectedRegistrationId != null}
        onOpenChange={(open) => !open && setSelectedRegistrationId(null)}
        allowRefund={role === "admin"}
      />
    </div>
  );
}

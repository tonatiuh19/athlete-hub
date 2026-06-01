import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import PortalErrorAlert from "@/components/athlete/PortalErrorAlert";
import StaffAthleteDetailSheet from "@/components/staff/StaffAthleteDetailSheet";
import StaffStatusBadge from "@/components/staff/StaffStatusBadge";
import { DataGrid, type DataGridColumn } from "@/components/ui/data-grid";
import { Input } from "@/components/ui/input";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchAdminAthleteDetail, fetchAdminAthletes } from "@/store/slices/staffPortalSlice";
import { useGridListState } from "@/hooks/useGridListState";
import { getDateFnsLocale } from "@/utils/dateLocale";
import type { AdminAthleteRow } from "@shared/api";

export default function StaffAthletesAccountsPanel() {
  const { t, i18n } = useTranslation();
  const dispatch = useAppDispatch();
  const { athletes, athletesPagination, loadingAthletes, athletesError } = useAppSelector(
    (s) => s.staffPortal,
  );
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const { page, setPage, sortBy, sortDir, onSort, gridParams } = useGridListState("created_at");
  const dateLocale = getDateFnsLocale(i18n.language);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebounced(query.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [query, setPage]);

  useEffect(() => {
    dispatch(fetchAdminAthletes({ q: debounced, ...gridParams }));
  }, [dispatch, debounced, gridParams]);

  useEffect(() => {
    if (selectedId) dispatch(fetchAdminAthleteDetail({ athleteId: selectedId }));
  }, [dispatch, selectedId]);

  const reload = () => dispatch(fetchAdminAthletes({ q: debounced, ...gridParams }));

  const columns = useMemo((): DataGridColumn<AdminAthleteRow>[] => {
    return [
      {
        key: "last_name",
        label: t("staffPortal.athletes.colName"),
        sortable: true,
        sticky: true,
        render: (a) => (
          <span className="font-medium">
            {a.first_name} {a.last_name}
          </span>
        ),
      },
      {
        key: "email",
        label: t("staffPortal.athletes.colContact"),
        sortable: true,
        render: (a) => (
          <div className="text-muted-foreground">
            <div>{a.email || "—"}</div>
            {a.phone ? <div className="text-xs">{a.phone}</div> : null}
          </div>
        ),
      },
      {
        key: "city",
        label: t("staffPortal.athletes.colLocation"),
        render: (a) => [a.city, a.country].filter(Boolean).join(", ") || "—",
      },
      {
        key: "registration_count",
        label: t("staffPortal.athletes.colRegs"),
        sortable: true,
        shrink: true,
        render: (a) => <span className="font-semibold text-cyan">{a.registration_count}</span>,
      },
      {
        key: "status",
        label: t("staffPortal.athletes.colStatus"),
        sortable: true,
        shrink: true,
        render: (a) => <StaffStatusBadge status={a.status} />,
      },
      {
        key: "created_at",
        label: t("staffPortal.athletes.colJoined"),
        sortable: true,
        shrink: true,
        render: (a) => format(new Date(a.created_at), "d MMM yyyy", { locale: dateLocale }),
      },
    ];
  }, [t, dateLocale]);

  return (
    <div className="space-y-4">
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("staffPortal.athletes.searchPlaceholder")}
          className="pl-9"
        />
      </div>

      <PortalErrorAlert error={athletesError} onRetry={reload} />

      <div className="card-sport p-6">
        <DataGrid<AdminAthleteRow>
          data={athletes}
          columns={columns}
          rowKey={(a) => a.id}
          sortBy={sortBy}
          sortDir={sortDir}
          onSort={onSort}
          pagination={athletesPagination}
          onPageChange={setPage}
          isLoading={loadingAthletes}
          emptyMessage={t("staffPortal.athletes.empty")}
          onRowClick={(a) => setSelectedId(a.id)}
          noBleeding
        />
      </div>

      <StaffAthleteDetailSheet
        athleteId={selectedId}
        open={selectedId != null}
        onOpenChange={(open) => !open && setSelectedId(null)}
      />
    </div>
  );
}

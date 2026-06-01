import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import PortalErrorAlert from "@/components/athlete/PortalErrorAlert";
import StaffCreateOrganizerDialog from "@/components/staff/StaffCreateOrganizerDialog";
import StaffOrganizerDetailSheet from "@/components/staff/StaffOrganizerDetailSheet";
import StaffStatusBadge from "@/components/staff/StaffStatusBadge";
import { DataGrid, type DataGridColumn } from "@/components/ui/data-grid";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchStaffOrganizers } from "@/store/slices/staffPortalSlice";
import { useGridListState } from "@/hooks/useGridListState";
import { getDateFnsLocale } from "@/utils/dateLocale";
import type { AdminOrganizerRow } from "@shared/api";

interface StaffOrganizersPanelProps {
  active?: boolean;
}

export default function StaffOrganizersPanel({ active = true }: StaffOrganizersPanelProps) {
  const { t, i18n } = useTranslation();
  const dispatch = useAppDispatch();
  const { staffOrganizers, staffOrganizersPagination, loadingStaffOrganizers, staffOrganizersError } =
    useAppSelector((s) => s.staffPortal);
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [status, setStatus] = useState("all");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const { page, setPage, sortBy, sortDir, onSort, gridParams } = useGridListState("name");
  const dateLocale = getDateFnsLocale(i18n.language);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebounced(query.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [query, setPage]);

  useEffect(() => {
    if (!active) return;
    dispatch(
      fetchStaffOrganizers({
        q: debounced,
        status: status === "all" ? undefined : status,
        ...gridParams,
      }),
    );
  }, [dispatch, debounced, status, gridParams, active]);

  const reload = () =>
    dispatch(
      fetchStaffOrganizers({
        q: debounced,
        status: status === "all" ? undefined : status,
        ...gridParams,
      }),
    );

  const columns = useMemo((): DataGridColumn<AdminOrganizerRow>[] => {
    return [
      {
        key: "name",
        label: t("staffPortal.staffManagement.colOrgName"),
        sortable: true,
        sticky: true,
        render: (o) => (
          <div>
            <div className="font-medium">{o.name}</div>
            <div className="text-xs text-muted-foreground">{o.slug}</div>
          </div>
        ),
      },
      {
        key: "email",
        label: t("staffPortal.staffManagement.colOrgEmail"),
        sortable: true,
        render: (o) => o.email,
      },
      {
        key: "city",
        label: t("staffPortal.staffManagement.fieldCity"),
        sortable: true,
        render: (o) => [o.city, o.country].filter(Boolean).join(", ") || "—",
      },
      {
        key: "event_count",
        label: t("staffPortal.staffManagement.colEvents"),
        sortable: true,
        shrink: true,
        render: (o) => <span className="font-semibold text-cyan">{o.event_count ?? 0}</span>,
      },
      {
        key: "member_count",
        label: t("staffPortal.staffManagement.colMembers"),
        sortable: true,
        shrink: true,
        render: (o) => o.member_count ?? 0,
      },
      {
        key: "status",
        label: t("staffPortal.staffManagement.fieldStatus"),
        sortable: true,
        shrink: true,
        render: (o) => <StaffStatusBadge status={o.status} />,
      },
      {
        key: "created_at",
        label: t("staffPortal.staffManagement.colCreated"),
        sortable: true,
        shrink: true,
        render: (o) =>
          o.created_at
            ? format(new Date(o.created_at), "d MMM yyyy", { locale: dateLocale })
            : "—",
      },
    ];
  }, [t, dateLocale]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("staffPortal.staffManagement.searchOrganizers")}
            className="pl-9"
          />
        </div>
        <Select
          value={status}
          onValueChange={(v) => {
            setStatus(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("staffPortal.events.statusAll")}</SelectItem>
            {["pending", "active", "suspended", "inactive"].map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <StaffCreateOrganizerDialog onCreated={reload} />
      </div>

      <PortalErrorAlert error={staffOrganizersError} onRetry={reload} />

      <div className="card-sport p-6">
        <DataGrid<AdminOrganizerRow>
          data={staffOrganizers}
          columns={columns}
          rowKey={(o) => o.id}
          sortBy={sortBy}
          sortDir={sortDir}
          onSort={onSort}
          pagination={staffOrganizersPagination}
          onPageChange={setPage}
          isLoading={loadingStaffOrganizers}
          emptyMessage={t("staffPortal.staffManagement.emptyOrganizers")}
          onRowClick={(o) => setSelectedId(o.id)}
          noBleeding
        />
      </div>

      <StaffOrganizerDetailSheet
        organizerId={selectedId}
        open={selectedId != null}
        onOpenChange={(open) => !open && setSelectedId(null)}
      />
    </div>
  );
}

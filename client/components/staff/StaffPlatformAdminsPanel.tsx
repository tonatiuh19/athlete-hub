import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { Search, Shield } from "lucide-react";
import { useTranslation } from "react-i18next";
import PortalErrorAlert from "@/components/athlete/PortalErrorAlert";
import StaffCreateAdminDialog from "@/components/staff/StaffCreateAdminDialog";
import StaffStatusBadge from "@/components/staff/StaffStatusBadge";
import { DataGrid, type DataGridColumn } from "@/components/ui/data-grid";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchStaffAdmins, updateStaffAdmin } from "@/store/slices/staffPortalSlice";
import { useGridListState } from "@/hooks/useGridListState";
import { getDateFnsLocale } from "@/utils/dateLocale";
import type { AdminStaffRow } from "@shared/api";

interface StaffPlatformAdminsPanelProps {
  active?: boolean;
}

export default function StaffPlatformAdminsPanel({ active = true }: StaffPlatformAdminsPanelProps) {
  const { t, i18n } = useTranslation();
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((s) => s.staffAuth);
  const {
    staffAdmins,
    staffAdminsPagination,
    loadingStaffAdmins,
    staffAdminsError,
    staffAdminSaveError,
  } = useAppSelector((s) => s.staffPortal);
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const { page, setPage, sortBy, sortDir, onSort, gridParams } = useGridListState("created_at");
  const dateLocale = getDateFnsLocale(i18n.language);
  const isSuperAdmin = user?.type === "admin" && user.role === "super_admin";
  const isPlatformAdmin = user?.type === "admin";
  const currentAdmin = user?.type === "admin" ? user : null;

  const canManageAdminStatus = (target: AdminStaffRow) =>
    isPlatformAdmin &&
    target.id !== user?.id &&
    (isSuperAdmin || target.role !== "super_admin");

  const canManageAdminRole = (target: AdminStaffRow) =>
    isSuperAdmin && target.id !== user?.id;

  const displayAdmins = useMemo(() => {
    if (!currentAdmin) return staffAdmins;
    if (staffAdmins.some((a) => a.id === currentAdmin.id)) return staffAdmins;
    const selfRow: AdminStaffRow = {
      id: currentAdmin.id,
      email: currentAdmin.email,
      first_name: currentAdmin.firstName,
      last_name: currentAdmin.lastName,
      role: currentAdmin.role,
      status: "active",
      created_at: new Date().toISOString(),
    };
    return [selfRow, ...staffAdmins];
  }, [staffAdmins, currentAdmin]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebounced(query.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [query, setPage]);

  useEffect(() => {
    if (!active) return;
    dispatch(fetchStaffAdmins({ q: debounced, ...gridParams }));
  }, [dispatch, debounced, gridParams, active]);

  const reload = () => dispatch(fetchStaffAdmins({ q: debounced, ...gridParams }));

  const columns = useMemo((): DataGridColumn<AdminStaffRow>[] => {
    return [
      {
        key: "last_name",
        label: t("staffPortal.staffManagement.colAdminName"),
        sortable: true,
        sticky: true,
        render: (a) => (
          <span className="font-medium inline-flex items-center gap-2">
            {a.first_name} {a.last_name}
            {currentAdmin?.id === a.id ? (
              <Badge variant="secondary" className="text-xs font-normal">
                {t("staffPortal.staffManagement.youBadge")}
              </Badge>
            ) : null}
          </span>
        ),
      },
      {
        key: "email",
        label: t("staffPortal.team.colEmail"),
        sortable: true,
        render: (a) => a.email,
      },
      {
        key: "role",
        label: t("staffPortal.team.colRole"),
        sortable: true,
        shrink: true,
        render: (a) =>
          canManageAdminRole(a) ? (
            <Select
              value={a.role}
              onValueChange={(v) =>
                dispatch(updateStaffAdmin({ adminId: a.id, patch: { role: v as "admin" | "super_admin" } }))
              }
            >
              <SelectTrigger className="h-8 w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">admin</SelectItem>
                <SelectItem value="super_admin">super_admin</SelectItem>
              </SelectContent>
            </Select>
          ) : (
            <span className="capitalize">{a.role.replace("_", " ")}</span>
          ),
      },
      {
        key: "status",
        label: t("staffPortal.staffManagement.fieldStatus"),
        sortable: true,
        shrink: true,
        render: (a) =>
          canManageAdminStatus(a) ? (
            <Select
              value={a.status}
              onValueChange={(v) =>
                dispatch(
                  updateStaffAdmin({
                    adminId: a.id,
                    patch: { status: v as "active" | "inactive" | "suspended" },
                  }),
                )
              }
            >
              <SelectTrigger className="h-8 w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["active", "inactive", "suspended"].map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <StaffStatusBadge status={a.status} />
          ),
      },
      {
        key: "last_login_at",
        label: t("staffPortal.staffManagement.colLastLogin"),
        sortable: true,
        shrink: true,
        render: (a) =>
          a.last_login_at
            ? format(new Date(a.last_login_at), "d MMM yyyy", { locale: dateLocale })
            : "—",
      },
      {
        key: "created_at",
        label: t("staffPortal.staffManagement.colCreated"),
        sortable: true,
        shrink: true,
        render: (a) => format(new Date(a.created_at), "d MMM yyyy", { locale: dateLocale }),
      },
    ];
  }, [t, dateLocale, dispatch, isSuperAdmin, isPlatformAdmin, user?.id, currentAdmin?.id]);

  return (
    <div className="space-y-4">
      {currentAdmin ? (
        <div className="card-sport p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 border-cyan/20 bg-cyan/5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-cyan/15">
            <Shield className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              {t("staffPortal.staffManagement.currentUserTitle")}
            </p>
            <p className="font-semibold truncate">
              {currentAdmin.firstName} {currentAdmin.lastName}
            </p>
            <p className="text-sm text-muted-foreground truncate">{currentAdmin.email}</p>
          </div>
          <Badge variant="outline" className="capitalize shrink-0 self-start sm:self-center">
            {currentAdmin.role.replace("_", " ")}
          </Badge>
        </div>
      ) : null}

      {!isSuperAdmin ? (
        <p className="text-sm text-muted-foreground card-sport p-4">
          {t("staffPortal.staffManagement.adminRoleSuperOnly")}
        </p>
      ) : null}

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("staffPortal.staffManagement.searchAdmins")}
            className="pl-9"
          />
        </div>
        {isPlatformAdmin ? <StaffCreateAdminDialog isSuperAdmin={isSuperAdmin} onCreated={reload} /> : null}
      </div>

      <PortalErrorAlert error={staffAdminsError} onRetry={reload} />
      {staffAdminSaveError ? (
        <p className="text-sm text-destructive card-sport p-3">{staffAdminSaveError}</p>
      ) : null}

      <div className="card-sport p-6">
        <DataGrid<AdminStaffRow>
          data={displayAdmins}
          columns={columns}
          rowKey={(a) => a.id}
          sortBy={sortBy}
          sortDir={sortDir}
          onSort={onSort}
          pagination={staffAdminsPagination}
          onPageChange={setPage}
          isLoading={loadingStaffAdmins}
          emptyMessage={t("staffPortal.staffManagement.emptyAdmins")}
          noBleeding
        />
      </div>
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { ExternalLink, RotateCcw, Search } from "lucide-react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import PortalErrorAlert from "@/components/athlete/PortalErrorAlert";
import StaffStatusBadge from "@/components/staff/StaffStatusBadge";
import { DataGrid, type DataGridColumn } from "@/components/ui/data-grid";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchStaffPayments, refundStaffPayment } from "@/store/slices/staffPortalSlice";
import { useGridListState } from "@/hooks/useGridListState";
import { getDateFnsLocale, getNumberLocale } from "@/utils/dateLocale";
import { canRefundStaffPayments } from "@/utils/staffNav";
import type { AdminPaymentRow, StaffRole } from "@shared/api";

interface StaffPaymentsPanelProps {
  role: StaffRole;
  onSelectPayment?: (paymentId: number) => void;
  onSelectAthlete?: (athleteId: number) => void;
}

export default function StaffPaymentsPanel({
  role,
  onSelectPayment,
  onSelectAthlete,
}: StaffPaymentsPanelProps) {
  const { t, i18n } = useTranslation();
  const dispatch = useAppDispatch();
  const { staffPayments,
    staffPaymentsPagination,
    loadingStaffPayments,
    staffPaymentsError,
    refundingPayment,
  } = useAppSelector((s) => s.staffPortal);
  const { user } = useAppSelector((s) => s.staffAuth);
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [status, setStatus] = useState("all");
  const { page, setPage, sortBy, sortDir, onSort, gridParams } = useGridListState("created_at");
  const dateLocale = getDateFnsLocale(i18n.language);
  const numLocale = getNumberLocale(i18n.language);
  const isAdmin = role === "admin";
  const organizerRole = user?.type === "organizer" ? user.role : undefined;
  const canRefund = canRefundStaffPayments(isAdmin, organizerRole);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebounced(query.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [query, setPage]);

  useEffect(() => {
    dispatch(
      fetchStaffPayments({
        q: debounced,
        status: status === "all" ? undefined : status,
        role,
        ...gridParams,
      }),
    );
  }, [dispatch, debounced, status, gridParams, role]);

  const reload = () =>
    dispatch(
      fetchStaffPayments({
        q: debounced,
        status: status === "all" ? undefined : status,
        role,
        ...gridParams,
      }),
    );

  const handleRefund = (paymentId: number) => {
    if (!window.confirm(t("staffPortal.finance.refundConfirm"))) return;
    dispatch(refundStaffPayment({ paymentId, role })).then((result) => {
      if (refundStaffPayment.fulfilled.match(result)) reload();
    });
  };

  const columns = useMemo((): DataGridColumn<AdminPaymentRow>[] => {
    const cols: DataGridColumn<AdminPaymentRow>[] = [
      {
        key: "created_at",
        label: t("staffPortal.finance.colDate"),
        sortable: true,
        sticky: true,
        render: (p) => format(new Date(p.created_at), "d MMM yyyy", { locale: dateLocale }),
      },
      {
        key: "athlete_last_name",
        label: t("staffPortal.people.colAthlete"),
        render: (p) => (
          <div>
            {isAdmin && onSelectAthlete && p.athlete_id ? (
              <button
                type="button"
                className="font-medium text-left hover:text-cyan transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectAthlete(p.athlete_id);
                }}
              >
                {p.athlete_first_name} {p.athlete_last_name}
              </button>
            ) : (
              <div className="font-medium">
                {p.athlete_first_name} {p.athlete_last_name}
              </div>
            )}
            <div className="text-xs text-muted-foreground">{p.registration_number || "—"}</div>
          </div>
        ),
      },
      {
        key: "event_title",
        label: t("staffPortal.people.colEvent"),
        wrap: true,
        render: (p) =>
          p.event_id && p.event_title ? (
            <Link
              to={`/staff/events/${p.event_id}`}
              className="inline-flex items-center gap-1 hover:text-cyan transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              {p.event_title}
              <ExternalLink className="w-3 h-3 shrink-0 opacity-60" />
            </Link>
          ) : (
            "—"
          ),
      },
    ];

    if (isAdmin) {
      cols.push({
        key: "organizer_name",
        label: t("staffPortal.finance.colOrganizer"),
        wrap: true,
        render: (p) => p.organizer_name || "—",
      });
    }

    cols.push(
      {
        key: "amount_cents",
        label: t("staffPortal.finance.colAmount"),
        sortable: true,
        shrink: true,
        render: (p) => (
          <span className="font-semibold text-cyan">
            ${(p.amount_cents / 100).toLocaleString(numLocale)}
          </span>
        ),
      },
      {
        key: "status",
        label: t("staffPortal.finance.colStatus"),
        sortable: true,
        shrink: true,
        render: (p) => <StaffStatusBadge status={p.status} />,
      },
      {
        key: "provider",
        label: t("staffPortal.finance.colProvider"),
        shrink: true,
        render: (p) => <span className="capitalize">{p.provider}</span>,
      },
    );

    if (canRefund) {
      cols.push({
        key: "actions",
        label: "",
        shrink: true,
        render: (p) =>
          p.status === "succeeded" ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 text-xs text-destructive"
              disabled={refundingPayment}
              onClick={(e) => {
                e.stopPropagation();
                handleRefund(p.id);
              }}
            >
              <RotateCcw className="w-3 h-3 mr-1" />
              {t("staffPortal.finance.refund")}
            </Button>
          ) : null,
      });
    }

    return cols;
  }, [t, dateLocale, numLocale, refundingPayment, canRefund, onSelectAthlete, role]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("staffPortal.finance.searchPayments")}
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
            {["succeeded", "pending", "failed", "refunded", "partially_refunded"].map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <PortalErrorAlert error={staffPaymentsError} onRetry={reload} />

      <div className="card-sport p-6">
        <DataGrid<AdminPaymentRow>
          data={staffPayments}
          columns={columns}
          rowKey={(p) => p.id}
          sortBy={sortBy}
          sortDir={sortDir}
          onSort={onSort}
          pagination={staffPaymentsPagination}
          onPageChange={setPage}
          isLoading={loadingStaffPayments}
          emptyMessage={t("staffPortal.finance.emptyPayments")}
          noBleeding
          onRowClick={onSelectPayment ? (p) => onSelectPayment(p.id) : undefined}
        />
      </div>
    </div>
  );
}

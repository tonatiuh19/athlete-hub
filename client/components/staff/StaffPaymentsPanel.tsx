import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { ExternalLink, RotateCcw, Search, X } from "lucide-react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import PortalErrorAlert from "@/components/athlete/PortalErrorAlert";
import StaffStatusBadge from "@/components/staff/StaffStatusBadge";
import { DataGrid, type DataGridColumn } from "@/components/ui/data-grid";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  fetchOrganizerMembers,
  fetchStaffPayments,
  refundStaffPayment,
} from "@/store/slices/staffPortalSlice";
import { useGridListState } from "@/hooks/useGridListState";
import { getDateFnsLocale, getNumberLocale } from "@/utils/dateLocale";
import { canRefundStaffPayments, canViewAllStaffPayments } from "@/utils/staffNav";
import type { AdminPaymentRow, StaffRole } from "@shared/api";

interface StaffPaymentsPanelProps {
  role: StaffRole;
  sellerFilter?: string;
  onSellerFilterChange?: (value: string) => void;
  onSelectPayment?: (paymentId: number) => void;
  onSelectAthlete?: (athleteId: number) => void;
}

export default function StaffPaymentsPanel({
  role,
  sellerFilter: sellerFilterProp,
  onSellerFilterChange,
  onSelectPayment,
  onSelectAthlete,
}: StaffPaymentsPanelProps) {
  const { t, i18n } = useTranslation();
  const dispatch = useAppDispatch();
  const {
    staffPayments,
    staffPaymentsPagination,
    loadingStaffPayments,
    staffPaymentsError,
    refundingPayment,
    events,
    loadingEvents,
    teamMembers,
  } = useAppSelector((s) => s.staffPortal);
  const { user } = useAppSelector((s) => s.staffAuth);
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [status, setStatus] = useState("all");
  const [provider, setProvider] = useState("all");
  const [eventId, setEventId] = useState("all");
  const [internalSellerFilter, setInternalSellerFilter] = useState("all");
  const sellerFilter = sellerFilterProp ?? internalSellerFilter;
  const setSellerFilter = onSellerFilterChange ?? setInternalSellerFilter;
  const { page, setPage, sortBy, sortDir, onSort, gridParams } = useGridListState("created_at");
  const dateLocale = getDateFnsLocale(i18n.language);
  const numLocale = getNumberLocale(i18n.language);
  const isAdmin = role === "admin";
  const organizerRole = user?.type === "organizer" ? user.role : undefined;
  const canRefund = canRefundStaffPayments(isAdmin, organizerRole);
  const showSellerFilters = !isAdmin && canViewAllStaffPayments(isAdmin, organizerRole);

  useEffect(() => {
    if (isAdmin) {
      dispatch(fetchAdminEvents({}));
    } else {
      dispatch(fetchOrganizerEvents());
      if (showSellerFilters) {
        dispatch(fetchOrganizerMembers());
      }
    }
  }, [dispatch, isAdmin, showSellerFilters]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebounced(query.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [query, setPage]);

  const listParams = useMemo(
    () => ({
      q: debounced,
      status: status === "all" ? undefined : status,
      provider: provider === "all" ? undefined : provider,
      eventId: eventId === "all" ? undefined : Number(eventId),
      sellerFilter: showSellerFilters ? sellerFilter : undefined,
      role,
      ...gridParams,
    }),
    [
      debounced,
      status,
      provider,
      eventId,
      sellerFilter,
      showSellerFilters,
      role,
      gridParams,
    ],
  );

  useEffect(() => {
    dispatch(fetchStaffPayments(listParams));
  }, [dispatch, listParams]);

  const reload = () => dispatch(fetchStaffPayments(listParams));

  const handleRefund = (paymentId: number) => {
    if (!window.confirm(t("staffPortal.finance.refundConfirm"))) return;
    dispatch(refundStaffPayment({ paymentId, role })).then((result) => {
      if (refundStaffPayment.fulfilled.match(result)) reload();
    });
  };

  const sellerOptions = useMemo(() => {
    return teamMembers
      .filter((m) => m.status === "active")
      .sort((a, b) =>
        `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`),
      );
  }, [teamMembers]);

  const activeFilterChips = useMemo(() => {
    const chips: Array<{ key: string; label: string; onClear: () => void }> = [];
    if (eventId !== "all") {
      const ev = events.find((e) => String(e.id) === eventId);
      chips.push({
        key: "event",
        label: ev?.title ?? t("staffPortal.registrations.eventFilter"),
        onClear: () => {
          setEventId("all");
          setPage(1);
        },
      });
    }
    if (status !== "all") {
      chips.push({
        key: "status",
        label: status,
        onClear: () => {
          setStatus("all");
          setPage(1);
        },
      });
    }
    if (provider !== "all") {
      chips.push({
        key: "provider",
        label:
          provider === "manual"
            ? t("staffPortal.finance.providerManual")
            : provider === "mock"
              ? t("staffPortal.finance.providerMock")
              : provider,
        onClear: () => {
          setProvider("all");
          setPage(1);
        },
      });
    }
    if (showSellerFilters && sellerFilter !== "all") {
      if (sellerFilter === "online") {
        chips.push({
          key: "seller",
          label: t("staffPortal.finance.sellerOnline"),
          onClear: () => {
            setSellerFilter("all");
            setPage(1);
          },
        });
      } else {
        const member = sellerOptions.find((m) => String(m.id) === sellerFilter);
        chips.push({
          key: "seller",
          label: member
            ? `${member.first_name} ${member.last_name}`.trim()
            : t("staffPortal.finance.colSeller"),
          onClear: () => {
            setSellerFilter("all");
            setPage(1);
          },
        });
      }
    }
    return chips;
  }, [
    eventId,
    status,
    provider,
    sellerFilter,
    showSellerFilters,
    events,
    sellerOptions,
    t,
    setPage,
    setSellerFilter,
  ]);

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
                className="font-medium text-left hover:text-primary transition-colors"
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
              className="inline-flex items-center gap-1 hover:text-primary transition-colors"
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

    if (showSellerFilters) {
      cols.push({
        key: "seller_last_name",
        label: t("staffPortal.finance.colSeller"),
        wrap: true,
        render: (p) =>
          p.seller_first_name ? (
            <div>
              <p className="font-medium">
                {p.seller_first_name} {p.seller_last_name ?? ""}
              </p>
              {p.seller_email ? (
                <p className="text-xs text-muted-foreground">{p.seller_email}</p>
              ) : null}
            </div>
          ) : (
            <span className="text-muted-foreground">{t("staffPortal.finance.sellerOnline")}</span>
          ),
      });
    }

    cols.push(
      {
        key: "amount_cents",
        label: t("staffPortal.finance.colAmount"),
        sortable: true,
        shrink: true,
        render: (p) => (
          <div>
            <span className="font-semibold text-primary">
              ${(p.amount_cents / 100).toLocaleString(numLocale)}
            </span>
            {p.service_fee_cents > 0 ? (
              <p className="text-[11px] text-muted-foreground">
                {t("staffPortal.finance.serviceFee")}: $
                {(p.service_fee_cents / 100).toLocaleString(numLocale)}
              </p>
            ) : p.provider === "manual" ? (
              <p className="text-[11px] text-muted-foreground">
                {t("staffPortal.finance.manualSaleNoCommission")}
              </p>
            ) : null}
          </div>
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
        render: (p) => (
          <span className="capitalize">
            {p.provider === "manual"
              ? t("staffPortal.finance.providerManual")
              : p.provider === "mock"
                ? t("staffPortal.finance.providerMock")
                : p.provider}
          </span>
        ),
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
  }, [
    t,
    dateLocale,
    numLocale,
    refundingPayment,
    canRefund,
    showSellerFilters,
    onSelectAthlete,
    isAdmin,
  ]);

  const clearAllFilters = () => {
    setQuery("");
    setDebounced("");
    setStatus("all");
    setProvider("all");
    setEventId("all");
    setSellerFilter("all");
    setPage(1);
  };

  return (
    <div className="space-y-4">
      <div className="card-sport p-4 space-y-3">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="relative sm:col-span-2 xl:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("staffPortal.finance.searchPayments")}
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
            <SelectTrigger>
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
          <Select
            value={status}
            onValueChange={(v) => {
              setStatus(v);
              setPage(1);
            }}
          >
            <SelectTrigger>
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
          <Select
            value={provider}
            onValueChange={(v) => {
              setProvider(v);
              setPage(1);
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("staffPortal.finance.providerAll")}</SelectItem>
              <SelectItem value="manual">{t("staffPortal.finance.providerManual")}</SelectItem>
              <SelectItem value="stripe">Stripe</SelectItem>
              <SelectItem value="mock">{t("staffPortal.finance.providerMock")}</SelectItem>
            </SelectContent>
          </Select>
          {showSellerFilters ? (
            <Select
              value={sellerFilter}
              onValueChange={(v) => {
                setSellerFilter(v);
                setPage(1);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder={t("staffPortal.finance.sellerFilter")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("staffPortal.finance.sellerFilterAll")}</SelectItem>
                <SelectItem value="online">{t("staffPortal.finance.sellerOnline")}</SelectItem>
                {sellerOptions.map((member) => (
                  <SelectItem key={member.id} value={String(member.id)}>
                    {member.first_name} {member.last_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
        </div>
        {loadingEvents ? (
          <p className="text-xs text-muted-foreground">{t("common.loading")}</p>
        ) : null}
        {activeFilterChips.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2">
            {activeFilterChips.map((chip) => (
              <Badge key={chip.key} variant="secondary" className="gap-1 pr-1">
                {chip.label}
                <button
                  type="button"
                  className="rounded-full p-0.5 hover:bg-muted"
                  onClick={chip.onClear}
                  aria-label={t("common.datePicker.clear")}
                >
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            ))}
            <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={clearAllFilters}>
              {t("staffPortal.finance.clearFilters")}
            </Button>
          </div>
        ) : null}
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

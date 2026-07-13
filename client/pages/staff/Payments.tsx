import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { CreditCard } from "lucide-react";
import { useTranslation } from "react-i18next";
import MetaHelmet from "@/components/MetaHelmet";
import StaffAthleteDetailSheet from "@/components/staff/StaffAthleteDetailSheet";
import StaffManualSaleDialog from "@/components/staff/StaffManualSaleDialog";
import StaffPaymentDetailSheet from "@/components/staff/StaffPaymentDetailSheet";
import StaffPaymentsPanel from "@/components/staff/StaffPaymentsPanel";
import PortalErrorAlert from "@/components/athlete/PortalErrorAlert";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchSellerSalesSummary } from "@/store/slices/staffPortalSlice";
import {
  canOrganizerRecordManualSale,
  canRefundStaffPayments,
  canViewSellerSalesSummary,
  canViewStaffPayments,
} from "@/utils/staffNav";
import { getNumberLocale } from "@/utils/dateLocale";

export default function StaffPayments() {
  const { t, i18n } = useTranslation();
  const dispatch = useAppDispatch();
  const { role, user } = useAppSelector((s) => s.staffAuth);
  const {
    sellerSalesSummary,
    loadingSellerSalesSummary,
    sellerSalesSummaryError,
  } = useAppSelector((s) => s.staffPortal);
  const [selectedPaymentId, setSelectedPaymentId] = useState<number | null>(null);
  const [paymentSheetOpen, setPaymentSheetOpen] = useState(false);
  const [selectedAthleteId, setSelectedAthleteId] = useState<number | null>(null);
  const [athleteSheetOpen, setAthleteSheetOpen] = useState(false);
  const [paymentsReloadKey, setPaymentsReloadKey] = useState(0);
  const [sellerFilter, setSellerFilter] = useState("all");

  const organizerRole = user?.type === "organizer" ? user.role : undefined;
  const canAccess = canViewStaffPayments(role === "admin", organizerRole);
  const canRefund = canRefundStaffPayments(role === "admin", organizerRole);
  const canManualSale =
    role === "organizer" && canOrganizerRecordManualSale(organizerRole ?? "");
  const showSellerSummary = canViewSellerSalesSummary(role === "admin", organizerRole);
  const numLocale = getNumberLocale(i18n.language);

  useEffect(() => {
    if (showSellerSummary) {
      dispatch(fetchSellerSalesSummary());
    }
  }, [dispatch, showSellerSummary, paymentsReloadKey]);

  if (!canAccess || !role) {
    return <Navigate to="/staff" replace />;
  }

  const openPayment = (paymentId: number) => {
    setSelectedPaymentId(paymentId);
    setPaymentSheetOpen(true);
  };

  const openAthlete = (athleteId: number) => {
    setSelectedAthleteId(athleteId);
    setAthleteSheetOpen(true);
  };

  const handleManualSaleCreated = () => {
    setPaymentsReloadKey((k) => k + 1);
    if (showSellerSummary) dispatch(fetchSellerSalesSummary());
  };

  return (
    <div className="max-w-6xl mx-auto w-full min-w-0 overflow-x-clip space-y-6">
      <MetaHelmet
        title={t("staffPortal.finance.title")}
        description={t("staffPortal.finance.subtitle")}
      />
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <CreditCard className="w-7 h-7 text-primary" />
            {t("staffPortal.finance.title")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{t("staffPortal.finance.subtitle")}</p>
        </div>
        {canManualSale ? (
          <StaffManualSaleDialog role={role} onCreated={handleManualSaleCreated} />
        ) : null}
      </div>

      {showSellerSummary ? (
        <div className="card-sport p-6 space-y-4">
          <div>
            <h2 className="font-semibold">{t("staffPortal.finance.sellerSummaryTitle")}</h2>
            <p className="text-sm text-muted-foreground">
              {t("staffPortal.finance.sellerSummarySubtitle")}
            </p>
          </div>
          <PortalErrorAlert
            error={sellerSalesSummaryError}
            onRetry={() => dispatch(fetchSellerSalesSummary())}
          />
          {loadingSellerSalesSummary ? (
            <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
          ) : sellerSalesSummary ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-border/70 p-4">
                  <p className="text-xs text-muted-foreground">
                    {t("staffPortal.finance.manualSalesTotal")}
                  </p>
                  <p className="text-2xl font-bold text-primary">
                    ${(sellerSalesSummary.manual_sale_total_cents / 100).toLocaleString(numLocale)}
                  </p>
                </div>
                <div className="rounded-xl border border-border/70 p-4">
                  <p className="text-xs text-muted-foreground">
                    {t("staffPortal.finance.manualSalesCount")}
                  </p>
                  <p className="text-2xl font-bold">{sellerSalesSummary.manual_sale_count}</p>
                </div>
              </div>
              {sellerSalesSummary.sellers.length > 0 ? (
                <div className="overflow-x-auto">
                  <p className="text-xs text-muted-foreground mb-2">
                    {t("staffPortal.finance.sellerSummaryFilterHint")}
                  </p>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-muted-foreground">
                        <th className="p-3 font-medium">{t("staffPortal.finance.colSeller")}</th>
                        <th className="p-3 font-medium">{t("staffPortal.finance.colSales")}</th>
                        <th className="p-3 font-medium">{t("staffPortal.finance.colAmount")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sellerSalesSummary.sellers.map((seller) => (
                        <tr
                          key={seller.member_id}
                          className="border-b border-border/60 cursor-pointer hover:bg-muted/40 transition-colors"
                          onClick={() => setSellerFilter(String(seller.member_id))}
                        >
                          <td className="p-3">
                            <p className="font-medium">
                              {seller.first_name} {seller.last_name}
                            </p>
                            <p className="text-xs text-muted-foreground">{seller.email}</p>
                          </td>
                          <td className="p-3">{seller.sale_count}</td>
                          <td className="p-3 font-semibold text-primary">
                            ${(seller.total_cents / 100).toLocaleString(numLocale)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {t("staffPortal.finance.sellerSummaryEmpty")}
                </p>
              )}
            </>
          ) : null}
        </div>
      ) : null}

      <StaffPaymentsPanel
        key={paymentsReloadKey}
        role={role}
        sellerFilter={sellerFilter}
        onSellerFilterChange={setSellerFilter}
        onSelectPayment={openPayment}
        onSelectAthlete={role === "admin" ? openAthlete : undefined}
      />

      <StaffPaymentDetailSheet
        paymentId={selectedPaymentId}
        role={role}
        open={paymentSheetOpen}
        onOpenChange={setPaymentSheetOpen}
        onViewAthlete={role === "admin" ? openAthlete : undefined}
        allowRefund={canRefund}
      />

      {role === "admin" ? (
        <StaffAthleteDetailSheet
          athleteId={selectedAthleteId}
          open={athleteSheetOpen}
          onOpenChange={setAthleteSheetOpen}
        />
      ) : null}
    </div>
  );
}

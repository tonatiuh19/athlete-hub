import { useEffect } from "react";
import { format } from "date-fns";
import { CalendarDays, CreditCard, ExternalLink, Loader2, RotateCcw, User } from "lucide-react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import StaffStatusBadge from "@/components/staff/StaffStatusBadge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  clearStaffPaymentDetail,
  fetchStaffPaymentDetail,
  refundStaffPayment,
} from "@/store/slices/staffPortalSlice";
import { getDateFnsLocale, getNumberLocale } from "@/utils/dateLocale";
import type { StaffRole } from "@shared/api";

interface StaffPaymentDetailSheetProps {
  paymentId: number | null;
  role: StaffRole;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onViewAthlete?: (athleteId: number) => void;
  allowRefund?: boolean;
}

export default function StaffPaymentDetailSheet({
  paymentId,
  role,
  open,
  onOpenChange,
  onViewAthlete,
  allowRefund = role === "admin",
}: StaffPaymentDetailSheetProps) {
  const { t, i18n } = useTranslation();
  const dispatch = useAppDispatch();
  const {
    staffPaymentDetail,
    loadingStaffPaymentDetail,
    staffPaymentDetailError,
    refundingPayment,
    refundPaymentError,
  } = useAppSelector((s) => s.staffPortal);
  const dateLocale = getDateFnsLocale(i18n.language);
  const numLocale = getNumberLocale(i18n.language);

  useEffect(() => {
    if (open && paymentId) {
      dispatch(fetchStaffPaymentDetail({ paymentId, role }));
    }
  }, [dispatch, open, paymentId, role]);

  const handleOpen = (next: boolean) => {
    if (!next) dispatch(clearStaffPaymentDetail());
    onOpenChange(next);
  };

  const payment = staffPaymentDetail;

  const handleRefund = () => {
    if (!payment || !window.confirm(t("staffPortal.finance.refundConfirm"))) return;
    dispatch(refundStaffPayment({ paymentId: payment.id, role }));
  };

  return (
    <Sheet open={open} onOpenChange={handleOpen}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{t("staffPortal.finance.detailTitle")}</SheetTitle>
          <SheetDescription>{t("staffPortal.finance.detailSubtitle")}</SheetDescription>
        </SheetHeader>

        {loadingStaffPaymentDetail ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : staffPaymentDetailError ? (
          <p className="text-sm text-destructive py-6">{staffPaymentDetailError}</p>
        ) : payment ? (
          <div className="space-y-6 py-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-2xl font-bold text-primary">
                  ${(payment.amount_cents / 100).toLocaleString(numLocale)} {payment.currency}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {format(new Date(payment.created_at), "d MMM yyyy, HH:mm", { locale: dateLocale })}
                </p>
              </div>
              <StaffStatusBadge status={payment.status} />
            </div>

            <section className="card-sport p-4 space-y-3">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <User className="w-4 h-4 text-primary" />
                {t("staffPortal.people.colAthlete")}
              </h3>
              <div>
                <p className="font-medium">
                  {payment.athlete_first_name} {payment.athlete_last_name}
                </p>
                <p className="text-sm text-muted-foreground">{payment.athlete_email || "—"}</p>
              </div>
              {role === "admin" && onViewAthlete && payment.athlete_id ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8"
                  onClick={() => onViewAthlete(payment.athlete_id)}
                >
                  {t("staffPortal.finance.viewAthlete")}
                </Button>
              ) : null}
            </section>

            {payment.event_id ? (
              <section className="card-sport p-4 space-y-3">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <CalendarDays className="w-4 h-4 text-primary" />
                  {t("staffPortal.people.colEvent")}
                </h3>
                <p className="font-medium">{payment.event_title}</p>
                <Button type="button" variant="outline" size="sm" className="h-8" asChild>
                  <Link to={`/staff/events/${payment.event_id}`}>
                    {t("staffPortal.finance.viewEvent")}
                    <ExternalLink className="w-3 h-3 ml-2" />
                  </Link>
                </Button>
              </section>
            ) : null}

            {payment.registration_id ? (
              <section className="card-sport p-4 space-y-2">
                <h3 className="text-sm font-semibold">{t("staffPortal.finance.colRegistration")}</h3>
                <p className="font-mono text-sm">{payment.registration_number || `#${payment.registration_id}`}</p>
                {payment.registration_status ? (
                  <StaffStatusBadge status={payment.registration_status} />
                ) : null}
                {payment.bib_number ? (
                  <p className="text-sm text-muted-foreground">
                    Bib {payment.bib_number}
                  </p>
                ) : null}
                {payment.event_id ? (
                  <Button type="button" variant="outline" size="sm" className="h-8" asChild>
                    <Link to={`/staff/events/${payment.event_id}?tab=registrations`}>
                      {t("staffPortal.finance.viewRegistration")}
                      <ExternalLink className="w-3 h-3 ml-2" />
                    </Link>
                  </Button>
                ) : null}
              </section>
            ) : null}

            {role === "admin" && payment.organizer_name ? (
              <section className="card-sport p-4 space-y-1">
                <h3 className="text-sm font-semibold">{t("staffPortal.finance.colOrganizer")}</h3>
                <p>{payment.organizer_name}</p>
              </section>
            ) : null}

            {payment.seller_first_name || payment.provider === "manual" ? (
              <section className="card-sport p-4 space-y-2">
                <h3 className="text-sm font-semibold">{t("staffPortal.finance.colSeller")}</h3>
                {payment.seller_first_name ? (
                  <>
                    <p className="font-medium">
                      {payment.seller_first_name} {payment.seller_last_name ?? ""}
                    </p>
                    {payment.seller_email ? (
                      <p className="text-sm text-muted-foreground">{payment.seller_email}</p>
                    ) : null}
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {t("staffPortal.finance.sellerOnline")}
                  </p>
                )}
              </section>
            ) : null}

            <section className="card-sport p-4 space-y-3">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-primary" />
                {t("staffPortal.finance.paymentSection")}
              </h3>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <dt className="text-muted-foreground">{t("staffPortal.finance.colProvider")}</dt>
                <dd className="capitalize">
                  {payment.provider === "manual"
                    ? t("staffPortal.finance.providerManual")
                    : payment.provider === "mock"
                      ? t("staffPortal.finance.providerMock")
                      : payment.provider}
                </dd>
                {payment.fee_presentation ? (
                  <>
                    <dt className="text-muted-foreground">{t("staffPortal.finance.feePresentation")}</dt>
                    <dd>
                      {payment.fee_presentation === "absorb_all"
                        ? t("staffPortal.eventEdit.feePresentation.absorbAll")
                        : t("staffPortal.eventEdit.feePresentation.passThrough")}
                    </dd>
                  </>
                ) : null}
                <dt className="text-muted-foreground">{t("staffPortal.finance.serviceFee")}</dt>
                <dd>${(payment.service_fee_cents / 100).toLocaleString(numLocale)}</dd>
                <dt className="text-muted-foreground">{t("staffPortal.finance.organizerTransfer")}</dt>
                <dd>
                  ${(payment.registration_amount_cents / 100).toLocaleString(numLocale)}
                </dd>
                {payment.checkout_breakdown ? (
                  <>
                    <dt className="text-muted-foreground">{t("staffPortal.finance.listPrice")}</dt>
                    <dd>
                      ${(payment.checkout_breakdown.listPriceCents / 100).toLocaleString(numLocale)}
                    </dd>
                    {payment.fee_presentation === "absorb_all" ? (
                      <>
                        <dt className="text-muted-foreground">{t("staffPortal.finance.displayIva")}</dt>
                        <dd>
                          ${(payment.checkout_breakdown.displayIvaCents / 100).toLocaleString(numLocale)}
                        </dd>
                        <dt className="text-muted-foreground">{t("staffPortal.finance.fiscalNet")}</dt>
                        <dd>
                          $
                          {(payment.checkout_breakdown.organizerFiscalNetCents / 100).toLocaleString(
                            numLocale,
                          )}
                        </dd>
                      </>
                    ) : null}
                  </>
                ) : null}
                {payment.paid_at ? (
                  <>
                    <dt className="text-muted-foreground">{t("staffPortal.finance.colPaidAt")}</dt>
                    <dd>
                      {format(new Date(payment.paid_at), "d MMM yyyy, HH:mm", { locale: dateLocale })}
                    </dd>
                  </>
                ) : null}
                {payment.stripe_payment_intent_id ? (
                  <>
                    <dt className="text-muted-foreground col-span-2">
                      {t("staffPortal.finance.paymentReference")}
                    </dt>
                    <dd className="col-span-2 font-mono text-xs break-all">
                      {payment.stripe_payment_intent_id}
                    </dd>
                  </>
                ) : null}
              </dl>
            </section>

            {allowRefund && payment.status === "succeeded" ? (
              <div className="space-y-2">
                {refundPaymentError ? (
                  <p className="text-sm text-destructive">{refundPaymentError}</p>
                ) : null}
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  disabled={refundingPayment}
                  onClick={handleRefund}
                >
                  {refundingPayment ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <RotateCcw className="w-4 h-4 mr-2" />
                  )}
                  {t("staffPortal.finance.refund")}
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

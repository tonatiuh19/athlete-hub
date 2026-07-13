import { useEffect } from "react";
import { format } from "date-fns";
import { CreditCard, Loader2, RotateCcw } from "lucide-react";
import { useTranslation } from "react-i18next";
import StaffStatusBadge from "@/components/staff/StaffStatusBadge";
import StaffRegistrationPurchasedExtras from "@/components/staff/StaffRegistrationPurchasedExtras";
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
  clearStaffRegistrationDetail,
  fetchStaffRegistrationDetail,
  refundStaffPayment,
} from "@/store/slices/staffPortalSlice";
import { getDateFnsLocale, getNumberLocale } from "@/utils/dateLocale";
import type { StaffRole } from "@shared/api";

interface StaffRegistrationDetailSheetProps {
  eventId: number;
  registrationId: number | null;
  role: StaffRole;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  allowRefund?: boolean;
}

export default function StaffRegistrationDetailSheet({
  eventId,
  registrationId,
  role,
  open,
  onOpenChange,
  allowRefund = role === "admin",
}: StaffRegistrationDetailSheetProps) {
  const { t, i18n } = useTranslation();
  const dispatch = useAppDispatch();
  const {
    staffRegistrationDetail,
    loadingStaffRegistrationDetail,
    staffRegistrationDetailError,
    refundingPayment,
    refundPaymentError,
  } = useAppSelector((s) => s.staffPortal);
  const dateLocale = getDateFnsLocale(i18n.language);
  const numLocale = getNumberLocale(i18n.language);

  useEffect(() => {
    if (open && registrationId) {
      dispatch(fetchStaffRegistrationDetail({ eventId, registrationId, role }));
    }
  }, [dispatch, open, registrationId, eventId, role]);

  const handleOpen = (next: boolean) => {
    if (!next) dispatch(clearStaffRegistrationDetail());
    onOpenChange(next);
  };

  const reg = staffRegistrationDetail?.registration;
  const payment = staffRegistrationDetail?.payment;

  const handleRefund = () => {
    if (!payment || !window.confirm(t("staffPortal.finance.refundConfirm"))) return;
    dispatch(refundStaffPayment({ paymentId: payment.id, role }));
  };

  return (
    <Sheet open={open} onOpenChange={handleOpen}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{t("staffPortal.registrations.detailTitle")}</SheetTitle>
          <SheetDescription>{t("staffPortal.registrations.detailSubtitle")}</SheetDescription>
        </SheetHeader>

        {loadingStaffRegistrationDetail ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : staffRegistrationDetailError ? (
          <p className="text-sm text-destructive mt-6">{staffRegistrationDetailError}</p>
        ) : reg ? (
          <div className="mt-6 space-y-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold">
                  {reg.athlete_first_name} {reg.athlete_last_name}
                </h3>
                <p className="text-sm text-muted-foreground">{reg.athlete_email}</p>
                <p className="text-xs text-muted-foreground mt-1 font-mono">
                  {reg.registration_number}
                </p>
              </div>
              <StaffStatusBadge status={reg.status} />
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-muted-foreground">{t("staffPortal.people.colCategory")}</p>
                <p className="font-medium">{reg.category_name}</p>
              </div>
              <div>
                <p className="text-muted-foreground">{t("staffPortal.people.colTotal")}</p>
                <p className="font-semibold text-primary">
                  ${(reg.total_cents / 100).toLocaleString(numLocale)}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">{t("staffPortal.registrations.folio")}</p>
                <p>{reg.bib_number || "—"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">{t("staffPortal.registrations.source")}</p>
                <p className="capitalize">{reg.source}</p>
              </div>
            </div>

            {payment ? (
              <div className="card-sport p-4 space-y-2">
                <h4 className="font-semibold flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-primary" />
                  {t("staffPortal.finance.paymentSection")}
                </h4>
                <div className="text-sm space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t("staffPortal.finance.colAmount")}</span>
                    <span>${(payment.amount_cents / 100).toLocaleString(numLocale)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t("staffPortal.finance.colStatus")}</span>
                    <StaffStatusBadge status={payment.status} />
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t("staffPortal.finance.colProvider")}</span>
                    <span className="capitalize">{payment.provider}</span>
                  </div>
                  {payment.paid_at ? (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t("staffPortal.finance.colPaidAt")}</span>
                      <span>
                        {format(new Date(payment.paid_at), "d MMM yyyy HH:mm", { locale: dateLocale })}
                      </span>
                    </div>
                  ) : null}
                </div>
                {allowRefund && payment.status === "succeeded" ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-2 text-destructive"
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
                ) : null}
                {refundPaymentError ? (
                  <p className="text-sm text-destructive">{refundPaymentError}</p>
                ) : null}
              </div>
            ) : null}

            {staffRegistrationDetail?.waivers?.length ? (
              <div className="card-sport p-4 space-y-3 text-sm">
                <h4 className="font-semibold">{t("staffPortal.registrations.waiverSection")}</h4>
                {staffRegistrationDetail.registration.waiver_signed_at ? (
                  <p className="text-xs text-muted-foreground">
                    {t("staffPortal.registrations.waiverSignedAt", {
                      date: format(
                        new Date(staffRegistrationDetail.registration.waiver_signed_at),
                        "d MMM yyyy HH:mm",
                        { locale: dateLocale },
                      ),
                    })}
                  </p>
                ) : null}
                <ul className="space-y-2">
                  {staffRegistrationDetail.waivers.map((w, i) => (
                    <li key={i} className="rounded-lg bg-secondary/40 px-3 py-2">
                      <p className="font-medium">{w.waiver_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {t("staffPortal.registrations.waiverVersion", {
                          version: w.waiver_version ?? "—",
                        })}
                        {" · "}
                        {format(new Date(w.signed_at), "d MMM yyyy HH:mm", { locale: dateLocale })}
                      </p>
                      {w.signature_data ? (
                        <p className="text-xs mt-1">{w.signature_data}</p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : staffRegistrationDetail?.waiver ? (
              <div className="card-sport p-4 space-y-1 text-sm">
                <h4 className="font-semibold">{t("staffPortal.registrations.waiverSection")}</h4>
                <p>{staffRegistrationDetail.waiver.waiver_name}</p>
                <p className="text-muted-foreground text-xs">
                  {format(new Date(staffRegistrationDetail.waiver.signed_at), "d MMM yyyy HH:mm", {
                    locale: dateLocale,
                  })}
                </p>
              </div>
            ) : null}

            {staffRegistrationDetail?.purchased_extras?.length ? (
              <StaffRegistrationPurchasedExtras extras={staffRegistrationDetail.purchased_extras} />
            ) : null}

            {staffRegistrationDetail?.field_values?.length ? (
              <div className="card-sport p-4 space-y-2">
                <h4 className="font-semibold text-sm">{t("staffPortal.registrations.fieldsSection")}</h4>
                {staffRegistrationDetail.field_values.map((f) => (
                  <div key={f.field_key} className="text-sm">
                    <p className="text-muted-foreground">{f.label}</p>
                    <p>{f.value_text || f.value_file_url || "—"}</p>
                  </div>
                ))}
              </div>
            ) : null}

            {staffRegistrationDetail?.status_history?.length ? (
              <div className="space-y-2">
                <h4 className="font-semibold text-sm">{t("staffPortal.registrations.historySection")}</h4>
                <ul className="text-xs space-y-1 text-muted-foreground">
                  {staffRegistrationDetail.status_history.map((h, i) => (
                    <li key={i}>
                      {h.from_status ? `${h.from_status} → ` : ""}
                      {h.to_status} · {format(new Date(h.created_at), "d MMM yyyy", { locale: dateLocale })}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

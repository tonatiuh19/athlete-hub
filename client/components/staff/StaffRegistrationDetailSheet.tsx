import { useEffect, useState } from "react";
import { format } from "date-fns";
import {
  CheckCircle2,
  Copy,
  CreditCard,
  Loader2,
  RotateCcw,
  Save,
  Users,
  XCircle,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import StaffStatusBadge from "@/components/staff/StaffStatusBadge";
import StaffRegistrationPurchasedExtras from "@/components/staff/StaffRegistrationPurchasedExtras";
import { StaffSheetSkeleton } from "@/components/staff/skeletons/StaffSkeletons";
import RegistrationQrPass from "@/components/shared/RegistrationQrPass";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  assignRegistrationBib,
  cancelRegistration,
  checkInRegistration,
  clearStaffRegistrationDetail,
  fetchStaffRegistrationDetail,
  refundStaffPayment,
} from "@/store/slices/staffPortalSlice";
import { getDateFnsLocale, getNumberLocale } from "@/utils/dateLocale";
import { isStaffPaymentRefundable } from "@/utils/staffNav";
import type { StaffRole } from "@shared/api";

interface StaffRegistrationDetailSheetProps {
  eventId: number;
  registrationId: number | null;
  role: StaffRole;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  allowRefund?: boolean;
  /** Race-day ops (check-in / bib / cancel) — timing included */
  allowRegistrationOps?: boolean;
  bibMode?: "folio" | "separate";
  onChanged?: () => void;
}

export default function StaffRegistrationDetailSheet({
  eventId,
  registrationId,
  role,
  open,
  onOpenChange,
  allowRefund = role === "admin",
  allowRegistrationOps = true,
  bibMode = "folio",
  onChanged,
}: StaffRegistrationDetailSheetProps) {
  const { t, i18n } = useTranslation();
  const dispatch = useAppDispatch();
  const {
    staffRegistrationDetail,
    loadingStaffRegistrationDetail,
    staffRegistrationDetailError,
    refundingPayment,
    refundPaymentError,
    cancellingRegistration,
    assigningBib,
    checkingIn,
  } = useAppSelector((s) => s.staffPortal);
  const dateLocale = getDateFnsLocale(i18n.language);
  const numLocale = getNumberLocale(i18n.language);
  const [bibDraft, setBibDraft] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (open && registrationId) {
      dispatch(fetchStaffRegistrationDetail({ eventId, registrationId, role }));
    }
  }, [dispatch, open, registrationId, eventId, role]);

  useEffect(() => {
    setBibDraft(staffRegistrationDetail?.registration?.bib_number ?? "");
  }, [staffRegistrationDetail?.registration?.id, staffRegistrationDetail?.registration?.bib_number]);

  const handleOpen = (next: boolean) => {
    if (!next) dispatch(clearStaffRegistrationDetail());
    onOpenChange(next);
  };

  const reg = staffRegistrationDetail?.registration;
  const payment = staffRegistrationDetail?.payment;
  const folioEqualsBib = bibMode !== "separate";

  const reload = () => {
    if (registrationId) {
      dispatch(fetchStaffRegistrationDetail({ eventId, registrationId, role }));
    }
    onChanged?.();
  };

  const handleRefund = () => {
    if (!payment || !window.confirm(t("staffPortal.finance.refundConfirm"))) return;
    dispatch(refundStaffPayment({ paymentId: payment.id, role }));
  };

  const handleSaveBib = async () => {
    if (!reg || !allowRegistrationOps) return;
    const result = await dispatch(
      assignRegistrationBib({
        eventId,
        registrationId: reg.id,
        bib_number: bibDraft.trim() || null,
        role,
      }),
    );
    if (assignRegistrationBib.fulfilled.match(result)) reload();
  };

  const handleCheckIn = async () => {
    if (!reg || !allowRegistrationOps) return;
    const result = await dispatch(
      checkInRegistration({
        eventId,
        registrationId: reg.id,
        role,
      }),
    );
    if (checkInRegistration.fulfilled.match(result)) reload();
  };

  const handleCancel = async () => {
    if (!reg || !allowRegistrationOps) return;
    if (!window.confirm(t("staffPortal.registrations.cancelConfirm"))) return;
    const result = await dispatch(
      cancelRegistration({
        eventId,
        registrationId: reg.id,
        role,
      }),
    );
    if (cancelRegistration.fulfilled.match(result)) {
      reload();
      handleOpen(false);
    }
  };

  const handleCopyQr = async () => {
    if (!reg?.qr_code_token) return;
    try {
      await navigator.clipboard.writeText(reg.qr_code_token);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* ignore */
    }
  };

  return (
    <Sheet open={open} onOpenChange={handleOpen}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{t("staffPortal.registrations.detailTitle")}</SheetTitle>
          <SheetDescription>{t("staffPortal.registrations.detailSubtitle")}</SheetDescription>
        </SheetHeader>

        {loadingStaffRegistrationDetail ? (
          <div className="mt-6" aria-busy="true">
            <StaffSheetSkeleton />
          </div>
        ) : staffRegistrationDetailError ? (
          <p className="text-sm text-destructive mt-6">{staffRegistrationDetailError}</p>
        ) : reg ? (
          <div className="mt-6 space-y-6">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-lg font-semibold">
                  {reg.athlete_first_name} {reg.athlete_last_name}
                </h3>
                <p className="text-sm text-muted-foreground">{reg.athlete_email}</p>
                {reg.athlete_phone ? (
                  <p className="text-xs text-muted-foreground mt-0.5">{reg.athlete_phone}</p>
                ) : null}
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {reg.is_managed_participant ? (
                    <span className="text-[10px] uppercase tracking-wide font-semibold px-2 py-0.5 rounded-md bg-muted text-muted-foreground">
                      {t("registrationWallet.badgeManaged")}
                    </span>
                  ) : null}
                  {reg.guest_claim_pending ? (
                    <span className="text-[10px] uppercase tracking-wide font-semibold px-2 py-0.5 rounded-md bg-primary/15 text-primary">
                      {t("registrationWallet.badgeUnclaimed")}
                    </span>
                  ) : null}
                </div>
              </div>
              <StaffStatusBadge status={reg.status} />
            </div>

            {reg.purchaser_athlete_id &&
            reg.purchaser_athlete_id !== reg.athlete_id &&
            (reg.purchaser_first_name || reg.purchaser_email) ? (
              <div className="rounded-xl border border-border bg-muted/30 px-3 py-2 text-sm">
                <p className="text-xs text-muted-foreground">{t("staffPortal.registrations.boughtBy")}</p>
                <p className="font-medium">
                  {reg.purchaser_first_name} {reg.purchaser_last_name}
                </p>
                {reg.purchaser_email ? (
                  <p className="text-xs text-muted-foreground">{reg.purchaser_email}</p>
                ) : null}
              </div>
            ) : null}

            {allowRegistrationOps && reg.status === "confirmed" ? (
              <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                  {t("staffPortal.registrations.opsBar")}
                </p>
                <div className="flex flex-wrap gap-2">
                  {!reg.checked_in_at ? (
                    <Button
                      type="button"
                      size="sm"
                      disabled={checkingIn}
                      onClick={handleCheckIn}
                    >
                      {checkingIn ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4 mr-1.5" />
                      )}
                      {t("staffPortal.registrations.checkIn")}
                    </Button>
                  ) : (
                    <p className="text-xs text-accent self-center">
                      {t("staffPortal.registrations.checkedInAt", {
                        date: format(new Date(reg.checked_in_at), "d MMM yyyy HH:mm", {
                          locale: dateLocale,
                        }),
                      })}
                    </p>
                  )}
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="text-destructive"
                    disabled={cancellingRegistration}
                    onClick={handleCancel}
                  >
                    {cancellingRegistration ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                    ) : (
                      <XCircle className="w-4 h-4 mr-1.5" />
                    )}
                    {t("staffPortal.registrations.cancel")}
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={handleCopyQr}>
                    <Copy className="w-4 h-4 mr-1.5" />
                    {copied ? t("common.copied") : t("staffPortal.registrations.copyQr")}
                  </Button>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="ops-bib">{t("staffPortal.registrations.bib")}</Label>
                  {folioEqualsBib ? (
                    <p className="text-sm font-mono">
                      {reg.bib_number || reg.registration_number}
                      <span className="block text-xs text-muted-foreground font-sans mt-1">
                        {t("staffPortal.eventEdit.bibMode.folioEqualsBibHint")}
                      </span>
                    </p>
                  ) : (
                    <div className="flex gap-2">
                      <Input
                        id="ops-bib"
                        value={bibDraft}
                        onChange={(e) => setBibDraft(e.target.value)}
                        maxLength={30}
                        placeholder={t("staffPortal.registrations.bibPlaceholder")}
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={assigningBib}
                        onClick={handleSaveBib}
                      >
                        {assigningBib ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Save className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ) : null}

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
                <p className="font-mono text-xs">{reg.registration_number}</p>
              </div>
              <div>
                <p className="text-muted-foreground">{t("staffPortal.registrations.bib")}</p>
                <p className="font-mono text-xs">
                  {folioEqualsBib
                    ? reg.bib_number || reg.registration_number
                    : reg.bib_number || "—"}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">{t("staffPortal.registrations.source")}</p>
                <p className="capitalize">{reg.source}</p>
              </div>
              {reg.checked_in_at ? (
                <div>
                  <p className="text-muted-foreground">{t("staffPortal.registrations.checkedIn")}</p>
                  <p className="text-xs">
                    {format(new Date(reg.checked_in_at), "d MMM yyyy HH:mm", { locale: dateLocale })}
                  </p>
                </div>
              ) : null}
            </div>

            <div className="grid grid-cols-3 gap-2 text-xs rounded-xl border border-border p-3">
              <div>
                <p className="text-muted-foreground">{t("staffPortal.registrations.price")}</p>
                <p className="font-medium">${(reg.price_cents / 100).toLocaleString(numLocale)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">{t("staffPortal.registrations.fee")}</p>
                <p className="font-medium">
                  ${(reg.service_fee_cents / 100).toLocaleString(numLocale)}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">{t("staffPortal.people.colTotal")}</p>
                <p className="font-semibold text-primary">
                  ${(reg.total_cents / 100).toLocaleString(numLocale)}
                </p>
              </div>
            </div>

            {reg.qr_code_token ? (
              <RegistrationQrPass
                pass={{
                  qr_code_token: reg.qr_code_token,
                  registration_number: reg.registration_number,
                  bib_number: reg.bib_number,
                  label: `${reg.athlete_first_name} ${reg.athlete_last_name}`,
                  subtitle: reg.category_name,
                  badge: reg.is_managed_participant
                    ? "managed"
                    : reg.guest_claim_pending
                      ? "unclaimed"
                      : null,
                }}
                size={140}
              />
            ) : null}

            {(staffRegistrationDetail?.order_mates?.length ?? 0) > 0 ? (
              <div className="space-y-2">
                <h4 className="font-semibold text-sm flex items-center gap-2">
                  <Users className="w-4 h-4 text-primary" />
                  {t("staffPortal.registrations.orderMates")}
                </h4>
                <ul className="space-y-2">
                  {staffRegistrationDetail?.order_mates?.map((m) => (
                    <li
                      key={m.id}
                      className="rounded-lg border border-border px-3 py-2 text-sm flex justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <p className="font-medium truncate">
                          {m.athlete_first_name} {m.athlete_last_name}
                        </p>
                        <p className="text-xs font-mono text-muted-foreground">
                          {m.registration_number}
                        </p>
                      </div>
                      <StaffStatusBadge status={m.status} />
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

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
                {allowRefund && isStaffPaymentRefundable(payment) ? (
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

            {(staffRegistrationDetail?.refunds?.length ?? 0) > 0 ? (
              <div className="space-y-2">
                <h4 className="font-semibold text-sm">{t("staffPortal.registrations.refundHistory")}</h4>
                <ul className="text-xs space-y-1 text-muted-foreground">
                  {staffRegistrationDetail?.refunds.map((r) => (
                    <li key={r.id}>
                      ${(r.amount_cents / 100).toLocaleString(numLocale)} · {r.status}
                      {r.reason ? ` · ${r.reason}` : ""} ·{" "}
                      {format(new Date(r.created_at), "d MMM yyyy", { locale: dateLocale })}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {(staffRegistrationDetail?.transfers?.length ?? 0) > 0 ? (
              <div className="space-y-2">
                <h4 className="font-semibold text-sm">{t("staffPortal.registrations.transfersSection")}</h4>
                <ul className="text-xs space-y-1 text-muted-foreground">
                  {staffRegistrationDetail?.transfers.map((tr, i) => (
                    <li key={i}>
                      {tr.from_first_name} {tr.from_last_name} → {tr.to_first_name}{" "}
                      {tr.to_last_name} · {tr.status} ·{" "}
                      {format(new Date(tr.created_at), "d MMM yyyy", { locale: dateLocale })}
                    </li>
                  ))}
                </ul>
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
                      {h.to_status}
                      {h.actor_type ? ` · ${h.actor_type}` : ""}
                      {h.reason ? ` · ${h.reason}` : ""} ·{" "}
                      {format(new Date(h.created_at), "d MMM yyyy", { locale: dateLocale })}
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

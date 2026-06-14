import { useEffect, useState } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  Banknote,
  CheckCircle2,
  ExternalLink,
  Loader2,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import MetaHelmet from "@/components/MetaHelmet";
import StaffFeeCalculatorCard from "@/components/staff/StaffFeeCalculatorCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { canAccessStaffPayouts } from "@/utils/staffNav";
import {
  validatePayoutProfileForm,
  type PayoutProfileFieldErrors,
} from "@/utils/payoutProfileValidation";
import {
  acceptOrganizerPayoutTerms,
  fetchOrganizerPayoutStatus,
  loginOrganizerPayoutDashboard,
  onboardOrganizerPayouts,
  syncOrganizerPayouts,
  updateOrganizerPayoutProfile,
} from "@/store/slices/staffPortalSlice";
import type { PayoutChecklistItem } from "@shared/api";

function ChecklistSection({
  title,
  hint,
  items,
  itemKeyPrefix,
}: {
  title: string;
  hint: string;
  items: PayoutChecklistItem[];
  itemKeyPrefix: string;
}) {
  const { t } = useTranslation();
  return (
    <div className="card-sport p-5 space-y-3">
      <div>
        <h2 className="font-semibold">{title}</h2>
        <p className="text-xs text-muted-foreground mt-1">{hint}</p>
      </div>
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item.key} className="flex items-start gap-2 text-sm">
            {item.complete ? (
              <CheckCircle2 className="w-4 h-4 text-accent shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
            )}
            <span className={item.complete ? "text-foreground" : "text-muted-foreground"}>
              {t(`${itemKeyPrefix}.${item.key}`)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function StaffPayouts() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const dispatch = useAppDispatch();
  const [searchParams] = useSearchParams();
  const { role, user } = useAppSelector((s) => s.staffAuth);
  const {
    payoutStatus,
    loadingPayoutStatus,
    payoutStatusError,
    savingPayoutProfile,
    onboardingPayouts,
    syncingPayouts,
  } = useAppSelector((s) => s.staffPortal);

  const organizerRole = user?.type === "organizer" ? user.role : undefined;
  const canAccess = canAccessStaffPayouts(role === "admin", organizerRole);

  const org = payoutStatus?.organizer;
  const [legalName, setLegalName] = useState("");
  const [billingEmail, setBillingEmail] = useState("");
  const [rfc, setRfc] = useState("");
  const [taxRegime, setTaxRegime] = useState("");
  const [profileErrors, setProfileErrors] = useState<PayoutProfileFieldErrors>({});
  const [samplePriceMxn, setSamplePriceMxn] = useState(1000);
  const [openingDashboard, setOpeningDashboard] = useState(false);

  useEffect(() => {
    void dispatch(fetchOrganizerPayoutStatus());
  }, [dispatch]);

  useEffect(() => {
    if (!org) return;
    setLegalName(org.legal_name ?? "");
    setBillingEmail(org.billing_email ?? "");
    setRfc(org.rfc ?? "");
    setTaxRegime(org.tax_regime ?? "");
  }, [org]);

  useEffect(() => {
    const connect = searchParams.get("connect");
    if (connect === "return" || connect === "refresh") {
      void dispatch(syncOrganizerPayouts());
    }
  }, [dispatch, searchParams]);

  if (!canAccess || !role) {
    return <Navigate to="/staff" replace />;
  }

  const tribooComplete = payoutStatus?.tribooChecklist.complete ?? false;
  const payoutReady = payoutStatus?.payoutReady ?? false;
  const feePercent = payoutStatus?.serviceFeePercent ?? 11;

  const handleSaveProfile = async () => {
    const values = {
      legal_name: legalName,
      billing_email: billingEmail,
      rfc,
      tax_regime: taxRegime,
    };
    const errors = validatePayoutProfileForm(values, {
      legalNameRequired: t("staffPortal.payouts.validation.legalNameRequired"),
      billingEmailInvalid: t("staffPortal.payouts.validation.billingEmailInvalid"),
      rfcInvalid: t("staffPortal.payouts.validation.rfcInvalid"),
    });
    setProfileErrors(errors);
    if (Object.keys(errors).length > 0) return;

    const result = await dispatch(
      updateOrganizerPayoutProfile({
        legal_name: legalName.trim(),
        billing_email: billingEmail.trim(),
        rfc: rfc.trim(),
        tax_regime: taxRegime.trim(),
      }),
    );
    if (updateOrganizerPayoutProfile.fulfilled.match(result)) {
      toast({ title: t("staffPortal.payouts.profileSaved") });
    }
  };

  const handleAcceptTerms = async () => {
    await dispatch(acceptOrganizerPayoutTerms());
  };

  const handleOnboard = async () => {
    const result = await dispatch(onboardOrganizerPayouts());
    if (onboardOrganizerPayouts.fulfilled.match(result) && result.payload.url) {
      window.location.href = result.payload.url;
    }
  };

  const handleOpenDashboard = async () => {
    setOpeningDashboard(true);
    try {
      const result = await dispatch(loginOrganizerPayoutDashboard());
      if (loginOrganizerPayoutDashboard.fulfilled.match(result) && result.payload.url) {
        window.open(result.payload.url, "_blank", "noopener,noreferrer");
      }
    } finally {
      setOpeningDashboard(false);
    }
  };

  const eventuallyDue = org?.requirements_eventually_due ?? [];

  return (
    <div className="max-w-3xl mx-auto w-full min-w-0 overflow-x-clip space-y-6">
      <MetaHelmet
        title={t("staffPortal.payouts.title")}
        description={t("staffPortal.payouts.subtitle")}
      />

      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Banknote className="w-7 h-7 text-primary" />
          {t("staffPortal.payouts.title")}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">{t("staffPortal.payouts.subtitle")}</p>
      </div>

      {loadingPayoutStatus && !payoutStatus ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          {t("staffPortal.payouts.loading")}
        </div>
      ) : null}

      {payoutStatusError ? (
        <p className="text-sm text-destructive">{payoutStatusError}</p>
      ) : null}

      {payoutStatus ? (
        <>
          <div
            className={`rounded-xl border px-4 py-3 flex items-start gap-3 ${
              payoutReady
                ? "border-accent/30 bg-accent/5"
                : "border-destructive/30 bg-destructive/5"
            }`}
          >
            {payoutReady ? (
              <ShieldCheck className="w-5 h-5 text-accent shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
            )}
            <div>
              <p className="font-medium">
                {payoutReady
                  ? t("staffPortal.payouts.statusReady")
                  : t("staffPortal.payouts.statusNotReady")}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {t(`staffPortal.payouts.connectStatus.${org?.stripe_connect_status ?? "not_started"}`)}
              </p>
            </div>
          </div>

          <ChecklistSection
            title={t("staffPortal.payouts.tribooSectionTitle")}
            hint={t("staffPortal.payouts.tribooSectionHint")}
            items={payoutStatus.tribooChecklist.items}
            itemKeyPrefix="staffPortal.payouts.tribooItem"
          />

          <div className="card-sport p-5 space-y-4">
            <p className="font-semibold">{t("staffPortal.payouts.profileFormTitle")}</p>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="legal_name">{t("staffPortal.payouts.fieldLegalName")}</Label>
                <Input
                  id="legal_name"
                  value={legalName}
                  onChange={(e) => {
                    setLegalName(e.target.value);
                    if (profileErrors.legal_name) {
                      setProfileErrors((prev) => ({ ...prev, legal_name: undefined }));
                    }
                  }}
                  aria-invalid={Boolean(profileErrors.legal_name)}
                />
                {profileErrors.legal_name ? (
                  <p className="text-xs text-destructive">{profileErrors.legal_name}</p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="billing_email">{t("staffPortal.payouts.fieldBillingEmail")}</Label>
                <Input
                  id="billing_email"
                  type="email"
                  value={billingEmail}
                  onChange={(e) => {
                    setBillingEmail(e.target.value);
                    if (profileErrors.billing_email) {
                      setProfileErrors((prev) => ({ ...prev, billing_email: undefined }));
                    }
                  }}
                  aria-invalid={Boolean(profileErrors.billing_email)}
                />
                {profileErrors.billing_email ? (
                  <p className="text-xs text-destructive">{profileErrors.billing_email}</p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="rfc">{t("staffPortal.payouts.fieldRfc")}</Label>
                <Input
                  id="rfc"
                  value={rfc}
                  onChange={(e) => {
                    setRfc(e.target.value.toUpperCase());
                    if (profileErrors.rfc) {
                      setProfileErrors((prev) => ({ ...prev, rfc: undefined }));
                    }
                  }}
                  aria-invalid={Boolean(profileErrors.rfc)}
                />
                {profileErrors.rfc ? (
                  <p className="text-xs text-destructive">{profileErrors.rfc}</p>
                ) : null}
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="tax_regime">{t("staffPortal.payouts.fieldTaxRegime")}</Label>
                <Input id="tax_regime" value={taxRegime} onChange={(e) => setTaxRegime(e.target.value)} />
              </div>
            </div>
            <Button onClick={handleSaveProfile} disabled={savingPayoutProfile}>
              {savingPayoutProfile ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {t("staffPortal.payouts.saveProfile")}
            </Button>
          </div>

          {!org?.payout_terms_accepted_at ? (
            <div className="card-sport p-5 space-y-3">
              <p className="text-sm">{t("staffPortal.payouts.termsText")}</p>
              <Button variant="outline" onClick={handleAcceptTerms}>
                {t("staffPortal.payouts.acceptTerms")}
              </Button>
            </div>
          ) : null}

          <StaffFeeCalculatorCard
            serviceFeePercent={feePercent}
            samplePriceMxn={samplePriceMxn}
            samplePriceEditable
            onSamplePriceChange={setSamplePriceMxn}
          />

          <ChecklistSection
            title={t("staffPortal.payouts.stripeSectionTitle")}
            hint={t("staffPortal.payouts.stripeSectionHint")}
            items={payoutStatus.stripeChecklist.items}
            itemKeyPrefix="staffPortal.payouts.stripeItem"
          />

          {eventuallyDue.length > 0 ? (
            <p className="text-xs text-muted-foreground rounded-lg border border-border bg-muted/30 px-3 py-2">
              {t("staffPortal.payouts.eventuallyDueHint", { count: eventuallyDue.length })}
            </p>
          ) : null}

          <div className="flex flex-col sm:flex-row gap-2">
            <Button
              className="flex-1"
              onClick={handleOnboard}
              disabled={!tribooComplete || onboardingPayouts}
            >
              {onboardingPayouts ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <ExternalLink className="w-4 h-4 mr-2" />
              )}
              {t("staffPortal.payouts.continueStripe")}
            </Button>
            <Button
              variant="outline"
              onClick={() => dispatch(syncOrganizerPayouts())}
              disabled={syncingPayouts}
            >
              {syncingPayouts ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-2" />
              )}
              {t("staffPortal.payouts.syncStatus")}
            </Button>
            {org?.stripe_account_id ? (
              <Button
                variant="outline"
                onClick={handleOpenDashboard}
                disabled={openingDashboard}
              >
                {openingDashboard ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <ExternalLink className="w-4 h-4 mr-2" />
                )}
                {t("staffPortal.payouts.openDashboard")}
              </Button>
            ) : null}
          </div>

          {!tribooComplete ? (
            <p className="text-xs text-muted-foreground">{t("staffPortal.payouts.completeTribooFirst")}</p>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

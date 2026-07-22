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
import StaffFormMissingChips from "@/components/staff/StaffFormMissingChips";
import { StaffFormSkeleton } from "@/components/staff/skeletons/StaffSkeletons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { canAccessStaffPayouts } from "@/utils/staffNav";
import {
  validatePayoutProfileForm,
  type PayoutProfileFieldErrors,
} from "@/utils/payoutProfileValidation";
import { getPayoutProfileMissing } from "@/utils/staffFormMissing";
import {
  acceptOrganizerPayoutTerms,
  fetchOrganizerPayoutStatus,
  loginOrganizerPayoutDashboard,
  onboardOrganizerPayouts,
  setOrganizerPayoutRail,
  startMercadoPagoOauth,
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
    acceptingPayoutTerms,
    onboardingPayouts,
    payoutOnboardError,
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
    const mp = searchParams.get("mp");
    if (mp === "connected") {
      void dispatch(fetchOrganizerPayoutStatus());
      toast({ title: t("staffPortal.payouts.mpConnected") });
    } else if (mp === "error") {
      toast({
        variant: "destructive",
        title: t("staffPortal.payouts.mpConnectError"),
      });
    }
  }, [dispatch, searchParams, t, toast]);

  if (!canAccess || !role) {
    return <Navigate to="/staff" replace />;
  }

  const tribooComplete = payoutStatus?.tribooChecklist.complete ?? false;
  const payoutReady = payoutStatus?.payoutReady ?? false;
  const feePercent = payoutStatus?.serviceFeePercent ?? 11;
  const feePresentation = payoutStatus?.feePresentation ?? org?.fee_presentation ?? "pass_through";
  const absorbAllFees = feePresentation === "absorb_all";

  const handleFeePresentationToggle = async (checked: boolean) => {
    const next = checked ? "absorb_all" : "pass_through";
    if (checked && !window.confirm(t("staffPortal.payouts.feePresentationSwitchConfirm"))) {
      return;
    }
    const result = await dispatch(updateOrganizerPayoutProfile({ fee_presentation: next }));
    if (updateOrganizerPayoutProfile.fulfilled.match(result)) {
      toast({
        title: t(
          checked
            ? "staffPortal.payouts.feePresentationAbsorbEnabled"
            : "staffPortal.payouts.feePresentationPassThroughEnabled",
        ),
      });
    }
  };

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
    const result = await dispatch(acceptOrganizerPayoutTerms());
    if (acceptOrganizerPayoutTerms.fulfilled.match(result)) {
      toast({ title: t("staffPortal.payouts.termsAccepted") });
    } else if (acceptOrganizerPayoutTerms.rejected.match(result)) {
      toast({
        variant: "destructive",
        title: result.payload || t("staffPortal.errors.acceptPayoutTerms"),
      });
    }
  };

  const handleOnboard = async () => {
    const result = await dispatch(onboardOrganizerPayouts());
    if (onboardOrganizerPayouts.fulfilled.match(result) && result.payload.url) {
      window.location.href = result.payload.url;
      return;
    }
    if (onboardOrganizerPayouts.rejected.match(result)) {
      toast({
        variant: "destructive",
        title: result.payload || t("staffPortal.errors.startPayoutVerification"),
      });
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
  const payoutProfileMissing = getPayoutProfileMissing({
    legal_name: legalName,
    billing_email: billingEmail,
    rfc,
    tax_regime: taxRegime,
  });

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
        <div className="card-sport p-5 sm:p-6" aria-busy="true">
          <StaffFormSkeleton fields={5} />
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
                {payoutStatus.railFallback
                  ? ` · ${t("staffPortal.payouts.usingFallbackRail")}`
                  : ""}
              </p>
            </div>
          </div>

          <div className="card-sport p-5 space-y-4">
            <div>
              <h2 className="font-semibold">{t("staffPortal.payouts.railTitle")}</h2>
              <p className="text-xs text-muted-foreground mt-1">
                {payoutStatus.mercadoPagoAvailable
                  ? t("staffPortal.payouts.railHint")
                  : t("staffPortal.payouts.railHintStripeOnly")}
              </p>
            </div>
            {payoutStatus.mercadoPagoAvailable ? (
              <>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button
                    type="button"
                    variant={org?.payout_rail !== "mercadopago" ? "default" : "outline"}
                    onClick={() => void dispatch(setOrganizerPayoutRail("stripe"))}
                  >
                    {t("staffPortal.payouts.railStripe")}
                  </Button>
                  <Button
                    type="button"
                    variant={org?.payout_rail === "mercadopago" ? "default" : "outline"}
                    onClick={() => void dispatch(setOrganizerPayoutRail("mercadopago"))}
                  >
                    {t("staffPortal.payouts.railMercadoPago")}
                  </Button>
                </div>
                <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground space-y-1">
                  <p className="font-medium text-foreground">{t("staffPortal.payouts.timingTitle")}</p>
                  <p>{t("staffPortal.payouts.timingStripe")}</p>
                  <p>{t("staffPortal.payouts.timingMpCard")}</p>
                  <p>{t("staffPortal.payouts.timingMpOxxo")}</p>
                </div>
              </>
            ) : (
              <div className="rounded-xl border border-dashed border-border bg-muted/20 p-4 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-foreground">
                    {t("staffPortal.payouts.railMercadoPago")}
                  </p>
                  <span className="rounded-md bg-secondary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-secondary-foreground">
                    {t("staffPortal.payouts.mpComingSoonBadge")}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {t("staffPortal.payouts.mpComingSoonBody")}
                </p>
                <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
                  <p className="font-medium text-foreground mb-1">{t("staffPortal.payouts.timingTitle")}</p>
                  <p>{t("staffPortal.payouts.timingStripe")}</p>
                </div>
              </div>
            )}
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
            <StaffFormMissingChips
              items={payoutProfileMissing}
              showCompleteState={payoutProfileMissing.length === 0}
            />
            <Button onClick={handleSaveProfile} disabled={savingPayoutProfile}>
              {savingPayoutProfile ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {t("staffPortal.payouts.saveProfile")}
            </Button>
          </div>

          {!org?.payout_terms_accepted_at ? (
            <div className="card-sport p-5 space-y-3">
              <p className="text-sm">
                {absorbAllFees
                  ? t("staffPortal.payouts.termsTextAbsorb")
                  : t("staffPortal.payouts.termsTextPassThrough")}
              </p>
              <Button
                variant="outline"
                onClick={handleAcceptTerms}
                disabled={acceptingPayoutTerms}
              >
                {acceptingPayoutTerms ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : null}
                {acceptingPayoutTerms
                  ? t("staffPortal.payouts.acceptingTerms")
                  : t("staffPortal.payouts.acceptTerms")}
              </Button>
            </div>
          ) : null}

          <div className="card-sport p-5 space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <p className="text-sm font-semibold">
                  {t("staffPortal.payouts.feePresentationTitle")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t("staffPortal.payouts.feePresentationHint")}
                </p>
              </div>
              <Switch
                checked={absorbAllFees}
                onCheckedChange={(checked) => void handleFeePresentationToggle(checked)}
                aria-label={t("staffPortal.payouts.feePresentationTitle")}
              />
            </div>
            <p className="text-xs text-muted-foreground rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
              {absorbAllFees
                ? t("staffPortal.payouts.feePresentationAbsorbActive")
                : t("staffPortal.payouts.feePresentationPassThroughActive")}
            </p>
          </div>

          <StaffFeeCalculatorCard
            serviceFeePercent={feePercent}
            feePresentation={feePresentation}
            samplePriceMxn={samplePriceMxn}
            samplePriceEditable
            onSamplePriceChange={setSamplePriceMxn}
          />

          <ChecklistSection
            title={t("staffPortal.payouts.bankVerificationSectionTitle")}
            hint={t("staffPortal.payouts.bankVerificationSectionHint")}
            items={payoutStatus.stripeChecklist.items}
            itemKeyPrefix="staffPortal.payouts.bankVerificationItem"
          />

          {payoutStatus.mercadoPagoAvailable && payoutStatus.mercadoPagoChecklist ? (
            <ChecklistSection
              title={t("staffPortal.payouts.mpSectionTitle")}
              hint={t("staffPortal.payouts.mpSectionHint")}
              items={payoutStatus.mercadoPagoChecklist.items}
              itemKeyPrefix="staffPortal.payouts.mpItem"
            />
          ) : null}

          {payoutStatus.mercadoPagoAvailable ? (
          <div className="card-sport p-5 space-y-3">
            <h2 className="font-semibold">{t("staffPortal.payouts.mpConnectTitle")}</h2>
            <p className="text-xs text-muted-foreground">
              {t("staffPortal.payouts.mpConnectHint")}
            </p>
            <Button
              type="button"
              variant="outline"
              onClick={async () => {
                const result = await dispatch(startMercadoPagoOauth());
                if (startMercadoPagoOauth.fulfilled.match(result) && result.payload.url) {
                  window.location.href = result.payload.url;
                } else if (startMercadoPagoOauth.rejected.match(result)) {
                  toast({
                    variant: "destructive",
                    title: result.payload || t("staffPortal.errors.mpOauthStart"),
                  });
                }
              }}
            >
              {t("staffPortal.payouts.mpConnectCta")}
            </Button>
            {org?.mp_oauth_status === "ready" ? (
              <p className="text-xs text-accent flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {t("staffPortal.payouts.mpReady")}
              </p>
            ) : null}
          </div>
          ) : (
            <div className="card-sport p-5 space-y-3 border-dashed">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-semibold">{t("staffPortal.payouts.mpConnectTitle")}</h2>
                <span className="rounded-md bg-secondary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-secondary-foreground">
                  {t("staffPortal.payouts.mpComingSoonBadge")}
                </span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {t("staffPortal.payouts.mpComingSoonBody")}
              </p>
              <Button type="button" variant="outline" disabled>
                {t("staffPortal.payouts.mpComingSoonCta")}
              </Button>
            </div>
          )}

          {eventuallyDue.length > 0 ? (
            <p className="text-xs text-muted-foreground rounded-lg border border-border bg-muted/30 px-3 py-2">
              {t("staffPortal.payouts.eventuallyDueHint", { count: eventuallyDue.length })}
            </p>
          ) : null}

          {payoutOnboardError ? (
            <p className="text-sm text-destructive rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2">
              {payoutOnboardError}
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
              {t("staffPortal.payouts.continueVerification")}
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

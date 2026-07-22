import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Banknote,
  CheckCircle2,
  ExternalLink,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import WizardProgress from "@/components/events/registration/WizardProgress";
import StaffFeeCalculatorCard from "@/components/staff/StaffFeeCalculatorCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  acceptOrganizerPayoutTerms,
  loginOrganizerPayoutDashboard,
  onboardOrganizerPayouts,
  setOrganizerPayoutRail,
  startMercadoPagoOauth,
  syncOrganizerPayouts,
  updateOrganizerPayoutProfile,
} from "@/store/slices/staffPortalSlice";
import type { OrganizerPayoutStatusResponse, PayoutChecklistItem } from "@shared/api";
import {
  DEFAULT_MP_SERVICE_FEE_PERCENT,
} from "@shared/payoutRail";
import { DEFAULT_SERVICE_FEE_PERCENT } from "@shared/checkoutBreakdown";

type WizardStep = "compare" | "choose" | "terms" | "connect";

const STEPS: WizardStep[] = ["compare", "choose", "terms", "connect"];

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

export default function StaffPayoutSetupWizard({
  payoutStatus,
}: {
  payoutStatus: OrganizerPayoutStatusResponse;
}) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const dispatch = useAppDispatch();
  const {
    savingPayoutProfile,
    acceptingPayoutTerms,
    onboardingPayouts,
    payoutOnboardError,
    syncingPayouts,
  } = useAppSelector((s) => s.staffPortal);

  const org = payoutStatus.organizer;
  const mpAvailable = Boolean(payoutStatus.mercadoPagoAvailable);
  const stripeFee = payoutStatus.stripeServiceFeePercent ?? DEFAULT_SERVICE_FEE_PERCENT;
  const mpFee = payoutStatus.mpServiceFeePercent ?? DEFAULT_MP_SERVICE_FEE_PERCENT;
  const payoutReady = payoutStatus.payoutReady;
  const tribooComplete = payoutStatus.tribooChecklist.complete;

  const initialStep: WizardStep = payoutReady
    ? "connect"
    : org.payout_rail && (org.stripe_account_id || org.mp_oauth_status === "ready")
      ? "connect"
      : org.payout_terms_accepted_at
        ? "connect"
        : "compare";

  const [step, setStep] = useState<WizardStep>(initialStep);
  const [selectedRail, setSelectedRail] = useState<"stripe" | "mercadopago">(
    org.payout_rail === "mercadopago" && mpAvailable ? "mercadopago" : "stripe",
  );
  const [legalName, setLegalName] = useState(org.legal_name ?? "");
  const [billingEmail, setBillingEmail] = useState(org.billing_email ?? org.email ?? "");
  const [samplePriceMxn, setSamplePriceMxn] = useState(1000);
  const [openingDashboard, setOpeningDashboard] = useState(false);
  const [termsChecked, setTermsChecked] = useState(Boolean(org.payout_terms_accepted_at));

  useEffect(() => {
    setLegalName(org.legal_name ?? "");
    setBillingEmail(org.billing_email ?? org.email ?? "");
    setTermsChecked(Boolean(org.payout_terms_accepted_at));
    if (org.payout_rail === "mercadopago" && mpAvailable) {
      setSelectedRail("mercadopago");
    }
  }, [org, mpAvailable]);

  const stepIndex = STEPS.indexOf(step);
  const progressSteps = useMemo(
    () =>
      STEPS.map((key) => ({
        key,
        label: t(`staffPortal.payouts.wizard.steps.${key}`),
      })),
    [t],
  );

  const feePresentation = payoutStatus.feePresentation ?? org.fee_presentation ?? "pass_through";
  const absorbAllFees = feePresentation === "absorb_all";
  const displayFee =
    selectedRail === "mercadopago" ? mpFee : stripeFee;

  const goNext = () => {
    const i = STEPS.indexOf(step);
    if (i < STEPS.length - 1) setStep(STEPS[i + 1]!);
  };
  const goBack = () => {
    const i = STEPS.indexOf(step);
    if (i > 0) setStep(STEPS[i - 1]!);
  };

  const handleChooseContinue = async () => {
    if (selectedRail === "mercadopago" && !mpAvailable) {
      toast({
        variant: "destructive",
        title: t("staffPortal.payouts.mpComingSoonBody"),
      });
      return;
    }
    const result = await dispatch(setOrganizerPayoutRail(selectedRail));
    if (setOrganizerPayoutRail.fulfilled.match(result)) {
      goNext();
    } else if (setOrganizerPayoutRail.rejected.match(result)) {
      toast({
        variant: "destructive",
        title: result.payload || t("staffPortal.errors.savePayoutProfile"),
      });
    }
  };

  const handleTermsContinue = async () => {
    const name = legalName.trim();
    const email = billingEmail.trim();
    if (!name || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast({
        variant: "destructive",
        title: t("staffPortal.payouts.wizard.contactInvalid"),
      });
      return;
    }
    if (!termsChecked) {
      toast({
        variant: "destructive",
        title: t("staffPortal.payouts.wizard.termsRequired"),
      });
      return;
    }

    const profileResult = await dispatch(
      updateOrganizerPayoutProfile({
        legal_name: name,
        billing_email: email,
      }),
    );
    if (updateOrganizerPayoutProfile.rejected.match(profileResult)) {
      toast({
        variant: "destructive",
        title: profileResult.payload || t("staffPortal.errors.savePayoutProfile"),
      });
      return;
    }

    if (!org.payout_terms_accepted_at) {
      const termsResult = await dispatch(acceptOrganizerPayoutTerms());
      if (acceptOrganizerPayoutTerms.rejected.match(termsResult)) {
        toast({
          variant: "destructive",
          title: termsResult.payload || t("staffPortal.errors.acceptPayoutTerms"),
        });
        return;
      }
    }
    goNext();
  };

  const handleFeePresentationToggle = async (checked: boolean) => {
    if (checked && !window.confirm(t("staffPortal.payouts.feePresentationSwitchConfirm"))) {
      return;
    }
    const next = checked ? "absorb_all" : "pass_through";
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

  const handleOnboard = async () => {
    if (selectedRail === "mercadopago") {
      const result = await dispatch(startMercadoPagoOauth());
      if (startMercadoPagoOauth.fulfilled.match(result) && result.payload.url) {
        window.location.href = result.payload.url;
        return;
      }
      toast({
        variant: "destructive",
        title: startMercadoPagoOauth.rejected.match(result)
          ? result.payload || t("staffPortal.errors.mpOauthStart")
          : t("staffPortal.errors.mpOauthStart"),
      });
      return;
    }
    const result = await dispatch(onboardOrganizerPayouts());
    if (onboardOrganizerPayouts.fulfilled.match(result) && result.payload.url) {
      window.location.href = result.payload.url;
      return;
    }
    toast({
      variant: "destructive",
      title: onboardOrganizerPayouts.rejected.match(result)
        ? result.payload || t("staffPortal.errors.startPayoutVerification")
        : t("staffPortal.errors.startPayoutVerification"),
    });
  };

  const handleOpenDashboard = async () => {
    setOpeningDashboard(true);
    try {
      const result = await dispatch(loginOrganizerPayoutDashboard());
      if (loginOrganizerPayoutDashboard.fulfilled.match(result) && result.payload.url) {
        window.location.href = result.payload.url;
      }
    } finally {
      setOpeningDashboard(false);
    }
  };

  return (
    <div className="space-y-6">
      <WizardProgress
        steps={progressSteps}
        currentIndex={Math.max(0, stepIndex)}
        stepOfLabel={t("staffPortal.payouts.wizard.stepOf", {
          current: stepIndex + 1,
          total: STEPS.length,
        })}
      />

      <div
        className={cn(
          "rounded-xl border px-4 py-3 flex items-start gap-3",
          payoutReady
            ? "border-accent/30 bg-accent/5"
            : "border-primary/25 bg-primary/5",
        )}
      >
        {payoutReady ? (
          <ShieldCheck className="w-5 h-5 text-accent shrink-0 mt-0.5" />
        ) : (
          <Banknote className="w-5 h-5 text-primary shrink-0 mt-0.5" />
        )}
        <div>
          <p className="font-medium">
            {payoutReady
              ? t("staffPortal.payouts.statusReady")
              : t("staffPortal.payouts.statusNotReady")}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {t(`staffPortal.payouts.connectStatus.${org.stripe_connect_status ?? "not_started"}`)}
          </p>
        </div>
      </div>

      {step === "compare" ? (
        <div className="space-y-4 animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
          <div className="card-sport p-5 sm:p-6 space-y-3">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              {t("staffPortal.payouts.wizard.compareTitle")}
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {t("staffPortal.payouts.wizard.compareIntro")}
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="card-sport p-5 space-y-3 border-primary/30">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-semibold text-lg">{t("staffPortal.payouts.railStripe")}</h3>
                <span className="rounded-md bg-accent/15 text-accent px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide">
                  {t("staffPortal.payouts.wizard.recommended")}
                </span>
              </div>
              <p className="text-3xl font-bold tabular-nums text-primary">
                {stripeFee}%
                <span className="text-sm font-medium text-muted-foreground ml-1">
                  {t("staffPortal.payouts.wizard.platformFee")}
                </span>
              </p>
              <ul className="text-sm text-muted-foreground space-y-2">
                <li>• {t("staffPortal.payouts.wizard.stripeBullet1")}</li>
                <li>• {t("staffPortal.payouts.wizard.stripeBullet2")}</li>
                <li>• {t("staffPortal.payouts.wizard.stripeBullet3")}</li>
              </ul>
            </div>

            <div className="card-sport p-5 space-y-3 relative overflow-hidden">
              {!mpAvailable ? (
                <span className="absolute top-3 right-3 rounded-md bg-secondary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-secondary-foreground">
                  {t("staffPortal.payouts.mpComingSoonBadge")}
                </span>
              ) : null}
              <h3 className="font-semibold text-lg">{t("staffPortal.payouts.railMercadoPago")}</h3>
              <p className="text-3xl font-bold tabular-nums">
                {mpFee}%
                <span className="text-sm font-medium text-muted-foreground ml-1">
                  {t("staffPortal.payouts.wizard.platformFee")}
                </span>
              </p>
              <ul className="text-sm text-muted-foreground space-y-2">
                <li>• {t("staffPortal.payouts.wizard.mpBullet1")}</li>
                <li>• {t("staffPortal.payouts.wizard.mpBullet2")}</li>
                <li>• {t("staffPortal.payouts.wizard.mpBullet3")}</li>
              </ul>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-2">
            <p className="text-sm font-semibold">
              {t("staffPortal.payouts.wizard.whyMoreExpensiveTitle")}
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {t("staffPortal.payouts.wizard.whyMoreExpensiveBody", {
                stripeFee,
                mpFee,
              })}
            </p>
          </div>

          <div className="flex justify-end">
            <Button type="button" onClick={goNext}>
              {t("staffPortal.payouts.wizard.continue")}
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      ) : null}

      {step === "choose" ? (
        <div className="space-y-4 animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
          <div className="card-sport p-5 space-y-4">
            <div>
              <h2 className="font-semibold text-lg">{t("staffPortal.payouts.wizard.chooseTitle")}</h2>
              <p className="text-sm text-muted-foreground mt-1">
                {t("staffPortal.payouts.wizard.chooseHint")}
              </p>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setSelectedRail("stripe")}
                className={cn(
                  "rounded-xl border p-4 text-left transition-all",
                  selectedRail === "stripe"
                    ? "border-primary bg-primary/10 ring-2 ring-primary/30"
                    : "border-border hover:border-primary/40",
                )}
              >
                <p className="font-semibold">{t("staffPortal.payouts.railStripe")}</p>
                <p className="text-2xl font-bold text-primary mt-2 tabular-nums">{stripeFee}%</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {t("staffPortal.payouts.wizard.stripeShort")}
                </p>
              </button>
              <button
                type="button"
                disabled={!mpAvailable}
                onClick={() => mpAvailable && setSelectedRail("mercadopago")}
                className={cn(
                  "rounded-xl border p-4 text-left transition-all",
                  !mpAvailable && "opacity-60 cursor-not-allowed",
                  selectedRail === "mercadopago"
                    ? "border-primary bg-primary/10 ring-2 ring-primary/30"
                    : "border-border hover:border-primary/40",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold">{t("staffPortal.payouts.railMercadoPago")}</p>
                  {!mpAvailable ? (
                    <span className="text-[10px] font-bold uppercase tracking-wide text-secondary-foreground bg-secondary px-2 py-0.5 rounded-md">
                      {t("staffPortal.payouts.mpComingSoonBadge")}
                    </span>
                  ) : null}
                </div>
                <p className="text-2xl font-bold mt-2 tabular-nums">{mpFee}%</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {t("staffPortal.payouts.wizard.mpShort")}
                </p>
              </button>
            </div>
          </div>

          <StaffFeeCalculatorCard
            serviceFeePercent={displayFee}
            feePresentation={feePresentation}
            samplePriceMxn={samplePriceMxn}
            samplePriceEditable
            onSamplePriceChange={setSamplePriceMxn}
          />

          <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-between">
            <Button type="button" variant="outline" onClick={goBack}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              {t("staffPortal.payouts.wizard.back")}
            </Button>
            <Button type="button" onClick={() => void handleChooseContinue()}>
              {t("staffPortal.payouts.wizard.continue")}
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      ) : null}

      {step === "terms" ? (
        <div className="space-y-4 animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
          <div className="card-sport p-5 space-y-4">
            <div>
              <h2 className="font-semibold text-lg">{t("staffPortal.payouts.wizard.termsTitle")}</h2>
              <p className="text-sm text-muted-foreground mt-1">
                {t("staffPortal.payouts.wizard.termsHint")}
              </p>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="payout-legal-name">{t("staffPortal.payouts.fieldLegalName")}</Label>
                <Input
                  id="payout-legal-name"
                  value={legalName}
                  onChange={(e) => setLegalName(e.target.value)}
                  placeholder={t("staffPortal.payouts.wizard.legalNamePlaceholder")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="payout-billing-email">{t("staffPortal.payouts.fieldBillingEmail")}</Label>
                <Input
                  id="payout-billing-email"
                  type="email"
                  value={billingEmail}
                  onChange={(e) => setBillingEmail(e.target.value)}
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground rounded-lg border border-border bg-muted/20 px-3 py-2">
              {t("staffPortal.payouts.wizard.kycDeferredHint")}
            </p>

            <div className="flex items-start justify-between gap-4 rounded-xl border border-border p-4">
              <div className="min-w-0 space-y-1">
                <p className="text-sm font-semibold">{t("staffPortal.payouts.feePresentationTitle")}</p>
                <p className="text-xs text-muted-foreground">
                  {absorbAllFees
                    ? t("staffPortal.payouts.feePresentationAbsorbActive")
                    : t("staffPortal.payouts.feePresentationPassThroughActive")}
                </p>
              </div>
              <Switch
                checked={absorbAllFees}
                onCheckedChange={(checked) => void handleFeePresentationToggle(checked)}
                disabled={savingPayoutProfile}
              />
            </div>

            <label className="flex items-start gap-3 rounded-xl border border-border p-4 cursor-pointer">
              <input
                type="checkbox"
                className="mt-1 accent-primary"
                checked={termsChecked}
                onChange={(e) => setTermsChecked(e.target.checked)}
              />
              <span className="text-sm text-muted-foreground leading-relaxed">
                {absorbAllFees
                  ? t("staffPortal.payouts.termsTextAbsorb")
                  : t("staffPortal.payouts.termsTextPassThrough")}
              </span>
            </label>
          </div>

          <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-between">
            <Button type="button" variant="outline" onClick={goBack}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              {t("staffPortal.payouts.wizard.back")}
            </Button>
            <Button
              type="button"
              onClick={() => void handleTermsContinue()}
              disabled={savingPayoutProfile || acceptingPayoutTerms}
            >
              {savingPayoutProfile || acceptingPayoutTerms ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : null}
              {t("staffPortal.payouts.wizard.continue")}
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      ) : null}

      {step === "connect" ? (
        <div className="space-y-4 animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
          <div className="card-sport p-5 space-y-4">
            <div>
              <h2 className="font-semibold text-lg">{t("staffPortal.payouts.wizard.connectTitle")}</h2>
              <p className="text-sm text-muted-foreground mt-1">
                {selectedRail === "mercadopago"
                  ? t("staffPortal.payouts.wizard.connectHintMp")
                  : t("staffPortal.payouts.wizard.connectHintStripe")}
              </p>
            </div>

            {!tribooComplete ? (
              <p className="text-sm text-destructive">
                {t("staffPortal.payouts.completeTribooFirst")}
              </p>
            ) : null}

            {payoutOnboardError ? (
              <p className="text-sm text-destructive">{payoutOnboardError}</p>
            ) : null}

            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                className="flex-1"
                onClick={() => void handleOnboard()}
                disabled={!tribooComplete || onboardingPayouts || (selectedRail === "mercadopago" && !mpAvailable)}
              >
                {onboardingPayouts ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <ExternalLink className="w-4 h-4 mr-2" />
                )}
                {selectedRail === "mercadopago"
                  ? t("staffPortal.payouts.mpConnectCta")
                  : t("staffPortal.payouts.continueVerification")}
              </Button>
              <Button
                variant="outline"
                onClick={() => void dispatch(syncOrganizerPayouts())}
                disabled={syncingPayouts}
              >
                {syncingPayouts ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <RefreshCw className="w-4 h-4 mr-2" />
                )}
                {t("staffPortal.payouts.syncStatus")}
              </Button>
              {org.stripe_account_id ? (
                <Button
                  variant="outline"
                  onClick={() => void handleOpenDashboard()}
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
          </div>

          <ChecklistSection
            title={t("staffPortal.payouts.bankVerificationSectionTitle")}
            hint={t("staffPortal.payouts.bankVerificationSectionHint")}
            items={payoutStatus.stripeChecklist.items}
            itemKeyPrefix="staffPortal.payouts.bankVerificationItem"
          />

          {mpAvailable && payoutStatus.mercadoPagoChecklist ? (
            <ChecklistSection
              title={t("staffPortal.payouts.mpSectionTitle")}
              hint={t("staffPortal.payouts.mpSectionHint")}
              items={payoutStatus.mercadoPagoChecklist.items}
              itemKeyPrefix="staffPortal.payouts.mpItem"
            />
          ) : null}

          <div className="flex justify-between gap-2">
            <Button type="button" variant="outline" onClick={goBack}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              {t("staffPortal.payouts.wizard.back")}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setStep("compare")}>
              {t("staffPortal.payouts.wizard.restart")}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

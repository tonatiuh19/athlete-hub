import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFormik } from "formik";
import { ArrowLeft, Loader2, Receipt } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { DiscountValidateResponse, EventCategory, EventExtra, EventRegistrationField, FeePresentation, RegistrationCheckoutExtraLine } from "@shared/api";
import { computeCheckoutWithExtras } from "@shared/checkoutBreakdown";
import {
  buildRegistrationFieldInitialValues,
  normalizeCheckoutFieldValues,
  normalizeRegistrationField,
  sortRegistrationFields,
} from "@shared/registrationFields";
import RegistrationFieldInput from "@/components/events/registration/RegistrationFieldInput";
import CheckoutDiscountField from "@/components/events/registration/CheckoutDiscountField";
import StripeCheckout from "@/components/events/registration/StripePaymentForm";
import MercadoPagoCheckout from "@/components/events/registration/MercadoPagoCheckout";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  confirmRegistration,
  createRegistrationCheckout,
  joinEventWaitlist,
  resetCheckoutSession,
  setCheckoutError,
  setDiscountCodeInput,
  setPaymentFailure,
  validateDiscountCode,
} from "@/store/slices/registrationCheckoutSlice";
import { formatPriceMxn } from "@/utils/eventFormat";
import { Link } from "react-router-dom";
import api, { athleteAuthHeaders } from "@/lib/api";
import {
  checkoutErrorIsEligibility,
  checkoutErrorMessage,
  checkoutErrorNeedsProfile,
  type CheckoutErrorPayload,
} from "@/utils/registrationCheckoutErrors";
import { resolveAppliedDiscountCode } from "@/utils/registrationCheckoutDiscount";
import { registrationCheckoutIsReady } from "@/utils/registrationCheckoutPayment";
import { buildRegistrationFieldsYupSchema } from "@/utils/registrationFieldsFormik";
import LegalConsentNotice from "@/components/legal/LegalConsentNotice";
import {
  prerequisiteGapFromCheckoutError,
  type RegistrationPrerequisiteGap,
} from "@/utils/registrationWizardPrerequisites";

export type CheckoutUiPhase = "details" | "payment";

interface WizardCheckoutStepProps {
  slug: string;
  eventTitle: string;
  category: EventCategory;
  fields: EventRegistrationField[];
  serviceFeePercent: number;
  feePresentation: FeePresentation;
  idempotencyKey: string;
  restoredFieldValues?: Record<string, string | boolean> | null;
  checkoutPaymentReady: boolean;
  onCheckoutPaymentReady: (ready: boolean) => void;
  /** Persist registration details when athlete continues to payment. */
  onFieldValuesChange?: (values: Record<string, string | boolean>) => void;
  needsWaiver?: boolean;
  hasWaiverAcceptance?: boolean;
  onPrerequisiteMissing?: (gap: RegistrationPrerequisiteGap) => void;
  eventExtras?: EventExtra[];
}

function CheckoutOrderSummary({
  eventTitle,
  categoryName,
  priceCents,
  serviceFeeCents,
  totalCents,
  displayIvaCents,
  organizerFiscalNetCents,
  serviceFeePercent,
  feePresentation,
  discountPreview,
  language,
  extras = [],
  extrasSubtotalCents = 0,
  /** Compact: total-first row; expand for line items (mobile details step). */
  compact = false,
}: {
  eventTitle: string;
  categoryName: string;
  priceCents: number;
  serviceFeeCents: number;
  totalCents: number;
  displayIvaCents?: number;
  organizerFiscalNetCents?: number;
  feePresentation: FeePresentation;
  serviceFeePercent: number;
  discountPreview: DiscountValidateResponse | null;
  language: string;
  extras?: RegistrationCheckoutExtraLine[];
  extrasSubtotalCents?: number;
  compact?: boolean;
}) {
  const { t } = useTranslation();
  const absorbAll = feePresentation === "absorb_all";

  const lineItems = (
    <div className="space-y-1 text-xs text-muted-foreground">
      {absorbAll ? (
        <div className="flex justify-between">
          <span>{t("registrationWizard.checkout.finalPrice")}</span>
          <span>{formatPriceMxn(priceCents, language)}</span>
        </div>
      ) : (
        <>
          <div className="flex justify-between">
            <span>{t("eventDetail.inscription")}</span>
            <span>{formatPriceMxn(priceCents, language)}</span>
          </div>
          <div className="flex justify-between">
            <span>{t("eventDetail.serviceFee")}</span>
            <span>{formatPriceMxn(serviceFeeCents, language)}</span>
          </div>
        </>
      )}
      {extras.map((line) => (
        <div key={line.extraId} className="flex justify-between pl-2 border-l border-border/60">
          <span className="truncate pr-2">
            {line.name}
            {line.quantity > 1 ? ` ×${line.quantity}` : ""}
          </span>
          <span className="shrink-0">{formatPriceMxn(line.totalCents, language)}</span>
        </div>
      ))}
      {extrasSubtotalCents > 0 ? (
        <div className="flex justify-between text-muted-foreground">
          <span>{t("registrationWizard.checkout.extrasSubtotal")}</span>
          <span>{formatPriceMxn(extrasSubtotalCents, language)}</span>
        </div>
      ) : null}
      {discountPreview?.valid && discountPreview.discountAmountCents > 0 ? (
        <div className="flex justify-between text-accent">
          <span>{t("registrationWizard.checkout.discountApplied")}</span>
          <span>−{formatPriceMxn(discountPreview.discountAmountCents, language)}</span>
        </div>
      ) : null}
      {!compact ? (
        <div className="flex justify-between font-bold text-primary pt-1 border-t border-border">
          <span>{t("eventDetail.total")}</span>
          <span>{formatPriceMxn(totalCents, language)}</span>
        </div>
      ) : null}
      {absorbAll && displayIvaCents != null ? (
        <details className="pt-2 text-[11px] text-muted-foreground">
          <summary className="cursor-pointer text-muted-foreground">
            {t("registrationWizard.checkout.invoicePreviewToggle")}
          </summary>
          <div className="mt-2 space-y-1 pl-1">
            <div className="flex justify-between">
              <span>
                {t("registrationWizard.checkout.invoiceServiceFeePercent", {
                  percent: serviceFeePercent,
                })}
              </span>
              <span>{formatPriceMxn(serviceFeeCents, language)}</span>
            </div>
            <div className="flex justify-between">
              <span>{t("registrationWizard.checkout.invoiceIva")}</span>
              <span>{formatPriceMxn(displayIvaCents, language)}</span>
            </div>
            {organizerFiscalNetCents != null ? (
              <div className="flex justify-between">
                <span>{t("registrationWizard.checkout.invoiceOrganizerPortion")}</span>
                <span>{formatPriceMxn(organizerFiscalNetCents, language)}</span>
              </div>
            ) : null}
          </div>
        </details>
      ) : null}
    </div>
  );

  if (compact) {
    return (
      <details className="rounded-xl border border-border bg-muted/40 group">
        <summary className="flex items-center gap-3 p-3 cursor-pointer list-none [&::-webkit-details-marker]:hidden">
          <Receipt className="w-4 h-4 text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[11px] text-muted-foreground truncate">{categoryName}</p>
            <p className="text-sm font-bold text-primary tabular-nums">
              {t("eventDetail.total")}: {formatPriceMxn(totalCents, language)}
            </p>
          </div>
          <span className="text-[11px] text-muted-foreground shrink-0 group-open:hidden">
            {t("registrationWizard.checkout.summaryExpand")}
          </span>
          <span className="text-[11px] text-muted-foreground shrink-0 hidden group-open:inline">
            {t("registrationWizard.checkout.summaryCollapse")}
          </span>
        </summary>
        <div className="px-3 pb-3 pt-0 border-t border-border/60 mt-0">
          <p className="text-[11px] text-muted-foreground truncate py-2">{eventTitle}</p>
          {lineItems}
        </div>
      </details>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card/40 p-4">
      <div className="flex items-start gap-3">
        <Receipt className="w-5 h-5 text-primary shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground truncate">{eventTitle}</p>
          <p className="text-sm font-bold text-foreground">{categoryName}</p>
          <div className="mt-3">{lineItems}</div>
        </div>
      </div>
    </div>
  );
}

export default function WizardCheckoutStep({
  slug,
  eventTitle,
  category,
  fields,
  serviceFeePercent,
  feePresentation,
  idempotencyKey,
  restoredFieldValues,
  checkoutPaymentReady,
  onCheckoutPaymentReady,
  onFieldValuesChange,
  needsWaiver = false,
  hasWaiverAcceptance = false,
  onPrerequisiteMissing,
  eventExtras = [],
}: WizardCheckoutStepProps) {
  const { t, i18n } = useTranslation();
  const dispatch = useAppDispatch();
  const {
    checkout,
    paymentConfig,
    loadingConfig,
    loadingCheckout,
    loadingConfirm,
    loadingDiscount,
    discountPreview,
    discountCode,
    error,
    waiverAcceptance,
    joiningWaitlist,
    waitlistEntryId,
    waitlistClaimMode,
    pending3dsClientSecret,
    selectedExtras,
    extraFieldAnswers,
    simulationToken,
  } = useAppSelector((s) => s.registrationCheckout);
  const athleteEmail = useAppSelector((s) => s.athleteAuth.user?.email);

  const [fieldsLocked, setFieldsLocked] = useState(false);
  const [discountInput, setDiscountInput] = useState(discountCode);
  const [pendingFieldValues, setPendingFieldValues] = useState<
    Record<string, string | boolean> | null
  >(null);
  const [waitlistOffered, setWaitlistOffered] = useState(false);
  const [checkoutNeedsProfile, setCheckoutNeedsProfile] = useState(false);
  const [checkoutIsEligibility, setCheckoutIsEligibility] = useState(false);
  const [discountRevalidateAttempted, setDiscountRevalidateAttempted] = useState(false);
  const checkoutEnsureInFlight = useRef(false);

  const normalizedFields = useMemo(
    () => sortRegistrationFields(fields).map(normalizeRegistrationField),
    [fields],
  );

  const uiPhase: CheckoutUiPhase =
    checkout || checkoutPaymentReady || fieldsLocked ? "payment" : "details";

  const appliedDiscountCode = resolveAppliedDiscountCode(discountPreview, discountCode);

  const absorbAll = feePresentation === "absorb_all";
  const priceCents = discountPreview?.priceCents ?? category.price_cents;
  const displayIvaCents =
    discountPreview?.displayIvaCents ?? category.display_iva_cents;
  const organizerFiscalNetCents =
    discountPreview?.organizerFiscalNetCents ?? category.organizer_fiscal_net_cents;

  const previewExtraLines = useMemo(() => {
    if (checkout?.extras?.length) return checkout.extras;
    return selectedExtras
      .map((row) => {
        const extra = eventExtras.find((e) => e.id === row.extraId);
        if (!extra) return null;
        return {
          extraId: extra.id,
          name: extra.name,
          quantity: row.quantity,
          unitPriceCents: extra.price_cents,
          totalCents: extra.price_cents * row.quantity,
        };
      })
      .filter(Boolean) as RegistrationCheckoutExtraLine[];
  }, [checkout?.extras, selectedExtras, eventExtras]);

  const previewExtrasSubtotal =
    checkout?.extrasSubtotalCents ??
    previewExtraLines.reduce((sum, line) => sum + line.totalCents, 0);

  const combinedCheckoutPreview = useMemo(
    () =>
      computeCheckoutWithExtras({
        categoryListPriceCents: priceCents,
        extrasSubtotalCents: previewExtrasSubtotal,
        serviceFeePercent,
        feePresentation,
      }),
    [priceCents, previewExtrasSubtotal, serviceFeePercent, feePresentation],
  );

  const totalCents = checkout?.amountCents ?? combinedCheckoutPreview.athleteTotalCents;
  const serviceFeeCents =
    checkout?.serviceFeeCents ??
    discountPreview?.serviceFeeCents ??
    combinedCheckoutPreview.serviceFeeCents ??
    category.service_fee_cents ??
    Math.round(category.price_cents * (serviceFeePercent / 100));

  const handleCheckout = useCallback(
    async (values: Record<string, string | boolean>) => {
      if (needsWaiver && !hasWaiverAcceptance) {
        onPrerequisiteMissing?.("waiver");
        return;
      }
      const fieldValues = normalizeCheckoutFieldValues(values, normalizedFields);
      onFieldValuesChange?.(fieldValues);
      const result = await dispatch(
        createRegistrationCheckout({
          slug,
          categoryId: category.id,
          fieldValues,
          idempotencyKey,
          waiverSignatures: waiverAcceptance ?? undefined,
          discountCode: appliedDiscountCode,
          waitlistEntryId: waitlistClaimMode ? waitlistEntryId ?? undefined : undefined,
          selectedExtras: selectedExtras.length > 0 ? selectedExtras : undefined,
          extraFieldAnswers: extraFieldAnswers.length > 0 ? extraFieldAnswers : undefined,
          simulationToken: simulationToken || undefined,
        }),
      );
      if (createRegistrationCheckout.fulfilled.match(result)) {
        setFieldsLocked(true);
        setWaitlistOffered(false);
        onCheckoutPaymentReady(true);
        // Never auto-confirm $0 — athlete must review discount / free total and tap Confirm.
      } else if (createRegistrationCheckout.rejected.match(result)) {
        const payload = result.payload as CheckoutErrorPayload;
        if (payload === "WAITLIST_AVAILABLE") {
          setWaitlistOffered(true);
          return;
        }
        if (payload === "ALREADY_REGISTERED") {
          dispatch(setPaymentFailure(t("registrationWizard.checkout.alreadyRegistered")));
          return;
        }
        const message = checkoutErrorMessage(payload, t);
        const gap = prerequisiteGapFromCheckoutError(
          typeof payload === "string" ? payload : payload?.message ?? message,
        );
        if (gap && onPrerequisiteMissing) {
          onPrerequisiteMissing(gap);
          return;
        }
        setCheckoutNeedsProfile(checkoutErrorNeedsProfile(payload));
        setCheckoutIsEligibility(checkoutErrorIsEligibility(payload));
        dispatch(setCheckoutError(message));
      }
    },
    [
      appliedDiscountCode,
      category.id,
      dispatch,
      hasWaiverAcceptance,
      idempotencyKey,
      needsWaiver,
      normalizedFields,
      onCheckoutPaymentReady,
      onFieldValuesChange,
      onPrerequisiteMissing,
      slug,
      t,
      waitlistClaimMode,
      waitlistEntryId,
      waiverAcceptance,
      selectedExtras,
      extraFieldAnswers,
      simulationToken,
    ],
  );

  const formik = useFormik({
    enableReinitialize: true,
    initialValues: {
      ...buildRegistrationFieldInitialValues(normalizedFields),
      ...(restoredFieldValues ?? {}),
    },
    validationSchema: buildRegistrationFieldsYupSchema(normalizedFields, t),
    onSubmit: async (values) => {
      if (needsWaiver && !hasWaiverAcceptance) {
        onPrerequisiteMissing?.("waiver");
        return;
      }
      const normalized = normalizeCheckoutFieldValues(values, normalizedFields);
      setPendingFieldValues(normalized);
      onFieldValuesChange?.(normalized);
      setFieldsLocked(true);
      onCheckoutPaymentReady(true);
      setCheckoutIsEligibility(false);
      dispatch(setCheckoutError(null));
    },
  });

  useEffect(() => {
    if (uiPhase !== "payment") return;
    if (needsWaiver && !hasWaiverAcceptance) {
      onPrerequisiteMissing?.("waiver");
    }
  }, [uiPhase, needsWaiver, hasWaiverAcceptance, onPrerequisiteMissing]);

  useEffect(() => {
    if (checkout) {
      setFieldsLocked(true);
      onCheckoutPaymentReady(true);
      if (checkout.fieldValues) {
        setPendingFieldValues(checkout.fieldValues);
      }
    }
  }, [checkout, onCheckoutPaymentReady]);

  useEffect(() => {
    if (discountCode && !discountInput) {
      setDiscountInput(discountCode);
    }
  }, [discountCode, discountInput]);

  useEffect(() => {
    if (uiPhase !== "payment" || discountRevalidateAttempted) return;
    if (!discountCode.trim() || discountPreview?.valid) return;
    setDiscountRevalidateAttempted(true);
    void dispatch(
      validateDiscountCode({
        slug,
        code: discountCode.trim(),
        categoryId: category.id,
      }),
    );
  }, [
    uiPhase,
    discountCode,
    discountPreview,
    discountRevalidateAttempted,
    dispatch,
    slug,
    category.id,
  ]);

  const amountLabel = useMemo(
    () => formatPriceMxn(checkout?.amountCents ?? totalCents, i18n.language),
    [checkout, totalCents, i18n.language],
  );

  const handleStripeSuccess = async (paymentIntentId: string) => {
    if (!checkout) return;
    await dispatch(
      confirmRegistration({
        slug,
        paymentPublicUuid: checkout.paymentPublicUuid,
        paymentIntentId,
      }),
    );
  };

  const handlePayWithSavedCard = async (paymentMethodId: string) => {
    if (!checkout) return;
    await dispatch(
      confirmRegistration({
        slug,
        paymentPublicUuid: checkout.paymentPublicUuid,
        paymentMethodId,
      }),
    );
  };

  const handleFreeConfirm = async () => {
    if (!checkout || checkout.amountCents > 0 || loadingConfirm) return;
    await dispatch(
      confirmRegistration({
        slug,
        paymentPublicUuid: checkout.paymentPublicUuid,
      }),
    );
  };

  const handleStripeError = (message: string) => {
    dispatch(setPaymentFailure(message));
  };

  const handleApplyDiscount = () => {
    dispatch(
      validateDiscountCode({
        slug,
        code: discountInput.trim(),
        categoryId: category.id,
      }),
    );
  };

  const handleDiscountInputChange = (value: string) => {
    setDiscountInput(value);
    dispatch(setDiscountCodeInput(value));
    setCheckoutIsEligibility(false);
    dispatch(setCheckoutError(null));
  };

  const handleBackToDetails = () => {
    if (loadingCheckout || loadingConfirm) return;
    const keep =
      pendingFieldValues ??
      checkout?.fieldValues ??
      restoredFieldValues ??
      normalizeCheckoutFieldValues(formik.values, normalizedFields);
    dispatch(resetCheckoutSession());
    setFieldsLocked(false);
    onCheckoutPaymentReady(false);
    if (keep && Object.keys(keep).length > 0) {
      setPendingFieldValues(keep);
      onFieldValuesChange?.(keep);
      void formik.setValues({
        ...buildRegistrationFieldInitialValues(normalizedFields),
        ...keep,
      });
    }
  };

  const handlePreparePayment = useCallback(async () => {
    const values =
      pendingFieldValues ??
      checkout?.fieldValues ??
      normalizeCheckoutFieldValues(formik.values, normalizedFields);
    await handleCheckout(values);
  }, [pendingFieldValues, checkout?.fieldValues, formik.values, normalizedFields, handleCheckout]);

  const showMp = Boolean(
    registrationCheckoutIsReady(checkout, totalCents, appliedDiscountCode) &&
      checkout &&
      checkout.amountCents > 0 &&
      checkout.provider === "mercadopago" &&
      checkout.mpPreferenceId &&
      checkout.mpPublicKey,
  );

  const showStripe = Boolean(
    registrationCheckoutIsReady(checkout, totalCents, appliedDiscountCode) &&
      checkout &&
      checkout.amountCents > 0 &&
      checkout.provider !== "mercadopago" &&
      checkout.clientSecret &&
      paymentConfig?.publishableKey,
  );

  const hasBlockingFileField = normalizedFields.some(
    (f) => f.field_type === "file" && f.is_required,
  );

  const paymentLocked = loadingCheckout || loadingConfirm;

  const preparingPayment =
    uiPhase === "payment" &&
    (loadingConfig ||
      loadingCheckout ||
      (!registrationCheckoutIsReady(checkout, totalCents, appliedDiscountCode) &&
        !error &&
        totalCents >= 0));

  useEffect(() => {
    if (uiPhase !== "payment") return;
    if (loadingDiscount || loadingCheckout || checkoutEnsureInFlight.current) return;
    if (registrationCheckoutIsReady(checkout, totalCents, appliedDiscountCode)) return;
    if (error && error !== "WAITLIST_AVAILABLE") return;

    const values =
      pendingFieldValues ??
      checkout?.fieldValues ??
      normalizeCheckoutFieldValues(formik.values, normalizedFields);

    // Stripe needs publishable key; MP does not use Stripe config
    const needsStripeKey = checkout?.provider !== "mercadopago";
    if (totalCents > 0 && needsStripeKey && !paymentConfig?.publishableKey && !checkout) {
      // still allow first checkout create — server decides rail
    }

    checkoutEnsureInFlight.current = true;
    void handleCheckout(values).finally(() => {
      checkoutEnsureInFlight.current = false;
    });
  }, [
    uiPhase,
    totalCents,
    appliedDiscountCode,
    checkout,
    loadingDiscount,
    loadingCheckout,
    loadingConfig,
    paymentConfig?.publishableKey,
    error,
    pendingFieldValues,
    formik.values,
    normalizedFields,
    handleCheckout,
  ]);

  const handleMpCardPay = async (payload: {
    token: string;
    paymentMethodId: string;
    installments: number;
  }) => {
    if (!checkout) return;
    try {
      const { data } = await api.post<{
        success?: boolean;
        pending?: boolean;
        error?: string;
      }>(
        `/events/${slug}/register/mp/pay`,
        {
          paymentPublicUuid: checkout.paymentPublicUuid,
          token: payload.token,
          paymentMethodId: payload.paymentMethodId,
          installments: payload.installments,
        },
        { headers: athleteAuthHeaders },
      );
      if (data.pending) {
        dispatch(setCheckoutError(t("registrationWizard.payment.mpPendingOxxo")));
        return;
      }
      if (data.success) {
        await dispatch(
          confirmRegistration({
            slug,
            paymentPublicUuid: checkout.paymentPublicUuid,
          }),
        );
      } else {
        dispatch(
          setPaymentFailure(data.error || t("registrationWizard.payment.failed")),
        );
      }
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { error?: string } } };
      dispatch(
        setPaymentFailure(
          ax.response?.data?.error || t("registrationWizard.payment.failed"),
        ),
      );
    }
  };

  const renderWaitlistOffer = () =>
    waitlistOffered ? (
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-3">
        <p className="text-sm text-amber-200">
          {t("registrationWizard.checkout.soldOutWaitlistHint")}
        </p>
        <Button
          type="button"
          disabled={joiningWaitlist}
          onClick={() => dispatch(joinEventWaitlist({ slug, categoryId: category.id }))}
          className="w-full bg-amber-500/10 text-amber-400 border border-amber-500/40"
        >
          {joiningWaitlist ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            t("eventDetail.joinWaitlist")
          )}
        </Button>
      </div>
    ) : null;

  const renderCheckoutError = () =>
    error && error !== "WAITLIST_AVAILABLE" ? (
      <div className="space-y-2">
        <p className="text-sm text-destructive">{error}</p>
        {checkoutNeedsProfile ? (
          <Button asChild size="sm" variant="outline" className="border-primary/40">
            <Link to="/portal/profile">{t("eventDetail.completeProfileCta")}</Link>
          </Button>
        ) : null}
      </div>
    ) : null;

  return (
    <div className="space-y-6">
      {athleteEmail ? (
        <div className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
          {t("registrationWizard.checkout.purchasingAs", { email: athleteEmail })}
        </div>
      ) : null}
      {uiPhase === "details" ? (
        <div className="space-y-4 pb-24">
          <CheckoutOrderSummary
            eventTitle={eventTitle}
            categoryName={category.name}
            priceCents={priceCents}
            serviceFeeCents={serviceFeeCents}
            totalCents={totalCents}
            displayIvaCents={displayIvaCents}
            organizerFiscalNetCents={organizerFiscalNetCents}
            feePresentation={feePresentation}
            serviceFeePercent={serviceFeePercent}
            discountPreview={discountPreview}
            language={i18n.language}
            extras={previewExtraLines}
            extrasSubtotalCents={previewExtrasSubtotal}
            compact
          />

          {normalizedFields.length > 0 ? (
            <form
              id="registration-details-form"
              onSubmit={formik.handleSubmit}
              className="space-y-4"
            >
              <h3 className="text-sm font-bold text-foreground">
                {t("registrationWizard.checkout.prerequisites")}
              </h3>
              <p className="text-xs text-muted-foreground -mt-2">
                {t("registrationWizard.checkout.prerequisitesHint")}
              </p>

              {hasBlockingFileField ? (
                <p className="text-sm text-destructive rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2">
                  {t("registrationWizard.checkout.fileRequiredBlocked")}
                </p>
              ) : null}

              {normalizedFields.map((field) => {
                const fieldError = formik.errors[field.field_key];
                const fieldTouched = formik.touched[field.field_key];
                const showFieldError = Boolean(fieldTouched && fieldError);

                return (
                  <div key={field.id} className="space-y-2">
                    {field.field_type !== "checkbox" ? (
                      <Label className="text-muted-foreground">
                        {field.label}
                        {field.is_required ? " *" : ""}
                      </Label>
                    ) : null}

                    <RegistrationFieldInput
                      field={field}
                      value={
                        formik.values[field.field_key] ??
                        (field.field_type === "checkbox" ? false : "")
                      }
                      disabled={fieldsLocked}
                      onValueChange={(key, val) => {
                        formik.setFieldValue(key, val);
                        formik.setFieldTouched(key, true, false);
                      }}
                      onBlur={(key) => formik.setFieldTouched(key, true)}
                    />

                    {showFieldError ? (
                      <p className="text-xs text-destructive">{String(fieldError)}</p>
                    ) : null}
                  </div>
                );
              })}

              {renderCheckoutError()}
              {renderWaitlistOffer()}

              <LegalConsentNotice variant="checkout" />
            </form>
          ) : (
            <div className="space-y-3">
              {waitlistClaimMode ? (
                <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 text-sm text-primary">
                  {t("registrationWizard.checkout.claimHint")}
                </div>
              ) : null}
              {renderCheckoutError()}
              {renderWaitlistOffer()}
              <LegalConsentNotice variant="checkout" />
            </div>
          )}

          <div className="sticky bottom-0 -mx-4 px-4 pt-3 pb-1 bg-gradient-to-t from-background via-background to-background/80 border-t border-border/60">
            {normalizedFields.length > 0 ? (
              <Button
                type="submit"
                form="registration-details-form"
                disabled={fieldsLocked || hasBlockingFileField}
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90 shadow-md"
              >
                {t("registrationWizard.checkout.continueToPayment")}
              </Button>
            ) : (
              <Button
                type="button"
                onClick={() => {
                  setPendingFieldValues({});
                  onFieldValuesChange?.({});
                  setFieldsLocked(true);
                  onCheckoutPaymentReady(true);
                  dispatch(setCheckoutError(null));
                }}
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90 shadow-md"
              >
                {t("registrationWizard.checkout.continueToPayment")}
              </Button>
            )}
          </div>
        </div>
      ) : (
        <>
          {!loadingCheckout && !loadingConfirm ? (
            <button
              type="button"
              onClick={handleBackToDetails}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              {t("registrationWizard.checkout.backToDetails")}
            </button>
          ) : null}

          <CheckoutOrderSummary
            eventTitle={eventTitle}
            categoryName={category.name}
            priceCents={priceCents}
            serviceFeeCents={serviceFeeCents}
            totalCents={totalCents}
            displayIvaCents={displayIvaCents}
            organizerFiscalNetCents={organizerFiscalNetCents}
            feePresentation={feePresentation}
            serviceFeePercent={serviceFeePercent}
            discountPreview={discountPreview}
            language={i18n.language}
            extras={previewExtraLines}
            extrasSubtotalCents={previewExtrasSubtotal}
          />

          <div className="space-y-4 pt-1 border-t border-border/60">
            <div>
              <h3 className="text-sm font-bold text-foreground">
                {t("registrationWizard.payment.title")}
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                {t("registrationWizard.checkout.paymentSectionHint")}
              </p>
            </div>

            <CheckoutDiscountField
              value={discountInput}
              onChange={handleDiscountInputChange}
              onApply={handleApplyDiscount}
              loading={loadingDiscount}
              disabled={paymentLocked}
              preview={discountPreview}
            />

            {renderCheckoutError()}
            {renderWaitlistOffer()}

            {preparingPayment ? (
              <div className="rounded-xl border border-border bg-card/60 p-6 flex flex-col items-center gap-3 text-muted-foreground">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
                <p className="text-xs text-center">
                  {t("registrationWizard.payment.preparing")}
                </p>
              </div>
            ) : null}

            {!preparingPayment &&
            totalCents > 0 &&
            !showStripe &&
            !showMp &&
            !paymentConfig?.publishableKey &&
            checkout?.provider !== "mercadopago" ? (
              <p className="text-sm text-destructive rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2">
                {t("registrationWizard.payment.unavailable")}
              </p>
            ) : null}

            <LegalConsentNotice variant="checkout" />

            {!preparingPayment &&
            checkout &&
            checkout.amountCents === 0 &&
            registrationCheckoutIsReady(checkout, totalCents, appliedDiscountCode) ? (
              <div className="space-y-3 rounded-xl border border-accent/40 bg-accent/5 p-4">
                <div>
                  <h4 className="text-sm font-bold text-foreground">
                    {t("registrationWizard.payment.freeTitle")}
                  </h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t("registrationWizard.payment.freeHint")}
                  </p>
                </div>
                {(checkout.discountAmountCents ?? discountPreview?.discountAmountCents ?? 0) >
                0 ? (
                  <div className="flex justify-between text-sm font-semibold text-accent">
                    <span>{t("registrationWizard.checkout.discountApplied")}</span>
                    <span>
                      −
                      {formatPriceMxn(
                        checkout.discountAmountCents ??
                          discountPreview?.discountAmountCents ??
                          0,
                        i18n.language,
                      )}
                    </span>
                  </div>
                ) : null}
                <div className="flex justify-between text-sm font-bold text-primary border-t border-border/60 pt-2">
                  <span>{t("eventDetail.total")}</span>
                  <span>{formatPriceMxn(0, i18n.language)}</span>
                </div>
                <Button
                  type="button"
                  disabled={loadingConfirm || paymentLocked}
                  onClick={() => void handleFreeConfirm()}
                  className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  {loadingConfirm ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    t("registrationWizard.payment.confirmFree")
                  )}
                </Button>
              </div>
            ) : null}

            {showMp && checkout?.mpPreferenceId && checkout.mpPublicKey ? (
              <MercadoPagoCheckout
                publicKey={checkout.mpPublicKey}
                preferenceId={checkout.mpPreferenceId}
                amountCents={totalCents}
                amountLabel={amountLabel}
                loading={loadingConfirm}
                onSubmitCard={handleMpCardPay}
                onError={(message) => dispatch(setPaymentFailure(message))}
              />
            ) : null}

            {showStripe && checkout && paymentConfig ? (
              <StripeCheckout
                clientSecret={checkout.clientSecret!}
                publishableKey={paymentConfig.publishableKey}
                amountLabel={amountLabel}
                loading={loadingConfirm}
                actionClientSecret={pending3dsClientSecret}
                onStripeSuccess={handleStripeSuccess}
                onStripeError={handleStripeError}
                onPayWithSavedCard={handlePayWithSavedCard}
              />
            ) : null}

            {!preparingPayment &&
            !showStripe &&
            !showMp &&
            error &&
            error !== "WAITLIST_AVAILABLE" &&
            !checkoutIsEligibility ? (
              <Button
                type="button"
                disabled={loadingCheckout}
                onClick={() => void handlePreparePayment()}
                className="w-full bg-cyan/10 text-primary border border-cyan/40"
              >
                {loadingCheckout ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  t("registrationWizard.checkout.retryPaymentSetup")
                )}
              </Button>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}

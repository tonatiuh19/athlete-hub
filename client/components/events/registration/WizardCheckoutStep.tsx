import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFormik } from "formik";
import * as Yup from "yup";
import { ArrowLeft, Loader2, Receipt } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { DiscountValidateResponse, EventCategory, EventRegistrationField, FeePresentation } from "@shared/api";
import {
  buildRegistrationFieldInitialValues,
  normalizeCheckoutFieldValues,
  normalizeRegistrationField,
  sortRegistrationFields,
} from "@shared/registrationFields";
import RegistrationFieldInput from "@/components/events/registration/RegistrationFieldInput";
import CheckoutDiscountField from "@/components/events/registration/CheckoutDiscountField";
import StripeCheckout from "@/components/events/registration/StripePaymentForm";
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
import {
  checkoutErrorMessage,
  checkoutErrorNeedsProfile,
  type CheckoutErrorPayload,
} from "@/utils/registrationCheckoutErrors";
import { resolveAppliedDiscountCode } from "@/utils/registrationCheckoutDiscount";
import { registrationCheckoutIsReady } from "@/utils/registrationCheckoutPayment";

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
}

function buildValidationSchema(
  fields: ReturnType<typeof normalizeRegistrationField>[],
  t: (k: string) => string,
) {
  const shape: Record<string, Yup.AnySchema> = {};
  for (const f of fields) {
    if (f.field_type === "file") {
      if (f.is_required) {
        shape[f.field_key] = Yup.mixed().test(
          "file-required",
          t("registrationWizard.checkout.fileNotSupported"),
          () => false,
        );
      }
      continue;
    }
    if (f.field_type === "checkbox") {
      shape[f.field_key] = f.is_required
        ? Yup.boolean().oneOf([true], t("common.required"))
        : Yup.boolean();
      continue;
    }
    let schema = Yup.string().trim();
    if (f.is_required) schema = schema.required(t("common.required"));
    if (f.field_type === "select" && (f.options_json?.length ?? 0) > 0) {
      const opts = f.options_json!;
      schema = f.is_required
        ? schema.oneOf(opts, t("registrationWizard.checkout.invalidOption"))
        : schema.test(
            "optional-select",
            t("registrationWizard.checkout.invalidOption"),
            (v) => !v || opts.includes(v),
          );
    }
    if (f.field_type === "number") {
      const numberPattern = /^-?\d+(\.\d+)?$/;
      schema = f.is_required
        ? schema.matches(numberPattern, t("registrationWizard.checkout.invalidNumber"))
        : schema.test(
            "optional-number",
            t("registrationWizard.checkout.invalidNumber"),
            (v) => !v || numberPattern.test(v),
          );
    }
    if (f.field_type === "date") {
      const datePattern = /^\d{4}-\d{2}-\d{2}$/;
      schema = f.is_required
        ? schema.matches(datePattern, t("registrationWizard.checkout.invalidDate"))
        : schema.test(
            "optional-date",
            t("registrationWizard.checkout.invalidDate"),
            (v) => !v || datePattern.test(v),
          );
    }
    shape[f.field_key] = schema;
  }
  return Yup.object(shape);
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
}) {
  const { t } = useTranslation();
  const absorbAll = feePresentation === "absorb_all";

  return (
    <div className="rounded-xl border border-gray-700/50 bg-surface-dark/40 p-4">
      <div className="flex items-start gap-3">
        <Receipt className="w-5 h-5 text-cyan shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-xs text-gray-500 truncate">{eventTitle}</p>
          <p className="text-sm font-bold text-white">{categoryName}</p>
          <div className="mt-3 space-y-1 text-xs text-gray-400">
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
            {discountPreview?.valid && discountPreview.discountAmountCents > 0 ? (
              <div className="flex justify-between text-accent">
                <span>{t("registrationWizard.checkout.discountApplied")}</span>
                <span>
                  −{formatPriceMxn(discountPreview.discountAmountCents, language)}
                </span>
              </div>
            ) : null}
            <div className="flex justify-between font-bold text-cyan pt-1 border-t border-gray-700/50">
              <span>{t("eventDetail.total")}</span>
              <span>{formatPriceMxn(totalCents, language)}</span>
            </div>
            {absorbAll && displayIvaCents != null ? (
              <details className="pt-2 text-[11px] text-gray-500">
                <summary className="cursor-pointer text-gray-400">
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
  } = useAppSelector((s) => s.registrationCheckout);
  const athleteEmail = useAppSelector((s) => s.athleteAuth.user?.email);

  const [fieldsLocked, setFieldsLocked] = useState(false);
  const [discountInput, setDiscountInput] = useState(discountCode);
  const [pendingFieldValues, setPendingFieldValues] = useState<
    Record<string, string | boolean> | null
  >(null);
  const [waitlistOffered, setWaitlistOffered] = useState(false);
  const [checkoutNeedsProfile, setCheckoutNeedsProfile] = useState(false);
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
  const serviceFeeCents =
    discountPreview?.serviceFeeCents ??
    category.service_fee_cents ??
    Math.round(category.price_cents * (serviceFeePercent / 100));
  const priceCents = discountPreview?.priceCents ?? category.price_cents;
  const totalCents =
    discountPreview?.totalCents ??
    category.total_cents ??
    (absorbAll ? category.price_cents : category.price_cents + serviceFeeCents);
  const displayIvaCents =
    discountPreview?.displayIvaCents ?? category.display_iva_cents;
  const organizerFiscalNetCents =
    discountPreview?.organizerFiscalNetCents ?? category.organizer_fiscal_net_cents;

  const handleCheckout = useCallback(
    async (values: Record<string, string | boolean>) => {
      const fieldValues = normalizeCheckoutFieldValues(values, normalizedFields);
      const result = await dispatch(
        createRegistrationCheckout({
          slug,
          categoryId: category.id,
          fieldValues,
          idempotencyKey,
          waiverSignatures: waiverAcceptance ?? undefined,
          discountCode: appliedDiscountCode,
          waitlistEntryId: waitlistClaimMode ? waitlistEntryId ?? undefined : undefined,
        }),
      );
      if (createRegistrationCheckout.fulfilled.match(result)) {
        setFieldsLocked(true);
        setWaitlistOffered(false);
        onCheckoutPaymentReady(true);
        if (result.payload.amountCents === 0 && result.payload.paymentPublicUuid) {
          await dispatch(
            confirmRegistration({
              slug,
              paymentPublicUuid: result.payload.paymentPublicUuid,
            }),
          );
        }
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
        setCheckoutNeedsProfile(checkoutErrorNeedsProfile(payload));
        dispatch(setCheckoutError(checkoutErrorMessage(payload, t)));
      }
    },
    [
      appliedDiscountCode,
      category.id,
      dispatch,
      idempotencyKey,
      normalizedFields,
      onCheckoutPaymentReady,
      slug,
      t,
      waitlistClaimMode,
      waitlistEntryId,
      waiverAcceptance,
    ],
  );

  const formik = useFormik({
    enableReinitialize: true,
    initialValues: {
      ...buildRegistrationFieldInitialValues(normalizedFields),
      ...(restoredFieldValues ?? {}),
    },
    validationSchema: buildValidationSchema(normalizedFields, t),
    onSubmit: async (values) => {
      const normalized = normalizeCheckoutFieldValues(values, normalizedFields);
      setPendingFieldValues(normalized);
      setFieldsLocked(true);
      onCheckoutPaymentReady(true);
      dispatch(setCheckoutError(null));
    },
  });

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
    dispatch(setCheckoutError(null));
  };

  const handleBackToDetails = () => {
    if (loadingCheckout || loadingConfirm) return;
    dispatch(resetCheckoutSession());
    setFieldsLocked(false);
    onCheckoutPaymentReady(false);
  };

  const handlePreparePayment = useCallback(async () => {
    const values =
      pendingFieldValues ??
      checkout?.fieldValues ??
      normalizeCheckoutFieldValues(formik.values, normalizedFields);
    await handleCheckout(values);
  }, [pendingFieldValues, checkout?.fieldValues, formik.values, normalizedFields, handleCheckout]);

  const showStripe = Boolean(
    registrationCheckoutIsReady(checkout, totalCents, appliedDiscountCode) &&
      checkout &&
      checkout.amountCents > 0 &&
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

    if (totalCents > 0 && !paymentConfig?.publishableKey) return;

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
        <>
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
          />

          {normalizedFields.length > 0 ? (
            <form onSubmit={formik.handleSubmit} className="space-y-4">
              <h3 className="text-sm font-bold text-white">
                {t("registrationWizard.checkout.prerequisites")}
              </h3>
              <p className="text-xs text-gray-500 -mt-2">
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
                      <Label className="text-gray-300">
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

              <Button
                type="submit"
                disabled={fieldsLocked || hasBlockingFileField}
                className="w-full bg-cyan/10 text-cyan border border-cyan/40 hover:bg-cyan hover:text-navy-deep"
              >
                {t("registrationWizard.checkout.continueToPayment")}
              </Button>
            </form>
          ) : (
            <div className="space-y-3">
              {waitlistClaimMode ? (
                <div className="rounded-xl border border-cyan/30 bg-cyan/5 p-3 text-sm text-cyan">
                  {t("registrationWizard.checkout.claimHint")}
                </div>
              ) : null}
              {renderCheckoutError()}
              {renderWaitlistOffer()}
              <Button
                type="button"
                onClick={() => {
                  setPendingFieldValues({});
                  setFieldsLocked(true);
                  onCheckoutPaymentReady(true);
                  dispatch(setCheckoutError(null));
                }}
                className="w-full bg-cyan/10 text-cyan border border-cyan/40 hover:bg-cyan hover:text-navy-deep"
              >
                {t("registrationWizard.checkout.continueToPayment")}
              </Button>
            </div>
          )}
        </>
      ) : (
        <>
          {!loadingCheckout && !loadingConfirm ? (
            <button
              type="button"
              onClick={handleBackToDetails}
              className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-cyan transition-colors"
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
          />

          <div className="space-y-4 pt-1 border-t border-gray-800/60">
            <div>
              <h3 className="text-sm font-bold text-white">
                {t("registrationWizard.payment.title")}
              </h3>
              <p className="text-xs text-gray-500 mt-1">
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
              <div className="rounded-xl border border-gray-700/50 bg-surface-dark/30 p-6 flex flex-col items-center gap-3 text-gray-400">
                <Loader2 className="w-6 h-6 animate-spin text-cyan" />
                <p className="text-xs text-center">
                  {t("registrationWizard.payment.preparing")}
                </p>
              </div>
            ) : null}

            {!preparingPayment &&
            totalCents > 0 &&
            !paymentConfig?.publishableKey ? (
              <p className="text-sm text-destructive rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2">
                {t("registrationWizard.payment.unavailable")}
              </p>
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

            {!preparingPayment && !showStripe && error && error !== "WAITLIST_AVAILABLE" ? (
              <Button
                type="button"
                disabled={loadingCheckout}
                onClick={() => void handlePreparePayment()}
                className="w-full bg-cyan/10 text-cyan border border-cyan/40"
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

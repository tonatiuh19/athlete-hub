import { useMemo, useState } from "react";
import { useFormik } from "formik";
import * as Yup from "yup";
import { Loader2, Receipt, Tag } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { EventCategory, EventRegistrationField } from "@shared/api";
import StripeCheckout from "@/components/events/registration/StripePaymentForm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  confirmRegistration,
  createRegistrationCheckout,
  joinEventWaitlist,
  setDiscountCodeInput,
  setPaymentFailure,
  validateDiscountCode,
} from "@/store/slices/registrationCheckoutSlice";
import { formatPriceMxn } from "@/utils/eventFormat";

interface WizardCheckoutStepProps {
  slug: string;
  eventTitle: string;
  category: EventCategory;
  fields: EventRegistrationField[];
  serviceFeePercent: number;
  idempotencyKey: string;
}

function buildInitialValues(fields: EventRegistrationField[]) {
  const values: Record<string, string | boolean> = {};
  fields.forEach((f) => {
    values[f.field_key] = f.field_type === "checkbox" ? false : "";
  });
  return values;
}

function buildValidationSchema(
  fields: EventRegistrationField[],
  t: (k: string) => string,
) {
  const shape: Record<string, Yup.AnySchema> = {};
  fields.forEach((f) => {
    if (f.field_type === "checkbox") {
      shape[f.field_key] = f.is_required
        ? Yup.boolean().oneOf([true], t("common.required"))
        : Yup.boolean();
    } else {
      let schema = Yup.string();
      if (f.is_required) schema = schema.required(t("common.required"));
      shape[f.field_key] = schema;
    }
  });
  return Yup.object(shape);
}

export default function WizardCheckoutStep({
  slug,
  eventTitle,
  category,
  fields,
  serviceFeePercent,
  idempotencyKey,
}: WizardCheckoutStepProps) {
  const { t, i18n } = useTranslation();
  const dispatch = useAppDispatch();
  const {
    checkout,
    paymentConfig,
    loadingCheckout,
    loadingConfirm,
    loadingDiscount,
    discountCode,
    discountPreview,
    error,
    waiverAcceptance,
    joiningWaitlist,
    waitlistEntryId,
    waitlistClaimMode,
  } = useAppSelector((s) => s.registrationCheckout);
  const [fieldsLocked, setFieldsLocked] = useState(false);
  const [discountInput, setDiscountInput] = useState("");
  const [waitlistOffered, setWaitlistOffered] = useState(false);

  const handleCheckout = async (
    values: Record<string, string | boolean>,
    discount?: string,
  ) => {
    const result = await dispatch(
      createRegistrationCheckout({
        slug,
        categoryId: category.id,
        fieldValues: values,
        idempotencyKey,
        waiverId: waiverAcceptance?.waiverId,
        waiverSignature: waiverAcceptance?.waiverSignature,
        discountCode: discount,
        waitlistEntryId: waitlistClaimMode ? waitlistEntryId ?? undefined : undefined,
      }),
    );
    if (createRegistrationCheckout.fulfilled.match(result)) {
      setFieldsLocked(true);
      setWaitlistOffered(false);
    } else if (
      createRegistrationCheckout.rejected.match(result) &&
      result.payload === "WAITLIST_AVAILABLE"
    ) {
      setWaitlistOffered(true);
    }
  };

  const serviceFeeCents =
    discountPreview?.serviceFeeCents ??
    category.service_fee_cents ??
    Math.round(category.price_cents * (serviceFeePercent / 100));
  const priceCents = discountPreview?.priceCents ?? category.price_cents;
  const totalCents =
    discountPreview?.totalCents ??
    category.total_cents ??
    category.price_cents + serviceFeeCents;
  const appliedDiscountCode = discountPreview?.valid ? discountCode : undefined;

  const formik = useFormik({
    initialValues: buildInitialValues(fields),
    validationSchema: buildValidationSchema(fields, t),
    onSubmit: async (values) => {
      if (!checkout) {
        await handleCheckout(values, appliedDiscountCode);
        return;
      }
    },
  });

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

  const showPayment =
    checkout?.clientSecret && paymentConfig?.publishableKey;

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-gray-700/50 bg-surface-dark/40 p-4">
        <div className="flex items-start gap-3">
          <Receipt className="w-5 h-5 text-cyan shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-500 truncate">{eventTitle}</p>
            <p className="text-sm font-bold text-white">{category.name}</p>
            <div className="mt-3 space-y-1 text-xs text-gray-400">
              <div className="flex justify-between">
                <span>{t("eventDetail.inscription")}</span>
                <span>{formatPriceMxn(priceCents, i18n.language)}</span>
              </div>
              <div className="flex justify-between">
                <span>{t("eventDetail.serviceFee")}</span>
                <span>{formatPriceMxn(serviceFeeCents, i18n.language)}</span>
              </div>
              {discountPreview?.valid && discountPreview.discountAmountCents > 0 ? (
                <div className="flex justify-between text-accent">
                  <span>{t("registrationWizard.checkout.discountApplied")}</span>
                  <span>
                    −{formatPriceMxn(discountPreview.discountAmountCents, i18n.language)}
                  </span>
                </div>
              ) : null}
              <div className="flex justify-between font-bold text-cyan pt-1 border-t border-gray-700/50">
                <span>{t("eventDetail.total")}</span>
                <span>{formatPriceMxn(totalCents, i18n.language)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {!showPayment ? (
        <div className="space-y-2">
          {waitlistClaimMode ? (
            <div className="rounded-xl border border-cyan/30 bg-cyan/5 p-3 text-sm text-cyan">
              {t("registrationWizard.checkout.claimHint")}
            </div>
          ) : null}
          <Label className="text-gray-300 flex items-center gap-2">
            <Tag className="w-4 h-4 text-cyan" />
            {t("registrationWizard.checkout.discountLabel")}
          </Label>
          <div className="flex gap-2">
            <Input
              value={discountInput}
              onChange={(e) => {
                setDiscountInput(e.target.value.toUpperCase());
                dispatch(setDiscountCodeInput(e.target.value.toUpperCase()));
              }}
              placeholder={t("registrationWizard.checkout.discountPlaceholder")}
              className="bg-surface-dark border-gray-700 font-mono uppercase flex-1"
              disabled={fieldsLocked}
            />
            <Button
              type="button"
              variant="outline"
              disabled={loadingDiscount || !discountInput.trim() || fieldsLocked}
              className="border-cyan/30 shrink-0"
              onClick={() =>
                dispatch(
                  validateDiscountCode({
                    slug,
                    code: discountInput.trim(),
                    categoryId: category.id,
                  }),
                )
              }
            >
              {loadingDiscount ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                t("registrationWizard.checkout.discountApply")
              )}
            </Button>
          </div>
          {discountPreview?.valid ? (
            <p className="text-xs text-accent">
              {t("registrationWizard.checkout.discountValid", { code: discountPreview.code })}
            </p>
          ) : null}
        </div>
      ) : null}

      {fields.length > 0 && (
        <form onSubmit={formik.handleSubmit} className="space-y-4">
          <h3 className="text-sm font-bold text-white">
            {t("registrationWizard.checkout.prerequisites")}
          </h3>
          <p className="text-xs text-gray-500 -mt-2">
            {t("registrationWizard.checkout.prerequisitesHint")}
          </p>

          {fields.map((field) => (
            <div key={field.id} className="space-y-2">
              <Label className="text-gray-300">
                {field.label}
                {field.is_required ? " *" : ""}
              </Label>

              {field.field_type === "select" ? (
                <Select
                  disabled={fieldsLocked}
                  value={String(formik.values[field.field_key] || "")}
                  onValueChange={(v) => formik.setFieldValue(field.field_key, v)}
                >
                  <SelectTrigger className="bg-surface-dark border-gray-700">
                    <SelectValue placeholder={t("registrationWizard.checkout.selectOption")} />
                  </SelectTrigger>
                  <SelectContent>
                    {(field.options_json ?? []).map((opt) => (
                      <SelectItem key={opt} value={opt}>
                        {opt}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : field.field_type === "checkbox" ? (
                <div className="flex items-center gap-2">
                  <Checkbox
                    disabled={fieldsLocked}
                    checked={Boolean(formik.values[field.field_key])}
                    onCheckedChange={(c) => formik.setFieldValue(field.field_key, c === true)}
                  />
                  <span className="text-sm text-gray-400">{field.label}</span>
                </div>
              ) : field.field_type === "textarea" ? (
                <Textarea
                  disabled={fieldsLocked}
                  className="bg-surface-dark border-gray-700 min-h-[80px]"
                  {...formik.getFieldProps(field.field_key)}
                />
              ) : (
                <Input
                  disabled={fieldsLocked}
                  type={field.field_type === "number" ? "number" : field.field_type === "date" ? "date" : "text"}
                  className="bg-surface-dark border-gray-700"
                  {...formik.getFieldProps(field.field_key)}
                />
              )}

              {formik.touched[field.field_key] && formik.errors[field.field_key] && (
                <p className="text-xs text-red-400">
                  {String(formik.errors[field.field_key])}
                </p>
              )}
            </div>
          ))}

          {!showPayment && (
            <>
              {error && error !== "WAITLIST_AVAILABLE" && (
                <p className="text-sm text-red-400">{error}</p>
              )}
              {waitlistOffered ? (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-3">
                  <p className="text-sm text-amber-200">
                    {t("registrationWizard.checkout.soldOutWaitlistHint")}
                  </p>
                  <Button
                    type="button"
                    disabled={joiningWaitlist}
                    onClick={() =>
                      dispatch(joinEventWaitlist({ slug, categoryId: category.id }))
                    }
                    className="w-full bg-amber-500/10 text-amber-400 border border-amber-500/40"
                  >
                    {joiningWaitlist ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      t("eventDetail.joinWaitlist")
                    )}
                  </Button>
                </div>
              ) : null}
              <Button
                type="submit"
                disabled={loadingCheckout || fieldsLocked}
                className="w-full bg-cyan/10 text-cyan border border-cyan/40 hover:bg-cyan hover:text-navy-deep"
              >
                {loadingCheckout ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  t("registrationWizard.checkout.continueToPayment")
                )}
              </Button>
            </>
          )}
        </form>
      )}

      {fields.length === 0 && !showPayment && (
        <div className="space-y-3">
          {waitlistOffered ? (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-3">
              <p className="text-sm text-amber-200">
                {t("registrationWizard.checkout.soldOutWaitlistHint")}
              </p>
              <Button
                type="button"
                disabled={joiningWaitlist}
                onClick={() =>
                  dispatch(joinEventWaitlist({ slug, categoryId: category.id }))
                }
                className="w-full bg-amber-500/10 text-amber-400 border border-amber-500/40"
              >
                {joiningWaitlist ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  t("eventDetail.joinWaitlist")
                )}
              </Button>
            </div>
          ) : null}
        <Button
          type="button"
          disabled={loadingCheckout}
          onClick={() =>
            handleCheckout({}, appliedDiscountCode)
          }
          className="w-full bg-cyan/10 text-cyan border border-cyan/40"
        >
          {loadingCheckout ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            t("registrationWizard.checkout.continueToPayment")
          )}
        </Button>
        </div>
      )}

      {showPayment && checkout && paymentConfig && (
        <div className="space-y-3 pt-2 border-t border-gray-800/60">
          <h3 className="text-sm font-bold text-white">{t("registrationWizard.payment.title")}</h3>
          <StripeCheckout
            clientSecret={checkout.clientSecret!}
            publishableKey={paymentConfig.publishableKey}
            amountLabel={amountLabel}
            loading={loadingConfirm}
            onStripeSuccess={handleStripeSuccess}
            onStripeError={handleStripeError}
            onPayWithSavedCard={handlePayWithSavedCard}
          />
        </div>
      )}
    </div>
  );
}

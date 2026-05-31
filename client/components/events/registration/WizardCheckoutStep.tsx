import { useMemo, useState } from "react";
import { useFormik } from "formik";
import * as Yup from "yup";
import { Loader2, Receipt } from "lucide-react";
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
  setPaymentFailure,
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
    error,
  } = useAppSelector((s) => s.registrationCheckout);
  const [fieldsLocked, setFieldsLocked] = useState(false);

  const serviceFeeCents =
    category.service_fee_cents ??
    Math.round(category.price_cents * (serviceFeePercent / 100));
  const totalCents = category.total_cents ?? category.price_cents + serviceFeeCents;

  const formik = useFormik({
    initialValues: buildInitialValues(fields),
    validationSchema: buildValidationSchema(fields, t),
    onSubmit: async (values) => {
      if (!checkout) {
        const result = await dispatch(
          createRegistrationCheckout({
            slug,
            categoryId: category.id,
            fieldValues: values,
            idempotencyKey,
          }),
        );
        if (createRegistrationCheckout.fulfilled.match(result)) {
          setFieldsLocked(true);
        }
        return;
      }
    },
  });

  const amountLabel = useMemo(
    () => formatPriceMxn(checkout?.amountCents ?? totalCents, i18n.language),
    [checkout, totalCents, i18n.language],
  );

  const handleMockPay = async () => {
    if (!checkout) return;
    await dispatch(
      confirmRegistration({
        slug,
        registrationPublicUuid: checkout.registrationPublicUuid,
      }),
    );
  };

  const handleStripeSuccess = async (paymentIntentId: string) => {
    if (!checkout) return;
    await dispatch(
      confirmRegistration({
        slug,
        registrationPublicUuid: checkout.registrationPublicUuid,
        paymentIntentId,
      }),
    );
  };

  const handleStripeError = (message: string) => {
    dispatch(setPaymentFailure(message));
  };

  const showPayment = checkout && (paymentConfig?.mockMode || checkout.clientSecret);

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
                <span>{formatPriceMxn(category.price_cents, i18n.language)}</span>
              </div>
              <div className="flex justify-between">
                <span>{t("eventDetail.serviceFee")}</span>
                <span>{formatPriceMxn(serviceFeeCents, i18n.language)}</span>
              </div>
              <div className="flex justify-between font-bold text-cyan pt-1 border-t border-gray-700/50">
                <span>{t("eventDetail.total")}</span>
                <span>{formatPriceMxn(totalCents, i18n.language)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

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
              {error && <p className="text-sm text-red-400">{error}</p>}
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
        <Button
          type="button"
          disabled={loadingCheckout}
          onClick={() =>
            dispatch(
              createRegistrationCheckout({
                slug,
                categoryId: category.id,
                fieldValues: {},
                idempotencyKey,
              }),
            ).then((r) => {
              if (createRegistrationCheckout.fulfilled.match(r)) setFieldsLocked(true);
            })
          }
          className="w-full bg-cyan/10 text-cyan border border-cyan/40"
        >
          {loadingCheckout ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            t("registrationWizard.checkout.continueToPayment")
          )}
        </Button>
      )}

      {showPayment && (
        <div className="space-y-3 pt-2 border-t border-gray-800/60">
          <h3 className="text-sm font-bold text-white">{t("registrationWizard.payment.title")}</h3>
          <StripeCheckout
            clientSecret={checkout.clientSecret || ""}
            publishableKey={paymentConfig?.publishableKey || ""}
            mockMode={checkout.mockMode}
            amountLabel={amountLabel}
            loading={loadingConfirm}
            onMockPay={handleMockPay}
            onStripeSuccess={handleStripeSuccess}
            onStripeError={handleStripeError}
          />
        </div>
      )}
    </div>
  );
}

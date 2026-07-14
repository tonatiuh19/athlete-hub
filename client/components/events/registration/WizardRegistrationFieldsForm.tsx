import { useMemo } from "react";
import { useFormik } from "formik";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ClipboardList } from "lucide-react";
import type { EventRegistrationField } from "@shared/api";
import {
  buildRegistrationFieldInitialValues,
  normalizeCheckoutFieldValues,
  normalizeRegistrationField,
  sortRegistrationFields,
} from "@shared/registrationFields";
import RegistrationFieldInput from "@/components/events/registration/RegistrationFieldInput";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { buildRegistrationFieldsYupSchema } from "@/utils/registrationFieldsFormik";

export interface WizardRegistrationFieldsFormProps {
  fields: EventRegistrationField[];
  initialValues?: Record<string, string | boolean>;
  /** Shown under the title — e.g. "For Ana Gomez (guest 2 of 4)". */
  participantLabel?: string;
  submitLabel: string;
  onSubmit: (fieldValues: Record<string, string | boolean>) => void;
  onBack?: () => void;
  backLabel?: string;
}

/**
 * Per-registrant Campos extra form (solo checkout + group wizard).
 * Category-scoped fields should already be filtered by the caller.
 */
export default function WizardRegistrationFieldsForm({
  fields,
  initialValues,
  participantLabel,
  submitLabel,
  onSubmit,
  onBack,
  backLabel,
}: WizardRegistrationFieldsFormProps) {
  const { t } = useTranslation();

  const normalizedFields = useMemo(
    () => sortRegistrationFields(fields).map(normalizeRegistrationField),
    [fields],
  );

  const hasBlockingFileField = normalizedFields.some(
    (f) => f.field_type === "file" && f.is_required,
  );

  const formik = useFormik({
    enableReinitialize: true,
    initialValues: {
      ...buildRegistrationFieldInitialValues(normalizedFields),
      ...(initialValues ?? {}),
    },
    validationSchema: buildRegistrationFieldsYupSchema(normalizedFields, t),
    onSubmit: (values) => {
      onSubmit(normalizeCheckoutFieldValues(values, normalizedFields));
    },
  });

  return (
    <form onSubmit={formik.handleSubmit} className="space-y-4">
      <div className="rounded-xl border border-primary/20 bg-primary/5 px-3.5 py-3 space-y-1">
        <p className="text-sm font-semibold text-foreground flex items-center gap-2">
          <ClipboardList className="w-4 h-4 text-primary shrink-0" aria-hidden />
          {t("registrationWizard.checkout.prerequisites")}
        </p>
        {participantLabel ? (
          <p className="text-xs font-medium text-primary">{participantLabel}</p>
        ) : null}
        <p className="text-xs text-muted-foreground leading-relaxed">
          {participantLabel
            ? t("groupRegistration.fieldsHint")
            : t("registrationWizard.checkout.prerequisitesHint")}
        </p>
      </div>

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

      <div className="flex gap-2 pt-1">
        {onBack ? (
          <Button type="button" variant="outline" className="flex-1" onClick={onBack}>
            <ChevronLeft className="w-4 h-4 mr-1" />
            {backLabel ?? t("common.back")}
          </Button>
        ) : null}
        <Button
          type="submit"
          className="flex-1 btn-primary"
          disabled={hasBlockingFileField || formik.isSubmitting}
        >
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}

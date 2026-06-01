import { useFormik } from "formik";
import * as Yup from "yup";
import { Loader2, ShieldCheck } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { EventWaiverPublic } from "@shared/api";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface WizardWaiverStepProps {
  waiver: EventWaiverPublic;
  onAccepted: (payload: { waiverId: number; waiverSignature: string }) => void;
}

export default function WizardWaiverStep({ waiver, onAccepted }: WizardWaiverStepProps) {
  const { t } = useTranslation();

  const formik = useFormik({
    initialValues: {
      accepted: false,
      signature: "",
    },
    validationSchema: Yup.object({
      accepted: Yup.boolean().oneOf([true], t("registrationWizard.waiver.mustAccept")),
      signature: Yup.string()
        .trim()
        .min(3, t("registrationWizard.waiver.signatureMin"))
        .required(t("common.required")),
    }),
    onSubmit: (values) => {
      onAccepted({
        waiverId: waiver.id,
        waiverSignature: values.signature.trim(),
      });
    },
  });

  return (
    <form onSubmit={formik.handleSubmit} className="space-y-4">
      <div className="flex items-center gap-2 text-cyan">
        <ShieldCheck className="w-5 h-5" />
        <h3 className="font-semibold text-sm">{waiver.title}</h3>
      </div>

      <div
        className="max-h-48 overflow-y-auto rounded-xl border border-gray-700/60 bg-black/20 p-4 text-sm text-gray-300 prose prose-invert prose-sm max-w-none"
        dangerouslySetInnerHTML={{ __html: waiver.content_html }}
      />

      <p className="text-xs text-gray-500">
        {t("registrationWizard.waiver.version", { version: waiver.version })}
      </p>

      <div className="flex items-start gap-3">
        <Checkbox
          id="waiver-accepted"
          checked={formik.values.accepted}
          onCheckedChange={(v) => formik.setFieldValue("accepted", v === true)}
        />
        <Label htmlFor="waiver-accepted" className="text-sm leading-snug cursor-pointer">
          {t("registrationWizard.waiver.acceptLabel")}
        </Label>
      </div>
      {formik.touched.accepted && formik.errors.accepted ? (
        <p className="text-xs text-destructive">{formik.errors.accepted}</p>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="waiver-signature">{t("registrationWizard.waiver.signatureLabel")}</Label>
        <Input
          id="waiver-signature"
          value={formik.values.signature}
          onChange={formik.handleChange}
          onBlur={formik.handleBlur}
          placeholder={t("registrationWizard.waiver.signaturePlaceholder")}
        />
        {formik.touched.signature && formik.errors.signature ? (
          <p className="text-xs text-destructive">{formik.errors.signature}</p>
        ) : null}
      </div>

      <Button type="submit" className="w-full" disabled={formik.isSubmitting}>
        {formik.isSubmitting ? (
          <Loader2 className="w-4 h-4 animate-spin mr-2" />
        ) : null}
        {t("registrationWizard.waiver.continue")}
      </Button>
    </form>
  );
}

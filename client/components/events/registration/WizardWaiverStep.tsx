import { useFormik } from "formik";
import * as Yup from "yup";
import { ExternalLink, FileText, Loader2, ShieldCheck } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { EventWaiverPublic, WaiverSignatureInput } from "@shared/api";
import { WAIVER_ACCEPTANCE_SIGNATURE } from "@shared/waiverConstants";
import { sanitizeHtml } from "@/utils/sanitizeHtml";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

interface WizardWaiverStepProps {
  waivers: EventWaiverPublic[];
  onAccepted: (signatures: WaiverSignatureInput[]) => void;
}

export default function WizardWaiverStep({ waivers, onAccepted }: WizardWaiverStepProps) {
  const { t } = useTranslation();
  const multiple = waivers.length > 1;

  const formik = useFormik({
    initialValues: {
      accepted: false,
    },
    validationSchema: Yup.object({
      accepted: Yup.boolean().oneOf(
        [true],
        multiple
          ? t("registrationWizard.waiver.mustAcceptAll")
          : t("registrationWizard.waiver.mustAccept"),
      ),
    }),
    onSubmit: () => {
      onAccepted(
        waivers.map((w) => ({
          waiverId: w.id,
          signature: WAIVER_ACCEPTANCE_SIGNATURE,
          waiverVersion: w.version,
        })),
      );
    },
  });

  return (
    <form onSubmit={formik.handleSubmit} className="space-y-4">
      <div className="flex items-center gap-2 text-primary">
        <ShieldCheck className="w-5 h-5 shrink-0" />
        <h3 className="font-semibold text-sm">
          {multiple
            ? t("registrationWizard.waiver.titleMultiple", { count: waivers.length })
            : waivers[0]?.title}
        </h3>
      </div>

      {multiple ? (
        <p className="text-xs text-muted-foreground">{t("registrationWizard.waiver.allRequiredHint")}</p>
      ) : null}

      <div className="space-y-4 max-h-64 overflow-y-auto pr-1">
        {waivers.map((waiver, index) => (
          <div
            key={waiver.id}
            className="rounded-xl border border-border bg-black/20 p-4 space-y-3"
          >
            {multiple ? (
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {t("registrationWizard.waiver.itemLabel", { index: index + 1 })}
              </p>
            ) : null}
            {multiple ? (
              <h4 className="font-medium text-sm text-muted-foreground">{waiver.title}</h4>
            ) : null}

            {(waiver.content_type === "html" || waiver.content_type === "both") &&
            waiver.content_html?.trim() ? (
              <div
                className="max-h-40 overflow-y-auto overflow-x-auto text-sm text-muted-foreground prose prose-invert prose-sm max-w-none [&_table]:block [&_table]:overflow-x-auto [&_table]:max-w-full [&_img]:max-w-full [&_img]:h-auto"
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(waiver.content_html) }}
              />
            ) : null}

            {(waiver.content_type === "pdf" || waiver.content_type === "both") &&
            waiver.pdf_url ? (
              <a
                href={waiver.pdf_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
              >
                <FileText className="w-4 h-4" />
                {t("registrationWizard.waiver.viewPdf")}
                <ExternalLink className="w-3 h-3" />
              </a>
            ) : null}

            <p className="text-xs text-muted-foreground">
              {t("registrationWizard.waiver.version", { version: waiver.version })}
            </p>
          </div>
        ))}
      </div>

      <div className="flex items-start gap-3">
        <Checkbox
          id="waiver-accepted"
          checked={formik.values.accepted}
          onCheckedChange={(v) => formik.setFieldValue("accepted", v === true)}
        />
        <Label htmlFor="waiver-accepted" className="text-sm leading-snug cursor-pointer">
          {multiple
            ? t("registrationWizard.waiver.acceptAllLabel")
            : t("registrationWizard.waiver.acceptLabel")}
        </Label>
      </div>
      {formik.touched.accepted && formik.errors.accepted ? (
        <p className="text-xs text-destructive">{formik.errors.accepted}</p>
      ) : null}

      <Button type="submit" className="w-full" disabled={formik.isSubmitting}>
        {formik.isSubmitting ? (
          <Loader2 className="w-4 h-4 animate-spin mr-2" />
        ) : null}
        {t("registrationWizard.waiver.continue")}
      </Button>
    </form>
  );
}

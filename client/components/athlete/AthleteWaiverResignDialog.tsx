import { useEffect, useState } from "react";
import { useFormik } from "formik";
import * as Yup from "yup";
import { ExternalLink, FileText, Loader2, ShieldAlert } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { EventWaiverPublic, RegistrationItem } from "@shared/api";
import { WAIVER_ACCEPTANCE_SIGNATURE } from "@shared/waiverConstants";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useAppDispatch } from "@/store/hooks";
import {
  fetchAthleteRegistrations,
  fetchRegistrationWaivers,
  resignRegistrationWaivers,
} from "@/store/slices/athletePortalSlice";
import { sanitizeHtml } from "@/utils/sanitizeHtml";

interface AthleteWaiverResignDialogProps {
  registration: RegistrationItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function AthleteWaiverResignDialog({
  registration,
  open,
  onOpenChange,
}: AthleteWaiverResignDialogProps) {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const [waivers, setWaivers] = useState<EventWaiverPublic[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !registration?.public_uuid) return;
    setLoading(true);
    setError(null);
    void dispatch(fetchRegistrationWaivers(registration.public_uuid))
      .unwrap()
      .then((data) => setWaivers(data.waivers))
      .catch((e: string) => setError(e))
      .finally(() => setLoading(false));
  }, [open, registration?.public_uuid, dispatch]);

  const formik = useFormik({
    enableReinitialize: true,
    initialValues: { accepted: false },
    validationSchema: Yup.object({
      accepted: Yup.boolean().oneOf([true], t("registrationWizard.waiver.mustAcceptAll")),
    }),
    onSubmit: async () => {
      if (!registration?.public_uuid || waivers.length === 0) return;
      setSubmitting(true);
      setError(null);
      try {
        await dispatch(
          resignRegistrationWaivers({
            publicUuid: registration.public_uuid,
            signatures: waivers.map((w) => ({
              waiverId: w.id,
              signature: WAIVER_ACCEPTANCE_SIGNATURE,
            })),
          }),
        ).unwrap();
        await dispatch(fetchAthleteRegistrations());
        onOpenChange(false);
        formik.resetForm();
      } catch (e) {
        setError(typeof e === "string" ? e : t("athletePortal.registrations.resignFailed"));
      } finally {
        setSubmitting(false);
      }
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-destructive" />
            {t("athletePortal.registrations.resignTitle")}
          </DialogTitle>
        </DialogHeader>

        {registration ? (
          <p className="text-sm text-muted-foreground">
            {t("athletePortal.registrations.resignSubtitle", {
              event: registration.event_title,
            })}
          </p>
        ) : null}

        {loading ? (
          <div className="py-8 flex justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <form onSubmit={formik.handleSubmit} className="space-y-4">
            <div className="space-y-3 max-h-56 overflow-y-auto">
              {waivers.map((waiver) => (
                <div
                  key={waiver.id}
                  className="rounded-xl border border-border/60 p-3 space-y-2"
                >
                  <h4 className="text-sm font-semibold">{waiver.title}</h4>
                  {(waiver.content_type === "html" || waiver.content_type === "both") &&
                  waiver.content_html?.trim() ? (
                    <div
                      className="text-xs prose prose-sm max-w-none max-h-32 overflow-y-auto"
                      dangerouslySetInnerHTML={{
                        __html: sanitizeHtml(waiver.content_html),
                      }}
                    />
                  ) : null}
                  {(waiver.content_type === "pdf" || waiver.content_type === "both") &&
                  waiver.pdf_url ? (
                    <a
                      href={waiver.pdf_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      <FileText className="w-3 h-3" />
                      {t("registrationWizard.waiver.viewPdf")}
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  ) : null}
                  <p className="text-[10px] text-muted-foreground">
                    {t("registrationWizard.waiver.version", { version: waiver.version })}
                  </p>
                </div>
              ))}
            </div>

            <div className="flex items-start gap-3">
              <Checkbox
                id="resign-accepted"
                checked={formik.values.accepted}
                onCheckedChange={(v) => formik.setFieldValue("accepted", v === true)}
              />
              <Label htmlFor="resign-accepted" className="text-sm leading-snug cursor-pointer">
                {t("athletePortal.registrations.resignAcceptLabel")}
              </Label>
            </div>
            {formik.touched.accepted && formik.errors.accepted ? (
              <p className="text-xs text-destructive">{formik.errors.accepted}</p>
            ) : null}
            {error ? <p className="text-sm text-destructive">{error}</p> : null}

            <Button type="submit" className="w-full" disabled={submitting || waivers.length === 0}>
              {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {t("athletePortal.registrations.resignSubmit")}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

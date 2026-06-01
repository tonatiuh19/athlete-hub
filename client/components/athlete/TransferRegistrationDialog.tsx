import { useFormik } from "formik";
import * as Yup from "yup";
import { Loader2, ArrowRightLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  fetchAthleteRegistrations,
  transferRegistration,
} from "@/store/slices/athletePortalSlice";
import type { RegistrationItem } from "@shared/api";

interface TransferRegistrationDialogProps {
  registration: RegistrationItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function TransferRegistrationDialog({
  registration,
  open,
  onOpenChange,
}: TransferRegistrationDialogProps) {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const { transferringRegistration, transferError } = useAppSelector(
    (s) => s.athletePortal,
  );

  const formik = useFormik({
    initialValues: { recipientEmail: "" },
    enableReinitialize: true,
    validationSchema: Yup.object({
      recipientEmail: Yup.string()
        .email(t("athletePortal.transfer.invalidEmail"))
        .required(t("common.required")),
    }),
    onSubmit: async (values, { resetForm }) => {
      if (!registration) return;
      const result = await dispatch(
        transferRegistration({
          publicUuid: registration.public_uuid,
          body: { recipientEmail: values.recipientEmail.trim() },
        }),
      );
      if (transferRegistration.fulfilled.match(result)) {
        resetForm();
        onOpenChange(false);
        dispatch(fetchAthleteRegistrations());
      }
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="w-5 h-5 text-cyan" />
            {t("athletePortal.transfer.title")}
          </DialogTitle>
        </DialogHeader>
        {registration ? (
          <form onSubmit={formik.handleSubmit} className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {t("athletePortal.transfer.subtitle", {
                event: registration.event_title,
                folio: registration.registration_number,
              })}
            </p>
            <div className="space-y-2">
              <Label htmlFor="recipientEmail">{t("athletePortal.transfer.emailLabel")}</Label>
              <Input
                id="recipientEmail"
                type="email"
                placeholder="athlete@example.com"
                {...formik.getFieldProps("recipientEmail")}
              />
              {formik.touched.recipientEmail && formik.errors.recipientEmail ? (
                <p className="text-xs text-destructive">{formik.errors.recipientEmail}</p>
              ) : null}
            </div>
            {transferError ? (
              <p className="text-sm text-destructive">{transferError}</p>
            ) : null}
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" disabled={transferringRegistration}>
                {transferringRegistration ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  t("athletePortal.transfer.submit")
                )}
              </Button>
            </div>
          </form>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

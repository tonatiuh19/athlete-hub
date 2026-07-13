import { QRCodeSVG } from "qrcode.react";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { RegistrationItem } from "@shared/api";

interface RegistrationQrDialogProps {
  registration: RegistrationItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function RegistrationQrDialog({
  registration,
  open,
  onOpenChange,
}: RegistrationQrDialogProps) {
  const { t } = useTranslation();

  if (!registration) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("athletePortal.registrations.qrTitle")}</DialogTitle>
          <DialogDescription>{registration.event_title}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4 py-2">
          <div className="rounded-2xl bg-white p-4 shadow-inner">
            <QRCodeSVG
              value={registration.qr_code_token}
              size={220}
              level="M"
              includeMargin
            />
          </div>
          <div className="text-center space-y-1">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">
              {t("athletePortal.registrations.folio")}
            </p>
            <p className="font-mono font-bold text-primary text-lg">
              {registration.registration_number}
            </p>
            {registration.bib_number ? (
              <p className="text-sm text-muted-foreground">
                {t("athletePortal.registrations.bib")} {registration.bib_number}
              </p>
            ) : null}
          </div>
          <p className="text-xs text-center text-muted-foreground max-w-xs">
            {t("athletePortal.registrations.qrHint")}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

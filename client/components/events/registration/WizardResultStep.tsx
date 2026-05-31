import { Link } from "react-router-dom";
import { CheckCircle2, QrCode, XCircle, ArrowRight, RotateCcw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { formatPriceMxn } from "@/utils/eventFormat";

interface WizardResultStepProps {
  success: boolean;
  failureMessage?: string | null;
  registration?: {
    registration_number: string;
    qr_code_token: string;
    total_cents: number;
    category_name: string;
    event_title: string;
    event_slug: string;
  };
  onRetry: () => void;
  onClose: () => void;
}

export default function WizardResultStep({
  success,
  failureMessage,
  registration,
  onRetry,
  onClose,
}: WizardResultStepProps) {
  const { t, i18n } = useTranslation();

  if (!success) {
    return (
      <div className="text-center py-6 space-y-5">
        <div className="w-16 h-16 mx-auto rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center">
          <XCircle className="w-8 h-8 text-red-400" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-white">{t("registrationWizard.result.failedTitle")}</h3>
          <p className="text-sm text-gray-400 mt-2 max-w-sm mx-auto">
            {failureMessage || t("registrationWizard.result.failedHint")}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button variant="outline" onClick={onClose} className="border-gray-700">
            {t("registrationWizard.result.close")}
          </Button>
          <Button
            onClick={onRetry}
            className="bg-gradient-to-r from-cyan to-blue-electric text-navy-deep font-bold"
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            {t("registrationWizard.result.retry")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="text-center py-4 space-y-6">
      <div className="w-16 h-16 mx-auto rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center animate-in zoom-in duration-300">
        <CheckCircle2 className="w-8 h-8 text-emerald-400" />
      </div>

      <div>
        <h3 className="text-xl font-bold text-white">{t("registrationWizard.result.successTitle")}</h3>
        <p className="text-sm text-gray-400 mt-2">{t("registrationWizard.result.successHint")}</p>
      </div>

      {registration && (
        <div className="rounded-xl border border-gray-700/50 bg-surface-dark/50 p-5 text-left space-y-4">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-gray-500">
              {t("registrationWizard.result.folio")}
            </p>
            <p className="text-lg font-bold text-cyan font-mono">{registration.registration_number}</p>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-gray-500">{t("registrationWizard.result.category")}</p>
              <p className="text-white font-medium">{registration.category_name}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">{t("eventDetail.total")}</p>
              <p className="text-white font-medium">
                {formatPriceMxn(registration.total_cents, i18n.language)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-lg bg-bg-dark/60 border border-gray-700/40">
            <QrCode className="w-8 h-8 text-cyan shrink-0" />
            <p className="text-xs text-gray-500">{t("registrationWizard.result.qrHint")}</p>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <Button variant="outline" onClick={onClose} className="border-gray-700">
          {t("registrationWizard.result.close")}
        </Button>
        <Link to="/portal/registrations">
          <Button className="w-full sm:w-auto bg-cyan/10 text-cyan border border-cyan/40 hover:bg-cyan hover:text-navy-deep">
            {t("registrationWizard.result.viewRegistrations")}
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </Link>
      </div>
    </div>
  );
}

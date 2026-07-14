import { useEffect, useRef } from "react";
import { CheckCircle2, XCircle, RotateCcw } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { RegistrationConfirmResponse } from "@shared/api";
import PurchaserQrWallet from "@/components/shared/PurchaserQrWallet";
import RegistrationInviteFriendsCard from "@/components/events/registration/RegistrationInviteFriendsCard";
import { Button } from "@/components/ui/button";
import { formatPriceMxn } from "@/utils/eventFormat";
import { fireRegistrationCelebration } from "@/utils/celebrationConfetti";

interface WizardGroupResultStepProps {
  success: boolean;
  failureMessage?: string | null;
  confirmationEmail?: string | null;
  eventTitle?: string;
  eventSlug?: string;
  order?: RegistrationConfirmResponse["order"];
  onRetry: () => void;
  onClose: () => void;
}

export default function WizardGroupResultStep({
  success,
  failureMessage,
  confirmationEmail,
  eventTitle,
  eventSlug,
  order,
  onRetry,
  onClose,
}: WizardGroupResultStepProps) {
  const { t, i18n } = useTranslation();
  const celebratedRef = useRef(false);

  useEffect(() => {
    if (!success) {
      celebratedRef.current = false;
      return;
    }
    if (celebratedRef.current) return;
    celebratedRef.current = true;
    const timer = window.setTimeout(() => fireRegistrationCelebration(), 180);
    return () => window.clearTimeout(timer);
  }, [success]);

  if (!success) {
    return (
      <div className="text-center py-6 space-y-5">
        <div className="w-16 h-16 mx-auto rounded-full bg-destructive/10 border border-destructive/30 flex items-center justify-center">
          <XCircle className="w-8 h-8 text-destructive" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-foreground">
            {t("groupRegistration.resultFailedTitle")}
          </h3>
          <p className="text-sm text-muted-foreground mt-2 max-w-sm mx-auto">
            {failureMessage || t("registrationWizard.result.failedHint")}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button variant="outline" onClick={onClose}>
            {t("registrationWizard.result.close")}
          </Button>
          <Button onClick={onRetry} className="btn-primary font-bold">
            <RotateCcw className="w-4 h-4 mr-2" />
            {t("registrationWizard.result.retry")}
          </Button>
        </div>
      </div>
    );
  }

  const registrations = order?.registrations ?? [];

  return (
    <div className="text-center py-4 space-y-6">
      <div className="w-16 h-16 mx-auto rounded-full bg-accent/10 border border-accent/30 flex items-center justify-center animate-in zoom-in duration-300">
        <CheckCircle2 className="w-8 h-8 text-accent" />
      </div>

      <div>
        <h3 className="text-xl font-bold text-foreground">
          {t("groupRegistration.resultSuccessTitle")}
        </h3>
        <p className="text-sm text-muted-foreground mt-2 max-w-sm mx-auto">
          {t("groupRegistration.resultSuccessHint", {
            email: confirmationEmail ?? "",
          })}
        </p>
      </div>

      <PurchaserQrWallet
        items={registrations.map((reg) => ({
          public_uuid: reg.public_uuid,
          registration_number: reg.registration_number,
          qr_code_token: reg.qr_code_token,
          bib_number: reg.bib_number,
          participant_label: reg.participant_label,
          category_name: reg.category_name,
          wallet_held_by_purchaser: reg.wallet_held_by_purchaser,
          is_managed_participant: reg.is_managed_participant,
          guest_claim_token: reg.guest_claim_token,
        }))}
        title={t("groupRegistration.resultWalletTitle")}
        subtitle={t("groupRegistration.resultWalletHint")}
      />

      <ul className="space-y-3 text-left">
        {registrations.map((reg) => (
          <li
            key={reg.public_uuid}
            className="rounded-xl border border-border bg-card/60 p-4 space-y-2"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-semibold text-foreground text-sm truncate">
                  {reg.participant_label || reg.category_name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {reg.category_name} · #{reg.registration_number}
                </p>
              </div>
              <span className="text-sm font-bold text-primary shrink-0">
                {formatPriceMxn(reg.total_cents, i18n.language)}
              </span>
            </div>
          </li>
        ))}
      </ul>

      {eventSlug && eventTitle ? (
        <RegistrationInviteFriendsCard eventTitle={eventTitle} eventSlug={eventSlug} />
      ) : null}

      <Button onClick={onClose} className="w-full btn-primary font-bold">
        {t("registrationWizard.result.close")}
      </Button>
    </div>
  );
}

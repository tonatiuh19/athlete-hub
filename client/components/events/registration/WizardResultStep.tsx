import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, QrCode, XCircle, ArrowRight, RotateCcw, Clock } from "lucide-react";
import type { WaitlistEntry } from "@shared/api";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { formatPriceMxn } from "@/utils/eventFormat";
import { fireRegistrationCelebration } from "@/utils/celebrationConfetti";

interface WizardResultStepProps {
  success: boolean;
  waitlistJoined?: WaitlistEntry | null;
  failureMessage?: string | null;
  confirmationEmail?: string | null;
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
  onViewRegistrations: () => void;
}

export default function WizardResultStep({
  success,
  waitlistJoined,
  failureMessage,
  confirmationEmail,
  registration,
  onRetry,
  onClose,
  onViewRegistrations,
}: WizardResultStepProps) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const celebratedRef = useRef(false);

  const isWaitlist = Boolean(waitlistJoined);

  useEffect(() => {
    if (!success || isWaitlist) {
      celebratedRef.current = false;
      return;
    }
    if (celebratedRef.current) return;

    celebratedRef.current = true;
    const timer = window.setTimeout(() => fireRegistrationCelebration(), 180);
    return () => window.clearTimeout(timer);
  }, [success, isWaitlist]);

  if (!success && !isWaitlist) {
    return (
      <div className="text-center py-6 space-y-5">
        <div className="w-16 h-16 mx-auto rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center">
          <XCircle className="w-8 h-8 text-red-400" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-foreground">{t("registrationWizard.result.failedTitle")}</h3>
          <p className="text-sm text-muted-foreground mt-2 max-w-sm mx-auto">
            {failureMessage || t("registrationWizard.result.failedHint")}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button variant="outline" onClick={onClose} className="border-border">
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

  if (isWaitlist && waitlistJoined) {
    return (
      <div className="text-center py-4 space-y-6">
        <div className="w-16 h-16 mx-auto rounded-full bg-cyan/10 border border-cyan/30 flex items-center justify-center animate-in zoom-in duration-300">
          <Clock className="w-8 h-8 text-primary" />
        </div>

        <div>
          <h3 className="text-xl font-bold text-foreground">
            {t("registrationWizard.result.waitlistTitle")}
          </h3>
          <p className="text-sm text-muted-foreground mt-2 max-w-sm mx-auto">
            {t("registrationWizard.result.waitlistHint")}
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card/60 p-5 text-left space-y-3">
          {waitlistJoined.event_title ? (
            <div>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                {t("registrationWizard.result.waitlistEvent")}
              </p>
              <p className="text-sm font-bold text-foreground">{waitlistJoined.event_title}</p>
            </div>
          ) : null}
          {waitlistJoined.category_name ? (
            <div>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                {t("registrationWizard.result.category")}
              </p>
              <p className="text-sm font-medium text-foreground">{waitlistJoined.category_name}</p>
            </div>
          ) : null}
          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
              {t("registrationWizard.result.waitlistPosition")}
            </p>
            <p className="text-2xl font-bold text-primary">#{waitlistJoined.position}</p>
          </div>
        </div>

        <Button variant="outline" onClick={onClose} className="border-border">
          {t("registrationWizard.result.close")}
        </Button>
      </div>
    );
  }

  return (
    <div className="text-center py-4 space-y-6">
      <div className="w-16 h-16 mx-auto rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center animate-in zoom-in duration-300">
        <CheckCircle2 className="w-8 h-8 text-emerald-400" />
      </div>

      <div>
        <h3 className="text-xl font-bold text-foreground">{t("registrationWizard.result.successTitle")}</h3>
        <p className="text-sm text-muted-foreground mt-2">{t("registrationWizard.result.successHint")}</p>
        {confirmationEmail ? (
          <p className="text-sm text-accent mt-3 font-medium">
            {t("registrationWizard.result.confirmationEmailSent", { email: confirmationEmail })}
          </p>
        ) : null}
      </div>

      {registration && (
        <div className="rounded-xl border border-border bg-card/60 p-5 text-left space-y-4">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
              {t("registrationWizard.result.folio")}
            </p>
            <p className="text-lg font-bold text-primary font-mono">{registration.registration_number}</p>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">{t("registrationWizard.result.category")}</p>
              <p className="text-foreground font-medium">{registration.category_name}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t("eventDetail.total")}</p>
              <p className="text-foreground font-medium">
                {formatPriceMxn(registration.total_cents, i18n.language)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-lg bg-background/60 border border-border/60">
            <QrCode className="w-8 h-8 text-primary shrink-0" />
            <p className="text-xs text-muted-foreground">{t("registrationWizard.result.qrHint")}</p>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <Button variant="outline" onClick={onClose} className="border-border">
          {t("registrationWizard.result.close")}
        </Button>
        <Button
          type="button"
          onClick={() => {
            onViewRegistrations();
            navigate("/portal/registrations", { replace: true });
          }}
          className="w-full sm:w-auto bg-cyan/10 text-primary border border-cyan/40 hover:bg-cyan hover:text-navy-deep"
        >
          {t("registrationWizard.result.viewRegistrations")}
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}

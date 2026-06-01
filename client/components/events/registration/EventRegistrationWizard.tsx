import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import WizardAuthStep from "@/components/events/registration/WizardAuthStep";
import WizardCheckoutStep from "@/components/events/registration/WizardCheckoutStep";
import WizardResultStep from "@/components/events/registration/WizardResultStep";
import WizardWaiverStep from "@/components/events/registration/WizardWaiverStep";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  closeRegistrationWizard,
  fetchPaymentConfig,
  joinEventWaitlist,
  setWaiverAcceptance,
  setWizardStep,
} from "@/store/slices/registrationCheckoutSlice";
import { fetchEventDetail } from "@/store/slices/marketplaceSlice";
import {
  fetchAthleteRegistrations,
  fetchAthleteWaitlist,
} from "@/store/slices/athletePortalSlice";
import { cn } from "@/lib/utils";

export default function EventRegistrationWizard() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const { eventDetail } = useAppSelector((s) => s.marketplace);
  const {
    open,
    step,
    eventSlug,
    category,
    paymentFailed,
    failureMessage,
    confirmResult,
    waitlistJoined,
    waitlistMode,
    waitlistClaimMode,
    joiningWaitlist,
  } = useAppSelector((s) => s.registrationCheckout);
  const { token } = useAppSelector((s) => s.athleteAuth);

  const [idempotencyKey] = useState(() => crypto.randomUUID());

  const needsWaiver = Boolean(
    eventDetail?.event.requires_waiver && eventDetail?.waiver,
  );

  const stepsMeta = useMemo(
    () =>
      waitlistMode
        ? ([
            { key: "auth", label: t("registrationWizard.steps.auth") },
            { key: "result", label: t("registrationWizard.steps.result") },
          ] as Array<{ key: string; label: string }>)
        : ([
            { key: "auth", label: t("registrationWizard.steps.auth") },
            needsWaiver
              ? { key: "waiver", label: t("registrationWizard.steps.waiver") }
              : null,
            { key: "checkout", label: t("registrationWizard.steps.checkout") },
            { key: "result", label: t("registrationWizard.steps.result") },
          ].filter(Boolean) as Array<{ key: string; label: string }>),
    [t, needsWaiver, waitlistMode],
  );

  const progressSteps = stepsMeta.filter((s) => s.key !== "result");
  const stepIndex = Math.max(0, progressSteps.findIndex((s) => s.key === step));

  useEffect(() => {
    if (!open || !eventSlug) return;
    if (!eventDetail || eventDetail.event.slug !== eventSlug) {
      dispatch(fetchEventDetail(eventSlug));
    }
  }, [open, eventSlug, eventDetail, dispatch]);

  useEffect(() => {
    if (open) dispatch(fetchPaymentConfig());
  }, [open, dispatch]);

  useEffect(() => {
    if (!open || !token || step !== "auth") return;
    if (waitlistMode) return;
    dispatch(setWizardStep(needsWaiver ? "waiver" : "checkout"));
  }, [open, token, step, needsWaiver, waitlistMode, dispatch]);

  useEffect(() => {
    if (!open || !waitlistMode || !token || !eventSlug || !category) return;
    if (step !== "auth" || joiningWaitlist || waitlistJoined) return;
    dispatch(joinEventWaitlist({ slug: eventSlug, categoryId: category.id }));
  }, [
    open,
    waitlistMode,
    token,
    step,
    eventSlug,
    category,
    joiningWaitlist,
    waitlistJoined,
    dispatch,
  ]);

  useEffect(() => {
    if (!open || !confirmResult?.success || !waitlistClaimMode) return;
    dispatch(fetchAthleteWaitlist());
    dispatch(fetchAthleteRegistrations());
  }, [open, confirmResult, waitlistClaimMode, dispatch]);

  if (!open || !category || !eventSlug) return null;

  if (!eventDetail || eventDetail.event.slug !== eventSlug) {
    return (
      <Dialog open={open} onOpenChange={(v) => !v && dispatch(closeRegistrationWizard())}>
        <DialogContent className="max-w-sm bg-bg-dark border-gray-700/60">
          <div className="py-8 text-center text-gray-400 text-sm">{t("common.loading")}</div>
        </DialogContent>
      </Dialog>
    );
  }

  const handleClose = () => dispatch(closeRegistrationWizard());

  const handleRetry = () => {
    dispatch(setWizardStep(needsWaiver ? "waiver" : "checkout"));
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-lg w-[calc(100%-2rem)] max-h-[min(90vh,720px)] overflow-y-auto bg-bg-dark border-gray-700/60 p-0 gap-0">
        <DialogHeader className="p-5 pb-0 pr-12 space-y-4">
          <div className="min-w-0">
            <DialogTitle className="text-base font-bold text-white truncate">
              {waitlistClaimMode
                ? t("registrationWizard.claimTitle")
                : t("registrationWizard.title")}
            </DialogTitle>
            <p className="text-xs text-gray-500 truncate">{category.name}</p>
          </div>

          {step !== "result" && (
            <div className="flex items-center gap-2">
              {progressSteps.map((s, i) => (
                <div
                  key={s.key}
                  className="flex items-center gap-2 flex-1 min-w-0"
                >
                  <div
                    className={cn(
                      "w-6 h-6 rounded-full text-[10px] font-bold flex items-center justify-center shrink-0 border",
                      i <= stepIndex
                        ? "bg-cyan/15 border-cyan/50 text-cyan"
                        : "border-gray-700 text-gray-600",
                    )}
                  >
                    {i + 1}
                  </div>
                  <span
                    className={cn(
                      "text-[10px] uppercase tracking-wider truncate",
                      i <= stepIndex ? "text-gray-300" : "text-gray-600",
                    )}
                  >
                    {s.label}
                  </span>
                  {i < progressSteps.length - 1 && (
                    <div className="flex-1 h-px bg-gray-800 min-w-[12px]" />
                  )}
                </div>
              ))}
            </div>
          )}
        </DialogHeader>

        <div className="p-5 pt-4">
          {step === "auth" && (
            <WizardAuthStep
              onAuthed={() => {
                if (waitlistMode) return;
                dispatch(setWizardStep(needsWaiver ? "waiver" : "checkout"));
              }}
            />
          )}

          {waitlistMode && step === "auth" && token && joiningWaitlist ? (
            <div className="py-8 text-center text-gray-400 text-sm">
              {t("eventDetail.joiningWaitlist")}
            </div>
          ) : null}

          {!waitlistMode && step === "waiver" && eventDetail.waiver ? (
            <WizardWaiverStep
              waiver={eventDetail.waiver}
              onAccepted={(payload) => dispatch(setWaiverAcceptance(payload))}
            />
          ) : null}

          {!waitlistMode && step === "checkout" && (
            <WizardCheckoutStep
              slug={eventSlug}
              eventTitle={eventDetail.event.title}
              category={category}
              fields={eventDetail.registrationFields}
              serviceFeePercent={eventDetail.serviceFeePercent}
              idempotencyKey={idempotencyKey}
            />
          )}

          {step === "result" && (
            <WizardResultStep
              success={!paymentFailed && Boolean(confirmResult?.success)}
              waitlistJoined={waitlistJoined}
              failureMessage={failureMessage}
              registration={confirmResult?.registration}
              onRetry={handleRetry}
              onClose={handleClose}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

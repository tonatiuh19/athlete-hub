import { useEffect, useMemo, useRef, useState } from "react";
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
import {
  usePersistRegistrationSession,
  useRestoreRegistrationSession,
} from "@/components/events/registration/RegistrationPaymentReturnHandler";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  fetchPaymentConfig,
  joinEventWaitlist,
  resetCheckoutSession,
  resumeRegistrationCheckout,
  setWaiverAcceptance,
  setWizardStep,
} from "@/store/slices/registrationCheckoutSlice";
import { dismissRegistrationWizard } from "@/utils/dismissRegistrationWizard";
import { clearRegistrationSession, loadRegistrationSession } from "@/utils/registrationSessionStorage";
import { fetchEventDetail } from "@/store/slices/marketplaceSlice";
import {
  fetchAthleteRegistrations,
  fetchAthleteWaitlist,
} from "@/store/slices/athletePortalSlice";
import { cn } from "@/lib/utils";
import {
  eventRequiresWaiver,
  getRegistrationWaivers,
  isWaiverMisconfigured,
} from "@/utils/eventRegistrationWaivers";

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
    waiverAcceptance,
    checkout,
    discountCode,
  } = useAppSelector((s) => s.registrationCheckout);
  const { token, user: athleteUser } = useAppSelector((s) => s.athleteAuth);

  const [idempotencyKey, setIdempotencyKey] = useState<string>(() => crypto.randomUUID());
  const [restoredFieldValues, setRestoredFieldValues] = useState<
    Record<string, string | boolean> | null
  >(null);
  const [checkoutPaymentReady, setCheckoutPaymentReady] = useState(false);

  const registrationWaivers = useMemo(
    () => getRegistrationWaivers(eventDetail),
    [eventDetail],
  );

  const needsWaiver = eventRequiresWaiver(eventDetail) && registrationWaivers.length > 0;
  const waiverMisconfigured = isWaiverMisconfigured(eventDetail);

  const resumeAttempted = useRef(false);

  useEffect(() => {
    if (!open) {
      resumeAttempted.current = false;
      setCheckoutPaymentReady(false);
    }
  }, [open]);

  useRestoreRegistrationSession({
    open,
    eventSlug,
    categoryId: category?.id ?? null,
    onRestoreIdempotencyKey: setIdempotencyKey,
    onRestoreWaiver: (signatures) => dispatch(setWaiverAcceptance(signatures)),
    onRestoreStep: (s) => dispatch(setWizardStep(s)),
    onRestoreSession: (saved) => {
      if (saved.fieldValues) setRestoredFieldValues(saved.fieldValues);
      if (saved.checkoutPaymentReady) setCheckoutPaymentReady(true);
    },
  });

  useEffect(() => {
    if (!open || !eventSlug || !token || category?.id == null || resumeAttempted.current) return;
    const saved = loadRegistrationSession(eventSlug, category.id);
    if (!saved || saved.step !== "checkout") return;
    if (!saved.paymentPublicUuid && !saved.idempotencyKey) return;
    resumeAttempted.current = true;
    void dispatch(
      resumeRegistrationCheckout({
        slug: eventSlug,
        paymentPublicUuid: saved.paymentPublicUuid,
        idempotencyKey: saved.idempotencyKey,
      }),
    ).then((result) => {
      if (!resumeRegistrationCheckout.fulfilled.match(result)) return;
      if (result.payload.status === "complete") {
        clearRegistrationSession();
        return;
      }
      if (
        result.payload.status === "checkout" &&
        result.payload.checkout?.fieldValues
      ) {
        setRestoredFieldValues(result.payload.checkout.fieldValues);
      }
    });
  }, [open, eventSlug, token, category?.id, dispatch]);

  usePersistRegistrationSession({
    open,
    eventSlug,
    categoryId: category?.id ?? null,
    idempotencyKey,
    step,
    paymentPublicUuid: checkout?.paymentPublicUuid,
    waiverAcceptance,
    discountCode,
    fieldValues: checkout?.fieldValues ?? restoredFieldValues ?? undefined,
    checkoutPaymentReady: checkoutPaymentReady || Boolean(checkout),
  });

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
    if (!open || !confirmResult?.success) return;
    clearRegistrationSession();
    if (waitlistClaimMode) {
      dispatch(fetchAthleteWaitlist());
      dispatch(fetchAthleteRegistrations());
    }
  }, [open, confirmResult, waitlistClaimMode, dispatch]);

  if (!open || !category || !eventSlug) return null;

  if (!eventDetail || eventDetail.event.slug !== eventSlug) {
    return (
      <Dialog open={open} onOpenChange={(v) => !v && dismissRegistrationWizard(dispatch)}>
        <DialogContent className="max-w-sm bg-bg-dark border-gray-700/60">
          <div className="py-8 text-center text-gray-400 text-sm">{t("common.loading")}</div>
        </DialogContent>
      </Dialog>
    );
  }

  const handleClose = () => dismissRegistrationWizard(dispatch);
  const handleViewRegistrations = () => dismissRegistrationWizard(dispatch);

  const handleRetry = () => {
    dispatch(resetCheckoutSession());
    setIdempotencyKey(crypto.randomUUID());
    setCheckoutPaymentReady(false);
    setRestoredFieldValues(null);
    dispatch(setWizardStep(needsWaiver ? "waiver" : "checkout"));
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-lg w-[min(calc(100vw-2rem),32rem)] max-h-[min(90dvh,720px)] overflow-y-auto overflow-x-hidden bg-bg-dark border-gray-700/60 p-0 gap-0">
        <DialogHeader className="p-5 pb-0 pr-12 space-y-4">
          <div className="min-w-0">
            <DialogTitle className="text-base font-bold text-white truncate">
              {waitlistClaimMode
                ? t("registrationWizard.claimTitle")
                : t("registrationWizard.title")}
            </DialogTitle>
            <p className="text-xs text-gray-500 truncate">{category.name}</p>
          </div>

          {step !== "result" && !waiverMisconfigured && (
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
                      i === stepIndex ? "inline" : "hidden sm:inline",
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
          {waiverMisconfigured && step !== "result" ? (
            <div className="py-6 text-center space-y-3">
              <p className="text-sm text-destructive">{t("eventDetail.waiverNotConfigured")}</p>
              <p className="text-xs text-gray-500">{t("eventDetail.waiverNotConfiguredHint")}</p>
            </div>
          ) : null}

          {!waiverMisconfigured && step === "auth" && (
            <WizardAuthStep
              onAuthed={() => {
                if (waitlistMode) return;
                dispatch(setWizardStep(needsWaiver ? "waiver" : "checkout"));
              }}
            />
          )}

          {!waiverMisconfigured && waitlistMode && step === "auth" && token && joiningWaitlist ? (
            <div className="py-8 text-center text-gray-400 text-sm">
              {t("eventDetail.joiningWaitlist")}
            </div>
          ) : null}

          {!waiverMisconfigured && !waitlistMode && step === "waiver" && registrationWaivers.length > 0 ? (
            <WizardWaiverStep
              waivers={registrationWaivers}
              onAccepted={(signatures) => dispatch(setWaiverAcceptance(signatures))}
            />
          ) : null}

          {!waiverMisconfigured && !waitlistMode && step === "checkout" && (
            <WizardCheckoutStep
              slug={eventSlug}
              eventTitle={eventDetail.event.title}
              category={category}
              fields={eventDetail.registrationFields}
              serviceFeePercent={eventDetail.serviceFeePercent}
              idempotencyKey={idempotencyKey}
              restoredFieldValues={restoredFieldValues ?? checkout?.fieldValues}
              checkoutPaymentReady={checkoutPaymentReady || Boolean(checkout)}
              onCheckoutPaymentReady={setCheckoutPaymentReady}
            />
          )}

          {step === "result" && (
            <WizardResultStep
              success={!paymentFailed && Boolean(confirmResult?.success)}
              waitlistJoined={waitlistJoined}
              failureMessage={failureMessage}
              confirmationEmail={confirmResult?.confirmationEmail ?? athleteUser?.email ?? null}
              registration={confirmResult?.registration}
              onRetry={handleRetry}
              onClose={handleClose}
              onViewRegistrations={handleViewRegistrations}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

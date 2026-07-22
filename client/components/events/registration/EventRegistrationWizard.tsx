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
import WizardExtrasStep from "@/components/events/registration/WizardExtrasStep";
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
import WizardProgress from "@/components/events/registration/WizardProgress";
import {
  eventRequiresWaiver,
  getRegistrationWaivers,
  isWaiverMisconfigured,
} from "@/utils/eventRegistrationWaivers";
import {
  prerequisiteGapToWizardStep,
  resolveFirstIncompleteRegistrationStep,
  type RegistrationPrerequisiteGap,
} from "@/utils/registrationWizardPrerequisites";

export default function EventRegistrationWizard() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const { eventDetail } = useAppSelector((s) => s.marketplace);
  const {
    open,
    step,
    eventSlug,
    simulationToken,
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
    selectedExtras,
  } = useAppSelector((s) => s.registrationCheckout);
  const { token, user: athleteUser } = useAppSelector((s) => s.athleteAuth);

  const [idempotencyKey, setIdempotencyKey] = useState<string>(() => crypto.randomUUID());
  const [restoredFieldValues, setRestoredFieldValues] = useState<
    Record<string, string | boolean> | null
  >(null);
  const [checkoutPaymentReady, setCheckoutPaymentReady] = useState(false);
  /** Last known registration details — survives payment failure / retry. */
  const lastFieldValuesRef = useRef<Record<string, string | boolean> | null>(null);
  const [resumeHint, setResumeHint] = useState<RegistrationPrerequisiteGap | null>(null);
  const wizardBodyRef = useRef<HTMLDivElement>(null);

  const registrationWaivers = useMemo(
    () => getRegistrationWaivers(eventDetail),
    [eventDetail],
  );

  const registrationExtras = useMemo(() => {
    const all = eventDetail?.extras ?? [];
    if (!category?.id) return all;
    return all.filter((extra) => {
      const scope = extra.scope_type ?? "all_categories";
      if (scope === "all_categories") return true;
      return (extra.category_ids ?? []).includes(category.id);
    });
  }, [eventDetail?.extras, category?.id]);

  const registrationFields = useMemo(() => {
    const all = eventDetail?.registrationFields ?? [];
    if (!category?.id) return all;
    return all.filter((field) => {
      const scope = field.scope_type ?? "all_categories";
      if (scope === "all_categories") return true;
      return (field.category_ids ?? []).includes(category.id);
    });
  }, [eventDetail?.registrationFields, category?.id]);

  const needsWaiver = eventRequiresWaiver(eventDetail) && registrationWaivers.length > 0;
  const waiverMisconfigured = isWaiverMisconfigured(eventDetail);
  const hasExtras = registrationExtras.length > 0;
  const stepAfterWaiver: "extras" | "checkout" = hasExtras ? "extras" : "checkout";
  const stepAfterAuth = needsWaiver ? "waiver" : stepAfterWaiver;

  const resumeAttempted = useRef(false);

  useEffect(() => {
    if (!open) {
      resumeAttempted.current = false;
      setCheckoutPaymentReady(false);
      lastFieldValuesRef.current = null;
      setResumeHint(null);
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
      if (saved.fieldValues) {
        setRestoredFieldValues(saved.fieldValues);
        lastFieldValuesRef.current = saved.fieldValues;
      }
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
        simulationToken: simulationToken || saved.simulationToken,
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
        lastFieldValuesRef.current = result.payload.checkout.fieldValues;
      }
    });
  }, [open, eventSlug, token, category?.id, dispatch, simulationToken]);

  const persistedFieldValues =
    checkout?.fieldValues ?? restoredFieldValues ?? lastFieldValuesRef.current ?? undefined;

  usePersistRegistrationSession({
    open,
    eventSlug,
    categoryId: category?.id ?? null,
    idempotencyKey,
    step,
    paymentPublicUuid: checkout?.paymentPublicUuid,
    waiverAcceptance,
    discountCode,
    simulationToken: simulationToken || undefined,
    fieldValues: persistedFieldValues,
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
            hasExtras
              ? { key: "extras", label: t("registrationWizard.steps.extras") }
              : null,
            { key: "checkout", label: t("registrationWizard.steps.checkout") },
            { key: "result", label: t("registrationWizard.steps.result") },
          ].filter(Boolean) as Array<{ key: string; label: string }>),
    [t, needsWaiver, hasExtras, waitlistMode],
  );

  const progressSteps = stepsMeta.filter((s) => s.key !== "result");

  /** Expand checkout into Datos → Pago so athletes always know the sub-phase. */
  const displaySteps = useMemo(() => {
    return progressSteps.flatMap((s) => {
      if (s.key !== "checkout") return [s];
      return [
        { key: "checkout-details", label: t("registrationWizard.steps.checkoutDetails") },
        { key: "checkout-payment", label: t("registrationWizard.steps.checkoutPayment") },
      ];
    });
  }, [progressSteps, t]);

  const displayStepIndex = useMemo(() => {
    if (step === "checkout") {
      const paymentIdx = displaySteps.findIndex((s) => s.key === "checkout-payment");
      const detailsIdx = displaySteps.findIndex((s) => s.key === "checkout-details");
      if (checkoutPaymentReady || Boolean(checkout)) {
        return Math.max(paymentIdx, 0);
      }
      return Math.max(detailsIdx, 0);
    }
    const idx = displaySteps.findIndex((s) => s.key === step);
    return Math.max(idx, 0);
  }, [step, displaySteps, checkoutPaymentReady, checkout]);

  const stepOfLabel = t("registrationWizard.steps.stepOf", {
    current: displayStepIndex + 1,
    total: Math.max(displaySteps.length, 1),
  });

  const nextStepHint =
    step !== "result" && displayStepIndex < displaySteps.length - 1
      ? t("registrationWizard.steps.nextStep", {
          label: displaySteps[displayStepIndex + 1]?.label ?? "",
        })
      : null;

  useEffect(() => {
    if (!open || !eventSlug) return;
    if (simulationToken) return;
    if (!eventDetail || eventDetail.event.slug !== eventSlug) {
      dispatch(fetchEventDetail(eventSlug));
    }
  }, [open, eventSlug, simulationToken, eventDetail, dispatch]);

  useEffect(() => {
    if (open) dispatch(fetchPaymentConfig({ simulationToken }));
  }, [open, dispatch, simulationToken]);

  useEffect(() => {
    if (!open || !token || step !== "auth") return;
    if (waitlistMode) return;
    if (!eventDetail || eventDetail.event.slug !== eventSlug) return;
    dispatch(setWizardStep(stepAfterAuth));
  }, [
    open,
    token,
    step,
    waitlistMode,
    dispatch,
    eventDetail,
    eventSlug,
    stepAfterAuth,
  ]);

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

  useEffect(() => {
    if (!open) return;
    const el = wizardBodyRef.current;
    if (!el) return;
    el.scrollTo({ top: 0, behavior: step === "result" ? "smooth" : "auto" });
  }, [open, step, confirmResult?.success, paymentFailed]);

  if (!open || !category || !eventSlug) return null;

  if (!eventDetail || eventDetail.event.slug !== eventSlug) {
    return (
      <Dialog open={open} onOpenChange={(v) => !v && dismissRegistrationWizard(dispatch)}>
        <DialogContent className="max-w-sm bg-background border-border">
          <div className="py-8 text-center text-muted-foreground text-sm">{t("common.loading")}</div>
        </DialogContent>
      </Dialog>
    );
  }

  const handleClose = () => dismissRegistrationWizard(dispatch);
  const handleViewRegistrations = () => dismissRegistrationWizard(dispatch);

  const restoreSessionArtifacts = () => {
    if (!eventSlug || category?.id == null) return;
    const saved = loadRegistrationSession(eventSlug, category.id);
    if (saved?.fieldValues) {
      setRestoredFieldValues(saved.fieldValues);
      lastFieldValuesRef.current = saved.fieldValues;
    }
    if (saved?.waiverAcceptance?.length) {
      dispatch(setWaiverAcceptance(saved.waiverAcceptance));
    }
  };

  const resumeToFirstIncomplete = (preferredGap?: RegistrationPrerequisiteGap) => {
    restoreSessionArtifacts();
    const fieldValues =
      lastFieldValuesRef.current ??
      restoredFieldValues ??
      (eventSlug && category?.id != null
        ? loadRegistrationSession(eventSlug, category.id)?.fieldValues
        : null) ??
      null;

    const gap =
      preferredGap ??
      resolveFirstIncompleteRegistrationStep({
        isAuthenticated: Boolean(token),
        needsWaiver,
        waiverAcceptance:
          waiverAcceptance ??
          (eventSlug && category?.id != null
            ? loadRegistrationSession(eventSlug, category.id)?.waiverAcceptance
            : null),
        hasExtras,
        registrationFields,
        fieldValues,
      });

    dispatch(resetCheckoutSession());
    setIdempotencyKey(crypto.randomUUID());
    setCheckoutPaymentReady(false);

    if (fieldValues) {
      setRestoredFieldValues(fieldValues);
      lastFieldValuesRef.current = fieldValues;
    }

    dispatch(setWizardStep(prerequisiteGapToWizardStep(gap)));
    setResumeHint(gap === "checkout" ? null : gap);
  };

  const handleRetry = () => {
    resumeToFirstIncomplete();
  };

  const handlePrerequisiteMissing = (gap: RegistrationPrerequisiteGap) => {
    resumeToFirstIncomplete(gap);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-lg w-[min(calc(100vw-2rem),32rem)] max-h-[min(92dvh,720px)] overflow-hidden overflow-x-hidden bg-background border-border p-0 gap-0 flex flex-col">
        <DialogHeader className="sticky top-0 z-10 shrink-0 p-4 pb-3 pr-12 space-y-3 border-b border-border bg-background/95 backdrop-blur-sm supports-[backdrop-filter]:bg-background/90">
          <div className="min-w-0 text-left">
            <DialogTitle className="text-base font-bold text-foreground truncate">
              {waitlistClaimMode
                ? t("registrationWizard.claimTitle")
                : t("registrationWizard.title")}
            </DialogTitle>
            <p className="text-xs text-muted-foreground truncate">{category.name}</p>
          </div>

          {step !== "result" && !waiverMisconfigured ? (
            <WizardProgress
              steps={displaySteps}
              currentIndex={displayStepIndex}
              stepOfLabel={stepOfLabel}
              nextStepHint={nextStepHint}
            />
          ) : null}
        </DialogHeader>

        <div
          ref={wizardBodyRef}
          className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 pt-4"
        >
          {waiverMisconfigured && step !== "result" ? (
            <div className="py-6 text-center space-y-3">
              <p className="text-sm text-destructive">{t("eventDetail.waiverNotConfigured")}</p>
              <p className="text-xs text-muted-foreground">{t("eventDetail.waiverNotConfiguredHint")}</p>
            </div>
          ) : null}

          {!waiverMisconfigured && step === "auth" && (
            <WizardAuthStep
              onAuthed={() => {
                if (waitlistMode) return;
                dispatch(setWizardStep(stepAfterAuth));
              }}
            />
          )}

          {!waiverMisconfigured && waitlistMode && step === "auth" && token && joiningWaitlist ? (
            <div className="py-8 text-center text-muted-foreground text-sm">
              {t("eventDetail.joiningWaitlist")}
            </div>
          ) : null}

          {!waiverMisconfigured && !waitlistMode && step === "waiver" && registrationWaivers.length > 0 ? (
            <div className="space-y-3">
              {resumeHint === "waiver" || !waiverAcceptance?.length ? (
                <div className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
                  <p className="font-medium text-foreground">
                    {t("registrationWizard.checkout.resumeIncompleteTitle")}
                  </p>
                  <p className="mt-0.5">
                    {t("registrationWizard.checkout.resumeIncompleteWaiver")}
                  </p>
                </div>
              ) : null}
              <WizardWaiverStep
                waivers={registrationWaivers}
                onAccepted={(signatures) => {
                  dispatch(setWaiverAcceptance(signatures));
                  setResumeHint(null);
                  dispatch(setWizardStep(stepAfterWaiver));
                }}
              />
            </div>
          ) : null}

          {!waiverMisconfigured && !waitlistMode && step === "extras" && hasExtras ? (
            <WizardExtrasStep
              extras={registrationExtras}
              serviceFeePercent={eventDetail.serviceFeePercent}
              feePresentation={eventDetail.feePresentation ?? "pass_through"}
              initialSelection={Object.fromEntries(
                selectedExtras.map((row) => [row.extraId, row.quantity]),
              )}
              profilePrefill={
                athleteUser
                  ? {
                      shirt_size: athleteUser.shirtSize ?? null,
                      city: athleteUser.city ?? null,
                    }
                  : undefined
              }
            />
          ) : null}

          {!waiverMisconfigured && !waitlistMode && step === "checkout" && (
            <div className="space-y-3">
              {resumeHint === "fields" ? (
                <div className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
                  <p className="font-medium text-foreground">
                    {t("registrationWizard.checkout.resumeIncompleteTitle")}
                  </p>
                  <p className="mt-0.5">
                    {t("registrationWizard.checkout.resumeIncompleteFields")}
                  </p>
                </div>
              ) : null}
              <WizardCheckoutStep
              slug={eventSlug}
              eventTitle={eventDetail.event.title}
              category={category}
              fields={registrationFields}
              serviceFeePercent={eventDetail.serviceFeePercent}
              feePresentation={eventDetail.feePresentation ?? "pass_through"}
              idempotencyKey={idempotencyKey}
              restoredFieldValues={
                restoredFieldValues ??
                checkout?.fieldValues ??
                lastFieldValuesRef.current
              }
              checkoutPaymentReady={checkoutPaymentReady || Boolean(checkout)}
              onCheckoutPaymentReady={setCheckoutPaymentReady}
              onFieldValuesChange={(values) => {
                setRestoredFieldValues(values);
                lastFieldValuesRef.current = values;
                setResumeHint(null);
              }}
              needsWaiver={needsWaiver}
              hasWaiverAcceptance={Boolean(waiverAcceptance?.length)}
              onPrerequisiteMissing={handlePrerequisiteMissing}
              eventExtras={registrationExtras}
            />
            </div>
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

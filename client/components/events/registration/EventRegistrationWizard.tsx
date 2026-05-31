import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Footprints } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import WizardAuthStep from "@/components/events/registration/WizardAuthStep";
import WizardCheckoutStep from "@/components/events/registration/WizardCheckoutStep";
import WizardResultStep from "@/components/events/registration/WizardResultStep";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  closeRegistrationWizard,
  fetchPaymentConfig,
  setWizardStep,
} from "@/store/slices/registrationCheckoutSlice";
import { cn } from "@/lib/utils";

const STEPS = ["auth", "checkout", "result"] as const;

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
  } = useAppSelector((s) => s.registrationCheckout);
  const { token } = useAppSelector((s) => s.athleteAuth);

  const [idempotencyKey] = useState(() => crypto.randomUUID());

  useEffect(() => {
    if (open) dispatch(fetchPaymentConfig());
  }, [open, dispatch]);

  useEffect(() => {
    if (open && token && step === "auth") {
      dispatch(setWizardStep("checkout"));
    }
  }, [open, token, step, dispatch]);

  const stepIndex = STEPS.indexOf(step);

  const stepsMeta = useMemo(
    () => [
      { key: "auth", label: t("registrationWizard.steps.auth") },
      { key: "checkout", label: t("registrationWizard.steps.checkout") },
      { key: "result", label: t("registrationWizard.steps.result") },
    ],
    [t],
  );

  if (!open || !category || !eventSlug || !eventDetail) return null;

  const handleClose = () => dispatch(closeRegistrationWizard());

  const handleRetry = () => {
    dispatch(setWizardStep("checkout"));
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-lg w-[calc(100%-2rem)] max-h-[min(90vh,720px)] overflow-y-auto bg-bg-dark border-gray-700/60 p-0 gap-0">
        <DialogHeader className="p-5 pb-0 pr-12 space-y-4">
          <div className="flex items-center gap-3 min-w-0">
            {/* <div className="w-10 h-10 rounded-xl bg-cyan/10 border border-cyan/30 flex items-center justify-center shrink-0">
              <Footprints className="w-5 h-5 text-cyan" />
            </div> */}
            <div className="min-w-0">
              <DialogTitle className="text-base font-bold text-white truncate">
                {t("registrationWizard.title")}
              </DialogTitle>
              <p className="text-xs text-gray-500 truncate">{category.name}</p>
            </div>
          </div>

          {step !== "result" && (
            <div className="flex items-center gap-2">
              {stepsMeta.slice(0, 2).map((s, i) => (
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
                  {i === 0 && (
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
              onAuthed={() => dispatch(setWizardStep("checkout"))}
            />
          )}

          {step === "checkout" && (
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

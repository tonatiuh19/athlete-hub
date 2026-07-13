import { useMemo } from "react";
import { Loader2, Receipt } from "lucide-react";
import { useTranslation } from "react-i18next";
import StripeCheckout from "@/components/events/registration/StripePaymentForm";
import { Button } from "@/components/ui/button";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  confirmGroupRegistration,
  setGroupCheckoutError,
  setGroupWizardStep,
} from "@/store/slices/groupRegistrationCheckoutSlice";
import { fetchPaymentConfig } from "@/store/slices/registrationCheckoutSlice";
import { formatPriceMxn } from "@/utils/eventFormat";
import { registrationCheckoutIsReady } from "@/utils/registrationCheckoutPayment";

interface WizardGroupCheckoutStepProps {
  slug: string;
  eventTitle: string;
}

export default function WizardGroupCheckoutStep({
  slug,
  eventTitle,
}: WizardGroupCheckoutStepProps) {
  const { t, i18n } = useTranslation();
  const dispatch = useAppDispatch();
  const {
    checkout,
    loadingConfirm,
    pending3dsClientSecret,
    discountCode,
  } = useAppSelector((s) => s.groupRegistration);
  const { paymentConfig, loadingConfig } = useAppSelector(
    (s) => s.registrationCheckout,
  );

  const amountLabel = useMemo(
    () => formatPriceMxn(checkout?.amountCents ?? 0, i18n.language),
    [checkout?.amountCents, i18n.language],
  );

  const showStripe = Boolean(
    checkout &&
      checkout.amountCents > 0 &&
      checkout.clientSecret &&
      paymentConfig?.publishableKey &&
      registrationCheckoutIsReady(checkout, checkout.amountCents, discountCode),
  );

  const handleStripeSuccess = async (paymentIntentId: string) => {
    if (!checkout) return;
    await dispatch(
      confirmGroupRegistration({
        slug,
        paymentPublicUuid: checkout.paymentPublicUuid,
        paymentIntentId,
      }),
    );
  };

  const handlePayWithSavedCard = async (paymentMethodId: string) => {
    if (!checkout) return;
    await dispatch(
      confirmGroupRegistration({
        slug,
        paymentPublicUuid: checkout.paymentPublicUuid,
        paymentMethodId,
      }),
    );
  };

  const handleStripeError = (message: string) => {
    dispatch(setGroupCheckoutError(message));
  };

  const handleFreeConfirm = async () => {
    if (!checkout) return;
    await dispatch(
      confirmGroupRegistration({
        slug,
        paymentPublicUuid: checkout.paymentPublicUuid,
      }),
    );
  };

  if (!checkout) {
    return (
      <div className="py-8 text-center text-muted-foreground text-sm">
        {t("common.loading")}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card/40 p-4">
        <div className="flex items-start gap-3">
          <Receipt className="w-5 h-5 text-primary shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground truncate">{eventTitle}</p>
            <p className="text-sm font-bold text-foreground">
              {t("groupRegistration.orderSummary", {
                count: checkout.itemCount ?? checkout.lineItems?.length ?? 0,
              })}
            </p>
            <div className="mt-3 space-y-1 text-xs text-muted-foreground">
              <div className="flex justify-between font-bold text-primary pt-1 border-t border-border">
                <span>{t("eventDetail.total")}</span>
                <span>{amountLabel}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {loadingConfig && !paymentConfig ? (
        <div className="flex justify-center py-6">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : showStripe ? (
        <StripeCheckout
          amountLabel={amountLabel}
          loading={loadingConfirm}
          clientSecret={checkout.clientSecret!}
          onStripeSuccess={handleStripeSuccess}
          onStripeError={handleStripeError}
          onPayWithSavedCard={handlePayWithSavedCard}
          actionClientSecret={pending3dsClientSecret}
          publishableKey={paymentConfig?.publishableKey}
        />
      ) : checkout.amountCents <= 0 ? (
        <Button
          className="w-full btn-primary"
          disabled={loadingConfirm}
          onClick={() => void handleFreeConfirm()}
        >
          {loadingConfirm ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            t("groupRegistration.confirmFree")
          )}
        </Button>
      ) : (
        <p className="text-sm text-destructive text-center">
          {t("registrationWizard.checkout.paymentUnavailable")}
        </p>
      )}

      <Button
        type="button"
        variant="ghost"
        className="w-full text-muted-foreground"
        disabled={loadingConfirm}
        onClick={() => dispatch(setGroupWizardStep("review"))}
      >
        {t("common.back")}
      </Button>
    </div>
  );
}

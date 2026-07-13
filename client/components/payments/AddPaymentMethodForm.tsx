import { useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { useTheme } from "next-themes";
import { Loader2, Lock } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { stripePaymentElementOptions } from "@/lib/stripePaymentElementOptions";
import { buildStripeAppearance } from "@/lib/stripeAppearance";

interface AddPaymentMethodFormInnerProps {
  loading: boolean;
  onSuccess: (setupIntentId: string) => void;
  onError: (message: string) => void;
  onCancel?: () => void;
}

function AddPaymentMethodFormInner({
  loading,
  onSuccess,
  onError,
  onCancel,
}: AddPaymentMethodFormInnerProps) {
  const { t } = useTranslation();
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setProcessing(true);
    const { error, setupIntent } = await stripe.confirmSetup({
      elements,
      redirect: "if_required",
    });
    setProcessing(false);

    if (error) {
      onError(error.message || t("athletePortal.paymentMethods.addFailed"));
      return;
    }
    if (setupIntent?.status === "succeeded" && setupIntent.id) {
      onSuccess(setupIntent.id);
      return;
    }
    onError(t("athletePortal.paymentMethods.addPending"));
  };

  const busy = loading || processing;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="rounded-xl border border-border bg-card/30 p-4">
        <PaymentElement options={stripePaymentElementOptions} />
      </div>
      <div className="flex gap-2">
        {onCancel ? (
          <Button type="button" variant="outline" className="flex-1" onClick={onCancel} disabled={busy}>
            {t("common.cancel")}
          </Button>
        ) : null}
        <Button
          type="submit"
          disabled={!stripe || !elements || busy}
          className="flex-1 bg-triboo-gradient text-primary-foreground font-bold"
        >
          {busy ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              <Lock className="w-4 h-4 mr-2" />
              {t("athletePortal.paymentMethods.saveCard")}
            </>
          )}
        </Button>
      </div>
    </form>
  );
}

interface AddPaymentMethodFormProps {
  clientSecret: string;
  publishableKey: string;
  loading: boolean;
  onSuccess: (setupIntentId: string) => void;
  onError: (message: string) => void;
  onCancel?: () => void;
}

export default function AddPaymentMethodForm(props: AddPaymentMethodFormProps) {
  const { clientSecret, publishableKey, ...rest } = props;
  const [stripePromise] = useState(() => loadStripe(publishableKey));
  const { resolvedTheme } = useTheme();
  const isDark = (resolvedTheme ?? "dark") !== "light";

  if (!stripePromise) return null;

  return (
    <Elements
      stripe={stripePromise}
      options={{
        clientSecret,
        appearance: buildStripeAppearance(isDark),
      }}
    >
      <AddPaymentMethodFormInner {...rest} />
    </Elements>
  );
}

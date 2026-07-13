import { useEffect, useState } from "react";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { useTheme } from "next-themes";
import { Loader2, Lock, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import PaymentMethodCard from "@/components/payments/PaymentMethodCard";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchPaymentMethods } from "@/store/slices/paymentMethodsSlice";
import { stripePaymentElementOptions } from "@/lib/stripePaymentElementOptions";
import { buildStripeAppearance } from "@/lib/stripeAppearance";

interface StripePaymentFormProps {
  amountLabel: string;
  loading: boolean;
  onStripeSuccess: (paymentIntentId: string) => void;
  onStripeError: (message: string) => void;
  onPayWithSavedCard?: (paymentMethodId: string) => void | Promise<void>;
  /** When saved-card confirm requires 3DS */
  actionClientSecret?: string | null;
  publishableKey?: string;
}

function PaymentFormInner({
  amountLabel,
  loading,
  onStripeSuccess,
  onStripeError,
  onPayWithSavedCard,
  actionClientSecret,
  publishableKey,
}: StripePaymentFormProps) {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);
  const [useNewCard, setUseNewCard] = useState(false);
  const [actionStripe, setActionStripe] = useState<Stripe | null>(null);
  const [inlineActionSecret, setInlineActionSecret] = useState<string | null>(null);
  const { paymentMethods, defaultPaymentMethodId } =
    useAppSelector((s) => s.paymentMethods);
  const [selectedPmId, setSelectedPmId] = useState<string | null>(null);

  useEffect(() => {
    dispatch(fetchPaymentMethods());
  }, [dispatch]);

  useEffect(() => {
    if (defaultPaymentMethodId) {
      setSelectedPmId(defaultPaymentMethodId);
    } else if (paymentMethods.length > 0) {
      setSelectedPmId(paymentMethods[0].id);
    }
  }, [defaultPaymentMethodId, paymentMethods]);

  const activeActionSecret = actionClientSecret ?? inlineActionSecret;

  useEffect(() => {
    if (!activeActionSecret || !publishableKey) {
      setActionStripe(null);
      return;
    }
    let cancelled = false;
    void loadStripe(publishableKey).then((s) => {
      if (!cancelled) setActionStripe(s);
    });
    return () => {
      cancelled = true;
    };
  }, [activeActionSecret, publishableKey]);

  const hasSavedCards = paymentMethods.length > 0;
  const showNewCardForm = !hasSavedCards || useNewCard;
  const needsAction = Boolean(activeActionSecret && actionStripe);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!showNewCardForm && selectedPmId && onPayWithSavedCard) {
      setProcessing(true);
      try {
        await onPayWithSavedCard(selectedPmId);
      } finally {
        setProcessing(false);
      }
      return;
    }

    if (!stripe || !elements) return;

    setProcessing(true);
    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: "if_required",
      confirmParams: {
        return_url: window.location.href,
      },
    });
    setProcessing(false);

    if (error) {
      onStripeError(error.message || t("registrationWizard.payment.failed"));
      return;
    }
    if (paymentIntent?.status === "succeeded") {
      onStripeSuccess(paymentIntent.id);
    } else if (
      paymentIntent?.status === "requires_action" &&
      paymentIntent.client_secret
    ) {
      setInlineActionSecret(paymentIntent.client_secret);
    } else {
      onStripeError(t("registrationWizard.payment.pending"));
    }
  };

  const handleCompleteAuthentication = async () => {
    if (!actionStripe || !activeActionSecret) return;
    setProcessing(true);
    const { error, paymentIntent } = await actionStripe.confirmCardPayment(
      activeActionSecret,
      { return_url: window.location.href },
    );
    setProcessing(false);
    if (error) {
      onStripeError(error.message || t("registrationWizard.payment.failed"));
      return;
    }
    if (paymentIntent?.status === "succeeded") {
      setInlineActionSecret(null);
      onStripeSuccess(paymentIntent.id);
    } else {
      onStripeError(t("registrationWizard.payment.pending"));
    }
  };

  const busy = loading || processing;

  if (needsAction) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-amber-200 rounded-xl border border-amber-500/30 bg-amber-500/5 px-3 py-2">
          {t("registrationWizard.payment.authenticationRequired")}
        </p>
        <Button
          type="button"
          disabled={busy}
          onClick={() => void handleCompleteAuthentication()}
          className="w-full h-11 bg-gradient-to-r from-cyan to-blue-electric text-navy-deep font-bold"
        >
          {busy ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              <Lock className="w-4 h-4 mr-2" />
              {t("registrationWizard.payment.completeAuthentication")}
            </>
          )}
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {hasSavedCards && !useNewCard ? (
        <div className="space-y-2">
          {paymentMethods.map((method) => (
            <PaymentMethodCard
              key={method.id}
              method={method}
              selectable
              selected={selectedPmId === method.id}
              onSelect={() => setSelectedPmId(method.id)}
            />
          ))}
          <button
            type="button"
            onClick={() => setUseNewCard(true)}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-border text-xs text-muted-foreground hover:text-primary hover:border-cyan/40 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            {t("registrationWizard.payment.useNewCard")}
          </button>
        </div>
      ) : null}

      {showNewCardForm ? (
        <>
          {hasSavedCards ? (
            <button
              type="button"
              onClick={() => setUseNewCard(false)}
              className="text-xs text-primary hover:underline"
            >
              {t("registrationWizard.payment.useSavedCard")}
            </button>
          ) : null}
          <div className="rounded-xl border border-border bg-card/60 p-4">
            <PaymentElement options={stripePaymentElementOptions} />
          </div>
        </>
      ) : null}

      <Button
        type="submit"
        disabled={
          busy ||
          (showNewCardForm && (!stripe || !elements)) ||
          (!showNewCardForm && !selectedPmId)
        }
        className="w-full h-11 bg-gradient-to-r from-cyan to-blue-electric text-navy-deep font-bold"
      >
        {busy ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <>
            <Lock className="w-4 h-4 mr-2" />
            {t("registrationWizard.payment.pay", { amount: amountLabel })}
          </>
        )}
      </Button>
      <p className="text-[10px] text-center text-muted-foreground flex items-center justify-center gap-1">
        <Lock className="w-3 h-3" />
        {t("registrationWizard.payment.secure")}
      </p>
    </form>
  );
}

interface StripeCheckoutProps extends StripePaymentFormProps {
  clientSecret: string;
  publishableKey: string;
}

export default function StripeCheckout(props: StripeCheckoutProps) {
  const { clientSecret, publishableKey, ...rest } = props;
  const [stripePromise] = useState(() => loadStripe(publishableKey));
  const { resolvedTheme } = useTheme();
  const isDark = (resolvedTheme ?? "dark") !== "light";

  if (!stripePromise || !clientSecret) return null;

  return (
    <Elements
      stripe={stripePromise}
      options={{
        clientSecret,
        appearance: buildStripeAppearance(isDark),
      }}
    >
      <PaymentFormInner {...rest} publishableKey={publishableKey} />
    </Elements>
  );
}

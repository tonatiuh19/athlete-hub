import { useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { CreditCard, Loader2, Lock } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface StripePaymentFormProps {
  mockMode: boolean;
  amountLabel: string;
  loading: boolean;
  onMockPay: () => void;
  onStripeSuccess: (paymentIntentId: string) => void;
  onStripeError: (message: string) => void;
}

function PaymentFormInner({
  mockMode,
  amountLabel,
  loading,
  onMockPay,
  onStripeSuccess,
  onStripeError,
}: StripePaymentFormProps) {
  const { t } = useTranslation();
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mockMode) {
      onMockPay();
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
    } else {
      onStripeError(t("registrationWizard.payment.pending"));
    }
  };

  const busy = loading || processing;

  if (mockMode) {
    return (
      <div className="space-y-4">
        <div
          className={cn(
            "rounded-xl border border-dashed border-gray-600/80 bg-surface-dark/40 p-5 relative overflow-hidden",
          )}
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(0,229,255,0.06),transparent_60%)]" />
          <div className="relative flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-cyan/10 border border-cyan/30 flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-cyan" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">
                {t("registrationWizard.payment.mockTitle")}
              </p>
              <p className="text-xs text-gray-500">{t("registrationWizard.payment.mockHint")}</p>
            </div>
          </div>
          <div className="relative h-10 rounded-lg bg-bg-dark/80 border border-gray-700/60 flex items-center px-3 text-xs text-gray-600 font-mono">
            •••• •••• •••• 4242
          </div>
        </div>
        <Button
          type="button"
          disabled={busy}
          onClick={onMockPay}
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
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="rounded-xl border border-gray-700/50 bg-surface-dark/30 p-4">
        <PaymentElement options={{ layout: "tabs" }} />
      </div>
      <Button
        type="submit"
        disabled={!stripe || !elements || busy}
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
      <p className="text-[10px] text-center text-gray-600 flex items-center justify-center gap-1">
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
  const { clientSecret, publishableKey, mockMode, ...rest } = props;
  const [stripePromise] = useState(() =>
    mockMode ? null : loadStripe(publishableKey),
  );

  if (mockMode) {
    return <PaymentFormInner mockMode {...rest} />;
  }

  if (!stripePromise) return null;

  return (
    <Elements
      stripe={stripePromise}
      options={{
        clientSecret,
        appearance: {
          theme: "night",
          variables: {
            colorPrimary: "#00E5FF",
            colorBackground: "#0A0F1F",
            colorText: "#E2E8F0",
            colorDanger: "#FF5252",
            borderRadius: "10px",
            fontFamily: "Inter, system-ui, sans-serif",
          },
          rules: {
            ".Input": {
              border: "1px solid rgba(55, 65, 81, 0.8)",
              backgroundColor: "rgba(15, 23, 42, 0.6)",
            },
            ".Tab": {
              border: "1px solid rgba(55, 65, 81, 0.5)",
            },
            ".Tab--selected": {
              borderColor: "rgba(0, 229, 255, 0.5)",
            },
          },
        },
      }}
    >
      <PaymentFormInner mockMode={false} {...rest} />
    </Elements>
  );
}

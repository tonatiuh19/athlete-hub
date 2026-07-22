import { useEffect, useState } from "react";
import { initMercadoPago, Payment } from "@mercadopago/sdk-react";
import { Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { logger } from "@/utils/logger";

interface MercadoPagoCheckoutProps {
  publicKey: string;
  preferenceId: string;
  amountCents: number;
  amountLabel: string;
  loading?: boolean;
  onSubmitCard: (payload: {
    token: string;
    paymentMethodId: string;
    installments: number;
  }) => Promise<void>;
  onError: (message: string) => void;
}

/**
 * Mercado Pago Payment Brick inside Triboo checkout chrome.
 * Card payments submit a token to our backend (marketplace application_fee).
 * Wallet / OXXO may redirect via preference; pending OXXO confirms via webhook.
 */
export default function MercadoPagoCheckout({
  publicKey,
  preferenceId,
  amountCents,
  amountLabel,
  loading,
  onSubmitCard,
  onError,
}: MercadoPagoCheckoutProps) {
  const { t } = useTranslation();
  const [ready, setReady] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    try {
      initMercadoPago(publicKey, { locale: "es-MX" });
      setReady(true);
    } catch (err) {
      logger.error("mp_init_failed", err);
      onError(t("registrationWizard.payment.mpInitFailed"));
    }
  }, [publicKey, onError, t]);

  if (!ready) {
    return (
      <div className="rounded-xl border border-border bg-card/60 p-6 flex justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  const amount = Math.max(0, amountCents) / 100;

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground text-center">{amountLabel}</p>
      {(loading || submitting) && (
        <div className="flex justify-center py-2">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
        </div>
      )}
      <div className="rounded-xl border border-border bg-card overflow-hidden p-2">
        <Payment
          initialization={{
            amount,
            preferenceId,
            marketplace: true,
          }}
          customization={{
            paymentMethods: {
              maxInstallments: 1,
              creditCard: "all",
              debitCard: "all",
              ticket: "all",
              mercadoPago: "all",
            },
          }}
          onSubmit={async ({ formData }) => {
            setSubmitting(true);
            try {
              const token = String(
                (formData as { token?: string }).token || "",
              );
              const paymentMethodId = String(
                (formData as { payment_method_id?: string }).payment_method_id ||
                  "",
              );
              const installments = Number(
                (formData as { installments?: number }).installments || 1,
              );
              if (!token || !paymentMethodId) {
                // Ticket / wallet flows may not return a card token — preference handles them.
                return;
              }
              await onSubmitCard({ token, paymentMethodId, installments });
            } catch (err) {
              onError(
                err instanceof Error
                  ? err.message
                  : t("registrationWizard.payment.failed"),
              );
            } finally {
              setSubmitting(false);
            }
          }}
          onError={(error) => {
            logger.error("mp_brick_error", error);
            onError(t("registrationWizard.payment.failed"));
          }}
          onReady={() => undefined}
        />
      </div>
      <p className="text-[11px] text-muted-foreground text-center">
        {t("registrationWizard.payment.mpPowered")
          ? t("registrationWizard.payment.mpPowered")
          : t("registrationWizard.payment.secure")}
      </p>
    </div>
  );
}

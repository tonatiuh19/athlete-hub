import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CreditCard, Loader2, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import MetaHelmet from "@/components/MetaHelmet";
import PortalErrorAlert from "@/components/athlete/PortalErrorAlert";
import AddPaymentMethodForm from "@/components/payments/AddPaymentMethodForm";
import PaymentMethodCard from "@/components/payments/PaymentMethodCard";
import { Button } from "@/components/ui/button";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  clearSetupIntent,
  completeSetupIntent,
  createSetupIntent,
  fetchPaymentMethods,
  removePaymentMethod,
  setDefaultPaymentMethod,
} from "@/store/slices/paymentMethodsSlice";
import { fetchPaymentConfig } from "@/store/slices/registrationCheckoutSlice";

export default function AthletePaymentMethods() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const {
    paymentMethods,
    setupClientSecret,
    loading,
    loadingSetup,
    loadingAction,
    error,
  } = useAppSelector((s) => s.paymentMethods);
  const { paymentConfig } = useAppSelector((s) => s.registrationCheckout);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    dispatch(fetchPaymentMethods());
    if (!paymentConfig) dispatch(fetchPaymentConfig());
  }, [dispatch, paymentConfig]);

  const publishableKey = paymentConfig?.publishableKey ?? "";

  const startAddCard = async () => {
    setAdding(true);
    const result = await dispatch(createSetupIntent());
    if (createSetupIntent.rejected.match(result)) {
      setAdding(false);
    }
  };

  const handleSetupSuccess = async (setupIntentId: string) => {
    const result = await dispatch(completeSetupIntent({ setupIntentId }));
    if (completeSetupIntent.fulfilled.match(result)) {
      setAdding(false);
    }
  };

  const handleCancelAdd = () => {
    setAdding(false);
    dispatch(clearSetupIntent());
  };

  return (
    <div className="max-w-xl mx-auto w-full min-w-0 overflow-x-clip space-y-6">
      <MetaHelmet
        title={t("athletePortal.paymentMethods.title")}
        description={t("athletePortal.paymentMethods.subtitle")}
      />

      <div>
        <h1 className="text-2xl font-bold">{t("athletePortal.paymentMethods.title")}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t("athletePortal.paymentMethods.subtitle")}
        </p>
      </div>

      {error ? (
        <PortalErrorAlert
          error={error}
          onRetry={() => dispatch(fetchPaymentMethods())}
        />
      ) : null}

      {loading && paymentMethods.length === 0 ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-cyan" />
        </div>
      ) : (
        <div className="space-y-3">
          {paymentMethods.map((method) => (
            <PaymentMethodCard
              key={method.id}
              method={method}
              disabled={loadingAction}
              onSetDefault={() => dispatch(setDefaultPaymentMethod({ paymentMethodId: method.id }))}
              onRemove={() => dispatch(removePaymentMethod({ paymentMethodId: method.id }))}
            />
          ))}

          {paymentMethods.length === 0 && !adding ? (
            <div className="card-sport p-8 text-center">
              <CreditCard className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">
                {t("athletePortal.paymentMethods.empty")}
              </p>
            </div>
          ) : null}
        </div>
      )}

      {adding && setupClientSecret && publishableKey ? (
        <div className="card-sport p-5">
          <h2 className="text-sm font-bold mb-4">{t("athletePortal.paymentMethods.addTitle")}</h2>
          <AddPaymentMethodForm
            clientSecret={setupClientSecret}
            publishableKey={publishableKey}
            loading={loadingAction}
            onSuccess={handleSetupSuccess}
            onError={() => undefined}
            onCancel={handleCancelAdd}
          />
        </div>
      ) : null}

      {!adding ? (
        <Button
          type="button"
          onClick={startAddCard}
          disabled={loadingSetup || loadingAction}
          className="w-full bg-cyan/10 text-cyan border border-cyan/40 hover:bg-cyan hover:text-navy-deep"
        >
          {loadingSetup ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              <Plus className="w-4 h-4 mr-2" />
              {t("athletePortal.paymentMethods.addCard")}
            </>
          )}
        </Button>
      ) : null}

      <p className="text-xs text-muted-foreground text-center">
        {t("athletePortal.paymentMethods.secureNote")}
      </p>

      <div className="text-center">
        <Link to="/portal/profile" className="text-xs text-cyan hover:underline">
          {t("athletePortal.paymentMethods.backToProfile")}
        </Link>
      </div>
    </div>
  );
}

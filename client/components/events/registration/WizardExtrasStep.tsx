import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Gift, Minus, Plus, Sparkles } from "lucide-react";
import WizardExtraFieldsForm, {
  type ExtraFieldValues,
} from "@/components/events/registration/WizardExtraFieldsForm";
import type { EventExtra, FeePresentation } from "@shared/api";
import { athleteFacingTotalCents } from "@shared/checkoutBreakdown";
import { validateExtraFieldAnswers } from "@shared/extraFields";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatPriceMxn } from "@/utils/eventFormat";
import { useAppDispatch } from "@/store/hooks";
import {
  setExtraFieldAnswers,
  setSelectedExtras,
  setWizardStep,
} from "@/store/slices/registrationCheckoutSlice";

interface WizardExtrasStepProps {
  extras: EventExtra[];
  serviceFeePercent: number;
  feePresentation: FeePresentation;
  initialSelection?: Record<number, number>;
  profilePrefill?: {
    shirt_size?: string | null;
    city?: string | null;
    state?: string | null;
  };
  onContinue?: () => void;
  onComplete?: (payload: {
    selectedExtras: Array<{ extraId: number; quantity: number }>;
    extraFieldAnswers: Array<{
      extraId: number;
      values: Record<string, string | boolean | Record<string, unknown>>;
    }>;
  }) => void;
}

export default function WizardExtrasStep({
  extras,
  serviceFeePercent,
  feePresentation,
  initialSelection = {},
  profilePrefill,
  onContinue,
  onComplete,
}: WizardExtrasStepProps) {
  const { t, i18n } = useTranslation();
  const dispatch = useAppDispatch();
  const [quantities, setQuantities] = useState<Record<number, number>>(() => ({
    ...initialSelection,
  }));
  const [fieldAnswers, setFieldAnswers] = useState<Record<number, ExtraFieldValues>>({});
  const [validationError, setValidationError] = useState<string | null>(null);

  const selectedLines = useMemo(
    () =>
      extras
        .map((extra) => ({
          extra,
          quantity: quantities[extra.id] ?? 0,
        }))
        .filter((row) => row.quantity > 0),
    [extras, quantities],
  );

  const extrasSubtotalCents = selectedLines.reduce(
    (sum, row) => sum + row.extra.price_cents * row.quantity,
    0,
  );

  const extrasAthleteTotal = athleteFacingTotalCents(
    extrasSubtotalCents,
    serviceFeePercent,
    feePresentation,
  );

  const setQty = (extraId: number, next: number, max: number) => {
    const clamped = Math.max(0, Math.min(max, next));
    setQuantities((prev) => {
      const copy = { ...prev };
      if (clamped <= 0) delete copy[extraId];
      else copy[extraId] = clamped;
      return copy;
    });
    setValidationError(null);
  };

  const handleFieldChange = (extraId: number, values: ExtraFieldValues) => {
    setFieldAnswers((prev) => ({ ...prev, [extraId]: values }));
    setValidationError(null);
  };

  const handleContinue = () => {
    for (const row of selectedLines) {
      const fields = row.extra.fields ?? [];
      if (!fields.length) continue;
      const err = validateExtraFieldAnswers(fields, fieldAnswers[row.extra.id]);
      if (err) {
        setValidationError(err);
        return;
      }
    }

    const payload = selectedLines.map((row) => ({
      extraId: row.extra.id,
      quantity: row.quantity,
    }));
    const answersPayload = selectedLines
      .filter((row) => (row.extra.fields?.length ?? 0) > 0)
      .map((row) => ({
        extraId: row.extra.id,
        values: fieldAnswers[row.extra.id] ?? {},
      }));

    if (onComplete) {
      onComplete({
        selectedExtras: payload,
        extraFieldAnswers: answersPayload.map((row) => ({
          extraId: row.extraId,
          values: row.values as Record<string, string | boolean | Record<string, unknown>>,
        })),
      });
    } else {
      dispatch(setSelectedExtras(payload));
      dispatch(
        setExtraFieldAnswers(
          answersPayload.map((row) => ({
            extraId: row.extraId,
            values: row.values as Record<string, string | boolean | Record<string, unknown>>,
          })),
        ),
      );
    }
    if (onContinue) onContinue();
    else if (!onComplete) dispatch(setWizardStep("checkout"));
  };

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 border border-primary/20">
          <Gift className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0 space-y-1">
          <h3 className="font-semibold text-sm text-foreground">
            {t("registrationWizard.extras.title")}
          </h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {t("registrationWizard.extras.subtitle")}
          </p>
        </div>
      </div>

      {validationError ? (
        <p className="text-sm text-destructive">{validationError}</p>
      ) : null}

      <ul className="space-y-3">
        {extras.map((extra) => {
          const qty = quantities[extra.id] ?? 0;
          const soldOut =
            extra.capacity != null &&
            Number(extra.sold_count ?? 0) >= Number(extra.capacity);
          const maxQty = Math.min(
            extra.max_per_athlete,
            extra.capacity != null
              ? Math.max(0, Number(extra.capacity) - Number(extra.sold_count ?? 0))
              : extra.max_per_athlete,
          );
          const lineTotal = athleteFacingTotalCents(
            extra.price_cents * Math.max(qty, 1),
            serviceFeePercent,
            feePresentation,
          );

          return (
            <li
              key={extra.id}
              className={cn(
                "rounded-xl border p-4 transition-colors",
                qty > 0
                  ? "border-primary/40 bg-primary/5"
                  : "border-border bg-card/60",
                soldOut && "opacity-60",
              )}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                {extra.image_url ? (
                  <img
                    src={extra.image_url}
                    alt=""
                    className="h-16 w-16 rounded-lg object-cover border border-border shrink-0"
                  />
                ) : null}
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-foreground">{extra.name}</p>
                    <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      {t(`staffPortal.eventEdit.extraTypes.${extra.extra_type}`)}
                    </span>
                  </div>
                  {extra.description ? (
                    <p className="text-xs text-muted-foreground leading-relaxed">{extra.description}</p>
                  ) : null}
                  <p className="text-sm font-medium text-primary">
                    {extra.price_cents === 0
                      ? t("registrationWizard.extras.free")
                      : formatPriceMxn(extra.price_cents, i18n.language)}
                    {extra.price_cents > 0 &&
                    feePresentation === "pass_through" &&
                    serviceFeePercent > 0 ? (
                      <span className="text-muted-foreground font-normal text-xs ml-1">
                        (+ {t("registrationWizard.extras.feeNote")})
                      </span>
                    ) : null}
                  </p>
                  {soldOut ? (
                    <p className="text-xs text-destructive">{t("registrationWizard.extras.soldOut")}</p>
                  ) : null}
                </div>

                {!soldOut ? (
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 border-border"
                      disabled={qty <= 0}
                      onClick={() => setQty(extra.id, qty - 1, maxQty)}
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                    <span className="w-6 text-center text-sm font-semibold text-foreground">{qty}</span>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 border-border"
                      disabled={qty >= maxQty}
                      onClick={() => setQty(extra.id, qty + 1, maxQty)}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                ) : null}
              </div>
              {qty > 0 && (extra.fields?.length ?? 0) > 0 ? (
                <WizardExtraFieldsForm
                  extraId={extra.id}
                  fields={extra.fields ?? []}
                  values={fieldAnswers[extra.id] ?? {}}
                  profilePrefill={profilePrefill}
                  onChange={handleFieldChange}
                />
              ) : null}
              {qty > 0 ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  {t("registrationWizard.extras.lineTotal", {
                    total: formatPriceMxn(lineTotal, i18n.language),
                    qty,
                  })}
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>

      {selectedLines.length > 0 ? (
        <div className="rounded-xl border border-border bg-card/40 p-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Sparkles className="w-4 h-4 text-primary shrink-0" />
            <span>{t("registrationWizard.extras.addOnsSubtotal")}</span>
          </div>
          <span className="text-sm font-bold text-primary">
            {formatPriceMxn(extrasAthleteTotal, i18n.language)}
          </span>
        </div>
      ) : null}

      <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-between">
        <Button
          type="button"
          variant="ghost"
          className="text-muted-foreground"
          onClick={() => {
            dispatch(setSelectedExtras([]));
            dispatch(setExtraFieldAnswers([]));
            dispatch(setWizardStep("checkout"));
          }}
        >
          {t("registrationWizard.extras.skip")}
        </Button>
        <Button type="button" onClick={handleContinue}>
          {t("registrationWizard.extras.continue")}
        </Button>
      </div>
    </div>
  );
}

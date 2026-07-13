import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  computeCheckoutBreakdown,
  DEFAULT_SERVICE_FEE_PERCENT,
  formatMxnFromCents,
  type FeePresentation,
} from "@shared/checkoutBreakdown";
import { Input } from "@/components/ui/input";

export interface StaffFeeCalculatorCardProps {
  serviceFeePercent?: number;
  feePresentation?: FeePresentation;
  samplePriceMxn?: number;
  samplePriceEditable?: boolean;
  onSamplePriceChange?: (value: number) => void;
  registrationCount?: number;
  feeEditable?: boolean;
  onFeePercentChange?: (value: number) => void;
  compact?: boolean;
}

export default function StaffFeeCalculatorCard({
  serviceFeePercent = DEFAULT_SERVICE_FEE_PERCENT,
  feePresentation = "pass_through",
  samplePriceMxn = 1000,
  samplePriceEditable = false,
  onSamplePriceChange,
  registrationCount = 1,
  feeEditable = false,
  onFeePercentChange,
  compact = false,
}: StaffFeeCalculatorCardProps) {
  const { t } = useTranslation();
  const absorbAll = feePresentation === "absorb_all";

  const breakdown = useMemo(() => {
    const listPriceCents = Math.max(0, Math.round(samplePriceMxn * 100));
    return computeCheckoutBreakdown({
      listPriceCents,
      serviceFeePercent: Math.max(0, serviceFeePercent),
      feePresentation,
    });
  }, [samplePriceMxn, serviceFeePercent, feePresentation]);

  const count = Math.max(1, registrationCount);
  const projectedOrganizer = breakdown.organizerFiscalNetCents * count;
  const projectedBankDeposit = breakdown.stripeOrganizerTransferCents * count;
  const projectedPlatform = breakdown.stripePlatformFeeCents * count;
  const projectedTotal = breakdown.athleteTotalCents * count;

  return (
    <div className="rounded-xl border border-border/60 bg-muted/20 p-4 space-y-4">
      <div>
        <p className="text-sm font-semibold">{t("staffPortal.payouts.feeCalculatorTitle")}</p>
        <p className="text-xs text-muted-foreground mt-1">
          {absorbAll
            ? t("staffPortal.payouts.feeCalculatorHintAbsorb")
            : t("staffPortal.payouts.feeCalculatorHint")}
        </p>
      </div>

      <div className={`grid gap-3 ${compact ? "grid-cols-1" : "sm:grid-cols-2"}`}>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">
            {t("staffPortal.payouts.feePercentLabel")}
          </label>
          {feeEditable ? (
            <input
              type="number"
              min={0}
              max={100}
              step={0.5}
              value={serviceFeePercent}
              onChange={(e) => onFeePercentChange?.(Number(e.target.value))}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          ) : (
            <p className="text-sm font-medium">{serviceFeePercent}%</p>
          )}
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">
            {absorbAll
              ? t("staffPortal.payouts.sampleStickerLabel")
              : t("staffPortal.payouts.samplePriceLabel")}
          </label>
          {samplePriceEditable ? (
            <Input
              type="number"
              min={0}
              step={50}
              value={samplePriceMxn}
              onChange={(e) => onSamplePriceChange?.(Math.max(0, Number(e.target.value) || 0))}
              className="h-10"
            />
          ) : (
            <p className="text-sm font-medium">{formatMxnFromCents(breakdown.listPriceCents)}</p>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-border/50 bg-background/60 p-3 space-y-2 text-sm">
        {absorbAll ? (
          <>
            <div className="flex justify-between gap-2 font-semibold">
              <span>{t("staffPortal.payouts.linePublicPrice")}</span>
              <span>{formatMxnFromCents(breakdown.athleteTotalCents)}</span>
            </div>
            <div className="flex justify-between gap-2 text-muted-foreground">
              <span>
                {t("staffPortal.payouts.lineServiceFee", { percent: serviceFeePercent })}
              </span>
              <span>−{formatMxnFromCents(breakdown.serviceFeeCents)}</span>
            </div>
            <div className="flex justify-between gap-2 text-muted-foreground">
              <span>{t("staffPortal.payouts.lineDisplayIva")}</span>
              <span>−{formatMxnFromCents(breakdown.displayIvaCents)}</span>
            </div>
            <div className="flex justify-between gap-2 text-accent border-t border-border pt-2">
              <span>{t("staffPortal.payouts.lineOrganizerNet")}</span>
              <span>{formatMxnFromCents(breakdown.organizerFiscalNetCents)}</span>
            </div>
            <div className="flex justify-between gap-2 text-muted-foreground text-xs">
              <span>{t("staffPortal.payouts.lineBankDeposit")}</span>
              <span>{formatMxnFromCents(breakdown.stripeOrganizerTransferCents)}</span>
            </div>
          </>
        ) : (
          <>
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">{t("staffPortal.payouts.lineInscription")}</span>
              <span>{formatMxnFromCents(breakdown.listPriceCents)}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">
                {t("staffPortal.payouts.lineServiceFee", { percent: serviceFeePercent })}
              </span>
              <span>{formatMxnFromCents(breakdown.serviceFeeCents)}</span>
            </div>
            <div className="flex justify-between gap-2 font-semibold border-t border-border pt-2">
              <span>{t("staffPortal.payouts.lineAthleteTotal")}</span>
              <span>{formatMxnFromCents(breakdown.athleteTotalCents)}</span>
            </div>
            <div className="flex justify-between gap-2 text-accent">
              <span>{t("staffPortal.payouts.lineOrganizerReceives")}</span>
              <span>{formatMxnFromCents(breakdown.stripeOrganizerTransferCents)}</span>
            </div>
            <div className="flex justify-between gap-2 text-muted-foreground text-xs">
              <span>{t("staffPortal.payouts.linePlatformFee")}</span>
              <span>{formatMxnFromCents(breakdown.stripePlatformFeeCents)}</span>
            </div>
          </>
        )}
      </div>

      {!compact ? (
        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer font-medium text-foreground">
            {t("staffPortal.payouts.ivaBreakdownToggle")}
          </summary>
          <div className="mt-2 space-y-1 pl-1">
            {absorbAll ? (
              <p>
                {t("staffPortal.payouts.ivaAbsorbSummary", {
                  iva: formatMxnFromCents(breakdown.displayIvaCents),
                  total: formatMxnFromCents(breakdown.athleteTotalCents),
                })}
              </p>
            ) : (
              <>
                <p>
                  {t("staffPortal.payouts.ivaInscription", {
                    base: formatMxnFromCents(breakdown.inscriptionBaseCents),
                    iva: formatMxnFromCents(breakdown.inscriptionIvaCents),
                  })}
                </p>
                <p>
                  {t("staffPortal.payouts.ivaServiceFee", {
                    base: formatMxnFromCents(breakdown.serviceFeeBaseCents),
                    iva: formatMxnFromCents(breakdown.serviceFeeIvaCents),
                  })}
                </p>
              </>
            )}
            <p className="text-[11px] pt-1">{t("staffPortal.payouts.ivaDisclaimer")}</p>
          </div>
        </details>
      ) : null}

      {count > 1 ? (
        <div className="text-xs text-muted-foreground border-t border-border pt-3 space-y-1">
          <p className="font-medium text-foreground">
            {t("staffPortal.payouts.projectionTitle", { count })}
          </p>
          <p>
            {t(
              absorbAll
                ? "staffPortal.payouts.projectionOrganizerNet"
                : "staffPortal.payouts.projectionOrganizer",
              { amount: formatMxnFromCents(projectedOrganizer) },
            )}
          </p>
          {absorbAll ? (
            <p>
              {t("staffPortal.payouts.projectionBankDeposit", {
                amount: formatMxnFromCents(projectedBankDeposit),
              })}
            </p>
          ) : null}
          <p>
            {t("staffPortal.payouts.projectionVolume", {
              amount: formatMxnFromCents(projectedTotal),
            })}
          </p>
          <p>
            {t("staffPortal.payouts.projectionPlatform", {
              amount: formatMxnFromCents(projectedPlatform),
            })}
          </p>
        </div>
      ) : null}
    </div>
  );
}

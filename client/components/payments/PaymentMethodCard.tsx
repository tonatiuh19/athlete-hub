import { CreditCard, Star, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { AthletePaymentMethod } from "@shared/api";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatCardBrand, formatCardExpiry } from "@/utils/cardFormat";

interface PaymentMethodCardProps {
  method: AthletePaymentMethod;
  selectable?: boolean;
  selected?: boolean;
  onSelect?: () => void;
  onSetDefault?: () => void;
  onRemove?: () => void;
  disabled?: boolean;
}

export default function PaymentMethodCard({
  method,
  selectable,
  selected,
  onSelect,
  onSetDefault,
  onRemove,
  disabled,
}: PaymentMethodCardProps) {
  const { t } = useTranslation();
  const label = `${formatCardBrand(method.brand)} •••• ${method.last4}`;

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl border p-3 transition-all",
        selectable && "cursor-pointer",
        selected
          ? "border-cyan/60 bg-cyan/5 ring-1 ring-cyan/20"
          : "border-border bg-card/50 hover:border-cyan/30",
        disabled && "opacity-60 pointer-events-none",
      )}
      onClick={selectable && onSelect ? onSelect : undefined}
      onKeyDown={
        selectable && onSelect
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") onSelect();
            }
          : undefined
      }
      role={selectable ? "button" : undefined}
      tabIndex={selectable ? 0 : undefined}
    >
      <div className="w-10 h-10 rounded-lg bg-cyan/10 border border-cyan/25 flex items-center justify-center shrink-0">
        <CreditCard className="w-5 h-5 text-cyan" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate">{label}</p>
        <p className="text-xs text-muted-foreground">
          {t("athletePortal.paymentMethods.expires", {
            date: formatCardExpiry(method.expMonth, method.expYear),
          })}
        </p>
      </div>
      {method.isDefault ? (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-cyan/15 text-cyan text-[10px] font-bold uppercase shrink-0">
          <Star className="w-3 h-3" />
          {t("athletePortal.paymentMethods.default")}
        </span>
      ) : null}
      {!selectable && onSetDefault && !method.isDefault ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-xs shrink-0"
          disabled={disabled}
          onClick={onSetDefault}
        >
          {t("athletePortal.paymentMethods.setDefault")}
        </Button>
      ) : null}
      {!selectable && onRemove ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-destructive hover:text-destructive shrink-0"
          disabled={disabled}
          onClick={onRemove}
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      ) : null}
    </div>
  );
}

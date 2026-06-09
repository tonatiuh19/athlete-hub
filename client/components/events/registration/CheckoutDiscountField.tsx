import { Loader2, Tag } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { DiscountValidateResponse } from "@shared/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface CheckoutDiscountFieldProps {
  value: string;
  onChange: (value: string) => void;
  onApply: () => void;
  loading?: boolean;
  disabled?: boolean;
  preview?: DiscountValidateResponse | null;
  error?: string | null;
}

export default function CheckoutDiscountField({
  value,
  onChange,
  onApply,
  loading,
  disabled,
  preview,
  error,
}: CheckoutDiscountFieldProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-2">
      <Label className="text-gray-300 flex items-center gap-2">
        <Tag className="w-4 h-4 text-cyan" />
        {t("registrationWizard.checkout.discountLabel")}
      </Label>
      <div className="flex gap-2">
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          placeholder={t("registrationWizard.checkout.discountPlaceholder")}
          className="bg-surface-dark border-gray-700 font-mono uppercase flex-1"
          disabled={disabled}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (!loading && !disabled && value.trim()) onApply();
            }
          }}
        />
        <Button
          type="button"
          variant="outline"
          disabled={loading || !value.trim() || disabled}
          className="border-cyan/30 shrink-0"
          onClick={onApply}
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            t("registrationWizard.checkout.discountApply")
          )}
        </Button>
      </div>
      {preview?.valid ? (
        <p className="text-xs text-accent">
          {t("registrationWizard.checkout.discountValid", { code: preview.code })}
        </p>
      ) : null}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

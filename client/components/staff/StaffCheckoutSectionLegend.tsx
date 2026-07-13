import { Info } from "lucide-react";
import { useTranslation } from "react-i18next";

export type StaffCheckoutSectionLegendVariant = "extras" | "fields";

export interface StaffCheckoutSectionLegendProps {
  variant: StaffCheckoutSectionLegendVariant;
}

export default function StaffCheckoutSectionLegend({
  variant,
}: StaffCheckoutSectionLegendProps) {
  const { t } = useTranslation();
  const key =
    variant === "extras"
      ? "staffPortal.eventEdit.extrasSectionLegend"
      : "staffPortal.eventEdit.fieldsSectionLegend";

  return (
    <div
      className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-muted-foreground"
      role="note"
    >
      <p className="flex items-start gap-2.5 leading-relaxed">
        <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" aria-hidden />
        <span>{t(key)}</span>
      </p>
    </div>
  );
}

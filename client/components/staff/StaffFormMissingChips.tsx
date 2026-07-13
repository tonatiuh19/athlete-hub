import { AlertCircle, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import {
  focusStaffFormField,
  type StaffFormMissingItem,
} from "@/utils/staffFormMissing";

export interface StaffFormMissingChipsProps {
  items: StaffFormMissingItem[];
  className?: string;
  /** Hide when form is complete */
  showCompleteState?: boolean;
}

export default function StaffFormMissingChips({
  items,
  className,
  showCompleteState = false,
}: StaffFormMissingChipsProps) {
  const { t } = useTranslation();

  const required = items.filter((i) => i.severity === "required");
  const recommended = items.filter((i) => i.severity === "recommended");

  if (items.length === 0) {
    if (!showCompleteState) return null;
    return (
      <div
        className={cn(
          "flex items-center gap-2 rounded-xl border border-accent/30 bg-accent/5 px-3 py-2 text-xs text-accent",
          className,
        )}
        role="status"
      >
        <Sparkles className="h-3.5 w-3.5 shrink-0" aria-hidden />
        <span>{t("staffPortal.formMissing.complete")}</span>
      </div>
    );
  }

  const renderChip = (item: StaffFormMissingItem) => {
    const isRequired = item.severity === "required";
    const clickable = Boolean(item.focusTarget);
    const chipClass = cn(
      "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-wide transition-colors",
      isRequired
        ? "border border-destructive/35 bg-destructive/10 text-destructive"
        : "border border-primary/25 bg-primary/5 text-muted-foreground",
      clickable && "cursor-pointer hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
    );

    const label = t(item.labelKey);

    if (!clickable) {
      return (
        <span key={item.id} className={chipClass}>
          {isRequired ? (
            <AlertCircle className="h-3 w-3 shrink-0" aria-hidden />
          ) : null}
          {label}
        </span>
      );
    }

    return (
      <button
        key={item.id}
        type="button"
        className={chipClass}
        onClick={() => focusStaffFormField(item.focusTarget)}
      >
        {isRequired ? (
          <AlertCircle className="h-3 w-3 shrink-0" aria-hidden />
        ) : null}
        {label}
      </button>
    );
  };

  return (
    <div
      className={cn(
        "rounded-xl border border-border/70 bg-muted/15 px-3 py-2.5 space-y-2",
        className,
      )}
      role="status"
      aria-live="polite"
    >
      {required.length > 0 ? (
        <div className="space-y-1.5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            {t("staffPortal.formMissing.requiredHeading")}
          </p>
          <div className="flex flex-wrap gap-1.5">{required.map(renderChip)}</div>
        </div>
      ) : null}
      {recommended.length > 0 ? (
        <div className="space-y-1.5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            {t("staffPortal.formMissing.recommendedHeading")}
          </p>
          <div className="flex flex-wrap gap-1.5">{recommended.map(renderChip)}</div>
        </div>
      ) : null}
    </div>
  );
}

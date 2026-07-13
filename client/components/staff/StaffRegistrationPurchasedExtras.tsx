import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { formatPriceMxn } from "@/utils/eventFormat";
import { formatExtraFieldAnswerDisplay } from "@shared/extraFields";
import type { RegistrationPurchasedExtra } from "@shared/api";

interface StaffRegistrationPurchasedExtrasProps {
  extras: RegistrationPurchasedExtra[];
  titleKey?: string;
  className?: string;
}

export default function StaffRegistrationPurchasedExtras({
  extras,
  titleKey = "staffPortal.registrations.purchasedExtras",
  className,
}: StaffRegistrationPurchasedExtrasProps) {
  const { t, i18n } = useTranslation();

  if (!extras.length) return null;

  return (
    <div className={cn("card-sport p-4 space-y-2", className)}>
      <h4 className="font-semibold text-sm">{t(titleKey)}</h4>
      <ul className="space-y-3">
        {extras.map((extra) => (
          <li
            key={`${extra.event_extra_id}-${extra.name}`}
            className="space-y-1"
          >
            <div className="flex items-start justify-between gap-3 text-sm">
              <span>
                {extra.name}
                {extra.quantity > 1 ? (
                  <span className="text-muted-foreground"> × {extra.quantity}</span>
                ) : null}
              </span>
              <span className="text-muted-foreground shrink-0 tabular-nums">
                {formatPriceMxn(extra.total_cents, i18n.language)}
              </span>
            </div>
            {(extra.field_answers?.length ?? 0) > 0 ? (
              <ul className="space-y-0.5 pl-2 border-l border-border/60">
                {extra.field_answers!.map((answer) => (
                  <li key={answer.field_key} className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground/80">{answer.label}: </span>
                    {formatExtraFieldAnswerDisplay(
                      {
                        field_kind: answer.field_kind ?? "standard",
                        field_type: answer.field_type ?? "text",
                      },
                      answer.value_text ?? null,
                      answer.value_json ?? null,
                    )}
                  </li>
                ))}
              </ul>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

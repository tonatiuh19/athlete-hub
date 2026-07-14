import { CheckCircle2, Info, Users } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

function PillList({ items, tone }: { items: string[]; tone: "accent" | "muted" | "primary" }) {
  const toneClass =
    tone === "accent"
      ? "border-accent/30 bg-accent/10 text-foreground"
      : tone === "primary"
        ? "border-primary/30 bg-primary/10 text-foreground"
        : "border-border bg-muted/40 text-muted-foreground";

  return (
    <ul className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <li
          key={item}
          className={cn(
            "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold",
            toneClass,
          )}
        >
          {item}
        </li>
      ))}
    </ul>
  );
}

/** Guide for staff custom registration fields — built-ins + multi-person orders. */
export default function StaffRegistrationFieldsGuide() {
  const { t } = useTranslation();

  const alwaysItems = t("staffPortal.eventEdit.builtinFields.alwaysItems", {
    returnObjects: true,
  }) as string[];
  const groupItems = t("staffPortal.eventEdit.builtinFields.groupItems", {
    returnObjects: true,
  }) as string[];
  const optionalItems = t("staffPortal.eventEdit.builtinFields.optionalItems", {
    returnObjects: true,
  }) as string[];
  const goodExamples = t("staffPortal.eventEdit.builtinFields.goodExamples", {
    returnObjects: true,
  }) as string[];

  return (
    <div className="space-y-3" role="region" aria-label={t("staffPortal.eventEdit.builtinFields.regionLabel")}>
      <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-muted-foreground">
        <p className="flex items-start gap-2.5 leading-relaxed">
          <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" aria-hidden />
          <span>{t("staffPortal.eventEdit.fieldsSectionLegend")}</span>
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card/80 p-4 space-y-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-primary mb-1.5 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" aria-hidden />
            {t("staffPortal.eventEdit.builtinFields.alwaysTitle")}
          </p>
          <p className="text-xs text-muted-foreground mb-2">
            {t("staffPortal.eventEdit.builtinFields.alwaysHint")}
          </p>
          <PillList items={Array.isArray(alwaysItems) ? alwaysItems : []} tone="accent" />
        </div>

        <div className="border-t border-border/70 pt-4">
          <p className="text-[11px] font-bold uppercase tracking-widest text-primary mb-1.5 flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5" aria-hidden />
            {t("staffPortal.eventEdit.builtinFields.groupTitle")}
          </p>
          <p className="text-xs text-muted-foreground mb-2 leading-relaxed">
            {t("staffPortal.eventEdit.builtinFields.groupHint")}
          </p>
          <PillList items={Array.isArray(groupItems) ? groupItems : []} tone="primary" />
        </div>

        <div className="border-t border-border/70 pt-4">
          <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5">
            {t("staffPortal.eventEdit.builtinFields.optionalTitle")}
          </p>
          <p className="text-xs text-muted-foreground mb-2 leading-relaxed">
            {t("staffPortal.eventEdit.builtinFields.optionalHint")}
          </p>
          <PillList items={Array.isArray(optionalItems) ? optionalItems : []} tone="muted" />
        </div>

        <div className="border-t border-border/70 pt-4">
          <p className="text-[11px] font-bold uppercase tracking-widest text-foreground mb-1.5">
            {t("staffPortal.eventEdit.builtinFields.goodTitle")}
          </p>
          <p className="text-xs text-muted-foreground mb-2">
            {t("staffPortal.eventEdit.builtinFields.goodHint")}
          </p>
          <PillList items={Array.isArray(goodExamples) ? goodExamples : []} tone="primary" />
        </div>
      </div>
    </div>
  );
}

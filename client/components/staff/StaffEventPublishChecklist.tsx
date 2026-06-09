import { CheckCircle2, Circle, AlertCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

export interface EventPublishReadiness {
  hasTitle: boolean;
  hasSport: boolean;
  hasStartDate: boolean;
  hasCategory: boolean;
  hasHero: boolean;
  hasLocation: boolean;
  hasWaiver: boolean;
  hasCourse: boolean;
}

export interface StaffEventPublishChecklistProps {
  readiness: EventPublishReadiness;
  className?: string;
  onNavigate?: (tab: string) => void;
}

type CheckItem = {
  key: keyof EventPublishReadiness;
  tab: string;
  required: boolean;
};

const ITEMS: CheckItem[] = [
  { key: "hasTitle", tab: "details", required: true },
  { key: "hasSport", tab: "details", required: true },
  { key: "hasStartDate", tab: "details", required: true },
  { key: "hasCategory", tab: "categories", required: true },
  { key: "hasHero", tab: "details", required: false },
  { key: "hasLocation", tab: "details", required: false },
  { key: "hasWaiver", tab: "waiver", required: false },
  { key: "hasCourse", tab: "course", required: false },
];

export function computeEventPublishReadiness(input: {
  title?: string;
  sportTypeId?: number;
  startDate?: string;
  categoryCount: number;
  heroUrl?: string | null;
  locationLat?: number | string | null;
  locationLng?: number | string | null;
  hasWaiver: boolean;
  hasCourse: boolean;
}): EventPublishReadiness {
  const lat =
    input.locationLat != null && input.locationLat !== ""
      ? Number(input.locationLat)
      : null;
  const lng =
    input.locationLng != null && input.locationLng !== ""
      ? Number(input.locationLng)
      : null;

  return {
    hasTitle: Boolean(input.title?.trim()),
    hasSport: Boolean(input.sportTypeId && input.sportTypeId > 0),
    hasStartDate: Boolean(input.startDate?.trim()),
    hasCategory: input.categoryCount > 0,
    hasHero: Boolean(input.heroUrl?.trim()),
    hasLocation:
      lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng),
    hasWaiver: input.hasWaiver,
    hasCourse: input.hasCourse,
  };
}

export default function StaffEventPublishChecklist({
  readiness,
  className,
  onNavigate,
}: StaffEventPublishChecklistProps) {
  const { t } = useTranslation();

  const requiredDone = ITEMS.filter((i) => i.required).every((i) => readiness[i.key]);
  const recommendedDone = ITEMS.filter((i) => !i.required).filter((i) => readiness[i.key])
    .length;
  const recommendedTotal = ITEMS.filter((i) => !i.required).length;

  return (
    <div className={cn("card-sport p-4 space-y-3", className)}>
      <div>
        <h3 className="text-sm font-semibold">{t("staffPortal.eventEdit.checklistTitle")}</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          {requiredDone
            ? t("staffPortal.eventEdit.checklistRequiredDone", {
                done: recommendedDone,
                total: recommendedTotal,
              })
            : t("staffPortal.eventEdit.checklistRequiredPending")}
        </p>
      </div>

      <ul className="space-y-2">
        {ITEMS.map((item) => {
          const done = readiness[item.key];
          const Icon = done ? CheckCircle2 : item.required ? AlertCircle : Circle;
          return (
            <li key={item.key}>
              <button
                type="button"
                className={cn(
                  "w-full flex items-start gap-2 text-left text-sm rounded-lg px-2 py-1.5 -mx-2 transition-colors",
                  onNavigate && "hover:bg-secondary/60",
                )}
                onClick={() => onNavigate?.(item.tab)}
                disabled={!onNavigate}
              >
                <Icon
                  className={cn(
                    "w-4 h-4 shrink-0 mt-0.5",
                    done
                      ? "text-accent"
                      : item.required
                        ? "text-destructive"
                        : "text-muted-foreground",
                  )}
                />
                <span className="flex-1 min-w-0">
                  <span className={cn(done ? "text-foreground" : "text-muted-foreground")}>
                    {t(`staffPortal.eventEdit.checklist.${item.key}`)}
                  </span>
                  {item.required ? (
                    <span className="ml-1.5 text-[10px] font-bold uppercase tracking-wide text-destructive">
                      {t("staffPortal.eventEdit.checklistRequired")}
                    </span>
                  ) : null}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

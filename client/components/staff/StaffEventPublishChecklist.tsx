import { CheckCircle2, Circle, AlertCircle, Loader2 } from "lucide-react";
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
  /** undefined = not required; null = loading; true/false = payout gate for paid events */
  payoutReady?: boolean | null;
}

export interface StaffEventPublishChecklistProps {
  readiness: EventPublishReadiness;
  className?: string;
  onNavigate?: (tab: string) => void;
  onPayoutSetupClick?: () => void;
}

type CheckItem = {
  key: keyof EventPublishReadiness;
  tab: string;
  required: boolean;
  isPayout?: boolean;
};

const BASE_ITEMS: CheckItem[] = [
  { key: "hasTitle", tab: "details", required: true },
  { key: "hasSport", tab: "details", required: true },
  { key: "hasStartDate", tab: "details", required: true },
  { key: "hasCategory", tab: "categories", required: true },
  { key: "hasHero", tab: "details", required: false },
  { key: "hasLocation", tab: "details", required: false },
  { key: "hasWaiver", tab: "waiver", required: false },
  { key: "hasCourse", tab: "course", required: false },
];

const PAYOUT_ITEM: CheckItem = {
  key: "payoutReady",
  tab: "payouts",
  required: true,
  isPayout: true,
};

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
  hasPaidCategories?: boolean;
  payoutReady?: boolean | null;
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
    payoutReady: input.hasPaidCategories ? input.payoutReady : undefined,
  };
}

function isItemDone(readiness: EventPublishReadiness, item: CheckItem): boolean {
  if (item.key === "payoutReady") {
    return readiness.payoutReady === true;
  }
  return Boolean(readiness[item.key]);
}

function isItemLoading(readiness: EventPublishReadiness, item: CheckItem): boolean {
  return item.key === "payoutReady" && readiness.payoutReady === null;
}

export default function StaffEventPublishChecklist({
  readiness,
  className,
  onNavigate,
  onPayoutSetupClick,
}: StaffEventPublishChecklistProps) {
  const { t } = useTranslation();

  const items =
    readiness.payoutReady !== undefined ? [...BASE_ITEMS, PAYOUT_ITEM] : BASE_ITEMS;

  const requiredDone = items
    .filter((i) => i.required)
    .every((i) => isItemDone(readiness, i) && !isItemLoading(readiness, i));
  const recommendedDone = items.filter((i) => !i.required).filter((i) => isItemDone(readiness, i))
    .length;
  const recommendedTotal = items.filter((i) => !i.required).length;

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
        {items.map((item) => {
          const loading = isItemLoading(readiness, item);
          const done = isItemDone(readiness, item);
          const Icon = loading
            ? Loader2
            : done
              ? CheckCircle2
              : item.required
                ? AlertCircle
                : Circle;
          const clickable = item.isPayout ? Boolean(onPayoutSetupClick) : Boolean(onNavigate);

          return (
            <li key={item.key}>
              <button
                type="button"
                className={cn(
                  "w-full flex items-start gap-2 text-left text-sm rounded-lg px-2 py-1.5 -mx-2 transition-colors",
                  clickable && "hover:bg-secondary/60",
                )}
                onClick={() => {
                  if (item.isPayout) {
                    onPayoutSetupClick?.();
                  } else {
                    onNavigate?.(item.tab);
                  }
                }}
                disabled={!clickable}
              >
                <Icon
                  className={cn(
                    "w-4 h-4 shrink-0 mt-0.5",
                    loading && "animate-spin text-muted-foreground",
                    !loading && done && "text-accent",
                    !loading && !done && item.required && "text-destructive",
                    !loading && !done && !item.required && "text-muted-foreground",
                  )}
                />
                <span className="flex-1 min-w-0">
                  <span className={cn(done ? "text-foreground" : "text-muted-foreground")}>
                    {loading
                      ? t("staffPortal.eventEdit.checklist.payoutReadyLoading")
                      : t(`staffPortal.eventEdit.checklist.${item.key}`)}
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

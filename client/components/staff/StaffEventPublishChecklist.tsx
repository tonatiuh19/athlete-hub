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
  /** When true, show payout step even before paid categories exist (hint). */
  showPayoutStep?: boolean;
}

export type SetupStepLevel = "required" | "recommended" | "optional";

/** Recommended fill order for organizers (tab → step number). */
export const EVENT_SETUP_TAB_STEPS: Record<string, number> = {
  details: 1,
  categories: 2,
  discounts: 4,
  folios: 5,
  waiver: 6,
  course: 7,
  media: 8,
  fields: 9,
  waves: 10,
  waitlist: 11,
  extras: 12,
  sponsors: 13,
};

type SetupGuideStep = {
  step: number;
  /** i18n key under staffPortal.eventEdit.setupGuide.steps.* */
  key: string;
  tab?: string;
  level: SetupStepLevel;
  isPayout?: boolean;
  /** When set, step is done if every readiness key is true */
  readinessKeys?: (keyof EventPublishReadiness)[];
  /** Hide unless payout gate applies */
  payoutOnly?: boolean;
};

const SETUP_GUIDE_STEPS: SetupGuideStep[] = [
  {
    step: 1,
    key: "details",
    tab: "details",
    level: "required",
    readinessKeys: ["hasTitle", "hasSport", "hasStartDate"],
  },
  {
    step: 2,
    key: "categories",
    tab: "categories",
    level: "required",
    readinessKeys: ["hasCategory"],
  },
  {
    step: 3,
    key: "payouts",
    level: "required",
    isPayout: true,
    payoutOnly: true,
    readinessKeys: ["payoutReady"],
  },
  {
    step: 4,
    key: "discounts",
    tab: "discounts",
    level: "optional",
  },
  {
    step: 5,
    key: "folios",
    tab: "folios",
    level: "recommended",
  },
  {
    step: 6,
    key: "waiver",
    tab: "waiver",
    level: "recommended",
    readinessKeys: ["hasWaiver"],
  },
  {
    step: 7,
    key: "course",
    tab: "course",
    level: "recommended",
    readinessKeys: ["hasCourse"],
  },
  {
    step: 8,
    key: "mediaLocation",
    tab: "media",
    level: "recommended",
    readinessKeys: ["hasHero", "hasLocation"],
  },
  {
    step: 9,
    key: "polish",
    tab: "fields",
    level: "optional",
  },
  {
    step: 10,
    key: "submit",
    tab: "details",
    level: "required",
  },
];

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

function isGuideStepDone(
  readiness: EventPublishReadiness,
  step: SetupGuideStep,
): boolean | null {
  if (!step.readinessKeys?.length) return null;
  if (step.readinessKeys.includes("payoutReady") && readiness.payoutReady === null) {
    return null;
  }
  return step.readinessKeys.every((key) => {
    if (key === "payoutReady") return readiness.payoutReady === true;
    return Boolean(readiness[key]);
  });
}

function LevelDot({ level }: { level: SetupStepLevel }) {
  return (
    <span
      className={cn(
        "inline-block h-2 w-2 rounded-full shrink-0",
        level === "required" && "bg-destructive",
        level === "recommended" && "bg-primary",
        level === "optional" && "bg-muted-foreground/50",
      )}
      aria-hidden
    />
  );
}

export function EventSetupStepBadge({
  step,
  className,
}: {
  step: number;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded-md",
        "bg-primary/15 text-primary text-[10px] font-bold tabular-nums mr-2 shrink-0",
        className,
      )}
      aria-hidden
    >
      {step}
    </span>
  );
}

export default function StaffEventPublishChecklist({
  readiness,
  className,
  onNavigate,
  onPayoutSetupClick,
  showPayoutStep,
}: StaffEventPublishChecklistProps) {
  const { t } = useTranslation();

  const includePayout =
    showPayoutStep || readiness.payoutReady !== undefined;

  const guideSteps = SETUP_GUIDE_STEPS.filter(
    (s) => !s.payoutOnly || includePayout,
  );

  const items =
    readiness.payoutReady !== undefined ? [...BASE_ITEMS, PAYOUT_ITEM] : BASE_ITEMS;

  const requiredDone = items
    .filter((i) => i.required)
    .every((i) => isItemDone(readiness, i) && !isItemLoading(readiness, i));
  const recommendedDone = items
    .filter((i) => !i.required)
    .filter((i) => isItemDone(readiness, i)).length;
  const recommendedTotal = items.filter((i) => !i.required).length;

  return (
    <div className={cn("card-sport p-4 space-y-4", className)}>
      <div>
        <h3 className="text-sm font-semibold">
          {t("staffPortal.eventEdit.setupGuide.title")}
        </h3>
        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
          {t("staffPortal.eventEdit.setupGuide.subtitle")}
        </p>
      </div>

      <div
        className="flex flex-wrap gap-x-3 gap-y-1.5 text-[11px] text-muted-foreground"
        role="legend"
        aria-label={t("staffPortal.eventEdit.setupGuide.legendAria")}
      >
        <span className="inline-flex items-center gap-1.5">
          <LevelDot level="required" />
          {t("staffPortal.eventEdit.setupGuide.legendRequired")}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <LevelDot level="recommended" />
          {t("staffPortal.eventEdit.setupGuide.legendRecommended")}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <LevelDot level="optional" />
          {t("staffPortal.eventEdit.setupGuide.legendOptional")}
        </span>
      </div>

      <ol className="space-y-1">
        {guideSteps.map((step) => {
          const doneState = isGuideStepDone(readiness, step);
          const loading = doneState === null && step.readinessKeys?.includes("payoutReady");
          const clickable = step.isPayout
            ? Boolean(onPayoutSetupClick)
            : Boolean(onNavigate && step.tab);

          return (
            <li key={step.key}>
              <button
                type="button"
                className={cn(
                  "w-full flex items-start gap-2 text-left rounded-lg px-2 py-1.5 -mx-2 transition-colors",
                  clickable && "hover:bg-secondary/60",
                )}
                onClick={() => {
                  if (step.isPayout) {
                    onPayoutSetupClick?.();
                  } else if (step.tab) {
                    onNavigate?.(step.tab);
                  }
                }}
                disabled={!clickable}
              >
                <EventSetupStepBadge step={step.step} className="mt-0.5" />
                <span className="flex-1 min-w-0 pt-0.5">
                  <span className="flex items-center gap-1.5 flex-wrap">
                    <LevelDot level={step.level} />
                    <span
                      className={cn(
                        "text-sm font-medium",
                        doneState === true
                          ? "text-foreground"
                          : "text-muted-foreground",
                      )}
                    >
                      {t(`staffPortal.eventEdit.setupGuide.steps.${step.key}`)}
                    </span>
                    {loading ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
                    ) : doneState === true ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-accent shrink-0" />
                    ) : null}
                  </span>
                  <span className="block text-[11px] text-muted-foreground leading-snug mt-0.5">
                    {t(`staffPortal.eventEdit.setupGuide.hints.${step.key}`)}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      <div className="border-t border-border/60 pt-3 space-y-2">
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t("staffPortal.eventEdit.checklistTitle")}
          </h4>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {requiredDone
              ? t("staffPortal.eventEdit.checklistRequiredDone", {
                  done: recommendedDone,
                  total: recommendedTotal,
                })
              : t("staffPortal.eventEdit.checklistRequiredPending")}
          </p>
        </div>

        <ul className="space-y-1">
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
            const clickable = item.isPayout
              ? Boolean(onPayoutSetupClick)
              : Boolean(onNavigate);

            return (
              <li key={item.key}>
                <button
                  type="button"
                  className={cn(
                    "w-full flex items-start gap-2 text-left text-xs rounded-lg px-2 py-1 -mx-2 transition-colors",
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
                      "w-3.5 h-3.5 shrink-0 mt-0.5",
                      loading && "animate-spin text-muted-foreground",
                      !loading && done && "text-accent",
                      !loading && !done && item.required && "text-destructive",
                      !loading && !done && !item.required && "text-muted-foreground",
                    )}
                  />
                  <span className="flex-1 min-w-0">
                    <span
                      className={cn(done ? "text-foreground" : "text-muted-foreground")}
                    >
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
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Eye, Loader2, MapPin, Route, Save } from "lucide-react";
import { useTranslation } from "react-i18next";
import StaffCourseMapEditor from "@/components/staff/StaffCourseMapEditor";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { parseLineString } from "@/utils/courseMapUtils";
import type { StaffEventCoursePayload } from "@shared/api";
import { cn } from "@/lib/utils";

type WizardStep = "route" | "checkpoints" | "review";

const STEPS: WizardStep[] = ["route", "checkpoints", "review"];

interface StaffCourseWizardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: StaffEventCoursePayload | null;
  onSave: (course: StaffEventCoursePayload) => void;
  saving?: boolean;
  eventLat?: number | string | null;
  eventLng?: number | string | null;
  onEventLocationChange?: (lat: number, lng: number) => void;
}

export default function StaffCourseWizardDialog({
  open,
  onOpenChange,
  value,
  onSave,
  saving = false,
  eventLat,
  eventLng,
  onEventLocationChange,
}: StaffCourseWizardDialogProps) {
  const { t } = useTranslation();
  const [step, setStep] = useState<WizardStep>("route");
  const [draft, setDraft] = useState<StaffEventCoursePayload | null>(value);

  useEffect(() => {
    if (open) {
      setStep("route");
      setDraft(value);
    }
  }, [open, value]);

  const stepIndex = STEPS.indexOf(step);
  const routePoints = useMemo(
    () => (draft ? parseLineString(draft.routeGeojson).length : 0),
    [draft],
  );
  const canNextRoute = routePoints >= 2;

  const handleSave = () => {
    if (!draft) return;
    onSave(draft);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "leaflet-safe-dialog flex flex-col gap-0 p-0 overflow-hidden border-border/80",
          "fixed z-50",
          "!left-0 !right-0 !mx-auto",
          "!top-[4dvh] !translate-x-0 !translate-y-0",
          "!max-w-[min(96vw,1180px)] !w-[min(96vw,1180px)] max-sm:!w-[calc(100vw-1rem)]",
          "h-[min(92dvh,880px)] max-h-[92dvh]",
          "sm:rounded-2xl shadow-2xl shadow-cyan/5",
          "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:duration-200",
          "!animate-none data-[state=closed]:!animate-none",
        )}
      >
        <DialogHeader className="px-5 py-4 border-b border-border/80 shrink-0 space-y-3">
          <div>
            <DialogTitle className="text-left text-xl">{t("staffPortal.courseEditor.wizardTitle")}</DialogTitle>
            <DialogDescription className="text-left">
              {t("staffPortal.courseEditor.wizardSubtitle")}
            </DialogDescription>
          </div>

          <ol className="flex items-center gap-2 sm:gap-3">
            {STEPS.map((s, i) => {
              const done = i < stepIndex;
              const active = s === step;
              const Icon = s === "route" ? Route : s === "checkpoints" ? MapPin : Eye;
              return (
                <li key={s} className="flex items-center gap-2 min-w-0 flex-1">
                  <div
                    className={cn(
                      "flex items-center justify-center w-8 h-8 rounded-full border shrink-0 transition-colors",
                      done && "bg-cyan/20 border-cyan/50 text-cyan",
                      active && "bg-cyan text-primary-foreground border-cyan shadow-lg shadow-cyan/25",
                      !done && !active && "border-border text-muted-foreground",
                    )}
                  >
                    {done ? <Check className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                  </div>
                  <div className="min-w-0 hidden sm:block">
                    <p className={cn("text-xs font-semibold truncate", active ? "text-cyan" : "text-muted-foreground")}>
                      {t(`staffPortal.courseEditor.wizardStep_${s}`)}
                    </p>
                  </div>
                  {i < STEPS.length - 1 ? (
                    <div className={cn("h-px flex-1 min-w-2", done ? "bg-cyan/40" : "bg-border")} />
                  ) : null}
                </li>
              );
            })}
          </ol>
          <p className="text-xs text-muted-foreground">{t(`staffPortal.courseEditor.wizardDesc_${step}`)}</p>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4">
          <StaffCourseMapEditor
            value={draft}
            onChange={setDraft}
            eventLat={eventLat}
            eventLng={eventLng}
            onEventLocationChange={onEventLocationChange}
            active={open}
            focus={step}
            mapClassName="h-[min(58dvh,640px)] min-h-[320px]"
          />
        </div>

        <div className="shrink-0 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-3 px-5 py-4 border-t border-border/80 bg-card/40">
          <Button
            type="button"
            variant="ghost"
            onClick={() => (stepIndex > 0 ? setStep(STEPS[stepIndex - 1]) : onOpenChange(false))}
            disabled={saving}
          >
            {stepIndex > 0 ? (
              <>
                <ChevronLeft className="w-4 h-4 mr-1" />
                {t("staffPortal.courseEditor.wizardBack")}
              </>
            ) : (
              t("common.cancel")
            )}
          </Button>

          <div className="flex gap-2 justify-end">
            {step !== "review" ? (
              <Button
                type="button"
                onClick={() => setStep(STEPS[stepIndex + 1])}
                disabled={step === "route" && !canNextRoute}
              >
                {t("staffPortal.courseEditor.wizardNext")}
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            ) : (
              <Button type="button" onClick={handleSave} disabled={saving || !draft || !canNextRoute}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                {t("staffPortal.eventEdit.saveCourse")}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

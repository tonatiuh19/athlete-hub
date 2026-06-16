import { Download, Lock, MapPin, Watch } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { EventCourse } from "@shared/api";
import { Button } from "@/components/ui/button";
import { downloadCourseGpx } from "@/utils/gpxExport";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

interface CourseRouteDownloadPanelProps {
  eventTitle: string;
  eventSlug: string;
  course: EventCourse;
  isRegistered: boolean;
  onRegisterClick?: () => void;
  className?: string;
}

export default function CourseRouteDownloadPanel({
  eventTitle,
  eventSlug,
  course,
  isRegistered,
  onRegisterClick,
  className,
}: CourseRouteDownloadPanelProps) {
  const { t } = useTranslation();

  const handleDownload = () => {
    const ok = downloadCourseGpx({ eventTitle, eventSlug, course });
    if (!ok) {
      toast({
        variant: "destructive",
        title: t("eventDetail.courseGpxDownloadError"),
      });
      return;
    }
    toast({ title: t("eventDetail.courseGpxDownloadSuccess") });
  };

  return (
    <div
      className={cn(
        "rounded-xl border border-border/70 bg-card/60 p-4 md:p-5 space-y-4",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/15 border border-primary/25">
          <Watch className="h-5 w-5 text-primary" aria-hidden />
        </div>
        <div className="min-w-0 space-y-1.5">
          <h3 className="text-sm font-bold text-foreground">
            {t("eventDetail.courseGpxTitle")}
          </h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {t("eventDetail.courseGpxLegend")}
          </p>
          <p className="text-xs text-muted-foreground/90 leading-relaxed">
            {t("eventDetail.courseGpxDevices")}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-background/60 px-2.5 py-1">
          <MapPin className="h-3 w-3 text-primary" />
          GPX
        </span>
        <span className="rounded-full border border-border/70 bg-background/60 px-2.5 py-1">
          Garmin
        </span>
        <span className="rounded-full border border-border/70 bg-background/60 px-2.5 py-1">
          Wahoo
        </span>
        <span className="rounded-full border border-border/70 bg-background/60 px-2.5 py-1">
          Coros
        </span>
        <span className="rounded-full border border-border/70 bg-background/60 px-2.5 py-1">
          Suunto
        </span>
      </div>

      {isRegistered ? (
        <Button
          type="button"
          className="w-full sm:w-auto rounded-xl bg-triboo-gradient text-primary-foreground font-semibold shadow-glow-triboo hover:brightness-110"
          onClick={handleDownload}
        >
          <Download className="h-4 w-4 mr-2" />
          {t("eventDetail.courseGpxDownload")}
        </Button>
      ) : (
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl border border-dashed border-border/80 bg-muted/20 px-4 py-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground min-w-0">
            <Lock className="h-4 w-4 shrink-0 text-primary" />
            <span>{t("eventDetail.courseGpxRegisterHint")}</span>
          </div>
          {onRegisterClick ? (
            <Button
              type="button"
              variant="outline"
              className="shrink-0 rounded-xl border-primary/40 text-primary hover:bg-primary/10"
              onClick={onRegisterClick}
            >
              {t("eventDetail.courseGpxRegisterCta")}
            </Button>
          ) : null}
        </div>
      )}
    </div>
  );
}

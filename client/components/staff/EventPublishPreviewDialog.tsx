import { format } from "date-fns";
import { useTranslation } from "react-i18next";
import { Calendar, MapPin, Rocket, ShieldCheck, Users } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { getDateFnsLocale } from "@/utils/dateLocale";
import { getNumberLocale } from "@/utils/dateLocale";
import type { StaffEventCategory, StaffEventDetail } from "@shared/api";
import type { EventSponsorInput } from "@shared/api";

export interface EventPublishPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: StaffEventDetail | null | undefined;
  categories: StaffEventCategory[];
  sponsors: EventSponsorInput[];
  courseDistanceKm?: number | null;
  waiverCount?: number;
  requiresWaiver?: boolean;
  confirming: boolean;
  onConfirm: () => void;
}

export default function EventPublishPreviewDialog({
  open,
  onOpenChange,
  event,
  categories,
  sponsors,
  courseDistanceKm,
  waiverCount = 0,
  requiresWaiver = false,
  confirming,
  onConfirm,
}: EventPublishPreviewDialogProps) {
  const { t, i18n } = useTranslation();
  const dateLocale = getDateFnsLocale(i18n.language);
  const numLocale = getNumberLocale(i18n.language);

  if (!event) return null;

  const hero = event.hero_image_url;
  const startLabel = event.start_date
    ? format(new Date(event.start_date), "PPp", { locale: dateLocale })
    : "—";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("staffPortal.eventEdit.preview.title")}</DialogTitle>
          <DialogDescription>{t("staffPortal.eventEdit.preview.description")}</DialogDescription>
        </DialogHeader>

        <article className="space-y-4 rounded-xl border border-border overflow-hidden">
          {hero ? (
            <img src={hero} alt="" className="w-full h-40 object-cover bg-secondary" />
          ) : (
            <div className="h-28 bg-secondary flex items-center justify-center text-sm text-muted-foreground">
              {t("staffPortal.eventEdit.preview.noHero")}
            </div>
          )}

          <div className="px-4 pb-4 space-y-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-primary">
                {event.sport_name}
              </p>
              <h2 className="text-xl font-bold text-foreground mt-1">{event.title}</h2>
              {event.short_description ? (
                <p className="text-sm text-muted-foreground mt-2">{event.short_description}</p>
              ) : null}
            </div>

            <div className="grid gap-2 text-sm text-muted-foreground">
              <p className="inline-flex items-center gap-2">
                <Calendar className="w-4 h-4 text-primary shrink-0" />
                {startLabel}
              </p>
              {event.location_city || event.location_name ? (
                <p className="inline-flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-primary shrink-0" />
                  {[event.location_name, event.location_city].filter(Boolean).join(" · ")}
                </p>
              ) : null}
              <p className="inline-flex items-center gap-2">
                <Users className="w-4 h-4 text-primary shrink-0" />
                {t("staffPortal.eventEdit.preview.categoryCount", { count: categories.length })}
              </p>
            </div>

            {categories.length > 0 ? (
              <div className="space-y-2 pt-2 border-t border-border">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t("staffPortal.eventEdit.preview.categories")}
                </p>
                <ul className="space-y-1.5">
                  {categories.slice(0, 6).map((c) => (
                    <li
                      key={c.id}
                      className="flex justify-between gap-2 text-sm rounded-lg bg-secondary/50 px-3 py-2"
                    >
                      <span className="font-medium truncate">{c.name}</span>
                      <span className="text-muted-foreground shrink-0">
                        ${(c.price_cents / 100).toLocaleString(numLocale)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {sponsors.filter((s) => s.name.trim()).length > 0 ? (
              <p className="text-xs text-muted-foreground">
                {t("staffPortal.eventEdit.preview.sponsorCount", {
                  count: sponsors.filter((s) => s.name.trim()).length,
                })}
              </p>
            ) : null}

            {courseDistanceKm ? (
              <p className="text-xs text-muted-foreground">
                {t("staffPortal.eventEdit.preview.courseDistance", {
                  km: courseDistanceKm,
                })}
              </p>
            ) : null}

            <p className="text-xs text-muted-foreground inline-flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-primary shrink-0" />
              {requiresWaiver
                ? t("staffPortal.eventEdit.preview.waiverRequired", { count: waiverCount })
                : t("staffPortal.eventEdit.preview.waiverOptional")}
            </p>
          </div>
        </article>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t("staffPortal.eventEdit.preview.close")}
          </Button>
          <Button type="button" className="btn-primary" disabled={confirming} onClick={onConfirm}>
            <Rocket className="w-4 h-4 mr-2" />
            {confirming
              ? t("staffPortal.eventEdit.preview.publishing")
              : t("staffPortal.eventEdit.preview.confirmPublish")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

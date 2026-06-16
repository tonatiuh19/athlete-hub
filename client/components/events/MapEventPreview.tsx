import { Link } from "react-router-dom";
import { ArrowRight, Calendar, MapPin } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { EventListItem } from "@shared/api";
import { formatEventDate } from "@/utils/eventFormat";
import { getNumberLocale } from "@/utils/dateLocale";
import EventCardImage from "@/components/events/EventCardImage";
import { cn } from "@/lib/utils";

interface MapEventPreviewProps {
  event: EventListItem;
  /** overlay = on top of map; inline = stacked below map (better for mobile home scroll). */
  variant?: "overlay" | "inline";
}

export default function MapEventPreview({
  event,
  variant = "overlay",
}: MapEventPreviewProps) {
  const { t, i18n } = useTranslation();
  const numLocale = getNumberLocale(i18n.language);
  const isInline = variant === "inline";

  return (
    <Link
      to={`/events/${event.slug}`}
      className={cn(
        "group flex items-center gap-2.5 sm:gap-3 p-2.5 sm:p-3 rounded-xl bg-card/95 backdrop-blur-md border border-border/70 hover:border-primary/45 shadow-sm transition-all duration-300 min-w-0",
        isInline
          ? "w-full"
          : "absolute bottom-3 left-3 right-3 sm:bottom-4 sm:left-4 sm:right-4 z-20 max-w-[calc(100%-1.5rem)] sm:max-w-none shadow-[0_8px_32px_rgba(0,0,0,0.45)] hover:shadow-glow-triboo",
      )}
    >
      <EventCardImage
        src={event.hero_image_url}
        sportSlug={event.sport_slug}
        sportName={event.sport_name}
        className="w-12 h-12 sm:w-16 sm:h-16 shrink-0 rounded-lg"
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-foreground line-clamp-2 leading-normal group-hover:text-primary transition-colors">
          {event.title}
        </p>
        <p className="flex items-center gap-1 text-[11px] text-muted-foreground mt-0.5 truncate">
          <MapPin className="w-3 h-3 text-primary shrink-0" />
          {[event.location_city, event.location_state].filter(Boolean).join(", ")}
        </p>
        <p className="flex items-center gap-1 text-[11px] text-muted-foreground mt-0.5">
          <Calendar className="w-3 h-3 shrink-0" />
          {formatEventDate(event.start_date, i18n.language)}
        </p>
        {event.from_price_cents != null && (
          <p className="sm:hidden text-sm font-bold text-primary tabular-nums mt-1">
            {t("eventsBrowse.fromPrice", {
              price: (event.from_price_cents / 100).toLocaleString(numLocale),
            })}
          </p>
        )}
      </div>
      <div className="hidden sm:block shrink-0 text-right pl-2">
        {event.from_price_cents != null && (
          <p className="text-sm font-bold text-primary tabular-nums">
            {t("eventsBrowse.fromPrice", {
              price: (event.from_price_cents / 100).toLocaleString(numLocale),
            })}
          </p>
        )}
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-muted-foreground group-hover:text-primary mt-1 transition-colors">
          {t("eventsBrowse.viewDetails")}
          <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
        </span>
      </div>
      {isInline ? (
        <ArrowRight className="w-4 h-4 shrink-0 text-muted-foreground group-hover:text-primary transition-colors" />
      ) : null}
    </Link>
  );
}

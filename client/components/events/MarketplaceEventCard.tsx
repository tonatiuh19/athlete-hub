import { Link } from "react-router-dom";
import { Calendar, MapPin, Users, Star, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { EventListItem } from "@shared/api";
import { cn } from "@/lib/utils";
import { getNumberLocale } from "@/utils/dateLocale";
import { formatEventDate } from "@/utils/eventFormat";
import EventCardImage from "@/components/events/EventCardImage";

interface MarketplaceEventCardProps {
  event: EventListItem;
  selected?: boolean;
  onSelect?: () => void;
  compact?: boolean;
}

export default function MarketplaceEventCard({
  event,
  selected,
  onSelect,
  compact,
}: MarketplaceEventCardProps) {
  const { t, i18n } = useTranslation();
  const numLocale = getNumberLocale(i18n.language);

  const className = cn(
    "group relative overflow-hidden rounded-xl border transition-all duration-300 text-left w-full",
    compact ? "flex flex-row items-stretch min-h-[108px]" : "flex flex-col h-full",
    selected
      ? "border-cyan/60 shadow-[0_0_24px_rgba(0,229,255,0.18)] bg-surface-dark/95 ring-1 ring-cyan/20"
      : "border-gray-700/50 bg-surface-dark/70 hover:border-cyan/35 hover:shadow-[0_0_20px_rgba(0,229,255,0.1)]",
  );

  const imageBlock = (
    <EventCardImage
      src={event.hero_image_url}
      sportSlug={event.sport_slug}
      sportName={event.sport_name}
      className={cn(
        "relative shrink-0 overflow-hidden",
        compact ? "w-[108px] sm:w-[120px] self-stretch min-h-[108px]" : "aspect-[16/10] w-full",
      )}
      imgClassName="group-hover:scale-105 transition-transform duration-500"
    />
  );

  const badges = (
    <>
      {event.featured ? (
        <span className="absolute top-2 left-2 z-10 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-cyan text-navy-deep text-[9px] font-bold uppercase shadow-sm">
          <Star className="w-2.5 h-2.5" />
          {t("eventsBrowse.featured")}
        </span>
      ) : null}
      <span className="absolute top-2 right-2 z-10 px-2 py-0.5 rounded-md bg-bg-dark/75 backdrop-blur text-[9px] font-medium text-cyan border border-cyan/25 max-w-[55%] truncate">
        {event.sport_name}
      </span>
    </>
  );

  const body = (
    <div className={cn("flex flex-col flex-1 min-w-0", compact ? "p-3 gap-1.5 justify-center" : "p-4 gap-2.5")}>
      <h3
        className={cn(
          "font-bold text-white group-hover:text-cyan transition-colors",
          compact ? "text-sm line-clamp-2 leading-snug" : "text-base line-clamp-2",
        )}
      >
        {event.title}
      </h3>

      {!compact && event.short_description && (
        <p className="text-xs text-gray-400 line-clamp-2">{event.short_description}</p>
      )}

      <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
        <MapPin className="w-3 h-3 text-cyan shrink-0" />
        <span className="truncate">
          {[event.location_city, event.location_state].filter(Boolean).join(", ")}
        </span>
      </div>

      <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
        <Calendar className="w-3 h-3 text-cyan shrink-0" />
        {formatEventDate(event.start_date, i18n.language)}
      </div>

      <div className="flex items-center justify-between pt-1.5 mt-auto border-t border-gray-700/40">
        <span className="flex items-center gap-1 text-[11px] text-gray-500">
          <Users className="w-3 h-3" />
          {event.registration_count.toLocaleString(numLocale)}
        </span>
        {event.from_price_cents != null && (
          <span className="text-xs font-bold text-cyan tabular-nums">
            {t("eventsBrowse.fromPrice", {
              price: (event.from_price_cents / 100).toLocaleString(numLocale),
            })}
          </span>
        )}
      </div>
    </div>
  );

  const content = compact ? (
    <>
      <div className="relative shrink-0">
        {imageBlock}
        {badges}
      </div>
      {body}
      {selected && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-cyan">
          <ChevronRight className="w-4 h-4" />
        </div>
      )}
    </>
  ) : (
    <>
      <div className="relative">
        {imageBlock}
        {badges}
      </div>
      {body}
    </>
  );

  if (onSelect) {
    return (
      <button type="button" onClick={onSelect} className={className}>
        {content}
      </button>
    );
  }

  return (
    <Link to={`/events/${event.slug}`} className={className}>
      {content}
    </Link>
  );
}

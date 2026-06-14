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
    "group relative rounded-xl border transition-all duration-300 text-left w-full",
    compact ? "flex flex-row items-stretch min-h-[120px]" : "flex flex-col h-full overflow-hidden",
    selected
      ? "border-cyan/60 shadow-[0_0_24px_rgba(0,229,255,0.18)] bg-surface-dark/95 ring-1 ring-cyan/20"
      : "border-gray-700/50 bg-surface-dark/70 hover:border-cyan/35 hover:shadow-[0_0_20px_rgba(0,229,255,0.1)]",
  );

  const imageBlock = (
    <EventCardImage
      src={event.hero_image_url}
      sportSlug={event.sport_slug}
      sportName={event.sport_name}
      displaySize={compact ? "thumb" : "card"}
      className={cn(
        "relative shrink-0 overflow-hidden",
        compact ? "w-[108px] sm:w-[120px] self-stretch min-h-[120px] rounded-l-xl overflow-hidden" : "aspect-[16/10] w-full",
      )}
      imgClassName="group-hover:scale-105 transition-transform duration-500"
    />
  );

  const sportBadge = (
    <span
      className={cn(
        "inline-flex max-w-full truncate rounded-md bg-bg-dark/80 backdrop-blur-sm font-medium text-cyan border border-cyan/25 shadow-sm",
        compact ? "px-1.5 py-0.5 text-[8px]" : "px-2 py-0.5 text-[9px]",
      )}
    >
      {event.sport_name}
    </span>
  );

  const featuredBadge = event.featured ? (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full bg-cyan text-navy-deep font-bold uppercase shadow-[0_2px_8px_rgba(0,229,255,0.35)]",
        compact ? "gap-0.5 px-1.5 py-0.5 text-[8px]" : "gap-1 px-2 py-0.5 text-[9px]",
      )}
    >
      <Star className={cn(compact ? "w-2 h-2" : "w-2.5 h-2.5")} />
      {t("eventsBrowse.featured")}
    </span>
  ) : null;

  const badges = compact ? (
    <div className="absolute top-1.5 left-1.5 z-10 flex max-w-[calc(100%-0.75rem)] flex-col items-start gap-1">
      {featuredBadge}
      {sportBadge}
    </div>
  ) : (
    <>
      {featuredBadge ? (
        <span className="absolute top-2 left-2 z-10">{featuredBadge}</span>
      ) : null}
      <span className="absolute top-2 right-2 z-10 max-w-[50%]">{sportBadge}</span>
    </>
  );

  const body = (
    <div className={cn("flex flex-col flex-1 min-w-0", compact ? "p-3 gap-1.5 justify-start" : "p-4 gap-2.5")}>
      <h3
        className={cn(
          "font-bold text-white group-hover:text-cyan transition-colors line-clamp-2 leading-normal",
          compact ? "text-sm" : "text-base",
        )}
      >
        {event.title}
      </h3>

      {!compact && event.short_description && (
        <p className="hidden sm:block text-xs text-gray-400 line-clamp-2">{event.short_description}</p>
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

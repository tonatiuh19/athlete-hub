import { Link } from "react-router-dom";
import { ArrowRight, Calendar, MapPin } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { EventListItem } from "@shared/api";
import { formatEventDate } from "@/utils/eventFormat";
import { getNumberLocale } from "@/utils/dateLocale";
import EventCardImage from "@/components/events/EventCardImage";

interface MapEventPreviewProps {
  event: EventListItem;
}

export default function MapEventPreview({ event }: MapEventPreviewProps) {
  const { t, i18n } = useTranslation();
  const numLocale = getNumberLocale(i18n.language);

  return (
    <Link
      to={`/events/${event.slug}`}
      className="absolute bottom-3 left-3 right-3 sm:bottom-4 sm:left-4 sm:right-4 z-[500] group flex items-center gap-2.5 sm:gap-3 p-2.5 sm:p-3 rounded-xl bg-bg-dark/92 backdrop-blur-md border border-gray-700/60 hover:border-cyan/50 shadow-[0_8px_32px_rgba(0,0,0,0.45)] transition-all duration-300 hover:shadow-glow-cyan min-w-0 max-w-[calc(100%-1.5rem)] sm:max-w-none"
    >
      <EventCardImage
        src={event.hero_image_url}
        sportSlug={event.sport_slug}
        sportName={event.sport_name}
        className="w-12 h-12 sm:w-16 sm:h-16 shrink-0 rounded-lg"
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-white truncate group-hover:text-cyan transition-colors">
          {event.title}
        </p>
        <p className="flex items-center gap-1 text-[11px] text-gray-400 mt-0.5 truncate">
          <MapPin className="w-3 h-3 text-cyan shrink-0" />
          {[event.location_city, event.location_state].filter(Boolean).join(", ")}
        </p>
        <p className="flex items-center gap-1 text-[11px] text-gray-500 mt-0.5">
          <Calendar className="w-3 h-3 shrink-0" />
          {formatEventDate(event.start_date, i18n.language)}
        </p>
        {event.from_price_cents != null && (
          <p className="sm:hidden text-sm font-bold text-cyan tabular-nums mt-1">
            {t("eventsBrowse.fromPrice", {
              price: (event.from_price_cents / 100).toLocaleString(numLocale),
            })}
          </p>
        )}
      </div>
      <div className="hidden sm:block shrink-0 text-right pl-2">
        {event.from_price_cents != null && (
          <p className="text-sm font-bold text-cyan tabular-nums">
            {t("eventsBrowse.fromPrice", {
              price: (event.from_price_cents / 100).toLocaleString(numLocale),
            })}
          </p>
        )}
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-gray-400 group-hover:text-cyan mt-1 transition-colors">
          {t("eventsBrowse.viewDetails")}
          <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
        </span>
      </div>
    </Link>
  );
}

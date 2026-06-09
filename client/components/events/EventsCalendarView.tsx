import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import {
  ArrowRight,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Star,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import type { EventListItem } from "@shared/api";
import EventCardImage from "@/components/events/EventCardImage";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getDateFnsLocale, getNumberLocale } from "@/utils/dateLocale";
import { formatEventDate } from "@/utils/eventFormat";

const SPORT_CHIP: Record<string, string> = {
  running: "bg-primary/20 text-primary border-primary/30",
  trail: "bg-accent/20 text-accent border-accent/30",
  triathlon: "bg-cyan/20 text-cyan border-cyan/30",
  cycling: "bg-secondary text-foreground border-border",
};

function dateKey(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

function eventDateKey(startDate: string): string {
  return startDate.slice(0, 10);
}

interface EventsCalendarViewProps {
  events: EventListItem[];
}

export default function EventsCalendarView({ events }: EventsCalendarViewProps) {
  const { t, i18n } = useTranslation();
  const dateLocale = getDateFnsLocale(i18n.language);
  const numLocale = getNumberLocale(i18n.language);
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [selected, setSelected] = useState(() => new Date());

  const eventsByDate = useMemo(() => {
    const map = new Map<string, EventListItem[]>();
    for (const ev of events) {
      const key = eventDateKey(ev.start_date);
      const bucket = map.get(key);
      if (bucket) bucket.push(ev);
      else map.set(key, [ev]);
    }
    for (const bucket of map.values()) {
      bucket.sort((a, b) => a.title.localeCompare(b.title));
    }
    return map;
  }, [events]);

  const monthDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [month]);

  const weekdayLabels = useMemo(() => {
    const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
    return eachDayOfInterval({ start: weekStart, end: addDays(weekStart, 6) }).map((d) =>
      format(d, "EEE", { locale: dateLocale }),
    );
  }, [dateLocale]);

  const selectedEvents = eventsByDate.get(dateKey(selected)) ?? [];
  const monthEventCount = useMemo(
    () =>
      monthDays.filter((d) => isSameMonth(d, month) && (eventsByDate.get(dateKey(d))?.length ?? 0) > 0)
        .length,
    [monthDays, month, eventsByDate],
  );

  const chipClass = (sportSlug: string) =>
    SPORT_CHIP[sportSlug] ?? "bg-cyan/15 text-cyan border-cyan/25";

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-gray-700/50 bg-surface-dark/60 overflow-hidden shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-gray-700/50 bg-gradient-to-r from-primary/10 via-transparent to-accent/5">
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => setMonth((m) => subMonths(m, 1))}
            className="border-gray-700/80 shrink-0"
            aria-label={t("eventsBrowse.calendarPrev")}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>

          <div className="text-center min-w-0 flex-1">
            <div className="inline-flex items-center gap-2 text-cyan mb-0.5">
              <CalendarDays className="w-4 h-4 shrink-0" />
              <span className="text-[10px] font-semibold uppercase tracking-widest">
                {t("eventsBrowse.calendarEyebrow")}
              </span>
            </div>
            <h2 className="text-base sm:text-lg font-bold text-white capitalize truncate">
              {format(month, "MMMM yyyy", { locale: dateLocale })}
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {t("eventsBrowse.calendarMonthSummary", { count: monthEventCount })}
            </p>
          </div>

          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => setMonth((m) => addMonths(m, 1))}
            className="border-gray-700/80 shrink-0"
            aria-label={t("eventsBrowse.calendarNext")}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>

        <div className="grid grid-cols-7 border-b border-gray-700/40 bg-bg-dark/40">
          {weekdayLabels.map((label) => (
            <div
              key={label}
              className="py-2.5 text-center text-[10px] sm:text-xs font-semibold text-gray-500 uppercase tracking-wide"
            >
              {label}
            </div>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={format(month, "yyyy-MM")}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="grid grid-cols-7 divide-x divide-y divide-gray-700/30"
          >
            {monthDays.map((day) => {
              const key = dateKey(day);
              const dayEvents = eventsByDate.get(key) ?? [];
              const inMonth = isSameMonth(day, month);
              const isSelected = isSameDay(day, selected);
              const today = isToday(day);

              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    setSelected(day);
                    if (!isSameMonth(day, month)) {
                      setMonth(startOfMonth(day));
                    }
                  }}
                  className={cn(
                    "min-h-[76px] sm:min-h-[112px] p-1.5 sm:p-2 text-left transition-all duration-200",
                    "hover:bg-cyan/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan/40 focus-visible:z-10",
                    !inMonth && "bg-bg-dark/30 opacity-50",
                    isSelected && "bg-cyan/10 ring-1 ring-inset ring-cyan/35",
                    dayEvents.length > 0 && !isSelected && "bg-primary/[0.03]",
                  )}
                >
                  <span
                    className={cn(
                      "inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold mb-1",
                      today && "bg-cyan text-background shadow-[0_0_12px_rgba(0,229,255,0.35)]",
                      !today && isSelected && "text-cyan",
                      !today && !isSelected && "text-gray-300",
                    )}
                  >
                    {format(day, "d")}
                  </span>

                  <div className="space-y-0.5 hidden sm:block">
                    {dayEvents.slice(0, 2).map((ev) => (
                      <span
                        key={ev.slug}
                        className={cn(
                          "block truncate rounded-md px-1.5 py-0.5 text-[10px] leading-tight border font-medium",
                          chipClass(ev.sport_slug),
                        )}
                        title={ev.title}
                      >
                        {ev.title}
                      </span>
                    ))}
                    {dayEvents.length > 2 ? (
                      <span className="block text-[10px] text-gray-500 px-1">
                        {t("eventsBrowse.calendarMore", { count: dayEvents.length - 2 })}
                      </span>
                    ) : null}
                  </div>

                  {dayEvents.length > 0 ? (
                    <span className="sm:hidden inline-flex gap-0.5 mt-1">
                      {dayEvents.slice(0, 3).map((ev) => (
                        <span
                          key={ev.slug}
                          className="h-1.5 w-1.5 rounded-full bg-cyan shadow-[0_0_6px_rgba(0,229,255,0.5)]"
                        />
                      ))}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="rounded-2xl border border-gray-700/50 bg-surface-dark/60 p-4 sm:p-5 space-y-4">
        <h3 className="font-semibold text-white text-sm sm:text-base">
          {t("eventsBrowse.calendarDayTitle", {
            date: format(selected, "EEEE, d MMMM yyyy", { locale: dateLocale }),
          })}
        </h3>

        {selectedEvents.length === 0 ? (
          <p className="text-sm text-gray-500 py-4 text-center rounded-xl border border-dashed border-gray-700/60 bg-bg-dark/30">
            {t("eventsBrowse.calendarDayEmpty")}
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {selectedEvents.map((ev, index) => (
              <motion.article
                key={ev.slug}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="group flex gap-3 rounded-xl border border-gray-700/50 bg-bg-dark/40 p-3 hover:border-cyan/35 transition-colors"
              >
                <EventCardImage
                  src={ev.hero_image_url}
                  sportSlug={ev.sport_slug}
                  sportName={ev.sport_name}
                  className="w-20 sm:w-24 shrink-0 rounded-lg overflow-hidden self-stretch min-h-[80px]"
                />
                <div className="flex flex-col min-w-0 flex-1">
                  <div className="flex items-start gap-2 mb-1">
                    <h4 className="font-semibold text-white text-sm line-clamp-2 group-hover:text-cyan transition-colors">
                      {ev.title}
                    </h4>
                    {ev.featured ? (
                      <Star className="w-3.5 h-3.5 text-primary shrink-0 fill-primary/30" />
                    ) : null}
                  </div>
                  <p className="text-[11px] text-cyan mb-2">{ev.sport_name}</p>
                  <div className="space-y-1 text-xs text-gray-500 mt-auto">
                    <p>{formatEventDate(ev.start_date, i18n.language)}</p>
                    {[ev.location_city, ev.location_state].filter(Boolean).length > 0 ? (
                      <p className="flex items-center gap-1 line-clamp-1">
                        <MapPin className="w-3 h-3 shrink-0 text-cyan" />
                        {[ev.location_city, ev.location_state].filter(Boolean).join(", ")}
                      </p>
                    ) : null}
                    {ev.from_price_cents != null ? (
                      <p className="text-gray-400">
                        {t("eventsBrowse.fromPrice", {
                          price: (ev.from_price_cents / 100).toLocaleString(numLocale, {
                            maximumFractionDigits: 0,
                          }),
                        })}
                      </p>
                    ) : null}
                  </div>
                  <Link
                    to={`/events/${ev.slug}`}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-cyan mt-2 hover:text-white transition-colors"
                  >
                    {t("eventsBrowse.viewDetails")}
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </motion.article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

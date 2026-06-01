import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
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
import { ChevronLeft, ChevronRight, ExternalLink, LayoutDashboard, MapPin, Pencil } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { StaffEventRow } from "@shared/api";
import StaffStatusBadge from "@/components/staff/StaffStatusBadge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getDateFnsLocale } from "@/utils/dateLocale";

const STATUS_CHIP: Record<string, string> = {
  published: "bg-cyan/20 text-cyan border-cyan/30 hover:bg-cyan/30",
  completed: "bg-blue-electric/20 text-blue-electric border-blue-electric/30 hover:bg-blue-electric/30",
  draft: "bg-muted/80 text-muted-foreground border-border hover:bg-muted",
  cancelled: "bg-destructive/15 text-destructive border-destructive/30 hover:bg-destructive/25",
};

function dateKey(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

function eventKey(startDate: string): string {
  return startDate.slice(0, 10);
}

interface StaffEventsCalendarViewProps {
  events: StaffEventRow[];
  isAdmin?: boolean;
}

export default function StaffEventsCalendarView({
  events,
  isAdmin = false,
}: StaffEventsCalendarViewProps) {
  const { t, i18n } = useTranslation();
  const dateLocale = getDateFnsLocale(i18n.language);
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [selected, setSelected] = useState(() => new Date());

  const eventsByDate = useMemo(() => {
    const map = new Map<string, StaffEventRow[]>();
    for (const ev of events) {
      const key = eventKey(ev.start_date);
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

  const goPrev = () => setMonth((m) => subMonths(m, 1));
  const goNext = () => setMonth((m) => addMonths(m, 1));

  return (
    <div className="space-y-4">
      <div className="card-sport overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border/60">
          <Button type="button" variant="outline" size="icon" onClick={goPrev} aria-label={t("staffPortal.events.calendarPrev")}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <h2 className="text-sm sm:text-base font-semibold capitalize">
            {format(month, "MMMM yyyy", { locale: dateLocale })}
          </h2>
          <Button type="button" variant="outline" size="icon" onClick={goNext} aria-label={t("staffPortal.events.calendarNext")}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>

        <div className="grid grid-cols-7 border-b border-border/40 bg-muted/20">
          {weekdayLabels.map((label) => (
            <div
              key={label}
              className="py-2 text-center text-[10px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wide"
            >
              {label}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 divide-x divide-y divide-border/30">
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
                  "min-h-[72px] sm:min-h-[108px] p-1 sm:p-1.5 text-left transition-colors",
                  "hover:bg-cyan/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan/40 focus-visible:z-10",
                  !inMonth && "bg-muted/10 opacity-60",
                  isSelected && "bg-cyan/10 ring-1 ring-inset ring-cyan/40",
                )}
              >
                <span
                  className={cn(
                    "inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium mb-1",
                    today && "bg-cyan text-navy-deep",
                    !today && isSelected && "text-cyan",
                    !today && !isSelected && "text-foreground/80",
                  )}
                >
                  {format(day, "d")}
                </span>
                <div className="space-y-0.5 hidden sm:block">
                  {dayEvents.slice(0, 2).map((ev) => (
                    <span
                      key={ev.id}
                      className={cn(
                        "block truncate rounded px-1 py-0.5 text-[10px] leading-tight border",
                        STATUS_CHIP[ev.status] ?? STATUS_CHIP.draft,
                      )}
                      title={ev.title}
                    >
                      {ev.title}
                    </span>
                  ))}
                  {dayEvents.length > 2 ? (
                    <span className="block text-[10px] text-muted-foreground px-1">
                      {t("staffPortal.events.calendarMore", { count: dayEvents.length - 2 })}
                    </span>
                  ) : null}
                </div>
                {dayEvents.length > 0 ? (
                  <span className="sm:hidden inline-flex mt-0.5 h-1.5 w-1.5 rounded-full bg-cyan" />
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      <div className="card-sport p-4 sm:p-5 space-y-3">
        <h3 className="font-semibold text-sm sm:text-base">
          {t("staffPortal.events.calendarDayTitle", {
            date: format(selected, "EEEE, d MMMM yyyy", { locale: dateLocale }),
          })}
        </h3>
        {selectedEvents.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("staffPortal.events.calendarDayEmpty")}</p>
        ) : (
          <div className="space-y-2">
            {selectedEvents.map((ev) => (
              <div
                key={ev.id}
                className="rounded-xl border border-border/60 p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center gap-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium truncate">{ev.title}</p>
                    <StaffStatusBadge status={ev.status} />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {ev.sport_name}
                    {isAdmin && ev.organizer_name ? ` · ${ev.organizer_name}` : ""}
                  </p>
                  {ev.location_city ? (
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                      <MapPin className="w-3.5 h-3.5 shrink-0" />
                      {ev.location_city}
                    </p>
                  ) : null}
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  <div className="text-right">
                    <div className="text-lg font-bold text-cyan">{ev.registration_count}</div>
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
                      {t("staffPortal.dashboard.registered")}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1 items-end">
                    {ev.status === "published" ? (
                      <Link
                        to={`/events/${ev.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-cyan hover:underline"
                      >
                        {t("staffPortal.events.viewPublic")}
                        <ExternalLink className="w-3.5 h-3.5" />
                      </Link>
                    ) : null}
                    <Link
                      to={`/staff/events/${ev.id}`}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-cyan hover:underline"
                    >
                      <LayoutDashboard className="w-3.5 h-3.5" />
                      {t("staffPortal.events.manage")}
                    </Link>
                    <Link
                      to={`/staff/events/${ev.id}/edit`}
                      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-cyan"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      {t("staffPortal.events.edit")}
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

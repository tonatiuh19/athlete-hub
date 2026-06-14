import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  Calendar,
  Loader2,
  MapPin,
  Search,
  Trophy,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import type {
  SearchSuggestCity,
  SearchSuggestEvent,
  SearchSuggestResponse,
  SearchSuggestSport,
} from "@shared/api";
import { formatEventDate } from "@/utils/eventFormat";
import { optimizeEventMediaUrl } from "@/lib/cdn-url";
import { cn } from "@/lib/utils";

export type HeroSearchFlatItem =
  | { kind: "event"; slug: string }
  | { kind: "city"; city: string; geoCityId?: number }
  | { kind: "sport"; slug: string }
  | { kind: "view-all" };

export function buildHeroSearchFlatItems(
  data: SearchSuggestResponse | null,
): HeroSearchFlatItem[] {
  if (!data) return [];
  const items: HeroSearchFlatItem[] = [];
  for (const e of data.events) items.push({ kind: "event", slug: e.slug });
  for (const c of data.cities) {
    items.push({ kind: "city", city: c.city, geoCityId: c.id });
  }
  for (const s of data.sports) items.push({ kind: "sport", slug: s.slug });
  const hasResults =
    data.events.length + data.cities.length + data.sports.length > 0;
  if (hasResults) items.push({ kind: "view-all" });
  return items;
}

interface HeroSearchDropdownProps {
  open: boolean;
  loading: boolean;
  query: string;
  data: SearchSuggestResponse | null;
  highlightIndex: number;
  flatItems: HeroSearchFlatItem[];
  onHighlight: (index: number) => void;
  onSelect: (item: HeroSearchFlatItem) => void;
  variant?: "dark" | "light";
}

function flatIndexFor(
  flatItems: HeroSearchFlatItem[],
  kind: HeroSearchFlatItem["kind"],
  sectionIndex: number,
): number {
  let eventIdx = 0;
  let cityIdx = 0;
  let sportIdx = 0;
  for (let i = 0; i < flatItems.length; i++) {
    const item = flatItems[i];
    if (item.kind === "event") {
      if (kind === "event" && eventIdx === sectionIndex) return i;
      eventIdx++;
    } else if (item.kind === "city") {
      if (kind === "city" && cityIdx === sectionIndex) return i;
      cityIdx++;
    } else if (item.kind === "sport") {
      if (kind === "sport" && sportIdx === sectionIndex) return i;
      sportIdx++;
    }
  }
  return -1;
}

function EventRow({
  event,
  locale,
  active,
  onMouseEnter,
  onClick,
}: {
  event: SearchSuggestEvent;
  locale: string;
  active: boolean;
  onMouseEnter: () => void;
  onClick: () => void;
}) {
  const location = [event.location_city, event.location_state]
    .filter(Boolean)
    .join(", ");
  const heroImage = optimizeEventMediaUrl(event.hero_image_url, "thumb");

  return (
    <button
      type="button"
      role="option"
      aria-selected={active}
      onMouseEnter={onMouseEnter}
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors",
        active
          ? "bg-primary/15 text-white"
          : "text-white/90 hover:bg-white/[0.06]",
      )}
    >
      <div className="h-11 w-11 shrink-0 rounded-lg overflow-hidden bg-white/10 border border-white/10">
        {heroImage ? (
          <img
            src={heroImage}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center">
            <Trophy className="w-4 h-4 text-primary/80" />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-sm truncate">{event.title}</p>
        <p className="text-xs text-white/50 truncate flex items-center gap-2 mt-0.5">
          <span className="inline-flex items-center gap-1">
            <Calendar className="w-3 h-3 shrink-0" />
            {formatEventDate(event.start_date, locale)}
          </span>
          {location ? (
            <>
              <span aria-hidden>·</span>
              <span className="inline-flex items-center gap-1 truncate">
                <MapPin className="w-3 h-3 shrink-0" />
                {location}
              </span>
            </>
          ) : null}
        </p>
      </div>
      <span className="text-[10px] font-bold uppercase tracking-wider text-primary/90 shrink-0 max-w-[35%] truncate text-right">
        {event.sport_name}
      </span>
    </button>
  );
}

function CityRow({
  city,
  active,
  onMouseEnter,
  onClick,
  countLabel,
}: {
  city: SearchSuggestCity;
  active: boolean;
  onMouseEnter: () => void;
  onClick: () => void;
  countLabel: string;
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={active}
      onMouseEnter={onMouseEnter}
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors",
        active
          ? "bg-primary/15 text-white"
          : "text-white/90 hover:bg-white/[0.06]",
      )}
    >
      <div className="h-9 w-9 shrink-0 rounded-full bg-primary/15 border border-primary/25 flex items-center justify-center">
        <MapPin className="w-4 h-4 text-primary" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-sm">
          {city.city}
          {city.state ? `, ${city.state}` : ""}
        </p>
        <p className="text-xs text-white/45">{countLabel}</p>
      </div>
      <ArrowRight className="w-4 h-4 text-white/30 shrink-0" />
    </button>
  );
}

function SportRow({
  sport,
  active,
  onMouseEnter,
  onClick,
}: {
  sport: SearchSuggestSport;
  active: boolean;
  onMouseEnter: () => void;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={active}
      onMouseEnter={onMouseEnter}
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors",
        active
          ? "bg-primary/15 text-white"
          : "text-white/90 hover:bg-white/[0.06]",
      )}
    >
      <div className="h-9 w-9 shrink-0 rounded-full bg-white/10 border border-white/10 flex items-center justify-center text-lg">
        {sport.icon || "🏅"}
      </div>
      <p className="font-semibold text-sm flex-1">{sport.name}</p>
      <ArrowRight className="w-4 h-4 text-white/30 shrink-0" />
    </button>
  );
}

export default function HeroSearchDropdown({
  open,
  loading,
  query,
  data,
  highlightIndex,
  flatItems,
  onHighlight,
  onSelect,
  variant = "dark",
}: HeroSearchDropdownProps) {
  const { t, i18n } = useTranslation();
  const isLight = variant === "light";
  const showPanel = open && query.trim().length >= 2;
  const hasResults =
    !!data &&
    (data.events.length > 0 ||
      data.cities.length > 0 ||
      data.sports.length > 0);

  const viewAllIndex = flatItems.findIndex((i) => i.kind === "view-all");

  return (
    <AnimatePresence>
      {showPanel ? (
        <motion.div
          initial={{ opacity: 0, y: -6, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -4, scale: 0.99 }}
          transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
          className={cn(
            "relative w-full z-[100] overflow-hidden rounded-2xl backdrop-blur-2xl",
            isLight
              ? "border border-border/80 bg-card/98 shadow-panel"
              : "border border-white/12 bg-triboo-black/95 shadow-[0_24px_80px_rgba(0,0,0,0.65)]",
          )}
          role="listbox"
          aria-label={t("home.hero.searchDropdownLabel")}
        >
          {loading && !data ? (
            <div className="flex items-center justify-center gap-2 py-10 text-white/50 text-sm">
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
              {t("home.hero.searchLoading")}
            </div>
          ) : !hasResults && !loading ? (
            <div className="px-4 py-8 text-center">
              <Search className="w-8 h-8 text-white/20 mx-auto mb-2" />
              <p className="text-sm text-white/60">{t("home.hero.searchNoResults")}</p>
              <button
                type="button"
                onClick={() => onSelect({ kind: "view-all" })}
                className="mt-3 text-sm font-semibold text-primary hover:text-white transition-colors"
              >
                {t("home.hero.searchViewAllFor", { query })}
              </button>
            </div>
          ) : (
            <div className="max-h-[min(420px,60vh)] overflow-y-auto overscroll-contain p-2">
              {data!.events.length > 0 ? (
                <section className="mb-1">
                  <p className="px-3 py-2 text-[10px] font-bold uppercase tracking-[0.2em] text-white/35">
                    {t("home.hero.searchSectionEvents")}
                  </p>
                  <div className="space-y-0.5">
                    {data!.events.map((event, idx) => {
                      const flatIdx = flatIndexFor(flatItems, "event", idx);
                      return (
                        <EventRow
                          key={event.slug}
                          event={event}
                          locale={i18n.language}
                          active={highlightIndex === flatIdx}
                          onMouseEnter={() => onHighlight(flatIdx)}
                          onClick={() => onSelect({ kind: "event", slug: event.slug })}
                        />
                      );
                    })}
                  </div>
                </section>
              ) : null}

              {data!.cities.length > 0 ? (
                <section className="mb-1">
                  <p className="px-3 py-2 text-[10px] font-bold uppercase tracking-[0.2em] text-white/35">
                    {t("home.hero.searchSectionCities")}
                  </p>
                  <div className="space-y-0.5">
                    {data!.cities.map((city, idx) => {
                      const flatIdx = flatIndexFor(flatItems, "city", idx);
                      return (
                        <CityRow
                          key={`${city.city}-${city.state ?? ""}`}
                          city={city}
                          active={highlightIndex === flatIdx}
                          onMouseEnter={() => onHighlight(flatIdx)}
                          onClick={() =>
                            onSelect({
                              kind: "city",
                              city: city.city,
                              geoCityId: city.id,
                            })
                          }
                          countLabel={t("home.hero.searchCityCount", {
                            count: city.event_count,
                          })}
                        />
                      );
                    })}
                  </div>
                </section>
              ) : null}

              {data!.sports.length > 0 ? (
                <section className="mb-1">
                  <p className="px-3 py-2 text-[10px] font-bold uppercase tracking-[0.2em] text-white/35">
                    {t("home.hero.searchSectionSports")}
                  </p>
                  <div className="space-y-0.5">
                    {data!.sports.map((sport, idx) => {
                      const flatIdx = flatIndexFor(flatItems, "sport", idx);
                      return (
                        <SportRow
                          key={sport.slug}
                          sport={sport}
                          active={highlightIndex === flatIdx}
                          onMouseEnter={() => onHighlight(flatIdx)}
                          onClick={() => onSelect({ kind: "sport", slug: sport.slug })}
                        />
                      );
                    })}
                  </div>
                </section>
              ) : null}

              {viewAllIndex >= 0 ? (
                <button
                  type="button"
                  role="option"
                  aria-selected={highlightIndex === viewAllIndex}
                  onMouseEnter={() => onHighlight(viewAllIndex)}
                  onClick={() => onSelect({ kind: "view-all" })}
                  className={cn(
                    "w-full mt-1 flex items-center justify-between gap-2 px-3 py-3 rounded-xl border-t border-white/8 text-sm font-semibold transition-colors",
                    highlightIndex === viewAllIndex
                      ? "bg-primary/15 text-primary"
                      : "text-white/70 hover:bg-white/[0.05] hover:text-white",
                  )}
                >
                  <span className="inline-flex items-center gap-2">
                    <Search className="w-4 h-4" />
                    {t("home.hero.searchViewAllFor", { query })}
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              ) : null}
            </div>
          )}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

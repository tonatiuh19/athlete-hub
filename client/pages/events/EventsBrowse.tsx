import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Grid3X3, Map, LayoutGrid, Search, Loader2, SlidersHorizontal, MapPin } from "lucide-react";
import MetaHelmet from "@/components/MetaHelmet";
import EventsFiltersSidebar from "@/components/events/EventsFiltersSidebar";
import EventsMap from "@/components/events/EventsMap";
import MapEventPreview from "@/components/events/MapEventPreview";
import MarketplaceEventCard from "@/components/events/MarketplaceEventCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  fetchFilterCities,
  fetchMarketplaceEvents,
  fetchSportTypes,
  resetFilters,
  setFilters,
  setSelectedEventSlug,
  setViewMode,
} from "@/store/slices/marketplaceSlice";
import { cn } from "@/lib/utils";

export default function EventsBrowse() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const {
    events,
    total,
    filters,
    viewMode,
    selectedEventSlug,
    sportTypes,
    cities,
    loadingEvents,
    error,
  } = useAppSelector((s) => s.marketplace);

  const [searchInput, setSearchInput] = useState(filters.q);

  useEffect(() => {
    dispatch(fetchSportTypes());
    dispatch(fetchFilterCities());
  }, [dispatch]);

  useEffect(() => {
    dispatch(fetchMarketplaceEvents(filters));
  }, [dispatch, filters]);

  useEffect(() => {
    const id = setTimeout(() => {
      if (searchInput !== filters.q) {
        dispatch(setFilters({ q: searchInput }));
      }
    }, 350);
    return () => clearTimeout(id);
  }, [searchInput, filters.q, dispatch]);

  useEffect(() => {
    if (events.length > 0 && !selectedEventSlug) {
      dispatch(setSelectedEventSlug(events[0].slug));
    }
  }, [events, selectedEventSlug, dispatch]);

  const selectedEvent = useMemo(
    () => events.find((e) => e.slug === selectedEventSlug) ?? events[0],
    [events, selectedEventSlug],
  );

  const mappableCount = useMemo(
    () => events.filter((e) => e.location_lat != null && e.location_lng != null).length,
    [events],
  );

  const viewButtons = [
    { mode: "grid" as const, icon: Grid3X3, label: t("eventsBrowse.viewGrid") },
    { mode: "split" as const, icon: LayoutGrid, label: t("eventsBrowse.viewSplit") },
    { mode: "map" as const, icon: Map, label: t("eventsBrowse.viewMap") },
  ];

  return (
    <>
      <MetaHelmet
        title={t("eventsBrowse.pageTitle")}
        description={t("eventsBrowse.pageSubtitle")}
        path="/events"
        alternateLocales
        keywords={["sports events", "race calendar", "triathlon", "marathon", "Mexico events"]}
      />

      <section className="relative overflow-hidden border-b border-gray-800/60">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(0,229,255,0.1),transparent_60%)]" />
        <div className="relative max-w-[1400px] mx-auto px-4 md:px-6 py-8 md:py-12">
          <p className="text-cyan text-xs font-semibold uppercase tracking-widest mb-2">
            {t("eventsBrowse.eyebrow")}
          </p>
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">{t("eventsBrowse.pageTitle")}</h1>
          <p className="text-gray-400 max-w-2xl mb-6 text-sm md:text-base">{t("eventsBrowse.pageSubtitle")}</p>

          <div className="flex flex-col sm:flex-row gap-3 max-w-3xl">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
              <Input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder={t("eventsBrowse.searchPlaceholder")}
                className="pl-10 h-11 bg-surface-dark/80 border-gray-700/80 focus-visible:ring-cyan rounded-xl"
              />
            </div>
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" className="h-11 border-gray-700 rounded-xl lg:hidden">
                  <SlidersHorizontal className="w-4 h-4 mr-2" />
                  {t("eventsBrowse.filters")}
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[min(320px,100vw)] bg-bg-dark border-gray-800 overflow-y-auto p-0">
                <div className="p-4">
                  <EventsFiltersSidebar
                    filters={filters}
                    sportTypes={sportTypes}
                    cities={cities}
                    onChange={(patch) => dispatch(setFilters(patch))}
                    onReset={() => {
                      dispatch(resetFilters());
                      setSearchInput("");
                    }}
                  />
                </div>
              </SheetContent>
            </Sheet>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center mt-6">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <span className="text-sm text-gray-400">
                {t("eventsBrowse.resultsCount", { count: total })}
              </span>
              {(viewMode === "map" || viewMode === "split") && mappableCount > 0 && (
                <span className="inline-flex items-center gap-1.5 text-xs text-gray-500">
                  <MapPin className="w-3.5 h-3.5 text-cyan shrink-0" />
                  {t("eventsBrowse.onMap", { count: mappableCount })}
                </span>
              )}
            </div>
            <div className="flex gap-1 p-1 w-full sm:w-auto sm:ml-auto rounded-xl bg-surface-dark/80 border border-gray-700/50">
              {viewButtons.map(({ mode, icon: Icon, label }) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => dispatch(setViewMode(mode))}
                  className={cn(
                    "inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all duration-200",
                    viewMode === mode
                      ? "bg-cyan/15 text-cyan shadow-sm"
                      : "text-gray-400 hover:text-white hover:bg-white/5",
                  )}
                  title={label}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="max-w-[1400px] mx-auto px-4 md:px-6 py-6 md:py-8">
        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] xl:grid-cols-[300px_1fr] gap-5 xl:gap-6 items-start">
          <div className="hidden lg:block lg:sticky lg:top-[5.5rem] lg:self-start">
            <EventsFiltersSidebar
              filters={filters}
              sportTypes={sportTypes}
              cities={cities}
              onChange={(patch) => dispatch(setFilters(patch))}
              onReset={() => {
                dispatch(resetFilters());
                setSearchInput("");
              }}
            />
          </div>

          <div className="min-w-0">
            {loadingEvents && (
              <div className="flex items-center justify-center gap-2 py-24 text-gray-400">
                <Loader2 className="w-5 h-5 animate-spin text-cyan" />
                {t("eventsBrowse.loading")}
              </div>
            )}

            {error && !loadingEvents && (
              <p className="text-center text-red-400 py-12">{error}</p>
            )}

            {!loadingEvents && !error && events.length === 0 && (
              <div className="text-center py-24 rounded-2xl border border-gray-800/60 bg-surface-dark/30">
                <p className="text-gray-400 mb-4">{t("eventsBrowse.empty")}</p>
                <Button
                  variant="outline"
                  className="border-gray-700"
                  onClick={() => {
                    dispatch(resetFilters());
                    setSearchInput("");
                  }}
                >
                  {t("eventsBrowse.reset")}
                </Button>
              </div>
            )}

            {!loadingEvents && events.length > 0 && (
              <>
                {viewMode === "grid" && (
                  <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-5">
                    {events.map((ev) => (
                      <MarketplaceEventCard key={ev.slug} event={ev} />
                    ))}
                  </div>
                )}

                {viewMode === "map" && (
                  <div className="relative h-[min(78vh,720px)] min-h-[440px] rounded-2xl overflow-hidden border border-gray-700/50 bg-surface-dark/30">
                    <EventsMap
                      events={events}
                      selectedSlug={selectedEventSlug}
                      onSelectEvent={(slug) => dispatch(setSelectedEventSlug(slug))}
                      className="absolute inset-0 h-full w-full border-0 rounded-none"
                    />
                    {selectedEvent && <MapEventPreview event={selectedEvent} />}
                  </div>
                )}

                {viewMode === "split" && (
                  <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,380px)_1fr] gap-4 xl:gap-5 min-h-0 lg:min-h-[min(78vh,720px)]">
                    <div className="flex flex-col gap-2.5 max-h-[min(50vh,420px)] lg:max-h-[min(78vh,720px)] overflow-y-auto pr-1 pb-1 scrollbar-hide min-w-0">
                      {events.map((ev) => (
                        <MarketplaceEventCard
                          key={ev.slug}
                          event={ev}
                          compact
                          selected={ev.slug === selectedEventSlug}
                          onSelect={() => dispatch(setSelectedEventSlug(ev.slug))}
                        />
                      ))}
                    </div>

                    <div className="relative min-h-[400px] lg:min-h-0 rounded-2xl overflow-hidden border border-gray-700/50 bg-surface-dark/30 shadow-[inset_0_0_0_1px_rgba(0,229,255,0.04)]">
                      <EventsMap
                        events={events}
                        selectedSlug={selectedEventSlug}
                        onSelectEvent={(slug) => dispatch(setSelectedEventSlug(slug))}
                        className="absolute inset-0 h-full w-full border-0 rounded-none"
                      />
                      {selectedEvent && <MapEventPreview event={selectedEvent} />}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

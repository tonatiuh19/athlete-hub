import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  CalendarDays,
  Grid3X3,
  Map,
  LayoutGrid,
  Loader2,
  SlidersHorizontal,
  MapPin,
} from "lucide-react";
import MetaHelmet, { DEFAULT_OG_IMAGE } from "@/components/MetaHelmet";
import EventsCalendarView from "@/components/events/EventsCalendarView";
import EventsFiltersSidebar from "@/components/events/EventsFiltersSidebar";
import EventsSearchCombobox from "@/components/events/EventsSearchCombobox";
import EventsMap from "@/components/events/EventsMap";
import MapEventPreview from "@/components/events/MapEventPreview";
import MarketplaceEventCard from "@/components/events/MarketplaceEventCard";
import { Button } from "@/components/ui/button";
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
import { useMediaQuery, useMapPanelHeight } from "@/hooks/use-media-query";
import {
  filtersFromSearchParams,
  marketplaceFiltersToSearchParams,
  normalizeMarketplaceFilters,
} from "@/utils/eventsBrowseFilters";

export default function EventsBrowse() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const [searchParams, setSearchParams] = useSearchParams();
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

  const isMapLayout = viewMode === "map" || viewMode === "split";
  const isDesktopSplit = useMediaQuery("(min-width: 1024px)");
  const mapPanelHeight = useMapPanelHeight();

  const skipUrlSyncRef = useRef(false);

  const [searchInput, setSearchInput] = useState(
    () => filtersFromSearchParams(searchParams).q ?? "",
  );

  const applyFiltersPatch = useCallback(
    (patch: Partial<typeof filters>) => {
      const next = normalizeMarketplaceFilters({ ...filters, ...patch });
      skipUrlSyncRef.current = true;
      dispatch(setFilters(patch));
      setSearchParams(marketplaceFiltersToSearchParams(next), { replace: true });
    },
    [dispatch, filters, setSearchParams],
  );

  const resetAllFilters = useCallback(() => {
    skipUrlSyncRef.current = true;
    dispatch(resetFilters());
    setSearchInput("");
    setSearchParams({}, { replace: true });
  }, [dispatch, setSearchParams]);

  useEffect(() => {
    dispatch(fetchSportTypes());
    dispatch(fetchFilterCities());
    const isDesktop = window.matchMedia("(min-width: 1024px)").matches;
    dispatch(setViewMode(isDesktop ? "split" : "map"));
  }, [dispatch]);

  useEffect(() => {
    if (skipUrlSyncRef.current) {
      skipUrlSyncRef.current = false;
      return;
    }
    const fromUrl = filtersFromSearchParams(searchParams);
    dispatch(setFilters(fromUrl));
    setSearchInput(fromUrl.q ?? "");
  }, [searchParams, dispatch]);

  useEffect(() => {
    const promise = dispatch(fetchMarketplaceEvents(filters));
    return () => promise.abort();
  }, [dispatch, filters]);

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

  useEffect(() => {
    if (!isDesktopSplit && viewMode === "split") {
      dispatch(setViewMode("map"));
    }
  }, [dispatch, isDesktopSplit, viewMode]);

  const isInitialLoad = loadingEvents && events.length === 0;
  const hasEvents = events.length > 0;

  const viewButtons = [
    { mode: "grid" as const, icon: Grid3X3, label: t("eventsBrowse.viewGrid"), desktopOnly: false },
    {
      mode: "calendar" as const,
      icon: CalendarDays,
      label: t("eventsBrowse.viewCalendar"),
      desktopOnly: false,
    },
    { mode: "split" as const, icon: LayoutGrid, label: t("eventsBrowse.viewSplit"), desktopOnly: true },
    { mode: "map" as const, icon: Map, label: t("eventsBrowse.viewMap"), desktopOnly: false },
  ].filter((btn) => !btn.desktopOnly || isDesktopSplit);

  return (
    <div className="flex flex-1 flex-col w-full min-w-0 min-h-full overflow-x-clip">
      <MetaHelmet
        title={t("eventsBrowse.pageTitle")}
        description={t("eventsBrowse.pageSubtitle")}
        image={DEFAULT_OG_IMAGE}
        imageAlt={t("eventsBrowse.metaImageAlt")}
        path="/events"
        alternateLocales
        keywords={["Triboo Sport", "sports events", "race calendar", "triathlon", "marathon", "Mexico events"]}
      />

      <section className="relative overflow-hidden border-b border-gray-800/60">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(0,229,255,0.1),transparent_60%)]" />
        <div className="relative max-w-[min(100%,1920px)] mx-auto px-4 md:px-6 lg:px-8 py-8 md:py-12">
          <p className="text-cyan text-xs font-semibold uppercase tracking-widest mb-2">
            {t("eventsBrowse.eyebrow")}
          </p>
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">{t("eventsBrowse.pageTitle")}</h1>
          <p className="text-gray-400 max-w-2xl mb-6 text-sm md:text-base">{t("eventsBrowse.pageSubtitle")}</p>

          <div className="flex flex-col sm:flex-row gap-3 max-w-3xl">
            <EventsSearchCombobox
              value={searchInput}
              onChange={setSearchInput}
              onApplyQuery={(q) => applyFiltersPatch({ q })}
              onApplySport={(sport) => applyFiltersPatch({ sport })}
              onApplyCity={(city, geoCityId) =>
                applyFiltersPatch({
                  geoCityId: geoCityId ? String(geoCityId) : "",
                  city: geoCityId ? "" : city,
                })
              }
            />
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
                    onChange={applyFiltersPatch}
                    onReset={resetAllFilters}
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

      <div
        className={cn(
          "mx-auto px-4 md:px-6 lg:px-8 py-6 md:py-8 w-full",
          isMapLayout ? "max-w-[min(100%,1920px)]" : "max-w-[1400px]",
        )}
      >
        <div
          className={cn(
            "grid gap-5 xl:gap-6 items-start w-full",
            isMapLayout
              ? "grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)] xl:grid-cols-[280px_minmax(0,1fr)]"
              : "grid-cols-1 lg:grid-cols-[280px_1fr] xl:grid-cols-[300px_1fr]",
          )}
        >
          <div className="hidden lg:block lg:sticky lg:top-[5.5rem] lg:self-start">
            <EventsFiltersSidebar
              filters={filters}
              sportTypes={sportTypes}
              cities={cities}
              onChange={applyFiltersPatch}
              onReset={resetAllFilters}
            />
          </div>

          <div className="min-w-0 w-full">
            {isInitialLoad && (
              <div className="flex items-center justify-center gap-2 py-24 text-gray-400">
                <Loader2 className="w-5 h-5 animate-spin text-cyan" />
                {t("eventsBrowse.loading")}
              </div>
            )}

            {error && !isInitialLoad && (
              <p className="text-center text-red-400 py-12">{error}</p>
            )}

            {!isInitialLoad && !error && !hasEvents && (
              <div className="text-center py-24 rounded-2xl border border-gray-800/60 bg-surface-dark/30">
                <p className="text-gray-400 mb-4">{t("eventsBrowse.empty")}</p>
                <Button
                  variant="outline"
                  className="border-gray-700"
                  onClick={resetAllFilters}
                >
                  {t("eventsBrowse.reset")}
                </Button>
              </div>
            )}

            {hasEvents && (
              <div className="relative">
                {loadingEvents && (
                  <div
                    className="absolute inset-0 z-20 flex items-start justify-center pt-16 rounded-2xl bg-background/50 backdrop-blur-[2px] pointer-events-none"
                    aria-hidden
                  >
                    <div className="inline-flex items-center gap-2 rounded-full border border-gray-700/60 bg-surface-dark/90 px-4 py-2 text-sm text-gray-300 shadow-lg">
                      <Loader2 className="w-4 h-4 animate-spin text-cyan" />
                      {t("eventsBrowse.updating")}
                    </div>
                  </div>
                )}

                {viewMode === "grid" && (
                  <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-5">
                    {events.map((ev) => (
                      <MarketplaceEventCard key={ev.slug} event={ev} />
                    ))}
                  </div>
                )}

                {viewMode === "calendar" && <EventsCalendarView events={events} />}

                {viewMode === "map" && (
                  <div className="relative w-full rounded-2xl overflow-hidden border border-gray-700/50 bg-surface-dark/30">
                    <EventsMap
                      events={events}
                      selectedSlug={selectedEventSlug}
                      onSelectEvent={(slug) => dispatch(setSelectedEventSlug(slug))}
                      height={mapPanelHeight}
                      className="w-full border-0 rounded-none"
                    />
                    {selectedEvent && <MapEventPreview event={selectedEvent} />}
                  </div>
                )}

                {viewMode === "split" && (
                  <div className="grid grid-cols-1 lg:grid-cols-[minmax(240px,300px)_minmax(0,1fr)] xl:grid-cols-[minmax(260px,320px)_minmax(0,1fr)] gap-4 xl:gap-6 w-full items-stretch">
                    <div className="flex flex-col gap-2.5 max-h-[min(50vh,420px)] lg:max-h-[560px] overflow-y-auto pr-1 pb-1 scrollbar-hide min-w-0 w-full">
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

                    <div className="relative min-w-0 w-full rounded-2xl overflow-hidden border border-gray-700/50 bg-surface-dark/30 shadow-[inset_0_0_0_1px_rgba(0,229,255,0.04)]">
                      <EventsMap
                        events={events}
                        selectedSlug={selectedEventSlug}
                        onSelectEvent={(slug) => dispatch(setSelectedEventSlug(slug))}
                        height={mapPanelHeight}
                        className="w-full border-0 rounded-none"
                      />
                      {selectedEvent && <MapEventPreview event={selectedEvent} />}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

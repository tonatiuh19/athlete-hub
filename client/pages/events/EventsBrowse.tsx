import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  CalendarDays,
  Grid3X3,
  Map,
  LayoutGrid,
  Loader2,
  MapPin,
} from "lucide-react";
import MetaHelmet, { DEFAULT_OG_IMAGE } from "@/components/MetaHelmet";
import EventsCalendarView from "@/components/events/EventsCalendarView";
import EventsFiltersSidebar from "@/components/events/EventsFiltersSidebar";
import MarketplaceSearchBar from "@/components/events/MarketplaceSearchBar";
import SportTypesChipCarousel from "@/components/events/SportTypesChipCarousel";
import EventsMap from "@/components/events/EventsMap";
import MapEventPreview from "@/components/events/MapEventPreview";
import MarketplaceEventCard from "@/components/events/MarketplaceEventCard";
import HeroMobileFiltersSheet from "@/components/home/HeroMobileFiltersSheet";
import { SportChipsSkeleton } from "@/components/home/homeSkeletonPrimitives";
import MarketplaceBrowseHeroBackdrop from "@/components/events/MarketplaceBrowseHeroBackdrop";
import { Button } from "@/components/ui/button";
import { useIsDarkTheme } from "@/hooks/use-is-dark-theme";
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
  const isDark = useIsDarkTheme();
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
    loadingMeta,
    error,
  } = useAppSelector((s) => s.marketplace);

  const isMapLayout = viewMode === "map" || viewMode === "split";
  const isDesktopSplit = useMediaQuery("(min-width: 1024px)");
  const mapPanelHeight = useMapPanelHeight();

  const skipUrlSyncRef = useRef(false);

  const [searchInput, setSearchInput] = useState(
    () => filtersFromSearchParams(searchParams).q ?? "",
  );
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const initialViewParam = searchParams.get("view");

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
    if (initialViewParam === "map") {
      dispatch(setViewMode("map"));
      return;
    }
    const isDesktop = window.matchMedia("(min-width: 1024px)").matches;
    dispatch(setViewMode(isDesktop ? "split" : "grid"));
  }, [dispatch, initialViewParam]);

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

      <section
        className={cn(
          "relative overflow-hidden border-b border-border",
          !isDark && "bg-background",
        )}
      >
        <MarketplaceBrowseHeroBackdrop isDark={isDark} />

        <div className="relative max-w-[min(100%,1920px)] mx-auto px-4 md:px-6 lg:px-8 py-3 md:py-12">
          <p className="hidden md:block text-primary text-xs font-semibold uppercase tracking-widest mb-2">
            {t("eventsBrowse.eyebrow")}
          </p>
          <h1 className="hidden md:block text-2xl md:text-4xl font-bold text-foreground mb-2 md:mb-2">
            {t("eventsBrowse.pageTitle")}
          </h1>
          <p className="hidden md:block text-muted-foreground max-w-2xl mb-6 text-sm md:text-base">
            {t("eventsBrowse.pageSubtitle")}
          </p>

          <div className="flex flex-col gap-3 max-w-3xl">
            <MarketplaceSearchBar
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
              placeholder={t("eventsBrowse.searchPlaceholder")}
              listboxId="events-browse-search-listbox"
              showFilters
              filtersOpen={mobileFiltersOpen}
              onFiltersClick={() => setMobileFiltersOpen(true)}
            />

            <HeroMobileFiltersSheet
              open={mobileFiltersOpen}
              onOpenChange={setMobileFiltersOpen}
              searchQuery={searchInput}
              initialFilters={{
                sport: filters.sport,
                geoCityId: filters.geoCityId,
                city: filters.city,
                dateFrom: filters.dateFrom,
                dateTo: filters.dateTo,
              }}
              onApplyFilters={(patch) => applyFiltersPatch(patch)}
            />
          </div>

          <div className="md:hidden mt-3 -mx-1 min-w-0">
            {sportTypes.length > 0 ? (
              <SportTypesChipCarousel
                mode="filter"
                sportTypes={sportTypes}
                activeSlug={filters.sport}
                showAll
                onSelect={(sport) => applyFiltersPatch({ sport })}
              />
            ) : loadingMeta ? (
              <SportChipsSkeleton />
            ) : null}
          </div>

          <div className="flex items-center justify-between gap-2 mt-3 md:mt-6">
            <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
              <span className="text-xs md:text-sm text-muted-foreground tabular-nums">
                {t("eventsBrowse.resultsCount", { count: total })}
              </span>
              {(viewMode === "map" || viewMode === "split") && mappableCount > 0 && (
                <span className="hidden sm:inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                  <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
                  {t("eventsBrowse.onMap", { count: mappableCount })}
                </span>
              )}
            </div>
            <div className="flex shrink-0 gap-0.5 p-0.5 rounded-xl bg-card/90 border border-border/70 backdrop-blur-sm">
              {viewButtons.map(({ mode, icon: Icon, label }) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => dispatch(setViewMode(mode))}
                  className={cn(
                    "inline-flex items-center justify-center gap-1.5 rounded-lg transition-all duration-200",
                    "h-9 w-9 sm:h-auto sm:w-auto sm:px-3 sm:py-2 text-xs font-semibold",
                    viewMode === mode
                      ? "bg-primary/15 text-primary shadow-sm"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted",
                  )}
                  title={label}
                  aria-label={label}
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
          "mx-auto px-4 md:px-6 lg:px-8 py-4 md:py-8 w-full",
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
              <div className="flex items-center justify-center gap-2 py-24 text-muted-foreground">
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
                {t("eventsBrowse.loading")}
              </div>
            )}

            {error && !isInitialLoad && (
              <p className="text-center text-destructive py-12">{error}</p>
            )}

            {!isInitialLoad && !error && !hasEvents && (
              <div className="text-center py-24 rounded-2xl border border-border bg-card/60">
                <p className="text-muted-foreground mb-4">{t("eventsBrowse.empty")}</p>
                <Button variant="outline" onClick={resetAllFilters}>
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
                    <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/90 px-4 py-2 text-sm text-muted-foreground shadow-lg">
                      <Loader2 className="w-4 h-4 animate-spin text-primary" />
                      {t("eventsBrowse.updating")}
                    </div>
                  </div>
                )}

                {viewMode === "grid" && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 md:gap-5">
                    {events.map((ev) => (
                      <MarketplaceEventCard key={ev.slug} event={ev} />
                    ))}
                  </div>
                )}

                {viewMode === "calendar" && <EventsCalendarView events={events} />}

                {viewMode === "map" && (
                  <div className="relative w-full rounded-2xl overflow-hidden border border-border bg-card/60">
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

                    <div className="relative min-w-0 w-full rounded-2xl overflow-hidden border border-border bg-card/60 shadow-sm">
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

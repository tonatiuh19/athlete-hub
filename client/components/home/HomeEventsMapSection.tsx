import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, MapPin } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { EventListItem } from "@shared/api";
import EventsMap from "@/components/events/EventsMap";
import MapEventPreview from "@/components/events/MapEventPreview";
import MarketplaceEventCard from "@/components/events/MarketplaceEventCard";
import { Button } from "@/components/ui/button";
import { parseCoord } from "@/lib/leafletSetup";
import { cn } from "@/lib/utils";
import { useMapPanelHeight, useMediaQuery } from "@/hooks/use-media-query";

interface HomeEventsMapSectionProps {
  events: EventListItem[];
}

function MapShellSkeleton({ height }: { height: number }) {
  return (
    <div
      className="w-full rounded-2xl border border-border/60 bg-card/40 animate-pulse"
      style={{ height }}
      aria-hidden
    />
  );
}

export default function HomeEventsMapSection({ events }: HomeEventsMapSectionProps) {
  const { t } = useTranslation();
  const sectionRef = useRef<HTMLElement>(null);
  const [mapReady, setMapReady] = useState(false);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const isLg = useMediaQuery("(min-width: 1024px)");
  const mobileMapHeight = useMapPanelHeight();
  const mapHeight = isLg ? 520 : mobileMapHeight;

  const mappableEvents = useMemo(
    () =>
      events.filter(
        (ev) => parseCoord(ev.location_lat) != null && parseCoord(ev.location_lng) != null,
      ),
    [events],
  );

  const selectedEvent = useMemo(
    () =>
      mappableEvents.find((ev) => ev.slug === selectedSlug) ?? mappableEvents[0] ?? null,
    [mappableEvents, selectedSlug],
  );

  useEffect(() => {
    if (mappableEvents.length === 0) {
      setSelectedSlug(null);
      return;
    }
    setSelectedSlug((prev) => {
      if (prev && mappableEvents.some((ev) => ev.slug === prev)) return prev;
      return mappableEvents[0]!.slug;
    });
  }, [mappableEvents]);

  useEffect(() => {
    const node = sectionRef.current;
    if (!node || mapReady) return;

    if (typeof IntersectionObserver === "undefined") {
      setMapReady(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setMapReady(true);
          observer.disconnect();
        }
      },
      { rootMargin: "160px 0px" },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [mapReady]);

  if (mappableEvents.length === 0) return null;

  return (
    <section
      ref={sectionRef}
      id="event-map"
      aria-label={t("home.map.sectionLabel")}
      className="px-4 pt-2 pb-10 md:py-10 scroll-mt-[4.5rem]"
    >
      <div className="max-w-7xl mx-auto w-full min-w-0">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between mb-4 md:mb-6">
          <div className="min-w-0">
            <p className="text-[11px] md:text-xs font-semibold uppercase tracking-widest text-primary mb-1.5 md:mb-2">
              {t("home.map.eyebrow")}
            </p>
            <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground tracking-tight">
              {t("home.map.title")}
            </h2>
            <p className="hidden md:block text-muted-foreground text-sm md:text-base mt-2 max-w-xl leading-relaxed">
              {t("home.map.subtitle")}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
              {t("home.map.onMap", { count: mappableEvents.length })}
            </span>
            <Button asChild variant="outline" size="sm" className="rounded-xl border-border">
              <Link to="/events">
                {t("home.map.exploreAll")}
                <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
              </Link>
            </Button>
          </div>
        </div>

        <div className="lg:hidden -mx-1 mb-3">
          <div
            className={cn(
              "flex gap-2.5 overflow-x-auto overscroll-x-contain scrollbar-hide snap-x snap-mandatory scroll-smooth py-1 px-1",
              "[mask-image:linear-gradient(to_right,transparent_0,black_8px,black_calc(100%-20px),transparent_100%)]",
            )}
          >
            {mappableEvents.map((ev) => (
              <div
                key={ev.slug}
                className="w-[min(78vw,17.5rem)] shrink-0 snap-start"
              >
                <MarketplaceEventCard
                  event={ev}
                  compact
                  selected={ev.slug === selectedEvent?.slug}
                  onSelect={() => setSelectedSlug(ev.slug)}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(240px,300px)_minmax(0,1fr)] xl:grid-cols-[minmax(260px,320px)_minmax(0,1fr)] gap-4 lg:gap-6 items-stretch">
          <div className="hidden lg:flex flex-col gap-2.5 max-h-[520px] overflow-y-auto pr-1 pb-1 scrollbar-hide min-w-0">
            {mappableEvents.map((ev) => (
              <MarketplaceEventCard
                key={ev.slug}
                event={ev}
                compact
                selected={ev.slug === selectedEvent?.slug}
                onSelect={() => setSelectedSlug(ev.slug)}
              />
            ))}
          </div>

          <div
            className="relative min-w-0 w-full rounded-2xl overflow-hidden border border-border/60 bg-card/30 shadow-[inset_0_0_0_1px_rgba(0,229,255,0.04)]"
            style={{ minHeight: mapHeight }}
          >
            {mapReady ? (
              <>
                <EventsMap
                  events={mappableEvents}
                  selectedSlug={selectedEvent?.slug}
                  onSelectEvent={setSelectedSlug}
                  height={mapHeight}
                  className="w-full border-0 rounded-none"
                />
                {selectedEvent ? <MapEventPreview event={selectedEvent} /> : null}
              </>
            ) : (
              <MapShellSkeleton height={mapHeight} />
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

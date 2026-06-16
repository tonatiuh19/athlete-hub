import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { EventListItem } from "@shared/api";
import EventsMap from "@/components/events/EventsMap";
import { Button } from "@/components/ui/button";
import { parseEventLatLng } from "@/lib/leafletSetup";
import { useMediaQuery } from "@/hooks/use-media-query";

interface HomeEventsMapSectionProps {
  events: EventListItem[];
}

const MOBILE_MAP_HEIGHT = 200;
const DESKTOP_MAP_HEIGHT = 520;

function MapSkeleton({ height }: { height: number }) {
  return (
    <div
      className="w-full bg-muted/30 animate-pulse"
      style={{ height }}
      aria-hidden
    />
  );
}

export default function HomeEventsMapSection({ events }: HomeEventsMapSectionProps) {
  const { t } = useTranslation();
  const sectionRef = useRef<HTMLElement>(null);
  const [mapReady, setMapReady] = useState(false);
  const isLg = useMediaQuery("(min-width: 1024px)");

  const mappableEvents = useMemo(
    () => events.filter((ev) => parseEventLatLng(ev) != null),
    [events],
  );

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
      { rootMargin: "120px 0px" },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [mapReady]);

  if (mappableEvents.length === 0) return null;

  const mapHeight = isLg ? DESKTOP_MAP_HEIGHT : MOBILE_MAP_HEIGHT;

  return (
    <section
      ref={sectionRef}
      id="event-map"
      aria-label={t("home.map.sectionLabel")}
      className="px-4 pt-1 pb-6 md:py-10 scroll-mt-[4.5rem]"
    >
      <div className="max-w-7xl mx-auto w-full min-w-0">
        {/* Mobile: header + interactive map */}
        <div className="md:hidden rounded-2xl border border-border/70 bg-card/80 overflow-hidden isolate">
          <div className="flex items-start justify-between gap-3 p-4 pb-3">
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-bold text-foreground leading-tight">
                {t("home.map.mobileTitle")}
              </h2>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                {t("home.map.mobileSubtitle")}
              </p>
            </div>
            <Button
              asChild
              variant="outline"
              size="sm"
              className="shrink-0 rounded-full border-primary/40 text-primary hover:bg-primary/10 h-9 px-3.5 text-xs"
            >
              <Link to="/events?view=map">
                {t("home.map.viewMap")}
                <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </Link>
            </Button>
          </div>

          <div
            className="relative border-t border-border/50 bg-muted/15 overflow-hidden isolate touch-pan-y"
            style={{ height: MOBILE_MAP_HEIGHT }}
          >
            {mapReady ? (
              <EventsMap
                events={mappableEvents}
                height={MOBILE_MAP_HEIGHT}
                className="w-full h-full border-0 rounded-none pointer-events-auto"
                interactive={false}
              />
            ) : (
              <MapSkeleton height={MOBILE_MAP_HEIGHT} />
            )}
          </div>
        </div>

        {/* Desktop: full map section */}
        <div className="hidden md:block">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between mb-4 md:mb-6">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-2">
                {t("home.map.eyebrow")}
              </p>
              <h2 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">
                {t("home.map.title")}
              </h2>
              <p className="text-muted-foreground text-sm md:text-base mt-2 max-w-xl leading-relaxed">
                {t("home.map.subtitle")}
              </p>
            </div>
            <Button asChild variant="outline" size="sm" className="rounded-xl border-border shrink-0">
              <Link to="/events?view=map">
                {t("home.map.exploreAll")}
                <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
              </Link>
            </Button>
          </div>

          <div
            className="relative min-w-0 w-full rounded-2xl overflow-hidden border border-border/60 bg-card/30"
            style={{ minHeight: mapHeight }}
          >
            {mapReady ? (
              <EventsMap
                events={mappableEvents}
                height={mapHeight}
                className="w-full border-0 rounded-none"
              />
            ) : (
              <MapSkeleton height={mapHeight} />
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

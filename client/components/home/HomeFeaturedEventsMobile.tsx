import { Link } from "react-router-dom";
import { ArrowRight, Calendar, MapPin, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import EventCardImage from "@/components/events/EventCardImage";
import { cn } from "@/lib/utils";

const MOBILE_FEATURED_MAX = 5;

export type HomeFeaturedEvent = {
  slug: string;
  title: string;
  location: string;
  date: string;
  category: string;
  sportSlug: string;
  imageUrl: string;
};

function MobileFeaturedCard({ event }: { event: HomeFeaturedEvent }) {
  return (
    <Link
      to={`/events/${event.slug}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-border/70 bg-card/90 shadow-sm active:scale-[0.98] transition-transform"
    >
      <div className="relative h-28 overflow-hidden">
        <EventCardImage
          src={event.imageUrl}
          sportSlug={event.sportSlug}
          sportName={event.category}
          displaySize="card"
          className="h-full w-full"
          imgClassName="group-hover:scale-105 transition-transform duration-500"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent pointer-events-none" />
        <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-background/80 backdrop-blur-sm text-[9px] font-bold uppercase tracking-wide text-primary border border-primary/25">
          {event.category}
        </span>
      </div>
      <div className="p-3 min-w-0">
        <h3 className="text-sm font-bold text-foreground line-clamp-2 leading-snug mb-2">
          {event.title}
        </h3>
        <div className="space-y-1 text-[11px] text-muted-foreground">
          <div className="flex items-center gap-1.5 min-w-0">
            <MapPin className="w-3 h-3 shrink-0 text-primary" />
            <span className="truncate">{event.location}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3 h-3 shrink-0 text-primary" />
            <span>{event.date}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}

function MobileSeeMoreCard({ extraCount }: { extraCount: number }) {
  const { t } = useTranslation();

  return (
    <Link
      to="/events"
      className={cn(
        "group relative flex h-full min-h-[12.75rem] flex-col overflow-hidden rounded-2xl",
        "border border-primary/35 bg-card/90 shadow-sm active:scale-[0.98] transition-transform",
        "hover:border-primary/55 hover:shadow-glow-triboo",
      )}
    >
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/20 via-transparent to-accent/15 opacity-90"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-primary/20 blur-2xl transition-opacity group-hover:opacity-100 opacity-70"
        aria-hidden
      />

      <div className="relative flex flex-1 flex-col items-center justify-center gap-3 p-4 text-center">
        <div className="relative">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-triboo-gradient text-primary-foreground shadow-glow-triboo transition-transform duration-300 group-hover:scale-105">
            <Sparkles className="h-5 w-5" aria-hidden />
          </div>
          <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full border border-primary/40 bg-background text-primary">
            <ArrowRight className="h-3 w-3" aria-hidden />
          </span>
        </div>

        <div className="space-y-1">
          <p className="text-sm font-bold leading-snug text-foreground">
            {t("home.events.seeMoreTitle")}
          </p>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            {extraCount > 0
              ? t("home.events.seeMoreSubtitleWithCount", { count: extraCount })
              : t("home.events.seeMoreSubtitle")}
          </p>
        </div>

        <span className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-primary transition-colors group-hover:bg-triboo-gradient group-hover:text-primary-foreground group-hover:border-transparent">
          {t("home.events.seeMoreCta")}
          <ArrowRight className="h-3 w-3" aria-hidden />
        </span>
      </div>
    </Link>
  );
}

interface HomeFeaturedEventsProps {
  events: HomeFeaturedEvent[];
}

export default function HomeFeaturedEvents({ events }: HomeFeaturedEventsProps) {
  if (events.length === 0) return null;

  const featuredEvents = events.slice(0, MOBILE_FEATURED_MAX);
  const extraCount = Math.max(0, events.length - MOBILE_FEATURED_MAX);

  return (
    <section
      id="events"
      className="md:hidden pt-2 pb-4 px-4 scroll-mt-[4.5rem]"
    >
      <div className="max-w-7xl mx-auto w-full min-w-0">
        <div
          className={cn(
            "flex gap-3 overflow-x-auto overscroll-x-contain scrollbar-hide snap-x snap-mandatory scroll-smooth -mx-1 px-1 pb-1",
            "[mask-image:linear-gradient(to_right,transparent_0,black_8px,black_calc(100%-16px),transparent_100%)]",
          )}
        >
          {featuredEvents.map((event) => (
            <div
              key={event.slug}
              className="w-[min(46vw,11.5rem)] shrink-0 snap-start"
            >
              <MobileFeaturedCard event={event} />
            </div>
          ))}
          <div className="w-[min(46vw,11.5rem)] shrink-0 snap-start">
            <MobileSeeMoreCard extraCount={extraCount} />
          </div>
        </div>
      </div>
    </section>
  );
}

import { useEffect, useMemo, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { useTranslation } from "react-i18next";
import type { EventSponsor, SponsorTier } from "@shared/api";
import { useAppDispatch } from "@/store/hooks";
import { trackSponsorEvent } from "@/store/slices/marketplaceSlice";
import { cn } from "@/lib/utils";

const STRATEGIC_TIERS: SponsorTier[] = ["title", "gold"];
const trackedImpressions = new Set<string>();

interface EventSponsorsCarouselProps {
  sponsors: EventSponsor[];
  eventSlug?: string;
  /** inline = sticky CTA strip; compact = sidebar card */
  variant?: "inline" | "compact";
  className?: string;
}

function tierLabelKey(tier?: string): string | null {
  if (!tier || tier === "partner") return null;
  return `eventDetail.sponsorTier.${tier}`;
}

function SponsorChip({
  sponsor,
  variant,
  eventSlug,
  onClickTrack,
}: {
  sponsor: EventSponsor;
  variant: "inline" | "compact";
  eventSlug?: string;
  onClickTrack?: () => void;
}) {
  const { t } = useTranslation();
  const [failed, setFailed] = useState(false);
  const initials = sponsor.name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
  const isTitle = sponsor.tier === "title";
  const tierKey = tierLabelKey(sponsor.tier);
  const title = tierKey ? `${sponsor.name} · ${t(tierKey)}` : sponsor.name;

  const chip = (
    <div
      title={title}
      className={cn(
        "flex items-center justify-center rounded-md border bg-background/50 backdrop-blur-sm transition-colors shrink-0",
        variant === "inline"
          ? cn(
              "h-8 px-3",
              isTitle ? "border-cyan/35 min-w-[72px]" : "border-border/60 min-w-[56px]",
            )
          : cn(
              "h-10 px-3.5 w-full",
              isTitle ? "border-cyan/30" : "border-border/45",
            ),
      )}
    >
      {sponsor.logo_url && !failed ? (
        <img
          src={sponsor.logo_url}
          alt=""
          className={cn(
            "w-auto object-contain brightness-0 invert opacity-75 hover:opacity-100 transition-opacity",
            variant === "inline"
              ? cn("max-h-[18px] max-w-[64px]", isTitle && "max-h-[20px] max-w-[72px]")
              : "max-h-[22px] max-w-[100px]",
          )}
          loading="lazy"
          onError={() => setFailed(true)}
        />
      ) : (
        <span
          className={cn(
            "font-bold text-muted-foreground",
            variant === "inline" ? "text-[10px]" : "text-xs",
            isTitle && "text-muted-foreground",
          )}
        >
          {initials || sponsor.name.slice(0, 3)}
        </span>
      )}
    </div>
  );

  if (sponsor.website_url) {
    return (
      <a
        href={sponsor.website_url}
        target="_blank"
        rel="noopener noreferrer"
        className="shrink-0 hover:opacity-90 transition-opacity"
        aria-label={title}
        onClick={() => {
          if (eventSlug && sponsor.id) onClickTrack?.();
        }}
      >
        {chip}
      </a>
    );
  }

  return chip;
}

export default function EventSponsorsCarousel({
  sponsors,
  eventSlug,
  variant = "inline",
  className,
}: EventSponsorsCarouselProps) {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();

  const displaySponsors = useMemo(() => {
    const strategic = sponsors.filter((s) => STRATEGIC_TIERS.includes(s.tier as SponsorTier));
    const list = strategic.length > 0 ? strategic : sponsors;
    return [...list].sort((a, b) => a.sort_order - b.sort_order);
  }, [sponsors]);

  useEffect(() => {
    if (!eventSlug) return;
    displaySponsors.forEach((sponsor) => {
      if (!sponsor.id) return;
      const key = `${eventSlug}-${sponsor.id}`;
      if (trackedImpressions.has(key)) return;
      trackedImpressions.add(key);
      dispatch(
        trackSponsorEvent({ slug: eventSlug, sponsorId: sponsor.id, type: "impression" }),
      );
    });
  }, [dispatch, eventSlug, displaySponsors]);

  const trackClick = (sponsorId: number) => {
    if (!eventSlug) return;
    dispatch(trackSponsorEvent({ slug: eventSlug, sponsorId, type: "click" }));
  };

  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop: displaySponsors.length > 3,
    align: "start",
    dragFree: true,
    containScroll: "trimSnaps",
  });

  useEffect(() => {
    if (!emblaApi || displaySponsors.length <= 3) return;
    const timer = setInterval(() => {
      if (emblaApi.canScrollNext()) emblaApi.scrollNext();
      else emblaApi.scrollTo(0);
    }, 4500);
    return () => clearInterval(timer);
  }, [emblaApi, displaySponsors.length]);

  if (displaySponsors.length === 0) return null;

  if (variant === "compact") {
    return (
      <div
        className={cn(
          "p-4 rounded-xl border border-border bg-card/60 space-y-3",
          className,
        )}
        aria-label={t("eventDetail.strategicSponsors")}
      >
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          {t("eventDetail.strategicSponsorsEyebrow")}
        </p>
        <div className="flex flex-wrap gap-2">
          {displaySponsors.map((sponsor) => (
            <div key={`${sponsor.name}-${sponsor.sort_order}`} className="w-[calc(50%-4px)]">
              <SponsorChip
                sponsor={sponsor}
                variant="compact"
                eventSlug={eventSlug}
                onClickTrack={() => sponsor.id && trackClick(sponsor.id)}
              />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn("flex items-center gap-2.5 min-w-0", className)}
      aria-label={t("eventDetail.strategicSponsors")}
    >
      <span className="hidden lg:block text-[9px] font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap shrink-0">
        {t("eventDetail.strategicSponsorsEyebrow")}
      </span>
      <div className="relative flex-1 min-w-0">
        <div className="pointer-events-none absolute inset-y-0 left-0 w-4 bg-gradient-to-r from-background/90 to-transparent z-10" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-4 bg-gradient-to-l from-background/90 to-transparent z-10" />
        <div ref={emblaRef} className="overflow-hidden">
          <div className="flex gap-2">
            {displaySponsors.map((sponsor) => (
              <SponsorChip
                key={`${sponsor.name}-${sponsor.sort_order}`}
                sponsor={sponsor}
                variant="inline"
                eventSlug={eventSlug}
                onClickTrack={() => sponsor.id && trackClick(sponsor.id)}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

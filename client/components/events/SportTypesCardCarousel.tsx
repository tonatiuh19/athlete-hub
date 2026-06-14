import { useEffect, useRef, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { LayoutGrid } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { SportType } from "@shared/api";
import SportKindIcon from "@/components/events/SportKindIcon";
import { getSportCardSurface } from "@/utils/sportKind";
import { cn } from "@/lib/utils";

export type SportTypesCardCarouselMode = "filter" | "navigate";

interface SportTypesCardCarouselProps {
  sportTypes: SportType[];
  mode: SportTypesCardCarouselMode;
  selectedSlug?: string;
  onSelect?: (slug: string) => void;
  showAll?: boolean;
  className?: string;
  cardSize?: "md" | "lg";
}

function SportTypeCardShell({
  selected,
  surfaceClass,
  children,
  className,
}: {
  selected?: boolean;
  surfaceClass: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative flex shrink-0 snap-start flex-col items-center justify-center gap-2 rounded-2xl border p-3",
        "transition-all duration-200 active:scale-[0.97]",
        "shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]",
        surfaceClass,
        selected
          ? "border-primary/50 ring-2 ring-primary/40 shadow-glow-triboo scale-[1.02]"
          : "hover:border-primary/30 hover:shadow-glow-triboo",
        className,
      )}
    >
      <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-t from-background/40 via-transparent to-transparent" />
      <div className="relative z-[1] flex flex-col items-center justify-center gap-2 w-full">
        {children}
      </div>
    </div>
  );
}

export default function SportTypesCardCarousel({
  sportTypes,
  mode,
  selectedSlug = "",
  onSelect,
  showAll = mode === "filter",
  className,
  cardSize = "md",
}: SportTypesCardCarouselProps) {
  const { t } = useTranslation();
  const listRef = useRef<HTMLDivElement>(null);
  const activeSlug = selectedSlug.trim();
  const cardDims = cardSize === "lg" ? "w-[5.75rem] h-[6.75rem] sm:w-24 sm:h-28" : "w-[5.25rem] h-[6.25rem] sm:w-[5.75rem] sm:h-[6.75rem]";

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const active = list.querySelector<HTMLElement>('[data-selected="true"]');
    active?.scrollIntoView({ inline: "nearest", behavior: "smooth", block: "nearest" });
  }, [activeSlug, sportTypes.length]);

  const renderCard = (sport: SportType) => {
    const selected = mode === "filter" && activeSlug === sport.slug;
    const surface = getSportCardSurface(sport.slug, sport.name);
    const content = (
      <SportTypeCardShell selected={selected} surfaceClass={surface} className={cardDims}>
        <SportKindIcon
          sportSlug={sport.slug}
          sportName={sport.name}
          className="w-7 h-7 sm:w-8 sm:h-8 text-primary drop-shadow-sm"
        />
        <span className="text-[10px] sm:text-[11px] font-bold text-foreground text-center leading-tight line-clamp-2 px-0.5">
          {sport.name}
        </span>
      </SportTypeCardShell>
    );

    if (mode === "navigate") {
      return (
        <Link
          key={sport.slug}
          to={`/events?sport=${encodeURIComponent(sport.slug)}`}
          data-selected="false"
          className="shrink-0 snap-start rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          aria-label={t("home.sportTypes.browseSport", { sport: sport.name })}
        >
          {content}
        </Link>
      );
    }

    return (
      <button
        key={sport.slug}
        type="button"
        data-selected={selected ? "true" : "false"}
        aria-pressed={selected}
        onClick={() => onSelect?.(sport.slug)}
        className="shrink-0 snap-start rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
      >
        {content}
      </button>
    );
  };

  const allSportsSurface = getSportCardSurface("default");
  const allSelected = mode === "filter" && !activeSlug;

  return (
    <div
      className={cn("relative min-w-0", className)}
      role="group"
      aria-label={t("eventsBrowse.sportCarouselLabel")}
    >
      <div
        ref={listRef}
        className={cn(
          "flex gap-2.5 sm:gap-3 overflow-x-auto overscroll-x-contain scrollbar-hide snap-x snap-mandatory scroll-smooth py-1 -mx-1 px-1",
          "[mask-image:linear-gradient(to_right,transparent_0,black_10px,black_calc(100%-24px),transparent_100%)]",
        )}
      >
        {showAll ? (
          <button
            type="button"
            data-selected={allSelected ? "true" : "false"}
            aria-pressed={allSelected}
            onClick={() => onSelect?.("")}
            className="shrink-0 snap-start rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          >
            <SportTypeCardShell
              selected={allSelected}
              surfaceClass={allSportsSurface}
              className={cardDims}
            >
              <LayoutGrid className="w-7 h-7 sm:w-8 sm:h-8 text-primary" aria-hidden />
              <span className="text-[10px] sm:text-[11px] font-bold text-foreground text-center leading-tight">
                {t("eventsBrowse.allSports")}
              </span>
            </SportTypeCardShell>
          </button>
        ) : null}
        {sportTypes.map(renderCard)}
      </div>
    </div>
  );
}

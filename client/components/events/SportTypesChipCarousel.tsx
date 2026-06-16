import { Link } from "react-router-dom";
import { LayoutGrid } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { SportType } from "@shared/api";
import SportKindIcon from "@/components/events/SportKindIcon";
import { cn } from "@/lib/utils";

interface SportTypesChipCarouselProps {
  sportTypes: SportType[];
  activeSlug?: string;
  className?: string;
  /** navigate = link to /events; filter = toggle selection in a panel */
  mode?: "navigate" | "filter";
  showAll?: boolean;
  onSelect?: (slug: string) => void;
}

const chipClass = (active: boolean) =>
  cn(
    "inline-flex shrink-0 snap-start items-center gap-2 rounded-full border px-3.5 py-2 text-xs font-semibold transition-all duration-200 active:scale-[0.97]",
    active
      ? "border-primary/60 bg-primary/15 text-primary shadow-glow-triboo"
      : "border-border/70 bg-card/80 text-foreground/90 hover:border-primary/35 hover:bg-primary/5",
  );

export default function SportTypesChipCarousel({
  sportTypes,
  activeSlug = "",
  className,
  mode = "navigate",
  showAll = false,
  onSelect,
}: SportTypesChipCarouselProps) {
  const { t } = useTranslation();

  const renderChip = (sport: SportType) => {
    const active = activeSlug === sport.slug;
    const content = (
      <>
        <SportKindIcon
          sportSlug={sport.slug}
          sportName={sport.name}
          className={cn("w-4 h-4", active ? "text-primary" : "text-muted-foreground")}
        />
        <span className="whitespace-nowrap">{sport.name}</span>
      </>
    );

    if (mode === "filter") {
      return (
        <button
          key={sport.slug}
          type="button"
          onClick={() => onSelect?.(sport.slug)}
          className={chipClass(active)}
          aria-pressed={active}
        >
          {content}
        </button>
      );
    }

    return (
      <Link
        key={sport.slug}
        to={`/events?sport=${encodeURIComponent(sport.slug)}`}
        className={chipClass(active)}
        aria-label={t("home.sportTypes.browseSport", { sport: sport.name })}
        aria-current={active ? "page" : undefined}
      >
        {content}
      </Link>
    );
  };

  return (
    <div
      className={cn("relative min-w-0", className)}
      role="group"
      aria-label={t("home.sportTypes.chipsLabel")}
    >
      <div
        className={cn(
          "flex gap-2 overflow-x-auto overscroll-x-contain scrollbar-hide snap-x snap-mandatory scroll-smooth py-0.5 -mx-1 px-1",
          "[mask-image:linear-gradient(to_right,transparent_0,black_8px,black_calc(100%-20px),transparent_100%)]",
        )}
      >
        {mode === "filter" && showAll ? (
          <button
            type="button"
            onClick={() => onSelect?.("")}
            className={chipClass(!activeSlug)}
            aria-pressed={!activeSlug}
          >
            <LayoutGrid className="w-4 h-4 text-primary" aria-hidden />
            <span className="whitespace-nowrap">{t("eventsBrowse.allSports")}</span>
          </button>
        ) : null}
        {sportTypes.map(renderChip)}
      </div>
    </div>
  );
}

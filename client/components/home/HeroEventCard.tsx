import { useState } from "react";
import { motion } from "framer-motion";
import {
  Calendar,
  Footprints,
  MapPin,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { Link } from "react-router-dom";
import {
  buildEventMediaSrcSet,
  eventMediaSizesAttr,
  optimizeEventMediaUrl,
  type EventMediaDisplaySize,
} from "@/lib/cdn-url";

const MotionLink = motion.create(Link);

export interface HeroEvent {
  title: string;
  location: string;
  date: string;
  distance: string;
  participants: number;
  imageUrl: string;
  accent: "orange" | "red" | "ember";
  slug?: string;
}

const accentMap = {
  orange: {
    bg: "from-primary/25 to-accent/10",
    border: "border-primary/45",
    text: "text-primary",
    glow: "shadow-glow-triboo",
    badge: "bg-triboo-gradient",
  },
  red: {
    bg: "from-accent/25 to-primary/10",
    border: "border-accent/45",
    text: "text-accent",
    glow: "shadow-glow-triboo",
    badge: "bg-triboo-gradient",
  },
  ember: {
    bg: "from-primary/20 to-accent/15",
    border: "border-primary/35",
    text: "text-primary",
    glow: "shadow-glow-triboo",
    badge: "bg-triboo-gradient",
  },
};

const FALLBACK_ICONS: Record<HeroEvent["accent"], LucideIcon> = {
  orange: Footprints,
  red: Footprints,
  ember: Zap,
};

interface HeroEventCardProps {
  event: HeroEvent;
  index: number;
  layout?: "stack" | "carousel" | "poster";
}

function EventImage({
  event,
  accent,
  layout,
}: {
  event: HeroEvent;
  accent: (typeof accentMap)[HeroEvent["accent"]];
  layout: "stack" | "carousel" | "poster";
}) {
  const [failed, setFailed] = useState(false);
  const FallbackIcon = FALLBACK_ICONS[event.accent];
  const displaySize: EventMediaDisplaySize =
    layout === "poster" ? "featured" : "card";
  const imageSrc = optimizeEventMediaUrl(event.imageUrl, displaySize) ?? event.imageUrl;
  const srcSet = buildEventMediaSrcSet(event.imageUrl, displaySize);
  const sizes = eventMediaSizesAttr(displaySize);
  const heightClass =
    layout === "poster"
      ? "h-[260px] sm:h-[280px]"
      : layout === "stack"
        ? "h-[5rem]"
        : "h-[5.75rem]";

  return (
    <div className={`relative shrink-0 overflow-hidden ${layout === "poster" ? "rounded-t-2xl" : "rounded-t-xl"} ${heightClass}`}>
      {!failed ? (
        <img
          src={imageSrc}
          srcSet={srcSet}
          sizes={srcSet ? sizes : undefined}
          alt=""
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
        />
      ) : (
        <div
          className={`w-full h-full bg-gradient-to-br ${accent.bg} flex items-center justify-center`}
        >
          <FallbackIcon className={`w-10 h-10 ${accent.text} opacity-60`} aria-hidden />
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-triboo-black via-triboo-black/40 to-transparent" />
      {layout === "poster" ? (
        <span
          className={`absolute top-3 left-3 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wide text-primary-foreground ${accent.badge}`}
        >
          {event.distance}
        </span>
      ) : null}
    </div>
  );
}

export default function HeroEventCard({
  event,
  index,
  layout = "stack",
}: HeroEventCardProps) {
  const accent = accentMap[event.accent];
  const isPoster = layout === "poster";
  const href = event.slug ? `/events/${event.slug}` : "/events";

  return (
    <MotionLink
      to={href}
      initial={{ opacity: 0, y: 20, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.55, delay: 0.12 + index * 0.1, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -6, scale: 1.02 }}
      className={`group flex flex-col h-full overflow-hidden rounded-2xl bg-triboo-black/80 backdrop-blur-xl border border-white/10 hover:border-primary/55 hover:shadow-glow-triboo-lg transition-all duration-500 ${
        isPoster
          ? "min-h-[360px] sm:min-h-[380px] ring-1 ring-white/5 hover:ring-primary/30"
          : layout === "carousel"
            ? "min-w-[260px] min-h-[220px] sm:min-w-[280px] sm:min-h-[240px] rounded-xl"
            : "min-h-[11.25rem] rounded-xl"
      }`}
    >
      <EventImage event={event} accent={accent} layout={layout} />

      <div
        className={`flex flex-col flex-1 min-h-0 ${
          isPoster ? "p-4 gap-3" : layout === "stack" ? "p-3 gap-2" : "p-4 gap-2.5"
        }`}
      >
        <div className="flex items-start justify-between gap-2 shrink-0">
          <div className="min-w-0 flex-1">
            <h3
              className={`font-bold text-white leading-snug group-hover:text-primary transition-colors ${
                isPoster ? "text-base line-clamp-2" : "text-[13px] sm:text-sm line-clamp-2"
              }`}
            >
              {event.title}
            </h3>
            <p className="flex items-center gap-1 text-[11px] text-muted-foreground mt-1">
              <MapPin className={`w-3 h-3 shrink-0 ${accent.text}`} />
              <span className="truncate">{event.location}</span>
            </p>
          </div>
          {!isPoster ? (
            <div
              className={`w-8 h-8 rounded-lg bg-gradient-to-br ${accent.bg} border ${accent.border} flex items-center justify-center shrink-0`}
            >
              <Zap className={`w-3.5 h-3.5 ${accent.text}`} />
            </div>
          ) : null}
        </div>

        <div className="flex items-center gap-2 text-[11px] text-muted-foreground shrink-0 pt-2 border-t border-border/60 mt-auto">
          <span className="flex items-center gap-1 min-w-0 truncate">
            <Calendar className="w-3 h-3 text-primary shrink-0" />
            <span className="truncate">{event.date}</span>
          </span>
        </div>
      </div>
    </MotionLink>
  );
}

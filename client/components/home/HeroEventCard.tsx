import { useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Calendar,
  Footprints,
  MapPin,
  Users,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

export interface HeroEvent {
  title: string;
  location: string;
  date: string;
  distance: string;
  participants: number;
  imageUrl: string;
  accent: "cyan" | "blue" | "purple";
  slug?: string;
}

const accentMap = {
  cyan: {
    bg: "from-cyan/20 to-blue-electric/10",
    border: "border-cyan/40",
    text: "text-cyan",
    glow: "shadow-[0_0_20px_rgba(0,229,255,0.15)]",
  },
  blue: {
    bg: "from-blue-electric/20 to-cyan/10",
    border: "border-blue-electric/40",
    text: "text-blue-electric",
    glow: "shadow-[0_0_20px_rgba(0,191,255,0.15)]",
  },
  purple: {
    bg: "from-purple-accent/20 to-cyan/10",
    border: "border-purple-accent/40",
    text: "text-purple-accent",
    glow: "shadow-[0_0_20px_rgba(124,77,255,0.15)]",
  },
};

const FALLBACK_ICONS: Record<HeroEvent["accent"], LucideIcon> = {
  cyan: Footprints,
  blue: Footprints,
  purple: Zap,
};

interface HeroEventCardProps {
  event: HeroEvent;
  index: number;
  /** Desktop vertical stack — compact, fixed image height */
  layout?: "stack" | "carousel";
}

function EventImage({
  event,
  accent,
  layout,
}: {
  event: HeroEvent;
  accent: (typeof accentMap)[HeroEvent["accent"]];
  layout: "stack" | "carousel";
}) {
  const [failed, setFailed] = useState(false);
  const FallbackIcon = FALLBACK_ICONS[event.accent];

  return (
    <div
      className={`relative shrink-0 overflow-hidden rounded-t-xl ${
        layout === "stack" ? "h-[5rem]" : "h-[5.75rem]"
      }`}
    >
      {!failed ? (
        <img
          src={event.imageUrl}
          alt=""
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
      ) : (
        <div
          className={`w-full h-full bg-gradient-to-br ${accent.bg} flex items-center justify-center`}
        >
          <FallbackIcon
            className={`w-8 h-8 ${accent.text} opacity-60`}
            aria-hidden
          />
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-surface-dark/95 via-surface-dark/30 to-transparent" />
    </div>
  );
}

export default function HeroEventCard({
  event,
  index,
  layout = "stack",
}: HeroEventCardProps) {
  const { t } = useTranslation();
  const accent = accentMap[event.accent];
  const isStack = layout === "stack";

  return (
    <motion.article
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.15 + index * 0.08 }}
      whileHover={{ y: -3 }}
      className={`group flex flex-col h-full overflow-hidden rounded-xl bg-surface-dark/85 backdrop-blur-md border border-gray-700/50 hover:border-cyan/45 transition-all duration-300 ${accent.glow} hover:shadow-glow-cyan ${
        layout === "carousel"
          ? "min-w-[260px] min-h-[220px] sm:min-w-[280px] sm:min-h-[240px]"
          : "min-h-[11.25rem]"
      }`}
    >
      <EventImage event={event} accent={accent} layout={layout} />

      <div
        className={`flex flex-col flex-1 min-h-0 ${
          isStack ? "p-3 gap-2" : "p-4 gap-2.5"
        }`}
      >
        {/* Title row */}
        <div className="flex items-start justify-between gap-2 shrink-0">
          <div className="min-w-0 flex-1">
            <h3
              className={`font-bold text-white leading-snug group-hover:text-cyan transition-colors ${
                isStack ? "text-[13px] line-clamp-1" : "text-sm line-clamp-2"
              }`}
            >
              {event.title}
            </h3>
            <p className="flex items-center gap-1 text-[11px] text-gray-400 mt-0.5">
              <MapPin className={`w-3 h-3 shrink-0 ${accent.text}`} />
              <span className="truncate">{event.location}</span>
            </p>
          </div>
          <div
            className={`w-8 h-8 rounded-lg bg-gradient-to-br ${accent.bg} border ${accent.border} flex items-center justify-center shrink-0`}
          >
            <Zap className={`w-3.5 h-3.5 ${accent.text}`} />
          </div>
        </div>

        {/* Meta row — date, athletes, distance */}
        <div className="flex items-center gap-2 text-[11px] text-gray-400 shrink-0 pt-1.5 border-t border-gray-700/40">
          <span className="flex items-center gap-1 min-w-0 truncate">
            <Calendar className="w-3 h-3 text-cyan shrink-0" />
            <span className="truncate">{event.date}</span>
          </span>
          <span className="text-gray-600 shrink-0">·</span>
          <span className="flex items-center gap-1 shrink-0">
            <Users className="w-3 h-3" />
            {event.participants.toLocaleString()}
          </span>
          <span className="ml-auto text-gray-200 font-semibold shrink-0 tabular-nums">
            {event.distance}
          </span>
        </div>

        {/* CTA — compact ghost pill */}
        <div className="mt-auto pt-0.5 shrink-0 flex mb-1 justify-end">
          <Link
            to={event.slug ? `/events/${event.slug}` : "/events"}
            className={`group/btn inline-flex items-center gap-1.5 mb-2 rounded-full font-semibold uppercase tracking-wider text-cyan border border-cyan/30 bg-white/[0.03] hover:bg-cyan/10 hover:border-cyan/55 hover:shadow-[0_0_20px_rgba(0,229,255,0.2)] transition-all duration-300 ${
              isStack ? "px-2.5 py-1 text-[9px]" : "px-3 py-1.5 text-[10px]"
            }`}
          >
            <span>{t("home.hero.signUp")}</span>
            <span className="flex items-center justify-center w-4 h-4 rounded-full bg-cyan/15 group-hover/btn:bg-cyan group-hover/btn:text-navy-deep transition-colors duration-300">
              <ArrowRight className="w-2.5 h-2.5 group-hover/btn:translate-x-px transition-transform" />
            </span>
          </Link>
        </div>
      </div>
    </motion.article>
  );
}

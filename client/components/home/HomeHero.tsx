import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import HeroArtOverlay from "./HeroArtOverlay";
import HeroEventCard from "./HeroEventCard";
import HeroSocialProof from "./HeroSocialProof";
import HeroVideoBackground from "./HeroVideoBackground";
import { HERO_TITLE_SENTINEL_ID, HOME_NAV_HEIGHT_PX } from "./homeNavConstants";
import type { HeroEvent } from "./HeroEventCard";

/** Clear fixed navbar + comfortable gap (sync with HOME_NAV_HEIGHT_PX) */
const MOBILE_HERO_PT = `calc(${HOME_NAV_HEIGHT_PX}px + max(1.5rem, env(safe-area-inset-top, 0px) + 0.75rem))`;
const DESKTOP_HERO_PT = `calc(${HOME_NAV_HEIGHT_PX}px + 2rem)`;

const EASE_OUT = [0.22, 1, 0.36, 1] as const;

const contentVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.12, delayChildren: 0.15 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 28, filter: "blur(8px)" },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.75, ease: EASE_OUT },
  },
};

const lineVariants = {
  hidden: { opacity: 0, y: 36, clipPath: "inset(0 0 100% 0)" },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    clipPath: "inset(0 0 0% 0)",
    transition: { duration: 0.85, delay: 0.1 + i * 0.12, ease: EASE_OUT },
  }),
};

const TITLE_LINES = [
  { key: "title1", className: "text-white" },
  { key: "title2", className: "hero-shimmer-text", highlight: true },
  { key: "title3", className: "text-white" },
] as const;

function HeroCopy({
  compact = false,
  activeAthletes = 0,
}: {
  compact?: boolean;
  activeAthletes?: number;
}) {
  const { t } = useTranslation();
  const trustedLabel = t("home.hero.trusted", { count: activeAthletes.toLocaleString() });

  return (
    <motion.div
      variants={contentVariants}
      initial="hidden"
      animate="visible"
      className={`relative z-10 ${compact ? "space-y-3.5 sm:space-y-5" : "space-y-5 md:space-y-8"}`}
    >
      <div className="space-y-1 relative">
        <span
          id={HERO_TITLE_SENTINEL_ID}
          className="absolute top-0 left-0 w-full h-px pointer-events-none"
          aria-hidden
        />
        <h1
          className={
            compact
              ? "text-[1.65rem] leading-[1.1] sm:text-4xl sm:leading-[1.05] font-extrabold tracking-tight"
              : "text-4xl sm:text-5xl lg:text-6xl xl:text-[4.25rem] font-extrabold tracking-tight leading-[1.02]"
          }
        >
          {TITLE_LINES.map((line, i) => (
            <motion.span
              key={line.key}
              custom={i}
              variants={lineVariants}
              initial="hidden"
              animate="visible"
              className={`block ${line.className}`}
            >
              {t(`home.hero.${line.key}`)}
              {"highlight" in line && line.highlight && (
                <motion.span
                  className={`block rounded-full bg-gradient-to-r from-cyan via-blue-electric to-purple-accent/80 origin-left ${
                    compact
                      ? "h-0.5 sm:h-1 mt-1.5 sm:mt-2 max-w-[min(100%,200px)] sm:max-w-[min(100%,280px)]"
                      : "h-1 mt-2 max-w-[min(100%,280px)]"
                  }`}
                  initial={{ scaleX: 0, opacity: 0 }}
                  animate={{ scaleX: 1, opacity: 1 }}
                  transition={{ duration: 1, delay: 0.55, ease: EASE_OUT }}
                />
              )}
            </motion.span>
          ))}
        </h1>
      </div>

      <motion.p
        variants={itemVariants}
        className={
          compact
            ? "text-[13px] leading-relaxed sm:text-base text-gray-300/90 sm:text-gray-300/95 max-w-xl font-light line-clamp-3 sm:line-clamp-none"
            : "text-base md:text-lg text-gray-300/95 max-w-xl leading-relaxed font-light"
        }
      >
        {t("home.hero.description")}
      </motion.p>

      <motion.div
        variants={itemVariants}
        className={`flex flex-col sm:flex-row gap-2.5 sm:gap-4 ${compact ? "pt-0.5 sm:pt-1" : "pt-1"}`}
      >
        <motion.a
          href="/events"
          whileHover={{ scale: 1.03, y: -2 }}
          whileTap={{ scale: 0.98 }}
          className={`group relative overflow-hidden text-center hero-cta-shine font-bold text-navy-deep ${
            compact
              ? "px-5 py-2.5 sm:px-7 sm:py-3.5 rounded-lg sm:rounded-xl text-sm sm:text-base shadow-[0_0_32px_rgba(0,229,255,0.2)] sm:shadow-[0_0_40px_rgba(0,229,255,0.25)]"
              : "px-7 py-3.5 rounded-xl text-base shadow-[0_0_40px_rgba(0,229,255,0.25)]"
          }`}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-cyan via-blue-electric to-cyan bg-[length:200%_100%] group-hover:animate-[hero-shimmer_2s_linear_infinite]" />
          <span className="relative flex items-center justify-center gap-1.5 sm:gap-2">
            {t("home.hero.discoverEvents")}
            <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 group-hover:translate-x-1.5 transition-transform duration-300" />
          </span>
        </motion.a>
      </motion.div>

      <HeroSocialProof
        activeAthletes={activeAthletes}
        trustedLabel={trustedLabel}
        worldwideLabel={t("home.hero.worldwide")}
      />
    </motion.div>
  );
}

function HeroMobileCarousel({ heroEvents }: { heroEvents: HeroEvent[] }) {
  const { t } = useTranslation();

  if (heroEvents.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5, duration: 0.6 }}
      className="mt-5 sm:mt-6"
    >
      <p className="text-[10px] sm:text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2.5">
        {t("home.hero.joinUpcoming")}
      </p>
      <div className="overflow-x-auto overscroll-x-contain snap-x snap-mandatory pb-1 scrollbar-hide -mx-4 px-4">
        <div className="flex gap-3 w-max items-stretch">
          {heroEvents.map((event, idx) => (
            <div
              key={event.title}
              className="w-[min(78vw,280px)] shrink-0 snap-center"
            >
              <HeroEventCard event={event} index={idx} layout="carousel" />
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

export default function HomeHero({
  heroEvents,
  loading = false,
  activeAthletes = 0,
}: {
  heroEvents: HeroEvent[];
  loading?: boolean;
  activeAthletes?: number;
}) {
  const { t } = useTranslation();
  const showCarousel = !loading && heroEvents.length > 0;

  return (
    <section className="relative flex flex-col overflow-hidden min-h-[80vh] lg:min-h-[80dvh]">
      <HeroVideoBackground />

      {/* Mobile — copy flows into carousel; label sits directly above cards */}
      <div
        className="lg:hidden relative z-20 max-w-7xl mx-auto w-full px-4 pb-8"
        style={{ paddingTop: MOBILE_HERO_PT }}
      >
        <HeroCopy compact activeAthletes={activeAthletes} />
        {showCarousel ? <HeroMobileCarousel heroEvents={heroEvents} /> : null}
      </div>

      {/* Desktop — two-column viewport-fit layout */}
      <div
        className="hidden lg:flex relative z-20 flex-1 items-center max-w-7xl mx-auto px-4 md:px-6 w-full pb-10 min-h-[80dvh]"
        style={{ paddingTop: DESKTOP_HERO_PT }}
      >
        <div className={`grid ${showCarousel ? "grid-cols-2" : "grid-cols-1"} gap-12 w-full items-stretch`}>
          <div className="relative flex flex-col justify-center overflow-hidden pl-6 lg:pl-8 min-w-0">
            <HeroArtOverlay />
            <HeroCopy activeAthletes={activeAthletes} />
          </div>

          {showCarousel ? (
          <motion.div
            initial={{ opacity: 0, x: 48, filter: "blur(12px)" }}
            animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
            transition={{ duration: 1, ease: EASE_OUT, delay: 0.25 }}
            className="flex flex-col min-h-0 h-[min(calc(100dvh-9rem),680px)]"
          >
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5 }}
              className="flex items-center gap-2 mb-3 shrink-0"
            >
              <motion.div
                className="w-2.5 h-2.5 bg-cyan rounded-full"
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
              <span className="text-sm font-semibold text-gray-300 tracking-wide uppercase">
                {t("home.hero.joinUpcoming")}
              </span>
            </motion.div>

            <div
              className="grid flex-1 min-h-0 gap-3"
              style={{ gridTemplateRows: "repeat(3, minmax(11.25rem, 1fr))" }}
            >
              {heroEvents.map((event, idx) => (
                <div key={event.slug ?? event.title} className="min-h-0 flex flex-col">
                  <HeroEventCard event={event} index={idx} layout="stack" />
                </div>
              ))}
            </div>

            <motion.a
              href="/events"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.9 }}
              className="inline-flex items-center gap-2 text-cyan hover:text-cyan-light transition-colors mt-4 font-semibold text-sm shrink-0 group"
            >
              {t("home.hero.exploreAll")}
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </motion.a>
          </motion.div>
          ) : null}
        </div>
      </div>

      {/* Scroll indicator — desktop only */}
      <motion.a
        href="#stats"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1, y: [0, 8, 0] }}
        transition={{
          opacity: { delay: 1.2, duration: 0.6 },
          y: { duration: 2.5, repeat: Infinity, ease: "easeInOut" },
        }}
        className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 hidden md:flex flex-col items-center gap-2 text-gray-500 hover:text-cyan transition-colors group"
        aria-label="Scroll down"
      >
        <span className="text-[10px] uppercase tracking-[0.2em] font-medium opacity-60 group-hover:opacity-100">
          Scroll
        </span>
        <span className="w-6 h-10 rounded-full border border-gray-600/80 flex justify-center pt-2 group-hover:border-cyan/60 transition-colors">
          <motion.span
            className="w-1 h-2 rounded-full bg-cyan/80"
            animate={{ y: [0, 6, 0], opacity: [1, 0.3, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
        </span>
      </motion.a>
    </section>
  );
}

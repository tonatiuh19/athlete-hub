import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import HeroSearchBar from "@/components/home/HeroSearchBar";
import HeroVideoBackground from "@/components/home/HeroVideoBackground";
import HeroGlowLayer from "@/components/home/HeroGlowLayer";
import {
  HERO_TITLE_SENTINEL_ID,
  HOME_NAV_HEIGHT_PX,
} from "@/components/home/homeNavConstants";

const HERO_PT = `calc(${HOME_NAV_HEIGHT_PX}px + clamp(1rem, 3vh, 2rem))`;
const EASE = [0.22, 1, 0.36, 1] as const;

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 28 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.75, delay, ease: EASE },
});

export default function HomeHero() {
  const { t } = useTranslation();

  return (
    <section className="relative flex flex-col overflow-x-clip bg-triboo-black">
      <HeroVideoBackground />
      <HeroGlowLayer />

      <div
        className="relative z-20 flex flex-col max-w-7xl mx-auto w-full px-4 md:px-6 pb-8 md:pb-10"
        style={{ paddingTop: HERO_PT }}
      >
        <span
          id={HERO_TITLE_SENTINEL_ID}
          className="absolute top-0 left-0 w-full h-px pointer-events-none"
          aria-hidden
        />

        <div className="flex flex-col max-w-3xl lg:max-w-4xl py-2 md:py-4">
          <motion.h1
            {...fadeUp(0.12)}
            className="font-black uppercase tracking-[-0.02em] leading-[0.9] text-[1.75rem] sm:text-5xl lg:text-[3.75rem] xl:text-[4.25rem]"
          >
            <span className="block text-white drop-shadow-[0_2px_24px_rgba(0,0,0,0.5)]">
              {t("home.hero.title1")}
            </span>
            <span className="block text-white drop-shadow-[0_2px_24px_rgba(0,0,0,0.5)]">
              {t("home.hero.title2")}
            </span>
            <span className="block triboo-shimmer-text mt-1 pb-1">
              {t("home.hero.title3")}
            </span>
          </motion.h1>

          <motion.p
            {...fadeUp(0.22)}
            className="hidden md:block mt-4 md:mt-5 text-sm sm:text-lg text-white/70 max-w-lg leading-relaxed"
          >
            {t("home.hero.description")}
          </motion.p>

          <motion.div {...fadeUp(0.32)} className="relative z-30 mt-5 md:mt-8 w-full min-w-0">
            <HeroSearchBar />
          </motion.div>
        </div>
      </div>

      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-b from-transparent to-triboo-black"
        aria-hidden
      />
    </section>
  );
}

import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { useHomeNavScroll } from "./useHomeNavScroll";

const NAV_SECTIONS = [
  { key: "home.navEvents", href: "/events" },
  { key: "home.navCommunities", href: "/#communities" },
  { key: "home.navLeaderboards", href: "/#leaderboards" },
  { key: "home.navChallenges", href: "/#challenges" },
] as const;

export default function HomeNavbar() {
  const { t } = useTranslation();
  const { solid, scrollProgress } = useHomeNavScroll();

  return (
    <header
      className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-[background-color,box-shadow,border-color,backdrop-filter] duration-500 ease-out",
        solid ? "home-nav-solid" : "home-nav-glass",
      )}
    >
      {/* Scroll progress rail */}
      <div
        className="absolute bottom-0 left-0 h-[2px] bg-gradient-to-r from-cyan via-blue-electric to-purple-accent origin-left transition-opacity duration-300"
        style={{
          width: `${scrollProgress * 100}%`,
          opacity: solid ? 0.9 : 0.35,
        }}
        aria-hidden
      />

      <div className="max-w-7xl mx-auto px-4 md:px-6 h-[4.5rem] flex items-center justify-between gap-3 min-w-0">
        <Link
          to="/"
          className={cn(
            "text-lg sm:text-xl md:text-2xl font-bold text-gradient transition-all duration-300 shrink-0",
            !solid && "drop-shadow-[0_0_24px_rgba(0,229,255,0.35)]",
          )}
        >
          AthleteHub
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          {NAV_SECTIONS.map(({ key, href }) =>
            href.startsWith("/") && !href.includes("#") ? (
              <Link
                key={key}
                to={href}
                className={cn(
                  "home-nav-link relative px-4 py-2 text-sm font-medium rounded-lg transition-colors duration-300",
                  solid
                    ? "text-gray-400 hover:text-cyan hover:bg-cyan/5"
                    : "text-white/75 hover:text-white hover:bg-white/5",
                )}
              >
                {t(key)}
              </Link>
            ) : (
              <a
                key={key}
                href={href}
                className={cn(
                  "home-nav-link relative px-4 py-2 text-sm font-medium rounded-lg transition-colors duration-300",
                  solid
                    ? "text-gray-400 hover:text-cyan hover:bg-cyan/5"
                    : "text-white/75 hover:text-white hover:bg-white/5",
                )}
              >
                {t(key)}
              </a>
            ),
          )}
        </nav>

        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <Link
            to="/login"
            className={cn(
              "text-xs sm:text-sm font-semibold rounded-xl transition-all duration-300 whitespace-nowrap",
              solid
                ? "btn-primary px-3 py-2 sm:px-5 sm:py-2.5"
                : "px-3 py-2 sm:px-5 sm:py-2.5 text-cyan border border-cyan/40 bg-white/[0.06] backdrop-blur-md hover:bg-cyan/15 hover:border-cyan/70 hover:shadow-[0_0_24px_rgba(0,229,255,0.2)]",
            )}
          >
            {t("home.signIn")}
          </Link>
        </div>
      </div>

      {/* Ambient edge glow — glass mode only */}
      <motion.div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-cyan/30 to-transparent"
        animate={{ opacity: solid ? 0 : 1 }}
        transition={{ duration: 0.4 }}
        aria-hidden
      />
    </header>
  );
}

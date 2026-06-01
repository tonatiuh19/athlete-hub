import { useEffect } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchAthleteMe } from "@/store/slices/athleteAuthSlice";
import { useHomeNavScroll } from "./useHomeNavScroll";

const NAV_SECTIONS = [
  { key: "home.navEvents", href: "/events" },
  { key: "home.navCommunities", href: "/#communities" },
  { key: "home.navLeaderboards", href: "/#leaderboards" },
] as const;

function NavUserAvatar({
  firstName,
  lastName,
  avatarUrl,
  solid,
}: {
  firstName: string;
  lastName: string;
  avatarUrl?: string;
  solid: boolean;
}) {
  const initials =
    `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase() || "?";
  const hasAvatar = Boolean(avatarUrl?.trim());

  const avatarShell = cn(
    "h-8 w-8 shrink-0 rounded-full ring-2",
    solid
      ? "ring-cyan/30 ring-offset-2 ring-offset-[hsl(var(--background))]"
      : "ring-white/25 ring-offset-2 ring-offset-transparent shadow-[0_0_16px_rgba(0,229,255,0.35)]",
  );

  if (hasAvatar) {
    return (
      <Avatar className={avatarShell}>
        <AvatarImage src={avatarUrl} alt="" />
        <AvatarFallback
          delayMs={0}
          className="bg-gradient-to-br from-cyan to-blue-electric text-navy-deep text-[11px] font-bold"
        >
          {initials}
        </AvatarFallback>
      </Avatar>
    );
  }

  return (
    <div
      className={cn(
        avatarShell,
        "flex items-center justify-center bg-gradient-to-br from-cyan via-blue-electric to-purple-accent/90 text-navy-deep text-[11px] font-bold tracking-tight",
      )}
      aria-hidden
    >
      {initials}
    </div>
  );
}

export default function HomeNavbar() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const { token, user, loading } = useAppSelector((s) => s.athleteAuth);
  const { solid, scrollProgress } = useHomeNavScroll();

  useEffect(() => {
    if (token && !user) dispatch(fetchAthleteMe());
  }, [token, user, dispatch]);

  const isLoggedIn = Boolean(token && user);

  const authButtonClass = cn(
    "text-xs sm:text-sm font-semibold rounded-xl transition-all duration-300 whitespace-nowrap",
    solid
      ? "btn-primary px-3 py-2 sm:px-5 sm:py-2.5"
      : "px-3 py-2 sm:px-5 sm:py-2.5 text-cyan border border-cyan/40 bg-white/[0.06] backdrop-blur-md hover:bg-cyan/15 hover:border-cyan/70 hover:shadow-[0_0_24px_rgba(0,229,255,0.2)]",
  );

  const portalChipClass = cn(
    "inline-flex items-center gap-2 sm:gap-2.5 rounded-full pl-1 pr-3 sm:pr-4 py-1 text-xs sm:text-sm font-semibold transition-all duration-300 whitespace-nowrap",
    solid
      ? "border border-border bg-surface-dark/90 text-foreground hover:border-cyan/45 hover:bg-cyan/5 hover:shadow-[0_0_20px_rgba(0,229,255,0.12)]"
      : "border border-white/15 bg-white/[0.08] text-white backdrop-blur-md hover:border-cyan/50 hover:bg-white/[0.12] hover:shadow-[0_0_24px_rgba(0,229,255,0.18)]",
  );

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
          {token && !user && loading ? (
            <div
              className="h-9 w-24 sm:w-28 rounded-xl bg-white/10 animate-pulse"
              aria-hidden
            />
          ) : isLoggedIn && user ? (
            <Link
              to="/portal"
              className={portalChipClass}
              title={t("home.myPortal")}
            >
              <NavUserAvatar
                firstName={user.firstName}
                lastName={user.lastName}
                avatarUrl={user.avatarUrl}
                solid={solid}
              />
              <span className="hidden sm:inline max-w-[8rem] truncate">
                {user.firstName}
              </span>
              <span className="sm:hidden">{t("home.myPortalShort")}</span>
            </Link>
          ) : (
            <Link to="/login" className={authButtonClass}>
              {t("home.signIn")}
            </Link>
          )}
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

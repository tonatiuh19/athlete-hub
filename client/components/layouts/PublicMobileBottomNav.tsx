import { NavLink, useLocation } from "react-router-dom";
import { CalendarDays, Home, UserCircle, Users } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { useAppSelector } from "@/store/hooks";

const NAV_ITEMS = [
  { key: "home", to: "/", icon: Home, matchPrefix: false },
  { key: "events", to: "/events", icon: CalendarDays, matchPrefix: true },
  { key: "communities", to: "/communities", icon: Users, matchPrefix: true },
  { key: "profile", to: "/portal", icon: UserCircle, matchPrefix: true, authOnly: true },
  { key: "signIn", to: "/login", icon: UserCircle, matchPrefix: false, guestOnly: true },
] as const;

function isNavActive(pathname: string, to: string, matchPrefix: boolean): boolean {
  if (to === "/") return pathname === "/";
  if (matchPrefix) return pathname === to || pathname.startsWith(`${to}/`);
  return pathname === to;
}

export default function PublicMobileBottomNav() {
  const { t } = useTranslation();
  const location = useLocation();
  const { token, user } = useAppSelector((s) => s.athleteAuth);
  const isLoggedIn = Boolean(token && user);

  const items = NAV_ITEMS.filter((item) => {
    if ("authOnly" in item && item.authOnly) return isLoggedIn;
    if ("guestOnly" in item && item.guestOnly) return !isLoggedIn;
    return !("authOnly" in item) && !("guestOnly" in item);
  });

  return (
    <nav
      className="fixed bottom-4 left-1/2 z-40 flex w-[calc(100%-1.5rem)] max-w-md -translate-x-1/2 items-center justify-between rounded-[1.6rem] border border-white/10 bg-card/90 px-2 py-2 shadow-panel backdrop-blur-xl md:hidden"
      aria-label={t("mobileNav.label")}
    >
      {items.map((item) => {
        const Icon = item.icon;
        const active = isNavActive(location.pathname, item.to, item.matchPrefix);

        return (
          <NavLink
            key={item.key}
            to={item.to}
            className={cn(
              "flex min-w-[4rem] flex-col items-center gap-1 rounded-2xl px-3 py-2 text-[11px] font-medium text-muted-foreground transition",
              active && "bg-primary/15 text-primary",
            )}
          >
            <Icon className="h-4 w-4" />
            <span className="truncate max-w-[4.5rem]">{t(`mobileNav.${item.key}`)}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}

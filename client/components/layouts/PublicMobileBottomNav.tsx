import { NavLink, useLocation } from "react-router-dom";
import { CalendarDays, Home, UserCircle, Users } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  marketplaceSearchGlowClass,
  marketplaceSearchInnerClass,
  marketplaceSearchOuterClass,
} from "@/components/events/marketplaceSearchBarStyles";
import { cn } from "@/lib/utils";
import { useAppSelector } from "@/store/hooks";

const NAV_ROUNDED = "rounded-[1.6rem]";
const NAV_INNER_ROUNDED = "rounded-[calc(1.6rem-1px)]";

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
      className="fixed bottom-4 left-1/2 z-[90] w-[calc(100%-1.5rem)] max-w-md -translate-x-1/2 md:hidden pb-[max(0px,env(safe-area-inset-bottom))] pointer-events-none"
      aria-label={t("mobileNav.label")}
    >
      <div className="relative pointer-events-auto overflow-hidden rounded-[1.6rem]">
        <div
          className={cn(marketplaceSearchGlowClass(false, NAV_ROUNDED), "opacity-60")}
          aria-hidden
        />
        <div className={marketplaceSearchOuterClass(false, NAV_ROUNDED)}>
          <div
            className={cn(
              marketplaceSearchInnerClass(false, NAV_INNER_ROUNDED),
              "min-h-0 justify-between py-2",
            )}
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
          </div>
        </div>
      </div>
    </nav>
  );
}

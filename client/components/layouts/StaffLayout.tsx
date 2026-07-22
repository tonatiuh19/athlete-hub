import { Suspense, useEffect, useState } from "react";
import { Link, NavLink, Navigate, Outlet, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  LogOut,
  Menu,
  X,
  ShieldCheck,
  Building2,
} from "lucide-react";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import ThemeToggle from "@/components/ThemeToggle";
import StaffOrganizerPayoutSetupBanner, {
  useOrganizerPayoutSetupBannerVisible,
} from "@/components/staff/StaffOrganizerPayoutSetupBanner";
import { StaffPageSkeleton } from "@/components/staff/skeletons/StaffSkeletons";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { staffLogout, fetchStaffMe, updateStaffLanguage, updateStaffTheme } from "@/store/slices/staffAuthSlice";
import { getStaffNav } from "@/utils/staffNav";
import { cn } from "@/lib/utils";
import type { AppLocale } from "@shared/i18n";
import { normalizeTheme, type AppTheme } from "@shared/theme";
import { useTheme } from "next-themes";

function StaffPageFallback() {
  return <StaffPageSkeleton variant="default" className="py-4" />;
}

export default function StaffLayout() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { token, user, role } = useAppSelector((s) => s.staffAuth);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { setTheme } = useTheme();

  useEffect(() => {
    // Orphaned token without a stored role never hydrates and used to spin forever.
    if (token && !role) {
      void dispatch(staffLogout());
      return;
    }
    if (token && role && !user) void dispatch(fetchStaffMe(role));
  }, [token, role, user, dispatch]);

  useEffect(() => {
    if (!user?.preferredTheme) return;
    setTheme(normalizeTheme(user.preferredTheme));
  }, [user?.preferredTheme, setTheme]);

  const organizerRole = user?.type === "organizer" ? user.role : undefined;
  const showPayoutSticky = useOrganizerPayoutSetupBannerVisible(organizerRole);

  if (!token) {
    return <Navigate to="/staff/login" replace />;
  }

  // Do not gate on `loading` once we already have a user (e.g. just verified OTP).
  // A hung/in-flight /me would otherwise leave the portal on this spinner forever.
  if (!role || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const isAdmin = role === "admin";
  const NAV = getStaffNav(isAdmin, organizerRole).map((item) => ({
    ...item,
    label: t(item.labelKey),
  }));

  const handleLogout = async () => {
    await dispatch(staffLogout());
    navigate("/staff/login", { replace: true });
  };

  const persistLanguage = (locale: AppLocale) => {
    if (!role) return;
    void dispatch(updateStaffLanguage({ locale, role }));
  };

  const persistTheme = (theme: AppTheme) => {
    if (!role) return;
    void dispatch(updateStaffTheme({ theme, role }));
  };

  const displayName =
    user?.type === "admin" || user?.type === "organizer"
      ? `${user.firstName} ${user.lastName}`
      : "Staff";

  const navLinkClass = (isActive: boolean) =>
    cn(
      "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all",
      isActive
        ? "bg-primary/10 text-primary border border-primary/20"
        : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
    );

  const NavItems = ({ mobile = false }: { mobile?: boolean }) => (
    <>
      {NAV.map(({ to, end, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={() => mobile && setMobileOpen(false)}
          className={({ isActive }) => navLinkClass(isActive)}
        >
          <Icon className="w-5 h-5 shrink-0" />
          {label}
        </NavLink>
      ))}
    </>
  );

  return (
    <div className="min-h-screen bg-background flex overflow-x-clip w-full max-w-full">
      <aside className="hidden lg:flex w-64 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground fixed inset-y-0">
        <div className="p-6 border-b border-sidebar-border">
          <div className="flex items-center gap-2">
            {isAdmin ? (
              <ShieldCheck className="w-7 h-7 text-primary" />
            ) : (
              <Building2 className="w-7 h-7 text-primary" />
            )}
            <div>
              <div className="font-bold text-sm text-sidebar-foreground">{t("staffPortal.nav.console")}</div>
              <div className="text-[10px] text-sidebar-foreground/60 uppercase">
                {isAdmin ? t("staffPortal.nav.admin") : t("staffPortal.nav.organizer")}
              </div>
            </div>
          </div>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {NAV.map(({ to, end, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => navLinkClass(isActive)}
            >
              <Icon className="w-5 h-5" />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="p-4 border-t border-sidebar-border">
          <Link
            to="/staff/profile"
            className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-sidebar-accent transition-colors mb-2 group"
          >
            <div className="w-9 h-9 rounded-xl overflow-hidden bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
              {user?.avatarUrl ? (
                <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-xs font-bold text-primary">
                  {displayName
                    .split(" ")
                    .map((p) => p[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase()}
                </span>
              )}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium truncate text-sidebar-foreground group-hover:text-primary transition-colors">
                {displayName}
              </p>
              <p className="text-[10px] text-sidebar-foreground/60 truncate">{user?.email}</p>
            </div>
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-4 py-2 rounded-xl text-sm text-sidebar-foreground/70 hover:text-destructive"
          >
            <LogOut className="w-4 h-4" /> {t("staffPortal.nav.exit")}
          </button>
        </div>
      </aside>

      <div className="flex-1 lg:ml-64 flex flex-col min-w-0 min-h-screen w-full max-w-full">
        <header className="lg:hidden sticky top-0 z-40 bg-background border-b px-4 h-14 flex items-center justify-between gap-2 min-w-0">
          <span className="font-bold text-sm truncate">{t("staffPortal.nav.console")}</span>
          <div className="flex items-center gap-2 shrink-0">
            <LanguageSwitcher variant="compact" onLanguageChange={persistLanguage} />
            <ThemeToggle variant="compact" onThemeChange={persistTheme} />
            <button
              type="button"
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
            >
              {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </header>

        {mobileOpen && (
          <div className="lg:hidden fixed inset-0 z-50 bg-background/95 backdrop-blur-md p-4 pt-16 overflow-y-auto overscroll-contain">
            <nav className="space-y-1">
              <NavItems mobile />
              <div className="mt-4 pt-4 border-t border-border">
                <Link
                  to="/staff/profile"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-card"
                >
                  <div className="w-9 h-9 rounded-xl overflow-hidden bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                    {user?.avatarUrl ? (
                      <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-xs font-bold text-primary">
                        {displayName
                          .split(" ")
                          .map((p) => p[0])
                          .join("")
                          .slice(0, 2)
                          .toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{displayName}</p>
                    <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                  </div>
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    setMobileOpen(false);
                    handleLogout();
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-muted-foreground hover:text-destructive"
                >
                  <LogOut className="w-5 h-5 shrink-0" /> {t("staffPortal.nav.exit")}
                </button>
              </div>
            </nav>
          </div>
        )}

        <main
          className={cn(
            "flex-1 p-4 md:p-8 min-w-0 w-full max-w-full overflow-x-clip",
            !isAdmin && showPayoutSticky && "pb-24 lg:pb-8",
          )}
        >
          <div className="mx-auto w-full min-w-0 max-w-6xl space-y-6">
            <div className="hidden lg:flex justify-end gap-2">
              <ThemeToggle variant="ghost" onThemeChange={persistTheme} />
              <LanguageSwitcher variant="ghost" onLanguageChange={persistLanguage} />
            </div>
            {!isAdmin ? (
              <StaffOrganizerPayoutSetupBanner
                organizerRole={organizerRole}
                className="hidden lg:block"
              />
            ) : null}
            <Suspense fallback={<StaffPageFallback />}>
              <Outlet />
            </Suspense>
          </div>
        </main>
        {!isAdmin ? (
          <StaffOrganizerPayoutSetupBanner
            organizerRole={organizerRole}
            variant="sticky"
            className="lg:hidden"
          />
        ) : null}
      </div>
    </div>
  );
}

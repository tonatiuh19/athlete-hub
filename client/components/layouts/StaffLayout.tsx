import { ReactNode, useEffect, useState } from "react";
import { Link, NavLink, Navigate, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  LogOut,
  Menu,
  X,
  ShieldCheck,
  Building2,
} from "lucide-react";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { staffLogout, fetchStaffMe } from "@/store/slices/staffAuthSlice";
import { getStaffNav } from "@/utils/staffNav";

export default function StaffLayout({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { token, user, role, loading } = useAppSelector((s) => s.staffAuth);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (token && role && !user) dispatch(fetchStaffMe(role));
  }, [token, role, user, dispatch]);

  if (!token) {
    return <Navigate to="/staff/login" replace />;
  }

  if ((loading && !user) || !role) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-cyan border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const isAdmin = role === "admin";
  const organizerRole = user?.type === "organizer" ? user.role : undefined;
  const NAV = getStaffNav(isAdmin, organizerRole).map((item) => ({
    ...item,
    label: t(item.labelKey),
  }));

  const handleLogout = async () => {
    await dispatch(staffLogout());
    navigate("/staff/login", { replace: true });
  };

  const displayName =
    user?.type === "admin" || user?.type === "organizer"
      ? `${user.firstName} ${user.lastName}`
      : "Staff";

  const NavItems = ({ mobile = false }: { mobile?: boolean }) => (
    <>
      {NAV.map(({ to, end, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={() => mobile && setMobileOpen(false)}
          className={({ isActive }) =>
            `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
              isActive
                ? "bg-cyan/10 text-cyan border border-cyan/20"
                : "text-muted-foreground hover:bg-card"
            }`
          }
        >
          <Icon className="w-5 h-5 shrink-0" />
          {label}
        </NavLink>
      ))}
    </>
  );

  return (
    <div className="min-h-screen bg-background flex overflow-x-clip max-w-[100vw]">
      <aside className="hidden lg:flex w-64 flex-col border-r border-border bg-surface-dark/80 fixed inset-y-0">
        <div className="p-6 border-b border-border">
          <div className="flex items-center gap-2">
            {isAdmin ? (
              <ShieldCheck className="w-7 h-7 text-cyan" />
            ) : (
              <Building2 className="w-7 h-7 text-cyan" />
            )}
            <div>
              <div className="font-bold text-sm">{t("staffPortal.nav.console")}</div>
              <div className="text-[10px] text-muted-foreground uppercase">
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
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? "bg-cyan/10 text-cyan border border-cyan/20"
                    : "text-muted-foreground hover:bg-card"
                }`
              }
            >
              <Icon className="w-5 h-5" />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="p-4 border-t border-border">
          <Link
            to="/staff/profile"
            className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-card transition-colors mb-2 group"
          >
            <div className="w-9 h-9 rounded-xl overflow-hidden bg-cyan/10 border border-cyan/20 flex items-center justify-center shrink-0">
              {user?.avatarUrl ? (
                <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-xs font-bold text-cyan">
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
              <p className="text-sm font-medium truncate group-hover:text-cyan transition-colors">
                {displayName}
              </p>
              <p className="text-[10px] text-muted-foreground truncate">{user?.email}</p>
            </div>
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-4 py-2 rounded-xl text-sm text-muted-foreground hover:text-destructive"
          >
            <LogOut className="w-4 h-4" /> {t("staffPortal.nav.exit")}
          </button>
        </div>
      </aside>

      <div className="flex-1 lg:ml-64 flex flex-col min-w-0 min-h-screen">
        <header className="lg:hidden sticky top-0 z-40 bg-background border-b px-4 h-14 flex items-center justify-between">
          <span className="font-bold text-sm truncate">{t("staffPortal.nav.console")}</span>
          <div className="flex items-center gap-2 shrink-0">
            <LanguageSwitcher variant="compact" />
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
          <div className="lg:hidden fixed inset-0 z-50 bg-background/95 backdrop-blur-md p-4 pt-16 overflow-y-auto">
            <nav className="space-y-1">
              <NavItems mobile />
              <div className="mt-4 pt-4 border-t border-border">
                <Link
                  to="/staff/profile"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-card"
                >
                  <div className="w-9 h-9 rounded-xl overflow-hidden bg-cyan/10 border border-cyan/20 flex items-center justify-center shrink-0">
                    {user?.avatarUrl ? (
                      <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-xs font-bold text-cyan">
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

        <main className="flex-1 p-4 md:p-8 min-w-0">
          <div className="hidden lg:flex justify-end mb-4">
            <LanguageSwitcher variant="ghost" />
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}

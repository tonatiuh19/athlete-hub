import { ReactNode, useEffect, useState } from "react";
import {
  Link,
  NavLink,
  Navigate,
  useNavigate,
  useLocation,
} from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  LayoutDashboard,
  Calendar,
  Trophy,
  User,
  LogOut,
  Menu,
  X,
  QrCode,
  CreditCard,
  Users,
  Medal,
} from "lucide-react";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import TribooLogo from "@/components/brand/TribooLogo";
import EventRegistrationWizard from "@/components/events/registration/EventRegistrationWizard";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { athleteLogout, fetchAthleteMe } from "@/store/slices/athleteAuthSlice";
import { dismissRegistrationWizard } from "@/utils/dismissRegistrationWizard";
import { athleteNeedsProfileCompletion } from "@/utils/athleteProfileCompletion";

export default function AthleteLayout({
  children,
  allowIncompleteProfile = false,
}: {
  children: ReactNode;
  allowIncompleteProfile?: boolean;
}) {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { token, user, loading } = useAppSelector((s) => s.athleteAuth);
  const { open: wizardOpen, step: wizardStep } = useAppSelector(
    (s) => s.registrationCheckout,
  );
  const [mobileOpen, setMobileOpen] = useState(false);

  // Success modal must not follow athletes into the portal.
  useEffect(() => {
    if (
      wizardOpen &&
      wizardStep === "result" &&
      location.pathname.startsWith("/portal")
    ) {
      dismissRegistrationWizard(dispatch);
    }
  }, [dispatch, location.pathname, wizardOpen, wizardStep]);

  const NAV = [
    {
      to: "/portal",
      end: true,
      label: t("athletePortal.nav.home"),
      icon: LayoutDashboard,
    },
    {
      to: "/portal/registrations",
      label: t("athletePortal.nav.registrations"),
      icon: QrCode,
    },
    {
      to: "/portal/events",
      label: t("athletePortal.nav.discover"),
      icon: Calendar,
    },
    {
      to: "/portal/results",
      label: t("athletePortal.nav.results"),
      icon: Trophy,
    },
    { to: "/portal/teams", label: t("athletePortal.nav.teams"), icon: Users },
    {
      to: "/portal/achievements",
      label: t("athletePortal.nav.achievements"),
      icon: Medal,
    },
    {
      to: "/portal/payment-methods",
      label: t("athletePortal.nav.paymentMethods"),
      icon: CreditCard,
    },
    {
      to: "/portal/profile",
      label: t("athletePortal.nav.profile"),
      icon: User,
    },
  ];

  useEffect(() => {
    if (token && !user) dispatch(fetchAthleteMe());
  }, [token, user, dispatch]);

  if (!token) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  if (loading && !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-10 h-10 border-2 border-cyan border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (
    !allowIncompleteProfile &&
    user &&
    athleteNeedsProfileCompletion(user) &&
    location.pathname !== "/portal/complete-profile"
  ) {
    return (
      <Navigate
        to="/portal/complete-profile"
        state={{ from: location.pathname }}
        replace
      />
    );
  }

  const handleLogout = async () => {
    await dispatch(athleteLogout());
    navigate("/login", { replace: true });
  };

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
                ? "bg-cyan/15 text-cyan border border-cyan/25"
                : "text-muted-foreground hover:text-foreground hover:bg-card"
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
    <div className="min-h-screen bg-background flex overflow-x-clip w-full max-w-full">
      <aside className="hidden lg:flex w-64 flex-col border-r border-border bg-card/30 backdrop-blur-sm fixed inset-y-0 left-0 z-30">
        <div className="p-6 border-b border-border space-y-2">
          <TribooLogo
            surface="dark"
            href="/portal"
            className="h-10 w-full max-w-[200px]"
          />
        </div>
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          <NavItems />
        </nav>
        <div className="p-4 border-t border-border">
          <div className="flex items-center gap-3 px-3 py-2 mb-2">
            {user?.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt=""
                className="w-9 h-9 rounded-full object-cover border border-cyan/20"
              />
            ) : (
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-cyan/30 to-purple-accent/30 flex items-center justify-center text-sm font-bold">
                {user?.firstName?.[0] || "A"}
              </div>
            )}
            <div className="min-w-0">
              <div className="text-sm font-medium truncate">
                {user?.firstName} {user?.lastName}
              </div>
              <div className="text-xs text-muted-foreground truncate">
                {user?.email}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
          >
            <LogOut className="w-4 h-4" /> {t("common.signOut")}
          </button>
        </div>
      </aside>

      <div className="flex-1 lg:ml-64 flex flex-col min-h-screen min-w-0 w-full max-w-full">
        <header className="lg:hidden sticky top-0 z-40 bg-background/90 backdrop-blur-md border-b border-border px-4 h-14 flex items-center justify-between gap-2 min-w-0">
          <TribooLogo
            surface="dark"
            href="/portal"
            className="h-8 max-w-[150px]"
          />
          <div className="flex items-center gap-2">
            <LanguageSwitcher variant="compact" />
            <button type="button" onClick={() => setMobileOpen(!mobileOpen)}>
              {mobileOpen ? (
                <X className="w-6 h-6" />
              ) : (
                <Menu className="w-6 h-6" />
              )}
            </button>
          </div>
        </header>

        {mobileOpen && (
          <div className="lg:hidden fixed inset-0 z-50 bg-background/95 backdrop-blur-md p-4 pt-16 overflow-y-auto overscroll-contain">
            <nav className="space-y-1">
              <NavItems mobile />
              <button
                type="button"
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-3 text-destructive"
              >
                <LogOut className="w-5 h-5" /> {t("common.signOut")}
              </button>
            </nav>
          </div>
        )}

        <main className="flex-1 p-4 md:p-8 min-w-0 w-full max-w-full overflow-x-clip">
          <div className="hidden lg:flex justify-end mb-4">
            <LanguageSwitcher variant="ghost" />
          </div>
          {children}
        </main>
      </div>
      <EventRegistrationWizard />
    </div>
  );
}

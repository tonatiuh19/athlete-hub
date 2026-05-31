import "./global.css";
import "@/i18n";

import { Suspense, lazy } from "react";
import { HelmetProvider } from "react-helmet-async";
import { Toaster } from "@/components/ui/toaster";
import { createRoot } from "react-dom/client";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Provider } from "react-redux";
import { ClerkProvider } from "@clerk/clerk-react";
import { store } from "@/store";
import { clerkPublishableKey, isClerkEnabled } from "@/lib/api";
import I18nSync from "@/components/I18nSync";
import { Users, Calendar, BarChart3, Settings } from "lucide-react";

const Index = lazy(() => import("./pages/Index"));
const NotFound = lazy(() => import("./pages/NotFound"));
const AthleteLogin = lazy(() => import("./pages/auth/AthleteLogin"));
const StaffLogin = lazy(() => import("./pages/auth/StaffLogin"));
const SsoCallback = lazy(() => import("./pages/auth/SsoCallback"));
const AthleteLayout = lazy(() => import("./components/layouts/AthleteLayout"));
const StaffLayout = lazy(() => import("./components/layouts/StaffLayout"));
const AthleteDashboard = lazy(() => import("./pages/athlete/Dashboard"));
const AthleteRegistrations = lazy(() => import("./pages/athlete/Registrations"));
const AthleteEvents = lazy(() => import("./pages/athlete/Events"));
const AthleteResults = lazy(() => import("./pages/athlete/Results"));
const AthleteProfile = lazy(() => import("./pages/athlete/Profile"));
const StaffDashboard = lazy(() => import("./pages/staff/Dashboard"));
const StaffPlaceholder = lazy(() => import("./pages/staff/Placeholder"));
const EventsBrowse = lazy(() => import("./pages/events/EventsBrowse"));
const EventDetail = lazy(() => import("./pages/events/EventDetail"));
const PublicEventsLayout = lazy(
  () => import("./components/layouts/PublicEventsLayout"),
);

const queryClient = new QueryClient();

function RouteFallback() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );
}

function AppRoutes() {
  return (
    <BrowserRouter>
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/login" element={<AthleteLogin />} />
          <Route path="/staff/login" element={<StaffLogin />} />
          <Route path="/sso-callback" element={<SsoCallback />} />

          <Route element={<PublicEventsLayout />}>
            <Route path="/events" element={<EventsBrowse />} />
            <Route path="/events/:slug" element={<EventDetail />} />
          </Route>

          <Route
            path="/portal"
            element={
              <AthleteLayout>
                <AthleteDashboard />
              </AthleteLayout>
            }
          />
          <Route
            path="/portal/registrations"
            element={
              <AthleteLayout>
                <AthleteRegistrations />
              </AthleteLayout>
            }
          />
          <Route
            path="/portal/events"
            element={
              <AthleteLayout>
                <AthleteEvents />
              </AthleteLayout>
            }
          />
          <Route
            path="/portal/results"
            element={
              <AthleteLayout>
                <AthleteResults />
              </AthleteLayout>
            }
          />
          <Route
            path="/portal/profile"
            element={
              <AthleteLayout>
                <AthleteProfile />
              </AthleteLayout>
            }
          />

          <Route
            path="/staff"
            element={
              <StaffLayout>
                <StaffDashboard />
              </StaffLayout>
            }
          />
          <Route
            path="/staff/athletes"
            element={
              <StaffLayout>
                <StaffPlaceholder
                  titleKey="staffPortal.placeholder.athletesTitle"
                  descKey="staffPortal.placeholder.athletesDesc"
                  icon={Users}
                />
              </StaffLayout>
            }
          />
          <Route
            path="/staff/events"
            element={
              <StaffLayout>
                <StaffPlaceholder
                  titleKey="staffPortal.placeholder.eventsTitle"
                  descKey="staffPortal.placeholder.eventsDesc"
                  icon={Calendar}
                />
              </StaffLayout>
            }
          />
          <Route
            path="/staff/registrations"
            element={
              <StaffLayout>
                <StaffPlaceholder
                  titleKey="staffPortal.placeholder.registrationsTitle"
                  descKey="staffPortal.placeholder.registrationsDesc"
                  icon={Users}
                />
              </StaffLayout>
            }
          />
          <Route
            path="/staff/analytics"
            element={
              <StaffLayout>
                <StaffPlaceholder
                  titleKey="staffPortal.placeholder.analyticsTitle"
                  descKey="staffPortal.placeholder.analyticsDesc"
                  icon={BarChart3}
                />
              </StaffLayout>
            }
          />
          <Route
            path="/staff/settings"
            element={
              <StaffLayout>
                <StaffPlaceholder
                  titleKey="staffPortal.placeholder.settingsTitle"
                  descKey="staffPortal.placeholder.settingsDesc"
                  icon={Settings}
                />
              </StaffLayout>
            }
          />

          <Route path="/admin/login" element={<Navigate to="/staff/login" replace />} />
          <Route path="/admin" element={<Navigate to="/staff" replace />} />

          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

const App = () => {
  const tree = (
    <HelmetProvider>
      <Provider store={store}>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <I18nSync />
            <AppRoutes />
          </TooltipProvider>
        </QueryClientProvider>
      </Provider>
    </HelmetProvider>
  );

  if (isClerkEnabled) {
    return (
      <ClerkProvider publishableKey={clerkPublishableKey} afterSignOutUrl="/">
        {tree}
      </ClerkProvider>
    );
  }

  return tree;
};

createRoot(document.getElementById("root")!).render(<App />);

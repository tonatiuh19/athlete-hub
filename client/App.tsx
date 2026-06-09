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
import { store } from "@/store";
import { isClerkEnabled } from "@/lib/api";
import ClerkRouterProvider from "@/components/auth/ClerkRouterProvider";
import I18nSync from "@/components/I18nSync";
import ScrollToTop from "@/components/ScrollToTop";
import RegistrationPaymentReturnHandler from "@/components/events/registration/RegistrationPaymentReturnHandler";

const Index = lazy(() => import("./pages/Index"));
const NotFound = lazy(() => import("./pages/NotFound"));
const AthleteLogin = lazy(() => import("./pages/auth/AthleteLogin"));
const AthleteResetPassword = lazy(() => import("./pages/auth/AthleteResetPassword"));
const StaffLogin = lazy(() => import("./pages/auth/StaffLogin"));
const SsoCallback = lazy(() => import("./pages/auth/SsoCallback"));
const AthleteLayout = lazy(() => import("./components/layouts/AthleteLayout"));
const StaffLayout = lazy(() => import("./components/layouts/StaffLayout"));
const AthleteDashboard = lazy(() => import("./pages/athlete/Dashboard"));
const AthleteRegistrations = lazy(() => import("./pages/athlete/Registrations"));
const AthleteEvents = lazy(() => import("./pages/athlete/Events"));
const AthleteResults = lazy(() => import("./pages/athlete/Results"));
const AthleteProfile = lazy(() => import("./pages/athlete/Profile"));
const CompleteProfile = lazy(() => import("./pages/athlete/CompleteProfile"));
const AthletePaymentMethods = lazy(() => import("./pages/athlete/PaymentMethods"));
const AthleteTeams = lazy(() => import("./pages/athlete/Teams"));
const AthleteAchievements = lazy(() => import("./pages/athlete/Achievements"));
const StaffDashboard = lazy(() => import("./pages/staff/Dashboard"));
const StaffAthletes = lazy(() => import("./pages/staff/Athletes"));
const StaffPeople = lazy(() => import("./pages/staff/People"));
const StaffPayments = lazy(() => import("./pages/staff/Payments"));
const StaffEvents = lazy(() => import("./pages/staff/Events"));
const AdminCreateEvent = lazy(() => import("./pages/staff/AdminCreateEvent"));
const StaffBlogPosts = lazy(() => import("./pages/staff/BlogPosts"));
const StaffBlogEditor = lazy(() => import("./pages/staff/BlogEditor"));
const StaffEventEdit = lazy(() => import("./pages/staff/EventEdit"));
const StaffEventHub = lazy(() => import("./pages/staff/EventHub"));
const StaffEventResults = lazy(() => import("./pages/staff/EventResults"));
const StaffTeam = lazy(() => import("./pages/staff/Team"));
const StaffAnalytics = lazy(() => import("./pages/staff/Analytics"));
const StaffRegistrations = lazy(() => import("./pages/staff/Registrations"));
const StaffProfile = lazy(() => import("./pages/staff/Profile"));
const StaffMessaging = lazy(() => import("./pages/staff/Messaging"));
const EventsBrowse = lazy(() => import("./pages/events/EventsBrowse"));
const EventDetail = lazy(() => import("./pages/events/EventDetail"));
const BlogIndex = lazy(() => import("./pages/blog/BlogIndex"));
const BlogPost = lazy(() => import("./pages/blog/BlogPost"));
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
  const routes = (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/login" element={<AthleteLogin />} />
          <Route path="/login/reset" element={<AthleteResetPassword />} />
          <Route path="/staff/login" element={<StaffLogin />} />
          <Route path="/sso-callback" element={<SsoCallback />} />

          <Route element={<PublicEventsLayout />}>
            <Route path="/events" element={<EventsBrowse />} />
            <Route path="/events/:slug" element={<EventDetail />} />
          </Route>

          <Route path="/blog" element={<BlogIndex />} />
          <Route path="/blog/:slug" element={<BlogPost />} />

          <Route
            path="/portal/complete-profile"
            element={
              <AthleteLayout allowIncompleteProfile>
                <CompleteProfile />
              </AthleteLayout>
            }
          />
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
            path="/portal/payment-methods"
            element={
              <AthleteLayout>
                <AthletePaymentMethods />
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
            path="/portal/teams"
            element={
              <AthleteLayout>
                <AthleteTeams />
              </AthleteLayout>
            }
          />
          <Route
            path="/portal/achievements"
            element={
              <AthleteLayout>
                <AthleteAchievements />
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
                <StaffAthletes />
              </StaffLayout>
            }
          />
          <Route
            path="/staff/people"
            element={
              <StaffLayout>
                <StaffPeople />
              </StaffLayout>
            }
          />
          <Route
            path="/staff/payments"
            element={
              <StaffLayout>
                <StaffPayments />
              </StaffLayout>
            }
          />
          <Route
            path="/staff/events"
            element={
              <StaffLayout>
                <StaffEvents />
              </StaffLayout>
            }
          />
          <Route
            path="/staff/blog"
            element={
              <StaffLayout>
                <StaffBlogPosts />
              </StaffLayout>
            }
          />
          <Route
            path="/staff/blog/new"
            element={
              <StaffLayout>
                <StaffBlogEditor />
              </StaffLayout>
            }
          />
          <Route
            path="/staff/blog/:postId/edit"
            element={
              <StaffLayout>
                <StaffBlogEditor />
              </StaffLayout>
            }
          />
          <Route
            path="/staff/events/create"
            element={
              <StaffLayout>
                <AdminCreateEvent />
              </StaffLayout>
            }
          />
          <Route
            path="/staff/events/new"
            element={
              <StaffLayout>
                <StaffEventEdit />
              </StaffLayout>
            }
          />
          <Route
            path="/staff/events/:eventId"
            element={
              <StaffLayout>
                <StaffEventHub />
              </StaffLayout>
            }
          />
          <Route
            path="/staff/events/:eventId/edit"
            element={
              <StaffLayout>
                <StaffEventEdit />
              </StaffLayout>
            }
          />
          <Route
            path="/staff/events/:eventId/results"
            element={
              <StaffLayout>
                <StaffEventResults />
              </StaffLayout>
            }
          />
          <Route
            path="/staff/team"
            element={
              <StaffLayout>
                <StaffTeam />
              </StaffLayout>
            }
          />
          <Route
            path="/staff/registrations"
            element={
              <StaffLayout>
                <StaffRegistrations />
              </StaffLayout>
            }
          />
          <Route
            path="/staff/analytics"
            element={
              <StaffLayout>
                <StaffAnalytics />
              </StaffLayout>
            }
          />
          <Route
            path="/staff/profile"
            element={
              <StaffLayout>
                <StaffProfile />
              </StaffLayout>
            }
          />
          <Route
            path="/staff/settings"
            element={
              <StaffLayout>
                <StaffProfile />
              </StaffLayout>
            }
          />
          <Route
            path="/staff/messaging"
            element={
              <StaffLayout>
                <StaffMessaging />
              </StaffLayout>
            }
          />

          <Route path="/admin/login" element={<Navigate to="/staff/login" replace />} />
          <Route path="/admin" element={<Navigate to="/staff" replace />} />

          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
  );

  if (isClerkEnabled) {
    return (
      <BrowserRouter>
        <ScrollToTop />
        <ClerkRouterProvider>
          <RegistrationPaymentReturnHandler />
          {routes}
        </ClerkRouterProvider>
      </BrowserRouter>
    );
  }

  return (
    <BrowserRouter>
      <ScrollToTop />
      <RegistrationPaymentReturnHandler />
      {routes}
    </BrowserRouter>
  );
}

const App = () => (
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

createRoot(document.getElementById("root")!).render(<App />);

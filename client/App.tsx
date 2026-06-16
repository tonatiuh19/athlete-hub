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
import AppMobileTabBar from "@/components/layouts/AppMobileTabBar";
import RegistrationPaymentReturnHandler from "@/components/events/registration/RegistrationPaymentReturnHandler";
import StaffLayout from "@/components/layouts/StaffLayout";
import AthleteLayout from "@/components/layouts/AthleteLayout";

const Index = lazy(() => import("./pages/Index"));
const NotFound = lazy(() => import("./pages/NotFound"));
const AthleteLogin = lazy(() => import("./pages/auth/AthleteLogin"));
const AthleteResetPassword = lazy(() => import("./pages/auth/AthleteResetPassword"));
const StaffLogin = lazy(() => import("./pages/auth/StaffLogin"));
const SsoCallback = lazy(() => import("./pages/auth/SsoCallback"));
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
const StaffPayouts = lazy(() => import("./pages/staff/Payouts"));
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
const CommunitiesBrowse = lazy(() => import("./pages/communities/CommunitiesBrowse"));
const CommunityDetail = lazy(() => import("./pages/communities/CommunityDetail"));
const BlogIndex = lazy(() => import("./pages/blog/BlogIndex"));
const BlogPost = lazy(() => import("./pages/blog/BlogPost"));
const PublicSiteLayout = lazy(
  () => import("./components/layouts/PublicSiteLayout"),
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
    <>
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route element={<PublicSiteLayout />}>
            <Route path="/" element={<Index />} />
            <Route path="/events" element={<EventsBrowse />} />
            <Route path="/events/:slug" element={<EventDetail />} />
            <Route path="/communities" element={<CommunitiesBrowse />} />
            <Route path="/communities/:slug" element={<CommunityDetail />} />
            <Route path="/blog" element={<BlogIndex />} />
            <Route path="/blog/:slug" element={<BlogPost />} />
          </Route>

          <Route path="/login" element={<AthleteLogin />} />
          <Route path="/login/reset" element={<AthleteResetPassword />} />
          <Route path="/staff/login" element={<StaffLogin />} />
          <Route path="/sso-callback" element={<SsoCallback />} />

          <Route path="/portal" element={<AthleteLayout />}>
            <Route
              path="complete-profile"
              element={<CompleteProfile />}
              handle={{ allowIncompleteProfile: true }}
            />
            <Route index element={<AthleteDashboard />} />
            <Route path="registrations" element={<AthleteRegistrations />} />
            <Route path="events" element={<AthleteEvents />} />
            <Route path="results" element={<AthleteResults />} />
            <Route path="payment-methods" element={<AthletePaymentMethods />} />
            <Route path="profile" element={<AthleteProfile />} />
            <Route path="teams" element={<AthleteTeams />} />
            <Route path="achievements" element={<AthleteAchievements />} />
          </Route>

          <Route path="/staff" element={<StaffLayout />}>
            <Route index element={<StaffDashboard />} />
            <Route path="athletes" element={<StaffAthletes />} />
            <Route path="people" element={<StaffPeople />} />
            <Route path="payments" element={<StaffPayments />} />
            <Route path="payouts" element={<StaffPayouts />} />
            <Route path="events" element={<StaffEvents />} />
            <Route path="blog" element={<StaffBlogPosts />} />
            <Route path="blog/new" element={<StaffBlogEditor />} />
            <Route path="blog/:postId/edit" element={<StaffBlogEditor />} />
            <Route path="events/create" element={<AdminCreateEvent />} />
            <Route path="events/new" element={<StaffEventEdit />} />
            <Route path="events/:eventId" element={<StaffEventHub />} />
            <Route path="events/:eventId/edit" element={<StaffEventEdit />} />
            <Route path="events/:eventId/results" element={<StaffEventResults />} />
            <Route path="team" element={<StaffTeam />} />
            <Route path="registrations" element={<StaffRegistrations />} />
            <Route path="analytics" element={<StaffAnalytics />} />
            <Route path="profile" element={<StaffProfile />} />
            <Route path="settings" element={<StaffProfile />} />
            <Route path="messaging" element={<StaffMessaging />} />
          </Route>

          <Route path="/admin/login" element={<Navigate to="/staff/login" replace />} />
          <Route path="/admin" element={<Navigate to="/staff" replace />} />

          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
      <AppMobileTabBar />
    </>
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

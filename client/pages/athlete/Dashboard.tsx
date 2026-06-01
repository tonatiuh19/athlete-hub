import { useEffect } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import MetaHelmet from "@/components/MetaHelmet";
import PortalErrorAlert from "@/components/athlete/PortalErrorAlert";
import {
  Calendar,
  ChevronRight,
  Flame,
  MapPin,
  QrCode,
  Trophy,
  Zap,
} from "lucide-react";
import { format } from "date-fns";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  fetchAthleteRegistrations,
  fetchAthleteResults,
  fetchMarketplaceEvents,
} from "@/store/slices/athletePortalSlice";
import { getDateFnsLocale } from "@/utils/dateLocale";

export default function AthleteDashboard() {
  const { t, i18n } = useTranslation();
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((s) => s.athleteAuth);
  const {
    registrations,
    upcomingEvents,
    results,
    loadingRegistrations,
    registrationsError,
    eventsError,
  } = useAppSelector((s) => s.athletePortal);

  const quotes = [
    t("athletePortal.dashboard.quote1"),
    t("athletePortal.dashboard.quote2"),
    t("athletePortal.dashboard.quote3"),
  ];
  const quote = quotes[new Date().getDate() % quotes.length];
  const dateLocale = getDateFnsLocale(i18n.language);

  useEffect(() => {
    dispatch(fetchAthleteRegistrations());
    dispatch(fetchMarketplaceEvents());
    dispatch(fetchAthleteResults());
  }, [dispatch]);

  const confirmed = registrations.filter((r) => r.status === "confirmed");
  const nextReg = confirmed[0];
  const completedCount = results.filter((r) => r.status === "finished").length;

  const loadDashboard = () => {
    dispatch(fetchAthleteRegistrations());
    dispatch(fetchMarketplaceEvents());
    dispatch(fetchAthleteResults());
  };

  const dashboardError = registrationsError || eventsError;

  return (
    <div className="max-w-6xl mx-auto space-y-8 min-w-0">
      <MetaHelmet
        title={t("athletePortal.nav.home")}
        description={t("athletePortal.dashboard.activeRegs", {
          count: confirmed.length,
        })}
      />
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl border border-cyan/20 bg-gradient-to-br from-cyan/10 via-card to-purple-accent/10 p-6 md:p-8"
      >
        <div className="absolute top-0 right-0 w-64 h-64 bg-cyan/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="relative">
          <div className="flex items-center gap-2 text-cyan text-sm font-medium mb-2">
            <Flame className="w-4 h-4" />
            {quote}
          </div>
          <h1 className="text-3xl md:text-4xl font-bold mb-1">
            {t("athletePortal.dashboard.greeting", { name: user?.firstName })}
          </h1>
          <p className="text-muted-foreground max-w-xl">
            {t("athletePortal.dashboard.activeRegs", {
              count: confirmed.length,
            })}
          </p>
        </div>
      </motion.div>

      <PortalErrorAlert error={dashboardError} onRetry={loadDashboard} />

      <div className="grid md:grid-cols-3 gap-4">
        {[
          {
            label: t("athletePortal.dashboard.statRegistrations"),
            value: confirmed.length,
            icon: QrCode,
            color: "text-cyan",
          },
          {
            label: t("athletePortal.dashboard.statUpcoming"),
            value: upcomingEvents.length,
            icon: Calendar,
            color: "text-blue-electric",
          },
          {
            label: t("athletePortal.dashboard.statCompleted"),
            value: completedCount,
            icon: Trophy,
            color: "text-success",
          },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="card-sport p-5 flex items-center gap-4">
            <div className={`p-3 rounded-xl bg-card ${color}`}>
              <Icon className="w-6 h-6" />
            </div>
            <div>
              <div className="text-2xl font-bold">{value}</div>
              <div className="text-sm text-muted-foreground">{label}</div>
            </div>
          </div>
        ))}
      </div>

      {nextReg && (
        <section className="card-sport p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <span className="text-xs font-semibold text-cyan uppercase tracking-wider">
                {t("athletePortal.dashboard.nextEvent")}
              </span>
              <h2 className="text-xl font-bold mt-1">{nextReg.event_title}</h2>
              <p className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
                <MapPin className="w-4 h-4" />
                {nextReg.category_name} · #{nextReg.registration_number}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {format(new Date(nextReg.start_date), "d MMMM yyyy", {
                  locale: dateLocale,
                })}
              </p>
            </div>
            <Link
              to={`/portal/registrations?qr=${nextReg.id}`}
              className="btn-primary rounded-xl inline-flex items-center gap-2 text-sm shrink-0"
            >
              <QrCode className="w-4 h-4" />
              {t("athletePortal.dashboard.viewQr")}
            </Link>
          </div>
        </section>
      )}

      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Zap className="w-5 h-5 text-cyan" />
            {t("athletePortal.dashboard.discoverTitle")}
          </h2>
          <Link
            to="/portal/events"
            className="text-sm text-cyan hover:underline flex items-center gap-1"
          >
            {t("athletePortal.dashboard.viewAll")}
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
        {eventsError ? null : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {upcomingEvents.slice(0, 3).map((ev) => (
              <Link
                key={ev.id}
                to={`/events/${ev.slug}`}
                className="card-sport group overflow-hidden"
              >
                {ev.hero_image_url && (
                  <div className="aspect-video overflow-hidden">
                    <img
                      src={ev.hero_image_url}
                      alt=""
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  </div>
                )}
                <div className="p-4">
                  <span className="text-[10px] uppercase tracking-wider text-cyan">
                    {ev.sport_name}
                  </span>
                  <h3 className="font-semibold mt-1 line-clamp-2">{ev.title}</h3>
                  <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    {ev.location_city}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {loadingRegistrations && confirmed.length === 0 && (
        <p className="text-center text-muted-foreground text-sm">
          {t("athletePortal.dashboard.loadingRegs")}
        </p>
      )}
    </div>
  );
}

import { useEffect } from "react";
import { Link } from "react-router-dom";
import { MapPin, Users } from "lucide-react";
import { useTranslation } from "react-i18next";
import MetaHelmet from "@/components/MetaHelmet";
import PortalErrorAlert from "@/components/athlete/PortalErrorAlert";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchMarketplaceEvents } from "@/store/slices/athletePortalSlice";
import { getNumberLocale } from "@/utils/dateLocale";

export default function AthleteEvents() {
  const { t, i18n } = useTranslation();
  const dispatch = useAppDispatch();
  const { upcomingEvents, loadingEvents, eventsError } = useAppSelector(
    (s) => s.athletePortal,
  );
  const numLocale = getNumberLocale(i18n.language);

  useEffect(() => {
    dispatch(fetchMarketplaceEvents());
  }, [dispatch]);

  return (
    <div className="max-w-6xl mx-auto w-full min-w-0 overflow-x-clip space-y-6">
      <MetaHelmet
        title={t("athletePortal.events.title")}
        description={t("athletePortal.events.subtitle")}
      />
      <div>
        <h1 className="text-2xl font-bold">{t("athletePortal.events.title")}</h1>
        <p className="text-muted-foreground text-sm">
          {t("athletePortal.events.subtitle")}
        </p>
      </div>

      <PortalErrorAlert
        error={eventsError}
        onRetry={() => dispatch(fetchMarketplaceEvents())}
      />

      {loadingEvents ? (
        <p className="text-muted-foreground">{t("athletePortal.events.loading")}</p>
      ) : eventsError ? null : upcomingEvents.length === 0 ? (
        <div className="card-sport p-8 text-center text-muted-foreground">
          {t("athletePortal.events.subtitle")}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {upcomingEvents.map((ev) => (
            <Link
              key={ev.id}
              to={`/events/${ev.slug}`}
              className="card-sport group overflow-hidden hover:shadow-glow-cyan transition-shadow"
            >
              <div className="aspect-[16/10] bg-surface-dark overflow-hidden relative">
                {ev.hero_image_url ? (
                  <img
                    src={ev.hero_image_url}
                    alt=""
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-cyan/20 to-purple-accent/20" />
                )}
                {ev.featured ? (
                  <span className="absolute top-3 left-3 px-2 py-0.5 rounded-full bg-cyan text-navy-deep text-[10px] font-bold uppercase">
                    {t("athletePortal.events.featured")}
                  </span>
                ) : null}
              </div>
              <div className="p-4">
                <span className="text-xs text-cyan font-medium">{ev.sport_name}</span>
                <h3 className="font-bold mt-1 line-clamp-2">{ev.title}</h3>
                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-2">
                  <MapPin className="w-3.5 h-3.5" />
                  {ev.location_city}
                </div>
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Users className="w-3.5 h-3.5" />
                    {ev.registration_count} {t("athletePortal.events.registered")}
                  </span>
                  {ev.from_price_cents != null && (
                    <span className="text-sm font-bold text-cyan">
                      {t("athletePortal.events.fromPrice", {
                        price: (ev.from_price_cents / 100).toLocaleString(numLocale),
                      })}
                    </span>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

import { useEffect } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { Calendar, QrCode } from "lucide-react";
import { useTranslation } from "react-i18next";
import MetaHelmet from "@/components/MetaHelmet";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchAthleteRegistrations } from "@/store/slices/athletePortalSlice";
import { Badge } from "@/components/ui/badge";
import { getDateFnsLocale, getNumberLocale } from "@/utils/dateLocale";

export default function AthleteRegistrations() {
  const { t, i18n } = useTranslation();
  const dispatch = useAppDispatch();
  const { registrations, loadingRegistrations } = useAppSelector(
    (s) => s.athletePortal,
  );
  const dateLocale = getDateFnsLocale(i18n.language);
  const numLocale = getNumberLocale(i18n.language);

  useEffect(() => {
    dispatch(fetchAthleteRegistrations());
  }, [dispatch]);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <MetaHelmet
        title={t("athletePortal.registrations.title")}
        description={t("athletePortal.registrations.subtitle")}
      />
      <div>
        <h1 className="text-2xl font-bold">{t("athletePortal.registrations.title")}</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {t("athletePortal.registrations.subtitle")}
        </p>
      </div>

      {loadingRegistrations ? (
        <div className="text-center py-12 text-muted-foreground">
          {t("common.loading")}
        </div>
      ) : registrations.length === 0 ? (
        <div className="card-sport p-8 text-center">
          <p className="text-muted-foreground mb-4">
            {t("athletePortal.registrations.empty")}
          </p>
          <Link to="/portal/events" className="btn-primary rounded-xl inline-block">
            {t("athletePortal.registrations.explore")}
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {registrations.map((r) => (
            <div
              key={r.id}
              className="card-sport p-5 flex flex-col sm:flex-row sm:items-center gap-4"
            >
              <div className="w-14 h-14 rounded-xl bg-cyan/10 border border-cyan/20 flex items-center justify-center shrink-0">
                <QrCode className="w-7 h-7 text-cyan" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="font-semibold truncate">{r.event_title}</h2>
                  <Badge variant={r.status === "confirmed" ? "default" : "secondary"}>
                    {r.status}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  {r.category_name} · {t("athletePortal.registrations.folio")}{" "}
                  {r.registration_number}
                  {r.bib_number && ` · ${t("athletePortal.registrations.bib")} ${r.bib_number}`}
                </p>
                <p className="text-xs text-muted-foreground flex items-center gap-3 mt-2">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    {format(new Date(r.start_date), "d MMM yyyy", {
                      locale: dateLocale,
                    })}
                  </span>
                </p>
              </div>
              <div className="text-left sm:text-right shrink-0 w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-0 border-border/60">
                <div className="text-lg font-bold text-cyan">
                  ${(r.total_cents / 100).toLocaleString(numLocale)} MXN
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

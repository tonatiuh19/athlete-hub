import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { format } from "date-fns";
import { Calendar, Clock, Loader2, QrCode, ArrowRightLeft, Sparkles, ShieldAlert } from "lucide-react";
import { useTranslation } from "react-i18next";
import MetaHelmet from "@/components/MetaHelmet";
import PortalErrorAlert from "@/components/athlete/PortalErrorAlert";
import RegistrationQrDialog from "@/components/athlete/RegistrationQrDialog";
import AthleteWaiverResignDialog from "@/components/athlete/AthleteWaiverResignDialog";
import TransferRegistrationDialog from "@/components/athlete/TransferRegistrationDialog";
import WaitlistOfferCountdown from "@/components/athlete/WaitlistOfferCountdown";
import { Button } from "@/components/ui/button";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  fetchAthleteRegistrations,
  fetchAthleteWaitlist,
} from "@/store/slices/athletePortalSlice";
import { fetchEventDetail } from "@/store/slices/marketplaceSlice";
import { openRegistrationWizard } from "@/store/slices/registrationCheckoutSlice";
import { Badge } from "@/components/ui/badge";
import { getDateFnsLocale, getNumberLocale } from "@/utils/dateLocale";
import type { RegistrationItem, WaitlistEntry } from "@shared/api";

export default function AthleteRegistrations() {
  const { t, i18n } = useTranslation();
  const dispatch = useAppDispatch();
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    registrations,
    waitlistEntries,
    loadingRegistrations,
    loadingWaitlist,
    registrationsError,
    waitlistError,
  } = useAppSelector((s) => s.athletePortal);
  const [qrRegistration, setQrRegistration] = useState<RegistrationItem | null>(
    null,
  );
  const [transferRegistration, setTransferRegistration] =
    useState<RegistrationItem | null>(null);
  const [resignRegistration, setResignRegistration] =
    useState<RegistrationItem | null>(null);
  const [claimingId, setClaimingId] = useState<number | null>(null);
  const dateLocale = getDateFnsLocale(i18n.language);
  const numLocale = getNumberLocale(i18n.language);

  useEffect(() => {
    dispatch(fetchAthleteRegistrations());
    dispatch(fetchAthleteWaitlist());
  }, [dispatch]);

  const qrParam = searchParams.get("qr");

  useEffect(() => {
    if (!qrParam || registrations.length === 0) return;
    const match = registrations.find((r) => String(r.id) === qrParam);
    if (match) {
      setQrRegistration(match);
      setSearchParams({}, { replace: true });
    }
  }, [qrParam, registrations, setSearchParams]);

  const retry = () => {
    dispatch(fetchAthleteRegistrations());
    dispatch(fetchAthleteWaitlist());
  };

  const waitlistStatusLabel = useMemo(
    () => ({
      waiting: t("athletePortal.waitlist.statusWaiting"),
      offered: t("athletePortal.waitlist.statusOffered"),
    }),
    [t],
  );

  const handleClaimSpot = async (entry: WaitlistEntry) => {
    if (!entry.event_slug || !entry.event_category_id) return;
    setClaimingId(entry.id);
    try {
      const result = await dispatch(fetchEventDetail(entry.event_slug));
      if (!fetchEventDetail.fulfilled.match(result)) return;
      const category = result.payload.categories.find(
        (c) => c.id === entry.event_category_id,
      );
      if (!category) return;
      dispatch(
        openRegistrationWizard({
          slug: entry.event_slug,
          category,
          waitlistClaimMode: true,
          waitlistEntryId: entry.id,
          initialStep: "auth",
        }),
      );
    } finally {
      setClaimingId(null);
    }
  };

  return (
    <div className="max-w-4xl mx-auto w-full min-w-0 overflow-x-clip space-y-6">
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

      <PortalErrorAlert error={registrationsError || waitlistError} onRetry={retry} />

      {!loadingWaitlist && waitlistEntries.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Clock className="w-5 h-5 text-amber-400" />
            {t("athletePortal.waitlist.title")}
          </h2>
          <div className="space-y-3">
            {waitlistEntries.map((entry) => {
              const canClaim =
                entry.can_claim &&
                entry.status === "offered" &&
                (!entry.offer_expires_at ||
                  new Date(entry.offer_expires_at).getTime() > Date.now());

              return (
                <div
                  key={entry.id}
                  className="card-sport p-4 flex flex-col sm:flex-row gap-3 sm:items-center"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate">{entry.event_title}</p>
                    <p className="text-sm text-muted-foreground">{entry.category_name}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {t("athletePortal.waitlist.position", { position: entry.position })}
                    </p>
                    {entry.status === "offered" && entry.offer_expires_at ? (
                      <WaitlistOfferCountdown
                        expiresAt={entry.offer_expires_at}
                        className="mt-2"
                      />
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <Badge variant={entry.status === "offered" ? "default" : "secondary"}>
                      {waitlistStatusLabel[entry.status as keyof typeof waitlistStatusLabel] ??
                        entry.status}
                    </Badge>
                    {canClaim ? (
                      <Button
                        type="button"
                        size="sm"
                        className="bg-cyan/10 text-primary border border-cyan/40 hover:bg-cyan hover:text-navy-deep"
                        disabled={claimingId === entry.id}
                        onClick={() => handleClaimSpot(entry)}
                      >
                        {claimingId === entry.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <>
                            <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                            {t("athletePortal.waitlist.claimSpot")}
                          </>
                        )}
                      </Button>
                    ) : null}
                    {entry.event_slug ? (
                      <Button asChild size="sm" variant="outline">
                        <Link to={`/events/${entry.event_slug}`}>
                          {t("athletePortal.waitlist.viewEvent")}
                        </Link>
                      </Button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      {loadingRegistrations ? (
        <div className="text-center py-12 text-muted-foreground">
          {t("common.loading")}
        </div>
      ) : registrationsError ? null : registrations.length === 0 ? (
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
              <button
                type="button"
                onClick={() => setQrRegistration(r)}
                className="w-14 h-14 rounded-xl bg-cyan/10 border border-cyan/20 flex items-center justify-center shrink-0 hover:bg-cyan/20 hover:border-cyan/40 transition-colors"
                aria-label={t("athletePortal.registrations.viewQr")}
              >
                <QrCode className="w-7 h-7 text-primary" />
              </button>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="font-semibold truncate">{r.event_title}</h2>
                  <Badge variant={r.status === "confirmed" ? "default" : "secondary"}>
                    {t(`athletePortal.registrations.status.${r.status}`, {
                      defaultValue: r.status,
                    })}
                  </Badge>
                  {r.waiver_outdated ? (
                    <Badge variant="destructive" className="gap-1">
                      <ShieldAlert className="w-3 h-3" />
                      {t("athletePortal.registrations.waiverOutdated")}
                    </Badge>
                  ) : null}
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
              <div className="flex flex-col items-stretch sm:items-end gap-2 shrink-0 w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-0 border-border/60">
                <div className="text-lg font-bold text-primary sm:text-right">
                  ${(r.total_cents / 100).toLocaleString(numLocale)} MXN
                </div>
                <div className="flex flex-wrap gap-2 justify-end">
                  {r.waiver_outdated ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setResignRegistration(r)}
                      className="border-destructive/40 text-destructive hover:bg-destructive/10"
                    >
                      <ShieldAlert className="w-3.5 h-3.5 mr-1.5" />
                      {t("athletePortal.registrations.resignAction")}
                    </Button>
                  ) : null}
                  {r.status === "confirmed" && Boolean(r.allows_transfers) ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setTransferRegistration(r)}
                      className="border-border"
                    >
                      <ArrowRightLeft className="w-3.5 h-3.5 mr-1.5" />
                      {t("athletePortal.transfer.button")}
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setQrRegistration(r)}
                    className="border-cyan/30 text-primary hover:bg-cyan/10"
                  >
                    <QrCode className="w-3.5 h-3.5 mr-1.5" />
                    {t("athletePortal.registrations.viewQr")}
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <RegistrationQrDialog
        registration={qrRegistration}
        open={qrRegistration != null}
        onOpenChange={(open) => {
          if (!open) setQrRegistration(null);
        }}
      />

      <TransferRegistrationDialog
        registration={transferRegistration}
        open={transferRegistration != null}
        onOpenChange={(open) => {
          if (!open) setTransferRegistration(null);
        }}
      />

      <AthleteWaiverResignDialog
        registration={resignRegistration}
        open={resignRegistration != null}
        onOpenChange={(open) => {
          if (!open) setResignRegistration(null);
        }}
      />
    </div>
  );
}

import { useEffect, useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AlertTriangle, FlaskConical, Loader2, ShieldAlert } from "lucide-react";
import MetaHelmet from "@/components/MetaHelmet";
import EventRegistrationWizard from "@/components/events/registration/EventRegistrationWizard";
import GroupRegistrationWizard from "@/components/events/registration/GroupRegistrationWizard";
import { Button } from "@/components/ui/button";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  clearEventDetail,
  hydrateEventDetail,
} from "@/store/slices/marketplaceSlice";
import { openRegistrationWizard } from "@/store/slices/registrationCheckoutSlice";
import { openGroupRegistrationWizard } from "@/store/slices/groupRegistrationCheckoutSlice";
import { fetchSimulationEvent } from "@/store/slices/simulationSlice";
import { formatEventDate, formatPriceMxn } from "@/utils/eventFormat";
import { STRIPE_TEST_CARDS } from "@shared/simulation";
import type { EventCategory, EventDetailResponse } from "@shared/api";

export default function SimulationEventPage() {
  const { token } = useParams<{ token: string }>();
  const { t, i18n } = useTranslation();
  const dispatch = useAppDispatch();
  const { eventDetail } = useAppSelector((s) => s.marketplace);
  const { detail, loading, error } = useAppSelector((s) => s.simulation);

  useEffect(() => {
    if (!token) return;
    void dispatch(fetchSimulationEvent(token));
    return () => {
      dispatch(clearEventDetail());
    };
  }, [dispatch, token]);

  useEffect(() => {
    if (!detail) return;
    const eventRaw = detail.event as Record<string, unknown>;
    const fields = (detail.fields as EventDetailResponse["registrationFields"]) ?? [];
    const feePresentation =
      eventRaw.fee_presentation === "pass_through" || eventRaw.fee_presentation === "absorb_all"
        ? eventRaw.fee_presentation
        : "pass_through";
    const payload: EventDetailResponse = {
      event: eventRaw as unknown as EventDetailResponse["event"],
      categories: (detail.categories as EventCategory[]) ?? [],
      registrationFields: fields,
      extras: (detail.extras as EventDetailResponse["extras"]) ?? [],
      waivers: (detail.waivers as EventDetailResponse["waivers"]) ?? [],
      scheduleWaves: (detail.waves as EventDetailResponse["scheduleWaves"]) ?? [],
      sponsors: [],
      tags: [],
      course: null,
      media: [],
      serviceFeePercent: Number(eventRaw.service_fee_percent ?? 0),
      feePresentation,
      payments_available: Boolean(eventRaw.payments_available),
      has_paid_categories: Boolean(eventRaw.has_paid_categories),
    };
    dispatch(hydrateEventDetail(payload));
  }, [detail, dispatch]);

  const expired = Boolean(
    (detail?.event as { simulation_expired?: boolean } | undefined)?.simulation_expired,
  );
  const categories = useMemo(
    () => (detail?.categories as EventCategory[] | undefined) ?? [],
    [detail],
  );
  const eventRow = detail?.event as
    | (EventDetailResponse["event"] & {
        payments_available?: boolean;
        organizer_name?: string;
      })
    | undefined;
  const slug = eventRow?.slug ? String(eventRow.slug) : null;
  const title = eventRow?.title ? String(eventRow.title) : "";
  const hydratedReady =
    Boolean(eventDetail?.event?.slug) &&
    Boolean(slug) &&
    eventDetail?.event?.slug === slug;

  const startSolo = (category: EventCategory) => {
    if (!slug || !token || expired || !hydratedReady) return;
    dispatch(
      openRegistrationWizard({
        slug,
        category,
        simulationToken: token,
      }),
    );
  };

  const startGroup = () => {
    if (!slug || !token || expired || !hydratedReady) return;
    dispatch(openGroupRegistrationWizard({ slug, simulationToken: token }));
  };

  if (loading && !detail) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !detail || !slug || !eventRow) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <FlaskConical className="mx-auto mb-4 h-10 w-10 text-muted-foreground" />
        <h1 className="text-xl font-semibold text-foreground">
          {t("simulation.notFoundTitle")}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {error || t("simulation.notFoundBody")}
        </p>
        <Button asChild className="mt-6" variant="outline">
          <Link to="/events">{t("simulation.backToEvents")}</Link>
        </Button>
      </div>
    );
  }

  const testCards =
    (
      detail.simulation as
        | { test_cards?: typeof STRIPE_TEST_CARDS }
        | undefined
    )?.test_cards ?? STRIPE_TEST_CARDS;

  return (
    <div className="min-h-screen bg-gradient-to-b from-muted/40 via-background to-background">
      <MetaHelmet title={`${title} · ${t("simulation.badge")}`} noindex />
      <div className="border-b border-border bg-secondary/80">
        <div className="mx-auto flex max-w-3xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-start">
          <FlaskConical className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div className="space-y-1 text-sm">
            <p className="font-semibold text-foreground">{t("simulation.bannerTitle")}</p>
            <p className="text-muted-foreground">{t("simulation.bannerBody")}</p>
            <p className="flex items-start gap-2 text-muted-foreground">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
              {t("simulation.doNotShare")}
            </p>
            <p className="text-muted-foreground">{t("simulation.futureCost")}</p>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-4 py-8">
        {expired && (
          <div className="mb-6 flex gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-foreground">
            <AlertTriangle className="h-5 w-5 shrink-0 text-destructive" />
            <div>
              <p className="font-medium">{t("simulation.expiredTitle")}</p>
              <p className="text-muted-foreground">{t("simulation.expiredBody")}</p>
            </div>
          </div>
        )}

        <p className="text-xs font-medium uppercase tracking-wide text-primary">
          {t("simulation.badge")}
        </p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          {title}
        </h1>
        <p className="mt-2 text-muted-foreground">
          {formatEventDate(String(eventRow.start_date), i18n.language)}
          {eventRow.organizer_name ? ` · ${String(eventRow.organizer_name)}` : ""}
        </p>

        <div className="mt-8 space-y-3">
          <h2 className="text-lg font-semibold text-foreground">
            {t("simulation.categories")}
          </h2>
          {categories.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("simulation.noCategories")}</p>
          ) : (
            categories.map((cat) => (
              <div
                key={cat.id}
                className="flex flex-col gap-3 rounded-lg border border-border bg-card/40 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium text-foreground">{cat.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatPriceMxn(
                      cat.total_cents ?? cat.price_cents ?? 0,
                      i18n.language,
                    )}
                  </p>
                </div>
                <Button
                  disabled={expired || !eventRow.payments_available || !hydratedReady}
                  onClick={() => startSolo(cat)}
                >
                  {t("simulation.register")}
                </Button>
              </div>
            ))
          )}
        </div>

        {categories.length > 0 && !expired && (
          <div className="mt-6">
            <Button variant="outline" onClick={startGroup} disabled={!hydratedReady}>
              {t("simulation.registerGroup")}
            </Button>
          </div>
        )}

        <div className="mt-10 rounded-lg border border-border bg-muted/30 p-4">
          <h3 className="text-sm font-semibold text-foreground">
            {t("simulation.testCardsTitle")}
          </h3>
          <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
            {testCards.map((card) => (
              <li key={card.number}>
                <span className="font-mono text-foreground">{card.number}</span>
                {" — "}
                {card.brand}: {card.note}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <EventRegistrationWizard />
      <GroupRegistrationWizard />
    </div>
  );
}

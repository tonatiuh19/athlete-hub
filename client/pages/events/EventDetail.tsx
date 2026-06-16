import { useEffect, useCallback, useState, useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  ArrowLeft,
  Calendar,
  MapPin,
  Users,
  Clock,
  Droplets,
  Flag,
  Mountain,
  Loader2,
  CheckCircle2,
  HeartPulse,
  Bath,
  AlertTriangle,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import MetaHelmet from "@/components/MetaHelmet";
import { resolveAbsoluteImage, resolveAbsoluteUrl } from "@/lib/siteMeta";
import EventsMap from "@/components/events/EventsMap";
import CourseRouteDownloadPanel from "@/components/events/CourseRouteDownloadPanel";
import EventSponsorsCarousel from "@/components/events/EventSponsorsCarousel";
import EventMediaGallery from "@/components/events/EventMediaGallery";
import ElevationProfileChart from "@/components/events/ElevationProfileChart";
import EventBlogSection from "@/components/blog/EventBlogSection";
import EventRegistrationWizard from "@/components/events/registration/EventRegistrationWizard";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  openRegistrationWizard,
  fetchPendingCheckout,
  resumeRegistrationCheckout,
} from "@/store/slices/registrationCheckoutSlice";
import type { EventCategory } from "@shared/api";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  clearEventDetail,
  fetchEventDetail,
} from "@/store/slices/marketplaceSlice";
import { fetchAthleteMe } from "@/store/slices/athleteAuthSlice";
import { formatEventDate, formatPriceMxn } from "@/utils/eventFormat";
import { formatCategoryEligibility } from "@/utils/formatCategoryEligibility";
import {
  getCategoryEligibilityForAthlete,
  categoryIneligibilityMessage,
} from "@/utils/categoryEligibilityUi";
import { suggestCategoryId } from "@shared/categoryEligibility";
import {
  eventDescriptionHasContent,
  eventDescriptionIsHtml,
  eventDescriptionPlainParagraphs,
  eventDescriptionPlainText,
} from "@/utils/eventDescriptionHtml";
import { sanitizeHtml } from "@/utils/sanitizeHtml";
import { optimizeEventMediaUrl, buildEventMediaSrcSet } from "@/lib/cdn-url";
import type { CoursePoint } from "@shared/api";
import { pointColor } from "@/lib/leafletSetup";
import { useMapPanelHeight } from "@/hooks/use-media-query";
import { isWaiverMisconfigured } from "@/utils/eventRegistrationWaivers";
import {
  getRegistrationWindowStatus,
  isRegistrationOpen,
} from "@/utils/eventRegistrationWindow";
import { toast } from "@/hooks/use-toast";

function pointIcon(type: CoursePoint["type"]) {
  switch (type) {
    case "hydration":
      return Droplets;
    case "finish":
    case "start":
      return Flag;
    case "aid":
      return Mountain;
    case "medical":
      return HeartPulse;
    case "restroom":
      return Bath;
    case "spectator":
      return Users;
    case "risk":
      return AlertTriangle;
    default:
      return MapPin;
  }
}

export default function EventDetail() {
  const { slug } = useParams<{ slug: string }>();
  const { t, i18n } = useTranslation();
  const dispatch = useAppDispatch();
  const { eventDetail, loadingDetail, detailError } = useAppSelector(
    (s) => s.marketplace,
  );
  const { token, user } = useAppSelector((s) => s.athleteAuth);
  const {
    open: wizardOpen,
    joiningWaitlist,
    pendingCheckout,
  } = useAppSelector((s) => s.registrationCheckout);
  const [activeTab, setActiveTab] = useState("overview");
  const courseMapHeight = useMapPanelHeight({ compact: true });

  const waiverMisconfigured = isWaiverMisconfigured(eventDetail);

  const startRegistration = useCallback(
    (category: EventCategory, initialStep?: "auth" | "checkout") => {
      if (!slug || !eventDetail) return;
      const windowStatus = getRegistrationWindowStatus(eventDetail.event);
      if (!isRegistrationOpen(eventDetail.event)) {
        toast({
          variant: "destructive",
          title:
            windowStatus === "closed"
              ? t("eventDetail.registrationClosed")
              : t("eventDetail.registrationNotOpen"),
        });
        return;
      }
      if (isWaiverMisconfigured(eventDetail)) {
        toast({
          variant: "destructive",
          title: t("eventDetail.waiverNotConfigured"),
          description: t("eventDetail.waiverNotConfiguredHint"),
        });
        return;
      }
      dispatch(
        openRegistrationWizard({
          slug,
          category,
          initialStep,
        }),
      );
    },
    [dispatch, slug, eventDetail, t],
  );

  const handleJoinWaitlist = useCallback(
    (category: EventCategory) => {
      if (!slug || !eventDetail) return;
      const windowStatus = getRegistrationWindowStatus(eventDetail.event);
      if (!isRegistrationOpen(eventDetail.event)) {
        toast({
          variant: "destructive",
          title:
            windowStatus === "closed"
              ? t("eventDetail.registrationClosed")
              : t("eventDetail.registrationNotOpen"),
        });
        return;
      }
      if (isWaiverMisconfigured(eventDetail)) {
        toast({
          variant: "destructive",
          title: t("eventDetail.waiverNotConfigured"),
          description: t("eventDetail.waiverNotConfiguredHint"),
        });
        return;
      }
      dispatch(
        openRegistrationWizard({
          slug,
          category,
          waitlistMode: true,
          initialStep: "auth",
        }),
      );
    },
    [dispatch, slug, eventDetail, t],
  );

  const scrollToPricing = useCallback(() => {
    setActiveTab("pricing");
    requestAnimationFrame(() => {
      document
        .getElementById("event-pricing")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, []);

  const handleResumePendingCheckout = useCallback(() => {
    if (!slug || !pendingCheckout || !eventDetail) return;
    const category =
      eventDetail.categories.find(
        (c) => c.id === pendingCheckout.category_id,
      ) ??
      eventDetail.categories.find(
        (c) => c.name === pendingCheckout.category_name,
      );
    if (!category) {
      scrollToPricing();
      return;
    }
    dispatch(
      openRegistrationWizard({
        slug,
        category,
        initialStep: token ? "checkout" : "auth",
      }),
    );
    if (token) {
      void dispatch(
        resumeRegistrationCheckout({
          slug,
          paymentPublicUuid: pendingCheckout.public_uuid,
        }),
      );
    }
  }, [slug, pendingCheckout, eventDetail, dispatch, token, scrollToPricing]);

  useEffect(() => {
    if (slug) dispatch(fetchEventDetail(slug));
    return () => {
      dispatch(clearEventDetail());
    };
  }, [dispatch, slug, token]);

  useEffect(() => {
    if (!wizardOpen && slug) {
      dispatch(fetchEventDetail(slug));
    }
  }, [wizardOpen, slug, dispatch]);

  useEffect(() => {
    if (slug && token && eventDetail && !eventDetail.myRegistration) {
      dispatch(fetchPendingCheckout(slug));
    }
  }, [dispatch, slug, token, eventDetail]);

  useEffect(() => {
    if (token && !user) {
      dispatch(fetchAthleteMe());
    }
  }, [dispatch, token, user]);

  const recommendedCategoryId = useMemo(() => {
    if (!eventDetail?.categories?.length || !user?.dateOfBirth) return null;
    const sorted = [...eventDetail.categories].sort(
      (a, b) => a.sort_order - b.sort_order,
    );
    return suggestCategoryId(
      sorted,
      { date_of_birth: user.dateOfBirth, gender: user.gender ?? null },
      eventDetail.event.start_date,
    );
  }, [eventDetail, user]);

  const profileIncompleteForCategories = Boolean(
    token && user && !user.dateOfBirth,
  );

  if (loadingDetail) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center min-h-below-nav gap-3 text-gray-400">
        <Loader2 className="w-8 h-8 animate-spin text-cyan" />
        {t("eventDetail.loading")}
      </div>
    );
  }

  if (detailError || !eventDetail) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center min-h-below-nav max-w-lg mx-auto py-20 px-4 text-center">
        <p className="text-gray-400 mb-6">{t("eventDetail.notFound")}</p>
        <Link to="/events">
          <Button variant="outline">{t("eventDetail.backToEvents")}</Button>
        </Link>
      </div>
    );
  }

  const {
    event,
    categories,
    course,
    sponsors,
    tags,
    scheduleWaves,
    myRegistration,
    media,
  } = eventDetail;

  const isRegisteredConfirmed = Boolean(myRegistration);
  const registrationWindowStatus = getRegistrationWindowStatus(event);
  const registrationOpen = isRegistrationOpen(event);
  const canRegister =
    !isRegisteredConfirmed && !pendingCheckout && registrationOpen;
  const hasDescription = eventDescriptionHasContent(event.description);
  const descriptionIsHtml = eventDescriptionIsHtml(event.description);
  const descriptionParagraphs = descriptionIsHtml
    ? []
    : eventDescriptionPlainParagraphs(event.description);

  const metaDescription =
    event.short_description ||
    eventDescriptionPlainText(event.description) ||
    event.title;

  const minPrice = categories.reduce(
    (min, c) =>
      c.price_cents != null && c.price_cents < min ? c.price_cents : min,
    categories[0]?.price_cents ?? Infinity,
  );

  const heroImage = optimizeEventMediaUrl(event.hero_image_url, "detail");
  const bannerImage = optimizeEventMediaUrl(event.banner_image_url, "banner");
  const eventImage = bannerImage || heroImage;
  const eventPath = `/events/${slug}`;

  const eventJsonLd = {
    "@context": "https://schema.org",
    "@type": "SportsEvent",
    name: event.title,
    description: metaDescription,
    startDate: event.start_date,
    ...(event.end_date ? { endDate: event.end_date } : {}),
    image: eventImage ? resolveAbsoluteImage(eventImage) : undefined,
    url: resolveAbsoluteUrl(eventPath),
    sport: event.sport_name,
    location: {
      "@type": "Place",
      name: event.location_name || event.location_city || undefined,
      address: {
        "@type": "PostalAddress",
        addressLocality: event.location_city ?? undefined,
        addressRegion: event.location_state ?? undefined,
        addressCountry: event.location_country ?? undefined,
      },
    },
    organizer: {
      "@type": "Organization",
      name: event.organizer_name,
    },
  };

  return (
    <div className="flex flex-1 flex-col w-full min-w-0 min-h-full overflow-x-clip">
      <MetaHelmet
        title={event.title}
        description={metaDescription}
        image={eventImage}
        images={
          eventImage
            ? [
                {
                  url: eventImage,
                  alt: event.title,
                },
                ...(bannerImage && heroImage && bannerImage !== heroImage
                  ? [
                      {
                        url: bannerImage,
                        alt: `${event.title} — banner`,
                      },
                    ]
                  : []),
              ]
            : undefined
        }
        imageAlt={event.title}
        path={eventPath}
        ogType="article"
        publishedTime={event.start_date}
        modifiedTime={event.end_date ?? event.start_date}
        articleAuthor={event.organizer_name}
        articleSection={event.sport_name}
        articleTags={[
          event.sport_name,
          event.location_city,
          event.location_state,
        ].filter((v): v is string => Boolean(v))}
        alternateLocales
        keywords={[event.sport_name, event.location_city, event.title].filter(
          Boolean,
        )}
        jsonLd={eventJsonLd}
      />

      {/* Hero */}
      <section className="relative min-h-[280px] md:min-h-[360px] overflow-hidden">
        {eventImage ? (
          <img
            src={eventImage}
            srcSet={buildEventMediaSrcSet(bannerImage || event.hero_image_url, bannerImage ? "banner" : "detail")}
            sizes="100vw"
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
            {...({ fetchpriority: "high" } as React.ImgHTMLAttributes<HTMLImageElement>)}
            decoding="async"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-cyan/20 via-bg-dark to-purple-accent/20" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-bg-dark via-bg-dark/70 to-bg-dark/30" />
        <div className="relative max-w-7xl mx-auto px-4 md:px-6 py-8 flex flex-col justify-end min-h-[280px] md:min-h-[360px]">
          <Link
            to="/events"
            className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-cyan mb-6 w-fit"
          >
            <ArrowLeft className="w-4 h-4" />
            {t("eventDetail.backToEvents")}
          </Link>
          <span className="text-cyan text-xs font-bold uppercase tracking-widest mb-2">
            {event.sport_name}
          </span>
          {event.requires_waiver ? (
            <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
              <ShieldCheck className="w-3.5 h-3.5 text-primary" />
              {t("eventDetail.waiverRequired")}
            </p>
          ) : null}
          <h1 className="text-3xl md:text-5xl font-bold text-white max-w-4xl leading-tight">
            {event.title}
          </h1>
          {event.short_description && (
            <p className="text-gray-300 mt-3 max-w-2xl text-base md:text-lg">
              {event.short_description}
            </p>
          )}
          <div className="flex flex-wrap gap-4 mt-6 text-sm text-gray-300">
            <span className="inline-flex items-center gap-2">
              <Calendar className="w-4 h-4 text-cyan" />
              {formatEventDate(event.start_date, i18n.language)}
            </span>
            <span className="inline-flex items-center gap-2">
              <MapPin className="w-4 h-4 text-cyan" />
              {[event.location_name, event.location_city]
                .filter(Boolean)
                .join(" · ")}
            </span>
            {/* Registration capacity counter hidden — re-enable when public counts are ready
            <span className="inline-flex items-center gap-2">
              <Users className="w-4 h-4 text-cyan" />
              {event.registration_count}
              {event.max_registrations
                ? ` / ${event.max_registrations}`
                : ""}{" "}
              {t("eventDetail.attendeesRegistered")}
            </span>
            */}
          </div>
        </div>
      </section>

      {/* Sticky CTA bar — price · sponsors · register */}
      <div className="sticky top-[4.5rem] z-40 border-b border-gray-800/80 bg-bg-dark/90 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto w-full min-w-0 px-4 md:px-6 py-2.5 md:py-3">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 md:gap-5 min-w-0">
            {isRegisteredConfirmed ? (
              <div className="flex items-center gap-2 min-w-0">
                <CheckCircle2 className="w-5 h-5 text-success shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white leading-tight">
                    {t("eventDetail.alreadyRegisteredTitle")}
                  </p>
                  {myRegistration && (
                    <p className="text-xs text-gray-400 truncate">
                      {t("eventDetail.alreadyRegisteredDesc", {
                        category: myRegistration.categoryName,
                        number: myRegistration.registrationNumber,
                      })}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="shrink-0">
                {Number.isFinite(minPrice) && minPrice !== Infinity && (
                  <p className="text-[10px] text-gray-500 leading-none mb-0.5">
                    {t("eventDetail.from")}
                  </p>
                )}
                <p className="text-base md:text-lg font-bold text-cyan leading-tight">
                  {Number.isFinite(minPrice) && minPrice !== Infinity
                    ? formatPriceMxn(minPrice, i18n.language)
                    : t("eventDetail.freeOrTbd")}
                </p>
              </div>
            )}

            {sponsors.length > 0 && (
              <EventSponsorsCarousel
                sponsors={sponsors}
                eventSlug={event.slug}
                variant="inline"
                className="flex-1 min-w-0 hidden sm:flex border-l border-gray-800/80 pl-3 md:pl-5"
              />
            )}

            {isRegisteredConfirmed ? (
              <Button
                asChild
                size="sm"
                className="shrink-0 ml-auto h-9 px-3 sm:h-10 sm:px-5 text-xs sm:text-sm whitespace-nowrap bg-success/15 text-success border border-success/40 hover:bg-success/25"
              >
                <Link to="/portal/registrations">
                  {t("eventDetail.viewMyRegistration")}
                </Link>
              </Button>
            ) : (
              <Button
                size="sm"
                disabled={categories.length === 0}
                onClick={scrollToPricing}
                className="shrink-0 ml-auto h-9 px-3 sm:h-10 sm:px-5 text-xs sm:text-sm whitespace-nowrap bg-gradient-to-r from-cyan to-blue-electric text-navy-deep font-bold hover:opacity-90"
              >
                {t("eventDetail.registerCta")}
              </Button>
            )}
          </div>

          {sponsors.length > 0 && (
            <EventSponsorsCarousel
              sponsors={sponsors}
              eventSlug={event.slug}
              variant="inline"
              className="sm:hidden mt-2.5 pt-2.5 border-t border-gray-800/60"
            />
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col max-w-7xl mx-auto px-4 md:px-6 py-8 md:py-12 w-full min-w-0">
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="flex flex-1 flex-col gap-8"
        >
          <TabsList className="bg-surface-dark/80 border border-gray-700/50 p-1 h-auto w-full flex flex-nowrap justify-start gap-1 overflow-x-auto scrollbar-hide">
            <TabsTrigger value="overview">
              {t("eventDetail.tabOverview")}
            </TabsTrigger>
            <TabsTrigger value="course">
              {t("eventDetail.tabCourse")}
            </TabsTrigger>
            {canRegister && (
              <TabsTrigger value="pricing">
                {t("eventDetail.tabPricing")}
              </TabsTrigger>
            )}
            {scheduleWaves.length > 0 && (
              <TabsTrigger value="schedule">
                {t("eventDetail.tabSchedule")}
              </TabsTrigger>
            )}
            {(media?.length ?? 0) > 0 && (
              <TabsTrigger value="media">
                {t("eventDetail.tabMedia")}
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="overview" className="space-y-8">
            {pendingCheckout && !isRegisteredConfirmed ? (
              <div className="p-5 rounded-xl border border-amber-500/30 bg-amber-500/5 flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <AlertTriangle className="w-6 h-6 text-amber-400 shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="font-bold text-white">
                      {t("eventDetail.pendingPaymentTitle")}
                    </p>
                    <p className="text-sm text-gray-400 mt-1">
                      {t("eventDetail.pendingPaymentDesc", {
                        category:
                          pendingCheckout.category_name ??
                          t("eventDetail.inscription"),
                      })}
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  onClick={handleResumePendingCheckout}
                  className="shrink-0 bg-amber-500/10 text-amber-300 border border-amber-500/40 hover:bg-amber-500/20"
                >
                  {t("eventDetail.completePayment")}
                </Button>
              </div>
            ) : null}
            {isRegisteredConfirmed && myRegistration && (
              <div className="p-5 rounded-xl border border-success/30 bg-success/5 flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <CheckCircle2 className="w-6 h-6 text-success shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="font-bold text-white">
                      {t("eventDetail.alreadyRegisteredTitle")}
                    </p>
                    <p className="text-sm text-gray-400 mt-1">
                      {t("eventDetail.alreadyRegisteredDesc", {
                        category: myRegistration.categoryName,
                        number: myRegistration.registrationNumber,
                      })}
                    </p>
                  </div>
                </div>
                <Button
                  asChild
                  variant="outline"
                  className="shrink-0 border-success/40 text-success hover:bg-success/10"
                >
                  <Link to="/portal/registrations">
                    {t("eventDetail.viewMyRegistration")}
                  </Link>
                </Button>
              </div>
            )}
            <div className="grid md:grid-cols-3 gap-6">
              <div className="md:col-span-2 space-y-6">
                <div className="p-6 rounded-xl border border-gray-700/50 bg-surface-dark/50">
                  <h2 className="text-lg font-bold text-white mb-4">
                    {t("eventDetail.convocatoriaTitle")}
                  </h2>
                  {hasDescription ? (
                    descriptionIsHtml ? (
                      <div
                        className="blog-prose text-gray-300 leading-relaxed [&_a]:text-cyan [&_a]:underline [&_h2]:text-white [&_h2]:text-xl [&_h2]:font-bold [&_h2]:mt-6 [&_h2]:mb-3 [&_h3]:text-white [&_h3]:font-semibold [&_h3]:mt-4 [&_h3]:mb-2 [&_p]:mb-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1 [&_ul]:mb-4 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:space-y-1 [&_ol]:mb-4 [&_li]:text-gray-300 [&_strong]:text-white [&_table]:block [&_table]:overflow-x-auto [&_table]:max-w-full [&_table]:w-full [&_table]:text-sm [&_table]:mb-4 [&_th]:text-left [&_th]:text-white [&_th]:border-b [&_th]:border-gray-600 [&_th]:py-2 [&_th]:pr-3 [&_td]:py-2 [&_td]:pr-3 [&_td]:border-b [&_td]:border-gray-700/50 [&_img]:rounded-xl [&_img]:my-4 [&_blockquote]:border-l-cyan [&_blockquote]:border-l-4 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-gray-400 [&_blockquote]:my-4"
                        dangerouslySetInnerHTML={{
                          __html: sanitizeHtml(event.description!),
                        }}
                      />
                    ) : (
                      <div className="space-y-4 text-gray-300 leading-relaxed">
                        {descriptionParagraphs.map((para) => (
                          <p key={para.slice(0, 24)}>{para}</p>
                        ))}
                      </div>
                    )
                  ) : (
                    <p className="text-gray-500">
                      {t("eventDetail.noConvocatoria")}
                    </p>
                  )}
                </div>

                {tags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {tags.map((tag) => (
                      <span
                        key={tag.slug}
                        className="px-3 py-1 rounded-full text-xs border border-cyan/30 text-cyan bg-cyan/5"
                      >
                        {tag.name}
                      </span>
                    ))}
                  </div>
                )}
                {slug ? (
                  <EventBlogSection
                    eventSlug={slug}
                    organizerSlug={event.organizer_slug}
                    organizerName={event.organizer_name}
                  />
                ) : null}
              </div>
              <div className="space-y-4">
                <div className="p-5 rounded-xl border border-gray-700/50 bg-surface-dark/50 space-y-3 text-sm">
                  <h3 className="font-bold text-white">
                    {t("eventDetail.info")}
                  </h3>
                  <div className="flex gap-2 text-gray-400">
                    <Clock className="w-4 h-4 text-cyan shrink-0 mt-0.5" />
                    <div>
                      <p className="text-gray-500 text-xs">
                        {t("eventDetail.registrationCloses")}
                      </p>
                      {event.registration_closes_at
                        ? formatEventDate(
                            event.registration_closes_at,
                            i18n.language,
                          )
                        : "—"}
                    </div>
                  </div>
                  <div className="flex gap-2 text-gray-400">
                    <MapPin className="w-4 h-4 text-cyan shrink-0 mt-0.5" />
                    <div>
                      <p>
                        {event.location_address ||
                          event.venue_address ||
                          event.location_city}
                      </p>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 pt-2 border-t border-gray-700/50">
                    {t("eventDetail.organizer")}:{" "}
                    <span className="text-gray-300">
                      {event.organizer_name}
                    </span>
                  </p>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="course" className="space-y-6">
            {course ? (
              <>
                <div className="grid sm:grid-cols-3 gap-4">
                  {course.distanceKm != null && (
                    <div className="p-4 rounded-xl border border-gray-700/50 bg-surface-dark/50">
                      <p className="text-xs text-gray-500 uppercase">
                        {t("eventDetail.distance")}
                      </p>
                      <p className="text-xl font-bold text-white">
                        {course.distanceKm} km
                      </p>
                    </div>
                  )}
                  {course.elevationGainM != null && (
                    <div className="p-4 rounded-xl border border-gray-700/50 bg-surface-dark/50">
                      <p className="text-xs text-gray-500 uppercase">
                        {t("eventDetail.elevation")}
                      </p>
                      <p className="text-xl font-bold text-white">
                        {course.elevationGainM} m
                      </p>
                    </div>
                  )}
                  <div className="p-4 rounded-xl border border-gray-700/50 bg-surface-dark/50">
                    <p className="text-xs text-gray-500 uppercase">
                      {t("eventDetail.aidStations")}
                    </p>
                    <p className="text-xl font-bold text-white">
                      {
                        course.points.filter(
                          (p) => p.type === "hydration" || p.type === "aid",
                        ).length
                      }
                    </p>
                  </div>
                </div>

                <EventsMap
                  courseRoute={course.routeGeojson}
                  coursePoints={course.points}
                  interactive
                  height={courseMapHeight}
                  className="rounded-xl w-full"
                />

                <CourseRouteDownloadPanel
                  eventTitle={event.title}
                  eventSlug={event.slug}
                  course={course}
                  isRegistered={isRegisteredConfirmed}
                  onRegisterClick={() => setActiveTab("pricing")}
                />

                {course.elevationProfile &&
                course.elevationProfile.length > 1 ? (
                  <ElevationProfileChart profile={course.elevationProfile} />
                ) : null}

                <div className="grid sm:grid-cols-2 gap-3">
                  {course.points.map((p) => {
                    const Icon = pointIcon(p.type);
                    return (
                      <div
                        key={`${p.type}-${p.name}-${p.km}`}
                        className="flex gap-3 p-4 rounded-xl border border-gray-700/50 bg-surface-dark/40"
                      >
                        <div
                          className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                          style={{
                            backgroundColor: `${pointColor(p.type)}22`,
                            border: `1px solid ${pointColor(p.type)}55`,
                          }}
                        >
                          <Icon
                            className="w-4 h-4"
                            style={{ color: pointColor(p.type) }}
                          />
                        </div>
                        <div>
                          <p className="font-semibold text-white text-sm">
                            {p.name}
                          </p>
                          {p.km != null && (
                            <p className="text-xs text-cyan">Km {p.km}</p>
                          )}
                          {p.description && (
                            <p className="text-xs text-gray-500 mt-1">
                              {p.description}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <p className="text-gray-500 py-12 text-center">
                {t("eventDetail.noCourse")}
              </p>
            )}
          </TabsContent>

          {(media?.length ?? 0) > 0 ? (
            <TabsContent value="media">
              <EventMediaGallery media={media} />
            </TabsContent>
          ) : null}

          {canRegister && (
            <TabsContent
              value="pricing"
              id="event-pricing"
              className="space-y-4 scroll-mt-[8rem]"
            >
              {!registrationOpen ? (
                <div className="p-4 rounded-xl border border-destructive/30 bg-destructive/5 flex gap-3">
                  <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                  <p className="text-sm text-destructive">
                    {registrationWindowStatus === "closed"
                      ? t("eventDetail.registrationClosed")
                      : t("eventDetail.registrationNotOpen")}
                  </p>
                </div>
              ) : null}
              {waiverMisconfigured ? (
                <div className="p-4 rounded-xl border border-destructive/30 bg-destructive/5 flex gap-3">
                  <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-destructive">
                      {t("eventDetail.waiverNotConfigured")}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {t("eventDetail.waiverNotConfiguredHint")}
                    </p>
                  </div>
                </div>
              ) : null}
              {profileIncompleteForCategories ? (
                <div className="p-4 rounded-xl border border-primary/30 bg-primary/5 flex flex-col sm:flex-row sm:items-center gap-3">
                  <p className="text-sm text-gray-300 flex-1">
                    {t("eventDetail.completeProfileForCategories")}
                  </p>
                  <Button
                    asChild
                    size="sm"
                    variant="outline"
                    className="shrink-0 border-primary/40"
                  >
                    <Link to="/portal/profile">
                      {t("eventDetail.completeProfileCta")}
                    </Link>
                  </Button>
                </div>
              ) : null}
              <div className="grid md:grid-cols-2 gap-4">
                {categories.map((cat) => {
                  const spotsLeft =
                    cat.capacity != null
                      ? Math.max(0, cat.capacity - cat.sold_count)
                      : null;
                  const isSoldOut =
                    cat.capacity != null && cat.sold_count >= cat.capacity;
                  const waitlistEnabled = Boolean(cat.waitlist_enabled);
                  const eligibility = token
                    ? getCategoryEligibilityForAthlete(
                        cat,
                        user,
                        event.start_date,
                      )
                    : { eligible: true as const };
                  const isRecommended =
                    recommendedCategoryId === cat.id && eligibility.eligible;
                  const eligibilityParts = formatCategoryEligibility(cat, t);
                  const ineligibleMessage =
                    !eligibility.eligible && token
                      ? categoryIneligibilityMessage(
                          eligibility as Extract<
                            typeof eligibility,
                            { eligible: false }
                          >,
                          t,
                        )
                      : null;
                  return (
                    <div
                      key={cat.id}
                      className={`p-5 rounded-xl border bg-surface-dark/50 transition-colors ${
                        isRecommended
                          ? "border-accent/50 ring-1 ring-accent/30"
                          : !eligibility.eligible && token
                            ? "border-gray-800/80 opacity-75"
                            : "border-gray-700/50 hover:border-cyan/40"
                      }`}
                    >
                      <div className="flex justify-between items-start gap-3 mb-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-bold text-white">{cat.name}</h3>
                            {isRecommended ? (
                              <span className="inline-flex items-center gap-1 text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-accent/15 text-accent border border-accent/30">
                                <Sparkles className="w-3 h-3" />
                                {t("eventDetail.categoryRecommended")}
                              </span>
                            ) : null}
                          </div>
                          {cat.distance_km != null && (
                            <p className="text-xs text-gray-500">
                              {cat.distance_km} km
                            </p>
                          )}
                          {eligibilityParts.length > 0 ? (
                            <p className="text-xs text-muted-foreground mt-1">
                              {eligibilityParts.join(" · ")}
                            </p>
                          ) : null}
                        </div>
                        {cat.difficulty && (
                          <span className="text-[10px] uppercase px-2 py-0.5 rounded border border-gray-600 text-gray-400">
                            {cat.difficulty}
                          </span>
                        )}
                      </div>
                      {cat.description && (
                        <p className="text-sm text-gray-400 mb-4 line-clamp-2">
                          {cat.description}
                        </p>
                      )}
                      <div className="flex justify-between items-center text-sm border-t border-gray-700/50 pt-3">
                        <span className="text-gray-400">
                          {t("eventDetail.inscription")}
                        </span>
                        <span className="font-bold text-cyan text-base">
                          {cat.price_formatted ||
                            formatPriceMxn(cat.price_cents, i18n.language)}
                        </span>
                      </div>
                      {spotsLeft != null && !isSoldOut && (
                        <p className="text-xs text-gray-500 mt-3">
                          {t("eventDetail.spotsLeft", { count: spotsLeft })}
                        </p>
                      )}
                      {ineligibleMessage ? (
                        <p className="text-xs text-destructive mt-2">
                          {ineligibleMessage}
                        </p>
                      ) : null}
                      {isSoldOut && waitlistEnabled ? (
                        <Button
                          type="button"
                          onClick={() => handleJoinWaitlist(cat)}
                          disabled={
                            !registrationOpen ||
                            waiverMisconfigured ||
                            joiningWaitlist ||
                            !eligibility.eligible
                          }
                          className="w-full mt-4 bg-amber-500/10 text-amber-400 border border-amber-500/40 hover:bg-amber-500/20"
                        >
                          {joiningWaitlist ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            t("eventDetail.joinWaitlist")
                          )}
                        </Button>
                      ) : isSoldOut ? (
                        <Button
                          type="button"
                          disabled
                          className="w-full mt-4 opacity-60"
                        >
                          {t("eventDetail.soldOut")}
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          onClick={() => startRegistration(cat)}
                          disabled={
                            !registrationOpen ||
                            waiverMisconfigured ||
                            !eligibility.eligible
                          }
                          className="w-full mt-4 bg-cyan/10 text-cyan border border-cyan/40 hover:bg-cyan hover:text-navy-deep disabled:opacity-50"
                        >
                          {isRecommended
                            ? t("eventDetail.categoryRecommended")
                            : t("eventDetail.selectCategory")}
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            </TabsContent>
          )}

          {scheduleWaves.length > 0 && (
            <TabsContent value="schedule" className="space-y-3">
              {scheduleWaves.map((wave) => (
                <div
                  key={wave.id}
                  className="flex items-center justify-between gap-3 p-4 rounded-xl border border-gray-700/50 bg-surface-dark/40"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-white break-words">
                      {wave.name}
                    </p>
                    <p className="text-sm text-gray-400">
                      {formatEventDate(wave.starts_at, i18n.language)}
                    </p>
                  </div>
                  <p className="text-sm text-gray-500 shrink-0 whitespace-nowrap">
                    {wave.registered_count}
                    {wave.capacity ? ` / ${wave.capacity}` : ""}
                  </p>
                </div>
              ))}
            </TabsContent>
          )}
        </Tabs>
      </div>

      <EventRegistrationWizard />
    </div>
  );
}

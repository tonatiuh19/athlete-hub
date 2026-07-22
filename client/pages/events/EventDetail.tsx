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
import GroupRegistrationWizard from "@/components/events/registration/GroupRegistrationWizard";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  openRegistrationWizard,
  fetchPendingCheckout,
  resumeRegistrationCheckout,
} from "@/store/slices/registrationCheckoutSlice";
import { openGroupRegistrationWizard } from "@/store/slices/groupRegistrationCheckoutSlice";
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
import { normalizeEventCourse } from "@shared/courseNormalize";
import {
  eventHasPaidCategories,
  isCategoryPaidCheckoutBlocked,
  isPaidCheckoutUnavailable,
} from "@/utils/eventPaymentAvailability";
import { pointColor } from "@/lib/leafletSetup";
import { useMapPanelHeight } from "@/hooks/use-media-query";
import { isWaiverMisconfigured } from "@/utils/eventRegistrationWaivers";
import {
  getRegistrationWindowStatus,
  isRegistrationOpen,
} from "@/utils/eventRegistrationWindow";
import { hasEventDayPassed } from "@shared/eventLifecycle";
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

  const displayCourse = useMemo(() => {
    const raw = eventDetail?.course;
    if (!raw) return null;
    return normalizeEventCourse({ ...raw });
  }, [eventDetail?.course]);

  const waiverMisconfigured = isWaiverMisconfigured(eventDetail);

  const startRegistration = useCallback(
    (category: EventCategory, initialStep?: "auth" | "checkout") => {
      if (!slug || !eventDetail) return;
      const paymentsOk = eventDetail.payments_available ?? true;
      if (isCategoryPaidCheckoutBlocked(category, paymentsOk)) {
        toast({
          variant: "destructive",
          title: t("eventDetail.paymentsPausedTitle"),
          description: t("eventDetail.paymentsPausedBody"),
        });
        return;
      }
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
      const paymentsOk = eventDetail.payments_available ?? true;
      if (isCategoryPaidCheckoutBlocked(category, paymentsOk)) {
        toast({
          variant: "destructive",
          title: t("eventDetail.paymentsPausedTitle"),
          description: t("eventDetail.paymentsPausedBody"),
        });
        return;
      }
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

  const startGroupRegistration = useCallback(() => {
    if (!slug || !eventDetail) return;
    const paymentsOk = eventDetail.payments_available ?? true;
    const purchasable = eventDetail.categories.some(
      (c) => !isCategoryPaidCheckoutBlocked(c, paymentsOk),
    );
    if (isPaidCheckoutUnavailable(eventDetail.categories, paymentsOk) && !purchasable) {
      toast({
        variant: "destructive",
        title: t("eventDetail.paymentsPausedTitle"),
        description: t("eventDetail.paymentsPausedBody"),
      });
      return;
    }
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
    dispatch(openGroupRegistrationWizard({ slug }));
  }, [dispatch, slug, eventDetail, t]);

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
      <div className="flex flex-1 flex-col items-center justify-center min-h-below-nav gap-3 text-muted-foreground">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        {t("eventDetail.loading")}
      </div>
    );
  }

  if (detailError || !eventDetail) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center min-h-below-nav max-w-lg mx-auto py-20 px-4 text-center">
        <p className="text-muted-foreground mb-6">{t("eventDetail.notFound")}</p>
        <Link to="/events">
          <Button variant="outline">{t("eventDetail.backToEvents")}</Button>
        </Link>
      </div>
    );
  }

  const {
    event,
    categories,
    sponsors,
    tags,
    scheduleWaves,
    myRegistration,
    media,
    feePresentation = "pass_through",
    payments_available: paymentsAvailable = true,
  } = eventDetail;
  const absorbAllPricing = feePresentation === "absorb_all";
  const hasPaidCategories = eventHasPaidCategories(categories);
  const paidCheckoutUnavailable = isPaidCheckoutUnavailable(categories, paymentsAvailable);
  const hasPurchasableCategory = categories.some(
    (c) => !isCategoryPaidCheckoutBlocked(c, paymentsAvailable),
  );

  const isRegisteredConfirmed = Boolean(myRegistration);
  const registrationWindowStatus = getRegistrationWindowStatus(event);
  const registrationOpen = isRegistrationOpen(event);
  const canRegister =
    !isRegisteredConfirmed && !pendingCheckout && registrationOpen;
  const canGroupRegister =
    registrationOpen &&
    categories.length > 0 &&
    hasPurchasableCategory &&
    !waiverMisconfigured;
  const hasDescription = eventDescriptionHasContent(event.description);
  const descriptionIsHtml = eventDescriptionIsHtml(event.description);
  const descriptionParagraphs = descriptionIsHtml
    ? []
    : eventDescriptionPlainParagraphs(event.description);

  const metaDescription =
    event.short_description ||
    eventDescriptionPlainText(event.description) ||
    event.title;

  const minPrice = categories.reduce((min, c) => {
    const displayCents = absorbAllPricing
      ? (c.total_cents ?? c.price_cents)
      : c.price_cents;
    return displayCents != null && displayCents < min ? displayCents : min;
  }, categories[0]
    ? absorbAllPricing
      ? (categories[0].total_cents ?? categories[0].price_cents)
      : categories[0].price_cents
    : Infinity);

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
          <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-background to-accent/15" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/55 to-black/25" />
        <div className="relative max-w-7xl mx-auto px-4 md:px-6 py-8 flex flex-col justify-end min-h-[280px] md:min-h-[360px]">
          <Link
            to="/events"
            className="inline-flex items-center gap-2 text-sm text-white/75 hover:text-white mb-6 w-fit"
          >
            <ArrowLeft className="w-4 h-4" />
            {t("eventDetail.backToEvents")}
          </Link>
          <span className="text-primary text-xs font-bold uppercase tracking-widest mb-2">
            {event.sport_name}
          </span>
          {event.requires_waiver ? (
            <p className="inline-flex items-center gap-1.5 text-xs text-white/80 mb-2">
              <ShieldCheck className="w-3.5 h-3.5 text-primary" />
              {t("eventDetail.waiverRequired")}
            </p>
          ) : null}
          <h1 className="text-3xl md:text-5xl font-bold text-white max-w-4xl leading-tight drop-shadow-sm">
            {event.title}
          </h1>
          {event.short_description && (
            <p className="text-white/85 mt-3 max-w-2xl text-base md:text-lg">
              {event.short_description}
            </p>
          )}
          <div className="flex flex-wrap gap-4 mt-6 text-sm text-white/80">
            <span className="inline-flex items-center gap-2">
              <Calendar className="w-4 h-4 text-primary" />
              {formatEventDate(event.start_date, i18n.language)}
            </span>
            <span className="inline-flex items-center gap-2">
              <MapPin className="w-4 h-4 text-primary" />
              {[event.location_name, event.location_city]
                .filter(Boolean)
                .join(" · ")}
            </span>
            {/* Registration capacity counter hidden — re-enable when public counts are ready
            <span className="inline-flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" />
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
      <div className="sticky top-[4.5rem] z-40 border-b border-border/80 bg-background/90 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto w-full min-w-0 px-4 md:px-6 py-2.5 md:py-3">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 md:gap-5 min-w-0">
            {isRegisteredConfirmed ? (
              <div className="flex items-center gap-2 min-w-0">
                <CheckCircle2 className="w-5 h-5 text-success shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground leading-tight">
                    {t("eventDetail.alreadyRegisteredTitle")}
                  </p>
                  {myRegistration && (
                    <p className="text-xs text-muted-foreground truncate">
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
                  <p className="text-[10px] text-muted-foreground leading-none mb-0.5">
                    {t("eventDetail.from")}
                  </p>
                )}
                <p className="text-base md:text-lg font-bold text-primary leading-tight">
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
                className="flex-1 min-w-0 hidden sm:flex border-l border-border/80 pl-3 md:pl-5"
              />
            )}

            {isRegisteredConfirmed ? (
              <div className="shrink-0 ml-auto flex flex-col sm:flex-row gap-2">
                {canGroupRegister && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={startGroupRegistration}
                    className="h-9 px-3 sm:h-10 sm:px-4 text-xs sm:text-sm whitespace-nowrap"
                  >
                    {t("eventDetail.registerGroupCta")}
                  </Button>
                )}
                <Button
                  asChild
                  size="sm"
                  className="h-9 px-3 sm:h-10 sm:px-5 text-xs sm:text-sm whitespace-nowrap bg-success/15 text-success border border-success/40 hover:bg-success/25"
                >
                  <Link to="/portal/registrations">
                    {t("eventDetail.viewMyRegistration")}
                  </Link>
                </Button>
              </div>
            ) : (
              <div className="shrink-0 ml-auto flex flex-col sm:flex-row gap-2">
                {canGroupRegister && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={startGroupRegistration}
                    className="h-9 px-3 sm:h-10 sm:px-4 text-xs sm:text-sm whitespace-nowrap"
                  >
                    {t("eventDetail.registerGroupCta")}
                  </Button>
                )}
                <Button
                  size="sm"
                  disabled={categories.length === 0 || !hasPurchasableCategory}
                  onClick={scrollToPricing}
                  title={
                    paidCheckoutUnavailable && !hasPurchasableCategory
                      ? t("eventDetail.paymentsPausedTitle")
                      : undefined
                  }
                  className="h-9 px-3 sm:h-10 sm:px-5 text-xs sm:text-sm whitespace-nowrap btn-primary font-bold disabled:opacity-50"
                >
                  {paidCheckoutUnavailable && !hasPurchasableCategory
                    ? t("eventDetail.registerUnavailable")
                    : t("eventDetail.registerCta")}
                </Button>
              </div>
            )}
          </div>

          {sponsors.length > 0 && (
            <EventSponsorsCarousel
              sponsors={sponsors}
              eventSlug={event.slug}
              variant="inline"
              className="sm:hidden mt-2.5 pt-2.5 border-t border-border/60"
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
          <TabsList className="bg-card/80 border border-border p-1 h-auto w-full flex flex-nowrap justify-start gap-1 overflow-x-auto scrollbar-hide">
            <TabsTrigger value="overview">
              {t("eventDetail.tabOverview")}
            </TabsTrigger>
            <TabsTrigger value="course">
              {t("eventDetail.tabCourse")}
            </TabsTrigger>
            {(canRegister || canGroupRegister) && (
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
            {paidCheckoutUnavailable ? (
              <div className="p-5 rounded-xl border border-primary/30 bg-primary/5 flex gap-3">
                <AlertTriangle className="w-6 h-6 text-primary shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="font-bold text-foreground">
                    {t("eventDetail.paymentsPausedTitle")}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {t("eventDetail.paymentsPausedBody")}
                  </p>
                  {hasPaidCategories && hasPurchasableCategory ? (
                    <p className="text-xs text-muted-foreground mt-2">
                      {t("eventDetail.paymentsPausedFreeCategoriesHint")}
                    </p>
                  ) : null}
                </div>
              </div>
            ) : null}
            {pendingCheckout && !isRegisteredConfirmed ? (
              <div className="p-5 rounded-xl border border-amber-500/30 bg-amber-500/5 flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <AlertTriangle className="w-6 h-6 text-amber-400 shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="font-bold text-foreground">
                      {t("eventDetail.pendingPaymentTitle")}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {t("eventDetail.pendingPaymentDescWithAmount", {
                        category:
                          pendingCheckout.category_name ??
                          t("eventDetail.inscription"),
                        amount: formatPriceMxn(
                          pendingCheckout.amount_cents,
                          i18n.language,
                        ),
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
                    <p className="font-bold text-foreground">
                      {t("eventDetail.alreadyRegisteredTitle")}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
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
                <div className="p-6 rounded-xl border border-border bg-card/60">
                  <h2 className="text-lg font-bold text-foreground mb-4">
                    {t("eventDetail.convocatoriaTitle")}
                  </h2>
                  {hasDescription ? (
                    descriptionIsHtml ? (
                      <div
                        className="blog-prose"
                        dangerouslySetInnerHTML={{
                          __html: sanitizeHtml(event.description!),
                        }}
                      />
                    ) : (
                      <div className="space-y-4 text-muted-foreground leading-relaxed">
                        {descriptionParagraphs.map((para) => (
                          <p key={para.slice(0, 24)}>{para}</p>
                        ))}
                      </div>
                    )
                  ) : (
                    <p className="text-muted-foreground">
                      {t("eventDetail.noConvocatoria")}
                    </p>
                  )}
                </div>

                {tags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {tags.map((tag) => (
                      <span
                        key={tag.slug}
                        className="px-3 py-1 rounded-full text-xs border border-cyan/30 text-primary bg-cyan/5"
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
                <div className="p-5 rounded-xl border border-border bg-card/60 space-y-3 text-sm">
                  <h3 className="font-bold text-foreground">
                    {t("eventDetail.info")}
                  </h3>
                  <div className="flex gap-2 text-muted-foreground">
                    <Clock className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                    <div>
                      <p className="text-muted-foreground text-xs">
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
                  <div className="flex gap-2 text-muted-foreground">
                    <MapPin className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                    <div>
                      <p>
                        {event.location_address ||
                          event.venue_address ||
                          event.location_city}
                      </p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground pt-2 border-t border-border">
                    {t("eventDetail.organizer")}:{" "}
                    <span className="text-muted-foreground">
                      {event.organizer_name}
                    </span>
                  </p>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="course" className="space-y-6">
            {displayCourse ? (
              <>
                <div className="grid sm:grid-cols-3 gap-4">
                  {displayCourse.distanceKm != null && (
                    <div className="p-4 rounded-xl border border-border bg-card/60">
                      <p className="text-xs text-muted-foreground uppercase">
                        {t("eventDetail.distance")}
                      </p>
                      <p className="text-xl font-bold text-foreground">
                        {displayCourse.distanceKm} km
                      </p>
                    </div>
                  )}
                  {displayCourse.elevationGainM != null && (
                    <div className="p-4 rounded-xl border border-border bg-card/60">
                      <p className="text-xs text-muted-foreground uppercase">
                        {t("eventDetail.elevation")}
                      </p>
                      <p className="text-xl font-bold text-foreground">
                        {displayCourse.elevationGainM} m
                      </p>
                    </div>
                  )}
                  <div className="p-4 rounded-xl border border-border bg-card/60">
                    <p className="text-xs text-muted-foreground uppercase">
                      {t("eventDetail.aidStations")}
                    </p>
                    <p className="text-xl font-bold text-foreground">
                      {
                        displayCourse.points.filter(
                          (p) => p.type === "hydration" || p.type === "aid",
                        ).length
                      }
                    </p>
                  </div>
                </div>

                <EventsMap
                  courseRoute={displayCourse.routeGeojson}
                  coursePoints={displayCourse.points}
                  interactive
                  height={courseMapHeight}
                  className="rounded-xl w-full"
                />

                <CourseRouteDownloadPanel
                  eventTitle={event.title}
                  eventSlug={event.slug}
                  course={displayCourse}
                  isRegistered={isRegisteredConfirmed}
                  onRegisterClick={() => setActiveTab("pricing")}
                />

                {displayCourse.elevationProfile &&
                displayCourse.elevationProfile.length > 1 ? (
                  <ElevationProfileChart profile={displayCourse.elevationProfile} />
                ) : null}

                <div className="grid sm:grid-cols-2 gap-3">
                  {displayCourse.points.map((p) => {
                    const Icon = pointIcon(p.type);
                    return (
                      <div
                        key={`${p.type}-${p.name}-${p.km}`}
                        className="flex gap-3 p-4 rounded-xl border border-border bg-card/40"
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
                          <p className="font-semibold text-foreground text-sm">
                            {p.name}
                          </p>
                          {p.km != null && (
                            <p className="text-xs text-primary">Km {p.km}</p>
                          )}
                          {p.description && (
                            <p className="text-xs text-muted-foreground mt-1">
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
              <p className="text-muted-foreground py-12 text-center">
                {t("eventDetail.noCourse")}
              </p>
            )}
          </TabsContent>

          {(media?.length ?? 0) > 0 ? (
            <TabsContent value="media">
              <EventMediaGallery media={media} />
            </TabsContent>
          ) : null}

          {(canRegister || canGroupRegister) && (
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
                      ? hasEventDayPassed(event.start_date, event.end_date ?? null)
                        ? t("eventDetail.registrationEventPassed")
                        : t("eventDetail.registrationClosed")
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
                    <p className="text-xs text-muted-foreground mt-1">
                      {t("eventDetail.waiverNotConfiguredHint")}
                    </p>
                  </div>
                </div>
              ) : null}
              {paidCheckoutUnavailable ? (
                <div className="p-4 rounded-xl border border-primary/30 bg-primary/5 flex gap-3">
                  <AlertTriangle className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {t("eventDetail.paymentsPausedTitle")}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {t("eventDetail.paymentsPausedBody")}
                    </p>
                  </div>
                </div>
              ) : null}
              {profileIncompleteForCategories ? (
                <div className="p-4 rounded-xl border border-primary/30 bg-primary/5 flex flex-col sm:flex-row sm:items-center gap-3">
                  <p className="text-sm text-muted-foreground flex-1">
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
                  const categoryPaidBlocked = isCategoryPaidCheckoutBlocked(
                    cat,
                    paymentsAvailable,
                  );
                  return (
                    <div
                      key={cat.id}
                      className={`p-5 rounded-xl border bg-card/60 transition-colors ${
                        isRecommended
                          ? "border-accent/50 ring-1 ring-accent/30"
                          : !eligibility.eligible && token
                            ? "border-border/80 opacity-75"
                            : "border-border hover:border-cyan/40"
                      }`}
                    >
                      <div className="flex justify-between items-start gap-3 mb-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-bold text-foreground">{cat.name}</h3>
                            {isRecommended ? (
                              <span className="inline-flex items-center gap-1 text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-accent/15 text-accent border border-accent/30">
                                <Sparkles className="w-3 h-3" />
                                {t("eventDetail.categoryRecommended")}
                              </span>
                            ) : null}
                          </div>
                          {cat.distance_km != null && (
                            <p className="text-xs text-muted-foreground">
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
                          <span className="text-[10px] uppercase px-2 py-0.5 rounded border border-border text-muted-foreground">
                            {cat.difficulty}
                          </span>
                        )}
                      </div>
                      {cat.description && (
                        <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                          {cat.description}
                        </p>
                      )}
                      <div className="flex justify-between items-center text-sm border-t border-border pt-3">
                        <span className="text-muted-foreground">
                          {absorbAllPricing
                            ? t("eventDetail.finalPrice")
                            : t("eventDetail.inscription")}
                        </span>
                        <div className="text-right">
                          <span className="font-bold text-primary text-base">
                            {(absorbAllPricing
                              ? cat.total_formatted
                              : cat.price_formatted) ||
                              formatPriceMxn(
                                absorbAllPricing
                                  ? (cat.total_cents ?? cat.price_cents)
                                  : cat.price_cents,
                                i18n.language,
                              )}
                          </span>
                          {absorbAllPricing ? (
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                              {t("eventDetail.finalPriceIvaIncluded")}
                            </p>
                          ) : null}
                        </div>
                      </div>
                      {spotsLeft != null && !isSoldOut && (
                        <p className="text-xs text-muted-foreground mt-3">
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
                            !eligibility.eligible ||
                            categoryPaidBlocked
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
                      ) : categoryPaidBlocked ? (
                        <div className="w-full mt-4 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2.5 text-center">
                          <p className="text-xs text-muted-foreground">
                            {t("eventDetail.categoryPaymentsPaused")}
                          </p>
                        </div>
                      ) : (
                        <Button
                          type="button"
                          onClick={() => startRegistration(cat)}
                          disabled={
                            !registrationOpen ||
                            waiverMisconfigured ||
                            !eligibility.eligible
                          }
                          className="w-full mt-4 bg-cyan/10 text-primary border border-cyan/40 hover:bg-cyan hover:text-navy-deep disabled:opacity-50"
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
                  className="flex items-center justify-between gap-3 p-4 rounded-xl border border-border bg-card/40"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground break-words">
                      {wave.name}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {formatEventDate(wave.starts_at, i18n.language)}
                    </p>
                  </div>
                  <p className="text-sm text-muted-foreground shrink-0 whitespace-nowrap">
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
      <GroupRegistrationWizard />
    </div>
  );
}

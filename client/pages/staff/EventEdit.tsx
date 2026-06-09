import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFormik } from "formik";
import * as Yup from "yup";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  LayoutDashboard,
  Loader2,
  Plus,
  Rocket,
  Save,
  Trash2,
  Trophy,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useToast } from "@/hooks/use-toast";
import MetaHelmet from "@/components/MetaHelmet";
import PortalErrorAlert from "@/components/athlete/PortalErrorAlert";
import StaffCourseSummaryCard from "@/components/staff/StaffCourseSummaryCard";
import StaffCourseWizardDialog from "@/components/staff/StaffCourseWizardDialog";
import StaffEventCategoriesSection from "@/components/staff/StaffEventCategoriesSection";
import StaffEventWaiversSection from "@/components/staff/StaffEventWaiversSection";
import EventAssetUpload from "@/components/staff/EventAssetUpload";
import RichHtmlEditor from "@/components/blog/RichHtmlEditor";
import EventPublishPreviewDialog from "@/components/staff/EventPublishPreviewDialog";
import StaffEventPublishChecklist, {
  computeEventPublishReadiness,
} from "@/components/staff/StaffEventPublishChecklist";
import StaffStatusBadge from "@/components/staff/StaffStatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import {
  VerticalTabsList,
  VerticalTabsTrigger,
} from "@/components/ui/scrollable-tabs";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import GeoCitySelector from "@/components/geo/GeoCitySelector";
import {
  enforceCatalogCityOnEventBody,
  isCatalogCitySelectionValid,
} from "@/utils/geoCityValidation";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchGeoCities, fetchGeoStates } from "@/store/slices/geoSlice";
import { fetchSportTypes } from "@/store/slices/marketplaceSlice";
import {
  clearEventDetail,
  createDiscountCode,
  createOrganizerEvent,
  deleteDiscountCode,
  fetchDiscountCodes,
  fetchEventCourse,
  fetchEventMedia,
  fetchEventSponsors,
  fetchEventWaitlist,
  fetchEventWaivers,
  fetchRegistrationFields,
  fetchScheduleWaves,
  fetchStaffEventDetail,
  publishStaffEvent,
  updateDiscountCode,
  updateEventCourse,
  updateEventMedia,
  updateEventSponsors,
  offerWaitlistSpot,
  revokeWaitlistEntry,
  updateRegistrationFields,
  updateScheduleWaves,
  updateStaffEvent,
} from "@/store/slices/staffPortalSlice";
import type {
  EventRegistrationFieldInput,
  EventSponsorInput,
  SponsorTier,
  StaffDiscountCodeInput,
  StaffEventCoursePayload,
  StaffMediaAssetRow,
  StaffScheduleWaveInput,
} from "@shared/api";
import { getNumberLocale } from "@/utils/dateLocale";
import { buildStaffEventBody } from "@/utils/buildStaffEventBody";
import { fromDatetimeLocal, toDatetimeLocal } from "@/utils/datetimeLocal";
import { uploadEventAssetToCdn } from "@/lib/cdn-upload";
import {
  createBlobPreviewUrl,
  revokeBlobUrl,
  uploadPendingHtmlImages,
} from "@/lib/blog-pending-images";
import { validateBlogImageFile } from "@/utils/blogImageValidation";
import {
  canOrganizerCreateEvents,
  canOrganizerEditEvents,
} from "@/utils/staffNav";

const eventSchema = Yup.object({
  title: Yup.string().trim().required("Required").max(255),
  sport_type_id: Yup.number().min(1, "Required").required("Required"),
  start_date: Yup.string().required("Required"),
});

export default function StaffEventEdit() {
  const { eventId: eventIdParam } = useParams<{ eventId: string }>();
  const isNew = eventIdParam === "new";
  const eventId = isNew ? null : Number(eventIdParam);
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const dispatch = useAppDispatch();
  const { role, user } = useAppSelector((s) => s.staffAuth);
  const { sportTypes } = useAppSelector((s) => s.marketplace);
  const {
    eventDetail,
    eventSponsors,
    registrationFields,
    eventWaivers,
    scheduleWaves,
    eventCourse,
    discountCodes,
    eventMedia,
    waitlistEntries,
    loadingEventMedia,
    eventMediaError,
    savingEventMedia,
    loadingWaitlist,
    waitlistError,
    offeringWaitlist,
    loadingEventDetail,
    eventDetailError,
    savingEvent,
    saveEventError,
    publishingEvent,
    publishError,
    savingSponsors,
    sponsorsError,
    savingFields,
    fieldsError,
    savingWaves,
    wavesError,
    savingCourse,
    courseError,
    savingDiscountCode,
    discountCodesError,
  } = useAppSelector((s) => s.staffPortal);

  const [tab, setTab] = useState("details");
  const [courseWizardOpen, setCourseWizardOpen] = useState(false);
  const [publishPreviewOpen, setPublishPreviewOpen] = useState(false);
  const [uploadingAssets, setUploadingAssets] = useState(false);
  const [heroPendingFile, setHeroPendingFile] = useState<File | null>(null);
  const [heroPreviewUrl, setHeroPreviewUrl] = useState<string | null>(null);
  const sponsorPendingRef = useRef<Map<number, File>>(new Map());
  const mediaPendingRef = useRef<Map<number, File>>(new Map());
  const descriptionPendingByUrlRef = useRef<Map<string, File>>(new Map());
  const descriptionDraftUploadIdRef = useRef(`event_draft_${Date.now()}`);
  const [fieldDrafts, setFieldDrafts] = useState<EventRegistrationFieldInput[]>([]);
  const [sponsorDrafts, setSponsorDrafts] = useState<EventSponsorInput[]>([]);
  const [waveDrafts, setWaveDrafts] = useState<StaffScheduleWaveInput[]>([]);
  const [courseDraft, setCourseDraft] = useState<StaffEventCoursePayload | null>(null);
  const [discountDraft, setDiscountDraft] = useState<StaffDiscountCodeInput>({
    code: "",
    discount_type: "percent",
    discount_value: 10,
    applies_to: "registration",
  });
  const [mediaDrafts, setMediaDrafts] = useState<StaffMediaAssetRow[]>([]);
  const [geoStateId, setGeoStateId] = useState<number | null>(null);
  const [geoCityId, setGeoCityId] = useState<number | null>(null);
  const [geoLegacySearchResolved, setGeoLegacySearchResolved] = useState(false);
  const geoStates = useAppSelector((s) => s.geo.states);
  const geoCitiesByState = useAppSelector((s) => s.geo.citiesByStateId);
  const numLocale = getNumberLocale(i18n.language);
  const isAdmin = role === "admin";

  const descriptionUploadId = useMemo(
    () =>
      eventId != null
        ? `event_${eventId}_desc`
        : descriptionDraftUploadIdRef.current,
    [eventId],
  );

  const stageDescriptionImage = useCallback(
    (file: File): string | null => {
      const validationError = validateBlogImageFile(file, t);
      if (validationError) {
        toast({
          title: t("staffPortal.eventEdit.descriptionImageFailed"),
          description: validationError,
          variant: "destructive",
        });
        return null;
      }
      const previewUrl = createBlobPreviewUrl(file);
      descriptionPendingByUrlRef.current.set(previewUrl, file);
      return previewUrl;
    },
    [t, toast],
  );
  const isOrganizer = role === "organizer";
  const staffRole = role === "admin" ? "admin" : "organizer";
  const organizerMemberRole = user?.type === "organizer" ? user.role : "organizer";
  const canEditEvents = isAdmin || canOrganizerEditEvents(organizerMemberRole);
  const canCreateEvents = isAdmin || canOrganizerCreateEvents(organizerMemberRole);
  const canManageEventContent = !isNew && eventId != null && (isAdmin || (isOrganizer && canEditEvents));
  const canManageSponsors = canManageEventContent;
  const canManageCategories = canManageEventContent;

  useEffect(() => {
    dispatch(fetchSportTypes());
    dispatch(fetchGeoStates("MX"));
    return () => {
      dispatch(clearEventDetail());
    };
  }, [dispatch]);

  useEffect(() => {
    if (!isNew && eventId && role) {
      dispatch(fetchStaffEventDetail({ eventId, role }));
    }
  }, [dispatch, isNew, eventId, role]);

  useEffect(() => {
    if (canManageSponsors && eventId && role) {
      dispatch(fetchEventSponsors({ eventId, role: role === "admin" ? "admin" : "organizer" }));
    }
    if (canManageEventContent && eventId && role) {
      const staffRole = role === "admin" ? "admin" : "organizer";
      dispatch(fetchRegistrationFields({ eventId, role: staffRole }));
      dispatch(fetchEventWaivers({ eventId, role: staffRole }));
      dispatch(fetchScheduleWaves({ eventId, role }));
      dispatch(fetchEventCourse({ eventId, role }));
      dispatch(fetchDiscountCodes({ eventId, role }));
      dispatch(fetchEventMedia({ eventId, role: staffRole }));
      dispatch(fetchEventWaitlist({ eventId, role: staffRole }));
    }
  }, [dispatch, canManageSponsors, canManageEventContent, eventId, role]);

  useEffect(() => {
    setMediaDrafts(
      eventMedia.map((m, i) => ({
        ...m,
        sort_order: m.sort_order ?? i,
        asset_type: m.asset_type || "gallery",
      })),
    );
  }, [eventMedia]);

  useEffect(() => {
    setSponsorDrafts(
      eventSponsors.map((s, i) => ({
        name: s.name,
        logo_url: s.logo_url,
        website_url: s.website_url,
        tier: s.tier,
        sort_order: s.sort_order ?? i,
      })),
    );
  }, [eventSponsors]);

  useEffect(() => {
    setFieldDrafts(
      registrationFields.map((f, i) => ({
        field_key: f.field_key,
        label: f.label,
        field_type: f.field_type,
        is_required: Boolean(f.is_required),
        sort_order: f.sort_order ?? i,
        is_active: f.is_active !== 0 && f.is_active !== false,
        options: (() => {
          try {
            if (typeof f.options_json === "string") {
              return JSON.parse(f.options_json || "[]") as string[];
            }
            if (Array.isArray(f.options_json)) return f.options_json;
          } catch {
            /* ignore invalid JSON */
          }
          return [];
        })(),
      })),
    );
  }, [registrationFields]);

  useEffect(() => {
    setWaveDrafts(
      scheduleWaves.map((w, i) => ({
        name: w.name,
        starts_at: toDatetimeLocal(w.starts_at),
        event_category_id: w.event_category_id ?? null,
        capacity: w.capacity ?? null,
        sort_order: w.sort_order ?? i,
      })),
    );
  }, [scheduleWaves]);

  useEffect(() => {
    if (eventCourse) {
      setCourseDraft(eventCourse);
    }
  }, [eventCourse]);

  const event = eventDetail?.event;

  if (isOrganizer && !isAdmin) {
    if (isNew && !canCreateEvents) {
      return <Navigate to="/staff/events" replace />;
    }
    if (!isNew && !canEditEvents) {
      return <Navigate to="/staff/events" replace />;
    }
  }

  const formik = useFormik({
    enableReinitialize: true,
    initialValues: {
      title: event?.title ?? "",
      slug: event?.slug ?? "",
      sport_type_id: event?.sport_type_id ?? (sportTypes[0]?.id ?? 0),
      short_description: event?.short_description ?? "",
      description: event?.description ?? "",
      status: event?.status ?? "draft",
      visibility: event?.visibility ?? "public",
      featured: Boolean(event?.featured),
      requires_waiver: Boolean(event?.requires_waiver),
      start_date: toDatetimeLocal(event?.start_date),
      end_date: toDatetimeLocal(event?.end_date),
      registration_opens_at: toDatetimeLocal(event?.registration_opens_at),
      registration_closes_at: toDatetimeLocal(event?.registration_closes_at),
      location_city: event?.location_city ?? "",
      location_state: event?.location_state ?? "",
      location_name: event?.location_name ?? "",
      location_lat:
        event?.location_lat != null && event.location_lat !== ""
          ? String(event.location_lat)
          : "",
      location_lng:
        event?.location_lng != null && event.location_lng !== ""
          ? String(event.location_lng)
          : "",
      hero_image_url: event?.hero_image_url ?? "",
      max_registrations: event?.max_registrations?.toString() ?? "",
    },
    validationSchema: eventSchema,
    onSubmit: async (values) => {
      if (!role) return;
      if (!isCatalogCitySelectionValid(geoCityId, values.location_city)) {
        toast({
          title: t("geo.citySelector.invalidSelectionTitle"),
          description: isAdmin
            ? t("geo.citySelector.supportMessageAdmin")
            : t("geo.citySelector.supportMessageOrganizer"),
          variant: "destructive",
        });
        return;
      }
      setUploadingAssets(true);
      try {
        let heroUrl = values.hero_image_url.trim() || null;
        if (heroPendingFile && eventId) {
          heroUrl = await uploadEventAssetToCdn(
            heroPendingFile,
            `event_${eventId}_hero`,
            isAdmin,
            "hero",
          );
          setHeroPendingFile(null);
          if (heroPreviewUrl?.startsWith("blob:")) revokeBlobUrl(heroPreviewUrl);
          setHeroPreviewUrl(heroUrl);
          void formik.setFieldValue("hero_image_url", heroUrl ?? "");
        }

        let description = values.description;
        if (descriptionPendingByUrlRef.current.size > 0) {
          description = await uploadPendingHtmlImages({
            html: values.description,
            pendingByUrl: descriptionPendingByUrlRef.current,
            uploadId: descriptionUploadId,
            isAdmin,
          });
          for (const blobUrl of descriptionPendingByUrlRef.current.keys()) {
            if (!description.includes(blobUrl)) {
              revokeBlobUrl(blobUrl);
            }
          }
          descriptionPendingByUrlRef.current.clear();
          void formik.setFieldValue("description", description);
        }

        const body = enforceCatalogCityOnEventBody(
          buildStaffEventBody(values, {
            hero_image_url: heroUrl,
            description: description.trim() || null,
          }),
          geoCityId,
        );

        if (isNew) {
          const result = await dispatch(createOrganizerEvent(body));
          if (createOrganizerEvent.fulfilled.match(result)) {
            navigate(`/staff/events/${result.payload.event.id}/edit`, { replace: true });
          }
          return;
        }

        if (eventId) {
          await dispatch(updateStaffEvent({ eventId, role, body }));
        }
      } finally {
        setUploadingAssets(false);
      }
    },
  });

  useEffect(() => {
    if (!event?.location_city) {
      setGeoStateId(null);
      setGeoCityId(null);
      return;
    }
    if (geoStates.length === 0) return;

    const stateMatch = geoStates.find(
      (s) =>
        s.name === event.location_state ||
        s.code === event.location_state ||
        (!event.location_state && s.name === "CDMX"),
    );
    if (!stateMatch) return;

    setGeoStateId((prev) => (prev === stateMatch.id ? prev : stateMatch.id));
    if (!geoCitiesByState[stateMatch.id]) {
      void dispatch(fetchGeoCities({ stateId: stateMatch.id }));
    }
  }, [
    dispatch,
    event?.location_city,
    event?.location_state,
    geoStates,
    geoCitiesByState,
  ]);

  useEffect(() => {
    if (!event?.location_city || geoStateId == null) return;
    const cities = geoCitiesByState[geoStateId] ?? [];
    if (cities.length === 0) return;
    const cityMatch = cities.find((c) => c.name === event.location_city);
    if (cityMatch) {
      setGeoCityId((prev) => (prev === cityMatch.id ? prev : cityMatch.id));
    }
  }, [event?.location_city, geoStateId, geoCitiesByState]);

  useEffect(() => {
    if (!event?.location_city || event.location_state || geoStateId) {
      setGeoLegacySearchResolved(false);
      return;
    }
    void dispatch(fetchGeoCities({ q: event.location_city })).then((action) => {
      setGeoLegacySearchResolved(true);
      if (!fetchGeoCities.fulfilled.match(action)) return;
      const match = action.payload.cities.find((c) => c.name === event.location_city);
      if (!match) return;
      setGeoStateId(match.state_id);
      setGeoCityId(match.id);
      void formik.setFieldValue("location_state", match.state_name);
    });
  }, [dispatch, event?.location_city, event?.location_state, geoStateId]);

  useEffect(() => {
    if (event?.hero_image_url && !heroPendingFile) {
      setHeroPreviewUrl(event.hero_image_url);
    }
  }, [event?.hero_image_url, heroPendingFile]);

  useEffect(() => {
    if (event?.id) {
      descriptionPendingByUrlRef.current.clear();
    }
  }, [event?.id]);

  useEffect(() => {
    return () => {
      for (const url of descriptionPendingByUrlRef.current.keys()) {
        revokeBlobUrl(url);
      }
    };
  }, []);

  const activeWaivers = useMemo(
    () => eventWaivers.filter((w) => Boolean(w.is_active)),
    [eventWaivers],
  );

  const waiverPublishBlocked =
    formik.values.requires_waiver &&
    !activeWaivers.some((w) => {
      if (w.content_type === "pdf") return Boolean(w.pdf_url?.trim());
      if (w.content_type === "both") {
        return Boolean(w.content_html?.trim() || w.pdf_url?.trim());
      }
      return Boolean(w.content_html?.trim());
    });

  const publishReadiness = useMemo(
    () =>
      computeEventPublishReadiness({
        title: formik.values.title,
        sportTypeId: formik.values.sport_type_id,
        startDate: formik.values.start_date,
        categoryCount: eventDetail?.categories?.length ?? 0,
        heroUrl: heroPreviewUrl || formik.values.hero_image_url,
        locationLat: formik.values.location_lat,
        locationLng: formik.values.location_lng,
        hasWaiver: activeWaivers.some((w) => {
          if (w.content_type === "pdf") return Boolean(w.pdf_url?.trim());
          if (w.content_type === "both") {
            return Boolean(w.content_html?.trim() || w.pdf_url?.trim());
          }
          return Boolean(w.content_html?.trim());
        }),
        hasCourse: Boolean(courseDraft?.routeGeojson),
      }),
    [
      activeWaivers,
      courseDraft?.routeGeojson,
      eventDetail?.categories?.length,
      formik.values,
      heroPreviewUrl,
    ],
  );

  const handleEventLocationFromCourse = useCallback(
    (lat: number, lng: number) => {
      void formik.setFieldValue("location_lat", String(lat));
      void formik.setFieldValue("location_lng", String(lng));
      if (!eventId || !role) return;
      void dispatch(
        updateStaffEvent({
          eventId,
          role,
          body: enforceCatalogCityOnEventBody(
            buildStaffEventBody(formik.values, {
              location_lat: lat,
              location_lng: lng,
            }),
            geoCityId,
          ),
        }),
      );
    },
    [dispatch, eventId, formik, geoCityId, role],
  );

  if (isNew && isAdmin) {
    return <Navigate to="/staff/events" replace />;
  }

  if (!isNew && (!eventId || Number.isNaN(eventId))) {
    return <Navigate to="/staff/events" replace />;
  }

  const handlePublish = async () => {
    if (!eventId || !role) return;
    const result = await dispatch(publishStaffEvent({ eventId, role }));
    if (publishStaffEvent.fulfilled.match(result)) {
      formik.setFieldValue("status", "published");
      setPublishPreviewOpen(false);
    }
  };

  const handleSaveSponsors = async () => {
    if (!eventId || !role) return;
    setUploadingAssets(true);
    try {
      const next = [...sponsorDrafts];
      for (const [index, file] of sponsorPendingRef.current.entries()) {
        const url = await uploadEventAssetToCdn(
          file,
          `event_${eventId}_sponsor_${index}`,
          isAdmin,
          "sponsor",
        );
        if (next[index]) next[index] = { ...next[index], logo_url: url };
      }
      sponsorPendingRef.current.clear();
      setSponsorDrafts(next);
      dispatch(
        updateEventSponsors({
          eventId,
          role: staffRole,
          sponsors: next.filter((s) => s.name.trim()),
        }),
      );
    } finally {
      setUploadingAssets(false);
    }
  };

  const handleSaveFields = () => {
    if (!eventId || !role) return;
    dispatch(
      updateRegistrationFields({
        eventId,
        role: staffRole,
        fields: fieldDrafts.filter((f) => f.label.trim()),
      }),
    );
  };

  const handleSaveMedia = async () => {
    if (!eventId || !role) return;
    setUploadingAssets(true);
    try {
      const next = [...mediaDrafts];
      for (const [index, file] of mediaPendingRef.current.entries()) {
        const url = await uploadEventAssetToCdn(
          file,
          `event_${eventId}_media_${index}`,
          isAdmin,
          "image",
        );
        if (next[index]) next[index] = { ...next[index], url };
      }
      mediaPendingRef.current.clear();
      setMediaDrafts(next);
      dispatch(
        updateEventMedia({
          eventId,
          role: staffRole,
          media: next.filter((m) => m.url.trim()),
        }),
      );
    } finally {
      setUploadingAssets(false);
    }
  };

  const handleSaveWaves = () => {
    if (!eventId || !role) return;
    dispatch(
      updateScheduleWaves({
        eventId,
        role,
        waves: waveDrafts
          .filter((w) => w.name.trim() && w.starts_at)
          .map((w, i) => ({
            ...w,
            starts_at: fromDatetimeLocal(w.starts_at) ?? w.starts_at,
            sort_order: i,
          })),
      }),
    );
  };

  const handleSaveCourse = (course?: StaffEventCoursePayload) => {
    const payload = course ?? courseDraft;
    if (!eventId || !payload || !role) return;
    setCourseDraft(payload);
    return dispatch(updateEventCourse({ eventId, role, course: payload }));
  };

  const handleWizardSave = async (course: StaffEventCoursePayload) => {
    const result = await handleSaveCourse(course);
    if (result && updateEventCourse.fulfilled.match(result)) {
      setCourseWizardOpen(false);
    }
  };

  const handleCreateDiscount = () => {
    if (!eventId || !role || !discountDraft.code.trim()) return;
    dispatch(createDiscountCode({ eventId, role: staffRole, body: discountDraft })).then((result) => {
      if (createDiscountCode.fulfilled.match(result)) {
        setDiscountDraft({
          code: "",
          discount_type: "percent",
          discount_value: 10,
          applies_to: "registration",
        });
      }
    });
  };

  const pageTitle = isNew
    ? t("staffPortal.eventEdit.createTitle")
    : t("staffPortal.eventEdit.editTitle");

  return (
    <div className="max-w-4xl mx-auto w-full min-w-0 overflow-x-clip space-y-6">
      <MetaHelmet title={pageTitle} description={t("staffPortal.eventEdit.subtitle")} />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Link
            to="/staff/events"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-cyan mb-2"
          >
            <ArrowLeft className="w-4 h-4" />
            {t("staffPortal.eventEdit.back")}
          </Link>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold">{pageTitle}</h1>
            {event ? <StaffStatusBadge status={event.status} /> : null}
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {t("staffPortal.eventEdit.subtitle")}
          </p>
        </div>
        {!isNew && event?.status !== "published" ? (
          <Button
            variant="outline"
            className="border-cyan text-cyan shrink-0"
            disabled={publishingEvent || !publishReadiness.hasCategory || waiverPublishBlocked}
            onClick={() => setPublishPreviewOpen(true)}
          >
            {publishingEvent ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <Rocket className="w-4 h-4 mr-2" />
            )}
            {t("staffPortal.eventEdit.publish")}
          </Button>
        ) : null}
        {!isNew && eventId ? (
          <Button asChild variant="outline" className="shrink-0">
            <Link to={`/staff/events/${eventId}`}>
              <LayoutDashboard className="w-4 h-4 mr-2" />
              {t("staffPortal.events.manage")}
            </Link>
          </Button>
        ) : null}
        {!isNew && isOrganizer && eventId ? (
          <Button asChild variant="outline" className="shrink-0">
            <Link to={`/staff/events/${eventId}/results`}>
              <Trophy className="w-4 h-4 mr-2" />
              {t("staffPortal.results.manage")}
            </Link>
          </Button>
        ) : null}
      </div>

      <PortalErrorAlert
        error={eventDetailError || saveEventError || publishError}
        onRetry={() => {
          if (!isNew && eventId && role) {
            dispatch(fetchStaffEventDetail({ eventId, role }));
          }
        }}
      />

      <EventPublishPreviewDialog
        open={publishPreviewOpen}
        onOpenChange={setPublishPreviewOpen}
        event={event}
        categories={eventDetail?.categories ?? []}
        sponsors={sponsorDrafts}
        courseDistanceKm={courseDraft?.distanceKm}
        waiverCount={activeWaivers.length}
        requiresWaiver={formik.values.requires_waiver}
        confirming={publishingEvent}
        onConfirm={() => void handlePublish()}
      />

      {loadingEventDetail && !isNew ? (
        <p className="text-muted-foreground">{t("common.loading")}</p>
      ) : (
        <>
          {!isNew ? (
            <StaffEventPublishChecklist
              readiness={publishReadiness}
              onNavigate={setTab}
              className="lg:hidden"
            />
          ) : null}
        <Tabs value={tab} onValueChange={setTab} className="flex flex-col lg:flex-row gap-4 lg:gap-6 items-start">
          <div className="w-full lg:w-56 shrink-0 space-y-4">
            <VerticalTabsList aria-label={t("staffPortal.eventEdit.sectionsLabel")}>
            <VerticalTabsTrigger value="details">{t("staffPortal.eventEdit.tabDetails")}</VerticalTabsTrigger>
            {!isNew ? (
              <VerticalTabsTrigger value="categories">
                {t("staffPortal.eventEdit.tabCategories")}
              </VerticalTabsTrigger>
            ) : null}
            {canManageSponsors ? (
              <VerticalTabsTrigger value="sponsors">{t("staffPortal.eventEdit.tabSponsors")}</VerticalTabsTrigger>
            ) : null}
            {canManageCategories ? (
              <>
                <VerticalTabsTrigger value="fields">{t("staffPortal.eventEdit.tabFields")}</VerticalTabsTrigger>
                <VerticalTabsTrigger value="waiver">{t("staffPortal.eventEdit.tabWaiver")}</VerticalTabsTrigger>
                <VerticalTabsTrigger value="waves">{t("staffPortal.eventEdit.tabWaves")}</VerticalTabsTrigger>
                <VerticalTabsTrigger value="course">{t("staffPortal.eventEdit.tabCourse")}</VerticalTabsTrigger>
                <VerticalTabsTrigger value="discounts">{t("staffPortal.eventEdit.tabDiscounts")}</VerticalTabsTrigger>
                <VerticalTabsTrigger value="waitlist">{t("staffPortal.eventEdit.tabWaitlist")}</VerticalTabsTrigger>
                <VerticalTabsTrigger value="media">{t("staffPortal.eventEdit.tabMedia")}</VerticalTabsTrigger>
              </>
            ) : null}
          </VerticalTabsList>
            {!isNew ? (
              <StaffEventPublishChecklist
                readiness={publishReadiness}
                onNavigate={setTab}
                className="hidden lg:block"
              />
            ) : null}
          </div>

          <div className="flex-1 min-w-0 w-full">

          <TabsContent value="details" className="mt-0">
            <form onSubmit={formik.handleSubmit} className="card-sport p-6 space-y-5">
              <p className="text-sm text-muted-foreground">
                {t("staffPortal.eventEdit.detailsHelp")}
              </p>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2 space-y-2">
                  <Label htmlFor="title">{t("staffPortal.eventEdit.fieldTitle")}</Label>
                  <Input id="title" {...formik.getFieldProps("title")} />
                  {formik.touched.title && formik.errors.title ? (
                    <p className="text-xs text-destructive">{formik.errors.title}</p>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="sport_type_id">{t("staffPortal.eventEdit.fieldSport")}</Label>
                  <Select
                    value={String(formik.values.sport_type_id)}
                    onValueChange={(v) => formik.setFieldValue("sport_type_id", Number(v))}
                  >
                    <SelectTrigger id="sport_type_id">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {sportTypes.map((st) => (
                        <SelectItem key={st.id} value={String(st.id)}>
                          {st.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="start_date">{t("staffPortal.eventEdit.fieldStart")}</Label>
                  <Input
                    id="start_date"
                    type="datetime-local"
                    {...formik.getFieldProps("start_date")}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="end_date">{t("staffPortal.eventEdit.fieldEnd")}</Label>
                  <Input id="end_date" type="datetime-local" {...formik.getFieldProps("end_date")} />
                </div>

                <GeoCitySelector
                  stateId={geoStateId}
                  cityId={geoCityId}
                  cityName={formik.values.location_city}
                  stateName={formik.values.location_state}
                  staffRole={isAdmin ? "admin" : "organizer"}
                  legacySearchResolved={geoLegacySearchResolved}
                  onChange={(sel) => {
                    setGeoStateId(sel.stateId);
                    setGeoCityId(sel.geoCityId);
                    setGeoLegacySearchResolved(false);
                    void formik.setFieldValue("location_city", sel.city);
                    void formik.setFieldValue("location_state", sel.state);
                    if (!sel.city) {
                      void formik.setFieldValue("location_lat", "");
                      void formik.setFieldValue("location_lng", "");
                      return;
                    }
                    if (sel.lat != null) {
                      void formik.setFieldValue("location_lat", String(sel.lat));
                    }
                    if (sel.lng != null) {
                      void formik.setFieldValue("location_lng", String(sel.lng));
                    }
                  }}
                />

                <div className="space-y-2">
                  <Label htmlFor="location_name">{t("staffPortal.eventEdit.fieldVenue")}</Label>
                  <Input id="location_name" {...formik.getFieldProps("location_name")} />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="location_lat">{t("staffPortal.eventEdit.fieldLat")}</Label>
                  <Input
                    id="location_lat"
                    type="number"
                    step="any"
                    placeholder="19.4326"
                    {...formik.getFieldProps("location_lat")}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="location_lng">{t("staffPortal.eventEdit.fieldLng")}</Label>
                  <Input
                    id="location_lng"
                    type="number"
                    step="any"
                    placeholder="-99.1332"
                    {...formik.getFieldProps("location_lng")}
                  />
                  <p className="text-xs text-muted-foreground">
                    {t("staffPortal.eventEdit.fieldLocationHint")}
                  </p>
                </div>

                {!isNew ? (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="status">{t("staffPortal.eventEdit.fieldStatus")}</Label>
                      <Select
                        value={formik.values.status}
                        onValueChange={(v) => formik.setFieldValue("status", v)}
                      >
                        <SelectTrigger id="status">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {["draft", "published", "completed", "cancelled"].map((s) => (
                            <SelectItem key={s} value={s}>
                              {s}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="visibility">{t("staffPortal.eventEdit.fieldVisibility")}</Label>
                      <Select
                        value={formik.values.visibility}
                        onValueChange={(v) => formik.setFieldValue("visibility", v)}
                      >
                        <SelectTrigger id="visibility">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {["public", "private", "unlisted"].map((s) => (
                            <SelectItem key={s} value={s}>
                              {s}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <label className="sm:col-span-2 flex items-start gap-3 rounded-lg border border-border/60 p-3 cursor-pointer">
                      <Checkbox
                        checked={formik.values.requires_waiver}
                        onCheckedChange={(v) => formik.setFieldValue("requires_waiver", v === true)}
                      />
                      <span className="text-sm leading-snug">
                        <span className="font-medium block">
                          {t("staffPortal.eventEdit.fieldRequiresWaiver")}
                        </span>
                        <span className="text-muted-foreground text-xs">
                          {t("staffPortal.eventEdit.fieldRequiresWaiverHint")}
                        </span>
                      </span>
                    </label>
                  </>
                ) : null}

                <div className="space-y-2">
                  <Label htmlFor="max_registrations">
                    {t("staffPortal.eventEdit.fieldMaxRegs")}
                  </Label>
                  <Input
                    id="max_registrations"
                    type="number"
                    min={0}
                    {...formik.getFieldProps("max_registrations")}
                  />
                </div>

                <div className="sm:col-span-2 space-y-2">
                  <Label>{t("staffPortal.eventEdit.fieldHero")}</Label>
                  <EventAssetUpload
                    kind="image"
                    previewUrl={heroPreviewUrl}
                    onSelectFile={(file) => {
                      if (heroPreviewUrl?.startsWith("blob:")) revokeBlobUrl(heroPreviewUrl);
                      setHeroPendingFile(file);
                      setHeroPreviewUrl(createBlobPreviewUrl(file));
                    }}
                    onClear={() => {
                      if (heroPreviewUrl?.startsWith("blob:")) revokeBlobUrl(heroPreviewUrl);
                      setHeroPendingFile(null);
                      setHeroPreviewUrl(null);
                      void formik.setFieldValue("hero_image_url", "");
                    }}
                  />
                  <Input
                    id="hero_image_url"
                    placeholder={t("staffPortal.eventEdit.fieldHeroUrlFallback")}
                    {...formik.getFieldProps("hero_image_url")}
                  />
                  <p className="text-xs text-muted-foreground">
                    {t("staffPortal.eventEdit.fieldHeroHint")}
                  </p>
                </div>

                {!isNew ? (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="registration_opens_at">
                        {t("staffPortal.eventEdit.fieldRegOpens")}
                      </Label>
                      <Input
                        id="registration_opens_at"
                        type="datetime-local"
                        {...formik.getFieldProps("registration_opens_at")}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="registration_closes_at">
                        {t("staffPortal.eventEdit.fieldRegCloses")}
                      </Label>
                      <Input
                        id="registration_closes_at"
                        type="datetime-local"
                        {...formik.getFieldProps("registration_closes_at")}
                      />
                    </div>
                  </>
                ) : null}

                <div className="sm:col-span-2 space-y-2">
                  <Label htmlFor="short_description">
                    {t("staffPortal.eventEdit.fieldShortDesc")}
                  </Label>
                  <Textarea
                    id="short_description"
                    rows={2}
                    {...formik.getFieldProps("short_description")}
                  />
                </div>

                <div className="sm:col-span-2 space-y-2">
                  <Label htmlFor="description">{t("staffPortal.eventEdit.fieldDesc")}</Label>
                  <p className="text-xs text-muted-foreground">
                    {t("staffPortal.eventEdit.fieldDescHint")}
                  </p>
                  <RichHtmlEditor
                    value={formik.values.description}
                    onChange={(html) => void formik.setFieldValue("description", html)}
                    onStageImage={stageDescriptionImage}
                    placeholder={t("staffPortal.eventEdit.fieldDescPlaceholder")}
                  />
                </div>
              </div>

              <Button type="submit" disabled={savingEvent || uploadingAssets} className="w-full sm:w-auto">
                {savingEvent || uploadingAssets ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                {uploadingAssets
                  ? t("staffPortal.eventEdit.savingAssets")
                  : isNew
                    ? t("staffPortal.eventEdit.create")
                    : t("staffPortal.eventEdit.save")}
              </Button>
            </form>
          </TabsContent>

          {!isNew ? (
            <TabsContent value="categories" className="mt-0 space-y-4">
              {eventId ? (
                <StaffEventCategoriesSection
                  eventId={eventId}
                  categories={eventDetail?.categories ?? []}
                  canManage={canManageCategories}
                  staffRole={staffRole}
                />
              ) : null}
            </TabsContent>
          ) : null}

          {canManageSponsors ? (
            <TabsContent value="sponsors" className="mt-0 space-y-4">
              <div className="card-sport p-6 space-y-4">
                <div>
                  <h2 className="font-semibold">{t("staffPortal.eventEdit.sponsorsTitle")}</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    {t("staffPortal.eventEdit.sponsorsHelp")}
                  </p>
                </div>
                {sponsorsError ? (
                  <p className="text-sm text-destructive">{sponsorsError}</p>
                ) : null}

                <div className="space-y-3">
                  {sponsorDrafts.map((s, i) => (
                    <div key={i} className="grid sm:grid-cols-12 gap-2 items-end">
                      <Input
                        className="sm:col-span-4"
                        placeholder={t("staffPortal.eventEdit.sponsorName")}
                        value={s.name}
                        onChange={(e) => {
                          const next = [...sponsorDrafts];
                          next[i] = { ...next[i], name: e.target.value };
                          setSponsorDrafts(next);
                        }}
                      />
                      <Input
                        className="sm:col-span-3"
                        placeholder={t("staffPortal.eventEdit.sponsorLogo")}
                        value={s.logo_url ?? ""}
                        onChange={(e) => {
                          const next = [...sponsorDrafts];
                          next[i] = { ...next[i], logo_url: e.target.value };
                          setSponsorDrafts(next);
                        }}
                      />
                      <div className="sm:col-span-12">
                        <EventAssetUpload
                          kind="image"
                          compact
                          previewUrl={s.logo_url ?? null}
                          onSelectFile={(file) => {
                            sponsorPendingRef.current.set(i, file);
                            const preview = createBlobPreviewUrl(file);
                            const next = [...sponsorDrafts];
                            next[i] = { ...next[i], logo_url: preview };
                            setSponsorDrafts(next);
                          }}
                          onClear={() => {
                            sponsorPendingRef.current.delete(i);
                            const next = [...sponsorDrafts];
                            next[i] = { ...next[i], logo_url: "" };
                            setSponsorDrafts(next);
                          }}
                        />
                      </div>
                      <Select
                        value={s.tier ?? "partner"}
                        onValueChange={(v) => {
                          const next = [...sponsorDrafts];
                          next[i] = { ...next[i], tier: v as SponsorTier };
                          setSponsorDrafts(next);
                        }}
                      >
                        <SelectTrigger className="sm:col-span-3">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {(["title", "gold", "silver", "bronze", "partner"] as SponsorTier[]).map(
                            (tier) => (
                              <SelectItem key={tier} value={tier}>
                                {tier}
                              </SelectItem>
                            ),
                          )}
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="text-destructive sm:col-span-1"
                        onClick={() =>
                          setSponsorDrafts(sponsorDrafts.filter((_, idx) => idx !== i))
                        }
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>

                <div className="flex flex-col sm:flex-row gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      setSponsorDrafts([
                        ...sponsorDrafts,
                        { name: "", tier: "partner", sort_order: sponsorDrafts.length },
                      ])
                    }
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    {t("staffPortal.eventEdit.addSponsor")}
                  </Button>
                  <Button
                    type="button"
                    onClick={() => void handleSaveSponsors()}
                    disabled={savingSponsors || uploadingAssets}
                  >
                    {savingSponsors ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : (
                      <Save className="w-4 h-4 mr-2" />
                    )}
                    {t("staffPortal.eventEdit.saveSponsors")}
                  </Button>
                </div>
              </div>
            </TabsContent>
          ) : null}

          {canManageCategories ? (
            <TabsContent value="fields" className="mt-0 space-y-4">
              <div className="card-sport p-6 space-y-4">
                <h2 className="font-semibold">{t("staffPortal.eventEdit.fieldsTitle")}</h2>
                <p className="text-sm text-muted-foreground">
                  {t("staffPortal.eventEdit.fieldsSubtitle")}
                </p>
                {fieldsError ? <p className="text-sm text-destructive">{fieldsError}</p> : null}
                <div className="space-y-3">
                  {fieldDrafts.map((f, i) => (
                    <div key={i} className="space-y-2 p-3 rounded-xl border border-gray-700/40">
                      <div className="grid sm:grid-cols-12 gap-2 items-end">
                        <Input
                          className="sm:col-span-4"
                          placeholder={t("staffPortal.eventEdit.fieldLabel")}
                          value={f.label}
                          onChange={(e) => {
                            const next = [...fieldDrafts];
                            next[i] = { ...next[i], label: e.target.value };
                            setFieldDrafts(next);
                          }}
                        />
                        <Select
                          value={f.field_type}
                          onValueChange={(v) => {
                            const next = [...fieldDrafts];
                            next[i] = {
                              ...next[i],
                              field_type: v,
                              options: v === "select" ? next[i].options ?? [""] : undefined,
                            };
                            setFieldDrafts(next);
                          }}
                        >
                          <SelectTrigger className="sm:col-span-3">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {["text", "textarea", "select", "checkbox", "number", "date"].map(
                              (type) => (
                                <SelectItem key={type} value={type}>
                                  {type}
                                </SelectItem>
                              ),
                            )}
                          </SelectContent>
                        </Select>
                        <label className="sm:col-span-2 flex items-center gap-2 text-xs">
                          <input
                            type="checkbox"
                            checked={Boolean(f.is_required)}
                            onChange={(e) => {
                              const next = [...fieldDrafts];
                              next[i] = { ...next[i], is_required: e.target.checked };
                              setFieldDrafts(next);
                            }}
                          />
                          {t("staffPortal.eventEdit.fieldRequired")}
                        </label>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="text-destructive sm:col-span-1"
                          onClick={() => setFieldDrafts(fieldDrafts.filter((_, idx) => idx !== i))}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                      {f.field_type === "select" ? (
                        <div className="space-y-2 pl-1">
                          <p className="text-xs text-muted-foreground">
                            {t("staffPortal.eventEdit.fieldOptions")}
                          </p>
                          {(f.options ?? []).map((opt, oi) => (
                            <div key={oi} className="flex gap-2">
                              <Input
                                className="flex-1"
                                placeholder={t("staffPortal.eventEdit.fieldOptionPlaceholder")}
                                value={opt}
                                onChange={(e) => {
                                  const next = [...fieldDrafts];
                                  const opts = [...(next[i].options ?? [])];
                                  opts[oi] = e.target.value;
                                  next[i] = { ...next[i], options: opts };
                                  setFieldDrafts(next);
                                }}
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="text-destructive shrink-0"
                                onClick={() => {
                                  const next = [...fieldDrafts];
                                  next[i] = {
                                    ...next[i],
                                    options: (next[i].options ?? []).filter((_, idx) => idx !== oi),
                                  };
                                  setFieldDrafts(next);
                                }}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          ))}
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const next = [...fieldDrafts];
                              next[i] = {
                                ...next[i],
                                options: [...(next[i].options ?? []), ""],
                              };
                              setFieldDrafts(next);
                            }}
                          >
                            <Plus className="w-3 h-3 mr-1" />
                            {t("staffPortal.eventEdit.addOption")}
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      setFieldDrafts([
                        ...fieldDrafts,
                        {
                          label: "",
                          field_type: "text",
                          is_required: false,
                          sort_order: fieldDrafts.length,
                        },
                      ])
                    }
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    {t("staffPortal.eventEdit.addField")}
                  </Button>
                  <Button type="button" onClick={handleSaveFields} disabled={savingFields}>
                    {savingFields ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : (
                      <Save className="w-4 h-4 mr-2" />
                    )}
                    {t("staffPortal.eventEdit.saveFields")}
                  </Button>
                </div>
              </div>
            </TabsContent>
          ) : null}

          {canManageCategories ? (
            <TabsContent value="waiver" className="mt-0 space-y-4">
              {eventId ? (
                <StaffEventWaiversSection
                  eventId={eventId}
                  waivers={eventWaivers}
                  canManage={canManageCategories}
                  staffRole={staffRole}
                  isAdmin={isAdmin}
                />
              ) : null}
            </TabsContent>
          ) : null}

          {canManageCategories ? (
            <TabsContent value="waves" className="mt-0 space-y-4">
              <div className="card-sport p-6 space-y-4">
                <h2 className="font-semibold">{t("staffPortal.eventEdit.wavesTitle")}</h2>
                <p className="text-sm text-muted-foreground">
                  {t("staffPortal.eventEdit.wavesSubtitle")}
                </p>
                {wavesError ? <p className="text-sm text-destructive">{wavesError}</p> : null}
                <div className="space-y-3">
                  {waveDrafts.map((w, i) => (
                    <div key={i} className="grid sm:grid-cols-12 gap-2 items-end">
                      <Input
                        className="sm:col-span-3"
                        placeholder={t("staffPortal.eventEdit.waveName")}
                        value={w.name}
                        onChange={(e) => {
                          const next = [...waveDrafts];
                          next[i] = { ...next[i], name: e.target.value };
                          setWaveDrafts(next);
                        }}
                      />
                      <Input
                        className="sm:col-span-3"
                        type="datetime-local"
                        value={w.starts_at}
                        onChange={(e) => {
                          const next = [...waveDrafts];
                          next[i] = { ...next[i], starts_at: e.target.value };
                          setWaveDrafts(next);
                        }}
                      />
                      <Select
                        value={w.event_category_id ? String(w.event_category_id) : "all"}
                        onValueChange={(v) => {
                          const next = [...waveDrafts];
                          next[i] = {
                            ...next[i],
                            event_category_id: v === "all" ? null : Number(v),
                          };
                          setWaveDrafts(next);
                        }}
                      >
                        <SelectTrigger className="sm:col-span-3">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">{t("staffPortal.eventEdit.waveAllCategories")}</SelectItem>
                          {(eventDetail?.categories ?? []).map((c) => (
                            <SelectItem key={c.id} value={String(c.id)}>
                              {c.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        className="sm:col-span-2"
                        type="number"
                        min={0}
                        placeholder={t("staffPortal.eventEdit.waveCapacity")}
                        value={w.capacity ?? ""}
                        onChange={(e) => {
                          const next = [...waveDrafts];
                          next[i] = {
                            ...next[i],
                            capacity: e.target.value ? Number(e.target.value) : null,
                          };
                          setWaveDrafts(next);
                        }}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="text-destructive"
                        onClick={() => setWaveDrafts(waveDrafts.filter((_, idx) => idx !== i))}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      setWaveDrafts([
                        ...waveDrafts,
                        { name: "", starts_at: "", sort_order: waveDrafts.length },
                      ])
                    }
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    {t("staffPortal.eventEdit.addWave")}
                  </Button>
                  <Button type="button" onClick={handleSaveWaves} disabled={savingWaves}>
                    {savingWaves ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : (
                      <Save className="w-4 h-4 mr-2" />
                    )}
                    {t("staffPortal.eventEdit.saveWaves")}
                  </Button>
                </div>
              </div>
            </TabsContent>
          ) : null}

          {canManageEventContent ? (
            <TabsContent value="course" className="mt-0 space-y-4">
              <div className="card-sport p-6 space-y-4">
                <div>
                  <h2 className="font-semibold">{t("staffPortal.eventEdit.courseTitle")}</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    {t("staffPortal.eventEdit.courseSubtitleVisual")}
                  </p>
                </div>
                {courseError ? <p className="text-sm text-destructive">{courseError}</p> : null}
                <StaffCourseSummaryCard
                  course={courseDraft}
                  startLat={formik.values.location_lat || event?.location_lat}
                  startLng={formik.values.location_lng || event?.location_lng}
                  onOpenWizard={() => setCourseWizardOpen(true)}
                />
                <StaffCourseWizardDialog
                  open={courseWizardOpen}
                  onOpenChange={setCourseWizardOpen}
                  value={courseDraft}
                  onSave={handleWizardSave}
                  saving={savingCourse}
                  eventLat={formik.values.location_lat || event?.location_lat}
                  eventLng={formik.values.location_lng || event?.location_lng}
                  onEventLocationChange={handleEventLocationFromCourse}
                />
              </div>
            </TabsContent>
          ) : null}

          {canManageCategories ? (
            <TabsContent value="discounts" className="mt-0 space-y-4">
              <div className="card-sport p-6 space-y-4">
                <h2 className="font-semibold">{t("staffPortal.eventEdit.discountsTitle")}</h2>
                <p className="text-sm text-muted-foreground">
                  {t("staffPortal.eventEdit.discountsSubtitle")}
                </p>
                {discountCodesError ? (
                  <p className="text-sm text-destructive">{discountCodesError}</p>
                ) : null}
                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <Input
                    placeholder={t("staffPortal.eventEdit.discountCode")}
                    value={discountDraft.code}
                    onChange={(e) =>
                      setDiscountDraft({ ...discountDraft, code: e.target.value.toUpperCase() })
                    }
                  />
                  <Select
                    value={discountDraft.discount_type ?? "percent"}
                    onValueChange={(v) =>
                      setDiscountDraft({
                        ...discountDraft,
                        discount_type: v as "percent" | "fixed_cents",
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percent">{t("staffPortal.eventEdit.discountPercent")}</SelectItem>
                      <SelectItem value="fixed_cents">{t("staffPortal.eventEdit.discountFixed")}</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    min={1}
                    placeholder={t("staffPortal.eventEdit.discountValue")}
                    value={discountDraft.discount_value}
                    onChange={(e) =>
                      setDiscountDraft({
                        ...discountDraft,
                        discount_value: Number(e.target.value),
                      })
                    }
                  />
                  <Button
                    type="button"
                    onClick={handleCreateDiscount}
                    disabled={savingDiscountCode || !discountDraft.code.trim()}
                  >
                    {savingDiscountCode ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : (
                      <Plus className="w-4 h-4 mr-2" />
                    )}
                    {t("staffPortal.eventEdit.addDiscount")}
                  </Button>
                </div>
                {discountCodes.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {t("staffPortal.eventEdit.noDiscounts")}
                  </p>
                ) : (
                  <div className="space-y-2">
                    {discountCodes.map((dc) => (
                      <div
                        key={dc.id}
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-xl border border-gray-700/40"
                      >
                        <div>
                          <p className="font-mono font-semibold">{dc.code}</p>
                          <p className="text-xs text-muted-foreground">
                            {dc.discount_type === "percent"
                              ? `${dc.discount_value}%`
                              : `$${(dc.discount_value / 100).toLocaleString(numLocale)} MXN`}
                            {" · "}
                            {t("staffPortal.eventEdit.discountUses", {
                              used: dc.used_count,
                              max: dc.max_uses ?? "∞",
                            })}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              eventId &&
                              dispatch(
                                updateDiscountCode({
                                  eventId,
                                  codeId: dc.id,
                                  role: staffRole,
                                  patch: { is_active: !Boolean(dc.is_active) },
                                }),
                              )
                            }
                          >
                            {Boolean(dc.is_active)
                              ? t("staffPortal.eventEdit.deactivateDiscount")
                              : t("staffPortal.eventEdit.activateDiscount")}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="text-destructive"
                            onClick={() =>
                              eventId &&
                              dispatch(deleteDiscountCode({ eventId, codeId: dc.id, role: staffRole }))
                            }
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>
          ) : null}

          {canManageCategories ? (
            <TabsContent value="waitlist" className="mt-0 space-y-4">
              <div className="card-sport p-6 space-y-4">
                <h2 className="font-semibold">{t("staffPortal.eventEdit.waitlistTitle")}</h2>
                <p className="text-sm text-muted-foreground">
                  {t("staffPortal.eventEdit.waitlistSubtitle")}
                </p>
                {waitlistError ? <p className="text-sm text-destructive">{waitlistError}</p> : null}
                {loadingWaitlist ? (
                  <p className="text-muted-foreground">{t("common.loading")}</p>
                ) : waitlistEntries.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {t("staffPortal.eventEdit.waitlistEmpty")}
                  </p>
                ) : (
                  <div className="space-y-2">
                    {waitlistEntries.map((entry) => (
                      <div
                        key={entry.id}
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl border border-border"
                      >
                        <div>
                          <p className="font-medium">
                            {entry.athlete_first_name} {entry.athlete_last_name}
                          </p>
                          <p className="text-xs text-muted-foreground">{entry.athlete_email}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {entry.category_name} · #{entry.position} ·{" "}
                            {t(`staffPortal.eventEdit.waitlistStatus.${entry.status}`, {
                              defaultValue: entry.status,
                            })}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2 shrink-0">
                        {entry.status === "waiting" && eventId ? (
                          <Button
                            type="button"
                            size="sm"
                            disabled={offeringWaitlist}
                            onClick={() =>
                              dispatch(
                                offerWaitlistSpot({
                                  eventId,
                                  role: staffRole,
                                  waitlistEntryId: entry.id,
                                }),
                              )
                            }
                          >
                            {t("staffPortal.eventEdit.waitlistOffer")}
                          </Button>
                        ) : null}
                        {(entry.status === "waiting" || entry.status === "offered") && eventId ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={offeringWaitlist}
                            className="text-destructive border-destructive/40"
                            onClick={() =>
                              dispatch(
                                revokeWaitlistEntry({
                                  eventId,
                                  role: staffRole,
                                  waitlistEntryId: entry.id,
                                }),
                              )
                            }
                          >
                            {t("staffPortal.eventEdit.waitlistRevoke")}
                          </Button>
                        ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>
          ) : null}

          {canManageCategories ? (
            <TabsContent value="media" className="mt-0 space-y-4">
              <div className="card-sport p-6 space-y-4">
                <h2 className="font-semibold">{t("staffPortal.eventEdit.mediaTitle")}</h2>
                <p className="text-sm text-muted-foreground">
                  {t("staffPortal.eventEdit.mediaSubtitle")}
                </p>
                {eventMediaError ? (
                  <p className="text-sm text-destructive">{eventMediaError}</p>
                ) : null}
                {loadingEventMedia ? (
                  <p className="text-muted-foreground">{t("common.loading")}</p>
                ) : (
                  <div className="space-y-3">
                    {mediaDrafts.map((m, i) => (
                      <div key={i} className="grid sm:grid-cols-12 gap-2 items-end">
                        <Input
                          className="sm:col-span-3"
                          placeholder={t("staffPortal.eventEdit.mediaType")}
                          value={m.asset_type}
                          onChange={(e) => {
                            const next = [...mediaDrafts];
                            next[i] = { ...next[i], asset_type: e.target.value };
                            setMediaDrafts(next);
                          }}
                        />
                        <div className="sm:col-span-7 space-y-2">
                          <Input
                            placeholder="https://..."
                            value={m.url.startsWith("blob:") ? "" : m.url}
                            onChange={(e) => {
                              const next = [...mediaDrafts];
                              next[i] = { ...next[i], url: e.target.value };
                              setMediaDrafts(next);
                            }}
                          />
                          <EventAssetUpload
                            kind="image"
                            compact
                            previewUrl={
                              m.url.startsWith("blob:") || m.url.startsWith("http")
                                ? m.url
                                : null
                            }
                            onSelectFile={(file) => {
                              mediaPendingRef.current.set(i, file);
                              const blob = createBlobPreviewUrl(file);
                              const next = [...mediaDrafts];
                              next[i] = { ...next[i], url: blob ?? "" };
                              setMediaDrafts(next);
                            }}
                            onClear={() => {
                              mediaPendingRef.current.delete(i);
                              const next = [...mediaDrafts];
                              if (next[i]?.url.startsWith("blob:")) {
                                revokeBlobUrl(next[i].url);
                              }
                              next[i] = { ...next[i], url: "" };
                              setMediaDrafts(next);
                            }}
                          />
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="text-destructive sm:col-span-1"
                          onClick={() =>
                            setMediaDrafts(mediaDrafts.filter((_, idx) => idx !== i))
                          }
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex gap-2 flex-wrap">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      setMediaDrafts([
                        ...mediaDrafts,
                        {
                          asset_type: "gallery",
                          url: "",
                          sort_order: mediaDrafts.length,
                        },
                      ])
                    }
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    {t("staffPortal.eventEdit.addMedia")}
                  </Button>
                  <Button
                    type="button"
                    disabled={savingEventMedia || uploadingAssets || !eventId}
                    onClick={handleSaveMedia}
                  >
                    {savingEventMedia ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : (
                      <Save className="w-4 h-4 mr-2" />
                    )}
                    {t("staffPortal.eventEdit.saveMedia")}
                  </Button>
                </div>
              </div>
            </TabsContent>
          ) : null}
          </div>
        </Tabs>
        </>
      )}
    </div>
  );
}

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFormik, type FormikProps } from "formik";
import * as Yup from "yup";
import { Link, Navigate, useLocation, useNavigate, useParams } from "react-router-dom";
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
import { resolveEventImageRole } from "@/constants/eventImageContexts";
import RichHtmlEditor, {
  type RichHtmlEditorHandle,
} from "@/components/blog/RichHtmlEditor";
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
import { cn } from "@/lib/utils";
import {
  enforceCatalogCityOnEventBody,
  isCatalogCitySelectionValid,
} from "@/utils/geoCityValidation";
import {
  resolveStaffEventFeePresentation,
  resolveStaffEventServiceFeePercent,
} from "@/utils/staffFeePresentation";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchGeoCities, fetchGeoStates } from "@/store/slices/geoSlice";
import { fetchSportTypes } from "@/store/slices/marketplaceSlice";
import {
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
  fetchOrganizerPayoutStatus,
  fetchAdminOrganizerConnect,
  publishStaffEvent,
  rejectStaffEventApproval,
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
  StaffEventDetail,
  StaffMediaAssetRow,
  StaffScheduleWaveInput,
} from "@shared/api";
import { getNumberLocale } from "@/utils/dateLocale";
import {
  buildEventEditFormValues,
  buildStaffEventBody,
  type EventEditFormValues,
} from "@/utils/buildStaffEventBody";
import { isStaffEventCreateRoute } from "@/utils/staffEventRoutes";
import { normalizeCoursePayloadForSave } from "@/utils/courseMapUtils";
import { isEventEndBeforeStart } from "@/utils/staffEventDateValidation";
import {
  checkInCloseWouldBeCapped,
  defaultCheckInWindowBounds,
  normalizeFormDatetimeLocal,
  validateCheckInWindowFields,
  type CheckInWindowValidationError,
} from "@shared/checkInWindow";
import { fromDatetimeLocal, toDatetimeLocal } from "@/utils/datetimeLocal";
import { uploadEventAssetToCdn } from "@/lib/cdn-upload";
import { normalizeCdnUploadUrl } from "@/lib/cdn-url";
import { prepareEventImageFile } from "@/utils/eventImageUpload";
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
import {
  parseFormCoordinate,
  validateFormCoordinatePair,
  type FormCoordinateError,
} from "@/utils/formCoordinates";

const CHECK_IN_VALIDATION_KEYS: Record<CheckInWindowValidationError, string> = {
  pair_required: "staffPortal.eventEdit.fieldCheckInErrorPair",
  opens_not_before_closes: "staffPortal.eventEdit.fieldCheckInErrorOrder",
  opens_after_event_end: "staffPortal.eventEdit.fieldCheckInErrorOpensAfterEnd",
  closes_after_event_end: "staffPortal.eventEdit.fieldCheckInErrorClosesAfterEnd",
};

const COORD_VALIDATION_KEYS: Record<FormCoordinateError, string> = {
  pair_required: "staffPortal.eventEdit.fieldCoordErrorPair",
  invalid_lat: "staffPortal.eventEdit.fieldCoordErrorLat",
  invalid_lng: "staffPortal.eventEdit.fieldCoordErrorLng",
};

export default function StaffEventEdit() {
  const location = useLocation();
  const { eventId: eventIdParam } = useParams<{ eventId: string }>();
  const isNew = isStaffEventCreateRoute(location.pathname, eventIdParam);
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
    rejectingEventApproval,
    publishError,
    payoutStatus,
    adminOrganizerConnect,
    loadingPayoutStatus,
    loadingAdminOrganizerConnect,
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
  const [bannerPendingFile, setBannerPendingFile] = useState<File | null>(null);
  const [bannerPreviewUrl, setBannerPreviewUrl] = useState<string | null>(null);
  const sponsorPendingRef = useRef<Map<number, File>>(new Map());
  const mediaPendingRef = useRef<Map<number, File>>(new Map());
  const descriptionPendingByUrlRef = useRef<Map<string, File>>(new Map());
  const descriptionDraftUploadIdRef = useRef(`event_draft_${Date.now()}`);
  const descriptionEditorRef = useRef<RichHtmlEditorHandle>(null);
  const descriptionHtmlRef = useRef("");
  const hydratedEventIdRef = useRef<number | null>(null);
  const geoPickerHydratedRef = useRef<number | null>(null);
  const geoUserTouchedRef = useRef(false);
  const formValuesRef = useRef(buildEventEditFormValues(undefined, []));
  const formikRef = useRef<FormikProps<EventEditFormValues> | null>(null);
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

  const eventSchema = useMemo(
    () =>
      Yup.object({
        title: Yup.string()
          .trim()
          .required(t("staffPortal.eventEdit.validation.required"))
          .max(255),
        sport_type_id: Yup.number()
          .min(1, t("staffPortal.eventEdit.validation.required"))
          .required(t("staffPortal.eventEdit.validation.required")),
        start_date: Yup.string().required(t("staffPortal.eventEdit.validation.required")),
        end_date: Yup.string(),
        check_in_opens_at: Yup.string(),
        check_in_closes_at: Yup.string(),
      })
        .test("end-after-start", function (values) {
          if (!values.end_date?.trim()) return true;
          if (!isEventEndBeforeStart(values.start_date, values.end_date)) return true;
          return this.createError({
            path: "end_date",
            message: t("staffPortal.eventEdit.validation.endBeforeStart"),
          });
        })
        .test("check-in-window", function (values) {
          const err = validateCheckInWindowFields({
            checkInOpensAt: values.check_in_opens_at,
            checkInClosesAt: values.check_in_closes_at,
            startDate: values.start_date,
            endDate: values.end_date,
          });
          if (!err) return true;
          return this.createError({
            path: err === "pair_required" ? "check_in_opens_at" : "check_in_closes_at",
            message: t(CHECK_IN_VALIDATION_KEYS[err]),
          });
        }),
    [t],
  );
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
  }, [dispatch]);

  useEffect(() => {
    if (!isNew && eventId && role) {
      const cachedId = eventDetail?.event?.id;
      if (cachedId === eventId) return;
      dispatch(fetchStaffEventDetail({ eventId, role }));
    }
  }, [dispatch, isNew, eventId, role, eventDetail?.event?.id]);

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
  const organizerAccessDenied =
    isOrganizer &&
    !isAdmin &&
    ((isNew && !canCreateEvents) || (!isNew && !canEditEvents));

  const defaultFormValues = useMemo(
    () => buildEventEditFormValues(undefined, sportTypes),
    [sportTypes],
  );

  const savedEventLocation = useMemo(
    () =>
      event
        ? { city: event.location_city, state: event.location_state }
        : undefined,
    [event?.location_city, event?.location_state],
  );

  const formik = useFormik({
    enableReinitialize: false,
    initialValues: defaultFormValues,
    validationSchema: eventSchema,
    onSubmit: async (values) => {
      if (!role) return;
      if (
        !isCatalogCitySelectionValid(
          geoCityId,
          values.location_city,
          savedEventLocation,
          values.location_state,
        )
      ) {
        toast({
          title: t("geo.citySelector.invalidSelectionTitle"),
          description: isAdmin
            ? t("geo.citySelector.supportMessageAdmin")
            : t("geo.citySelector.supportMessageOrganizer"),
          variant: "destructive",
        });
        return;
      }
      const coordError = validateFormCoordinatePair(
        parseFormCoordinate(values.location_lat),
        parseFormCoordinate(values.location_lng),
      );
      if (coordError) {
        toast({
          title: t("staffPortal.eventEdit.saveFailed"),
          description: t(COORD_VALIDATION_KEYS[coordError]),
          variant: "destructive",
        });
        return;
      }
      setUploadingAssets(true);
      try {
        let heroUrl = values.hero_image_url.trim() || null;
        if (heroPendingFile) {
          const heroUploadId =
            eventId != null ? `event_${eventId}_hero` : `${descriptionUploadId}_hero`;
          const preparedHero = await prepareEventImageFile(heroPendingFile, "hero");
          heroUrl = await uploadEventAssetToCdn(
            preparedHero,
            heroUploadId,
            isAdmin,
            "hero",
          );
          setHeroPendingFile(null);
          if (heroPreviewUrl?.startsWith("blob:")) revokeBlobUrl(heroPreviewUrl);
          setHeroPreviewUrl(heroUrl);
          void formik.setFieldValue("hero_image_url", heroUrl ?? "");
        }

        let bannerUrl = values.banner_image_url.trim() || null;
        if (bannerPendingFile) {
          const bannerUploadId =
            eventId != null ? `event_${eventId}_banner` : `${descriptionUploadId}_banner`;
          const preparedBanner = await prepareEventImageFile(bannerPendingFile, "banner");
          bannerUrl = await uploadEventAssetToCdn(
            preparedBanner,
            bannerUploadId,
            isAdmin,
            "hero",
          );
          setBannerPendingFile(null);
          if (bannerPreviewUrl?.startsWith("blob:")) revokeBlobUrl(bannerPreviewUrl);
          setBannerPreviewUrl(bannerUrl);
          void formik.setFieldValue("banner_image_url", bannerUrl ?? "");
        }

        let description =
          descriptionEditorRef.current?.getHtml() ??
          descriptionHtmlRef.current ??
          values.description;
        descriptionHtmlRef.current = description;
        if (descriptionPendingByUrlRef.current.size > 0) {
          description = await uploadPendingHtmlImages({
            html: description,
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
            banner_image_url: bannerUrl,
            description: description.trim() || null,
          }),
          geoCityId,
          savedEventLocation,
        );

        if (isNew) {
          const result = await dispatch(createOrganizerEvent(body));
          if (createOrganizerEvent.fulfilled.match(result)) {
            const newEventId = result.payload.event.id;
            toast({
              title: t("staffPortal.eventEdit.createSuccess"),
              description: t("staffPortal.eventEdit.createSuccessHint"),
            });
            navigate(`/staff/events/${newEventId}/edit`, { replace: true });
            return;
          }
          if (createOrganizerEvent.rejected.match(result)) {
            toast({
              title: t("staffPortal.eventEdit.createFailed"),
              description: result.payload ?? t("staffPortal.eventEdit.createFailed"),
              variant: "destructive",
            });
          }
          return;
        }

        if (eventId) {
          const updateResult = await dispatch(updateStaffEvent({ eventId, role, body }));
          if (updateStaffEvent.fulfilled.match(updateResult)) {
            hydratedEventIdRef.current = updateResult.payload.event.id;
            const savedValues = buildEventEditFormValues(
              updateResult.payload.event,
              sportTypes,
            );
            descriptionHtmlRef.current = savedValues.description;
            void formik.resetForm({ values: savedValues });
            toast({ title: t("staffPortal.eventEdit.saveSuccess") });
          } else if (updateStaffEvent.rejected.match(updateResult)) {
            toast({
              title: t("staffPortal.eventEdit.saveFailed"),
              description: updateResult.payload ?? t("staffPortal.eventEdit.saveFailed"),
              variant: "destructive",
            });
          }
        }
      } catch (err) {
        toast({
          title: t("staffPortal.eventEdit.saveFailed"),
          description: err instanceof Error ? err.message : t("staffPortal.eventEdit.saveFailed"),
          variant: "destructive",
        });
      } finally {
        setUploadingAssets(false);
      }
    },
  });

  formikRef.current = formik;
  formValuesRef.current = formik.values;

  const applySavedEventToForm = useCallback(
    (savedEvent: StaffEventDetail) => {
      const values = buildEventEditFormValues(savedEvent, sportTypes);
      descriptionHtmlRef.current = values.description;
      void formikRef.current?.resetForm({ values });
    },
    [sportTypes],
  );

  useEffect(() => {
    geoUserTouchedRef.current = false;
    geoPickerHydratedRef.current = null;
    if (isNew) {
      hydratedEventIdRef.current = null;
      return;
    }
    if (eventId != null && hydratedEventIdRef.current !== eventId) {
      hydratedEventIdRef.current = null;
    }
  }, [eventId, isNew]);

  useEffect(() => {
    if (isNew || !event?.id) return;
    if (hydratedEventIdRef.current === event.id) return;
    hydratedEventIdRef.current = event.id;
    applySavedEventToForm(event);
  }, [isNew, event, applySavedEventToForm]);

  useEffect(() => {
    if (sportTypes.length === 0) return;
    if (formik.values.sport_type_id > 0) return;
    void formik.setFieldValue("sport_type_id", sportTypes[0]!.id);
  }, [sportTypes, formik.values.sport_type_id, formik]);

  useEffect(() => {
    if (!isNew) return;
    setGeoStateId(null);
    setGeoCityId(null);
    setGeoLegacySearchResolved(false);
  }, [isNew]);

  // One-time geo picker hydrate from saved event — never override after user edits.
  useEffect(() => {
    if (isNew || !event?.id || !event.location_city) return;
    if (geoUserTouchedRef.current) return;
    if (geoPickerHydratedRef.current === event.id) return;
    if (geoStates.length === 0) return;

    const applyCityMatch = (cities: { id: number; name: string }[]) => {
      if (geoUserTouchedRef.current) return;
      geoPickerHydratedRef.current = event.id;
      const cityMatch = cities.find((c) => c.name === event.location_city);
      if (cityMatch) {
        setGeoCityId(cityMatch.id);
      }
    };

    const stateMatch = geoStates.find(
      (s) =>
        s.name === event.location_state ||
        s.code === event.location_state ||
        (!event.location_state && s.name === "CDMX"),
    );

    if (stateMatch) {
      setGeoStateId(stateMatch.id);
      const cached = geoCitiesByState[stateMatch.id];
      if (cached?.length) {
        applyCityMatch(cached);
        return;
      }
      void dispatch(fetchGeoCities({ stateId: stateMatch.id })).then((action) => {
        if (!fetchGeoCities.fulfilled.match(action)) return;
        applyCityMatch(action.payload.cities);
      });
      return;
    }

    if (event.location_state) return;

    void dispatch(fetchGeoCities({ q: event.location_city })).then((action) => {
      if (geoUserTouchedRef.current) return;
      setGeoLegacySearchResolved(true);
      geoPickerHydratedRef.current = event.id;
      if (!fetchGeoCities.fulfilled.match(action)) return;
      const match = action.payload.cities.find((c) => c.name === event.location_city);
      if (!match) return;
      setGeoStateId(match.state_id);
      setGeoCityId(match.id);
      void formik.setFieldValue("location_state", match.state_name);
    });
  }, [
    dispatch,
    formik,
    isNew,
    event?.id,
    event?.location_city,
    event?.location_state,
    geoStates,
    geoCitiesByState,
  ]);

  useEffect(() => {
    if (event?.hero_image_url && !heroPendingFile) {
      setHeroPreviewUrl(normalizeCdnUploadUrl(event.hero_image_url));
    }
  }, [event?.hero_image_url, heroPendingFile]);

  useEffect(() => {
    if (event?.banner_image_url && !bannerPendingFile) {
      setBannerPreviewUrl(normalizeCdnUploadUrl(event.banner_image_url));
    }
  }, [event?.banner_image_url, bannerPendingFile]);

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

  const checkInAutoWindowHint = useMemo(() => {
    if (formik.values.check_in_opens_at || formik.values.check_in_closes_at) {
      return null;
    }
    const startWall = normalizeFormDatetimeLocal(formik.values.start_date);
    if (!startWall) return null;
    const endWall = normalizeFormDatetimeLocal(formik.values.end_date);
    return defaultCheckInWindowBounds(startWall, endWall);
  }, [
    formik.values.check_in_closes_at,
    formik.values.check_in_opens_at,
    formik.values.end_date,
    formik.values.start_date,
  ]);

  const endDateBeforeStart = useMemo(
    () => isEventEndBeforeStart(formik.values.start_date, formik.values.end_date),
    [formik.values.end_date, formik.values.start_date],
  );

  const citySelectionIncomplete =
    Boolean(formik.values.location_city.trim()) && geoCityId == null;

  const checkInCapHint = useMemo(() => {
    if (!formik.values.check_in_closes_at) return null;
    if (
      !checkInCloseWouldBeCapped({
        checkInClosesAt: formik.values.check_in_closes_at,
        startDate: formik.values.start_date,
        endDate: formik.values.end_date,
      })
    ) {
      return null;
    }
    const startWall = normalizeFormDatetimeLocal(formik.values.start_date);
    if (!startWall) return null;
    const endWall = normalizeFormDatetimeLocal(formik.values.end_date);
    return defaultCheckInWindowBounds(startWall, endWall).closesAtLocal;
  }, [
    formik.values.check_in_closes_at,
    formik.values.end_date,
    formik.values.start_date,
  ]);

  const hasPaidCategories = useMemo(
    () => (eventDetail?.categories ?? []).some((c) => c.is_active && Number(c.price_cents) > 0),
    [eventDetail?.categories],
  );

  const effectiveFeePresentation = useMemo(
    () =>
      resolveStaffEventFeePresentation(
        formik.values.fee_presentation === "inherit"
          ? null
          : formik.values.fee_presentation,
        event?.organizer_fee_presentation,
      ),
    [formik.values.fee_presentation, event?.organizer_fee_presentation],
  );

  const staffServiceFeePercent = useMemo(
    () =>
      resolveStaffEventServiceFeePercent(
        event?.service_fee_percent,
        event?.organizer_service_fee_percent,
      ),
    [event?.service_fee_percent, event?.organizer_service_fee_percent],
  );

  const handleFeePresentationChange = (value: string) => {
    const nextEffective = resolveStaffEventFeePresentation(
      value === "inherit" ? null : (value as "pass_through" | "absorb_all"),
      event?.organizer_fee_presentation,
    );
    if (hasPaidCategories && nextEffective !== effectiveFeePresentation) {
      if (!window.confirm(t("staffPortal.eventEdit.feePresentationSwitchConfirm"))) {
        return;
      }
    }
    void formik.setFieldValue("fee_presentation", value);
  };

  useEffect(() => {
    if (isAdmin && hasPaidCategories && event?.organizer_id) {
      void dispatch(fetchAdminOrganizerConnect({ organizerId: event.organizer_id }));
    } else if (!isAdmin && isOrganizer && hasPaidCategories) {
      void dispatch(fetchOrganizerPayoutStatus());
    }
  }, [dispatch, event?.organizer_id, hasPaidCategories, isAdmin, isOrganizer]);

  const eventOrganizerPayoutReady = isAdmin
    ? adminOrganizerConnect?.payoutReady
    : payoutStatus?.payoutReady;

  const loadingPayoutGate = hasPaidCategories
    ? isAdmin
      ? loadingAdminOrganizerConnect && !adminOrganizerConnect
      : loadingPayoutStatus && !payoutStatus
    : false;

  const payoutPublishBlocked =
    hasPaidCategories &&
    (loadingPayoutGate || eventOrganizerPayoutReady !== true) &&
    (isOrganizer || isAdmin);

  const showPayoutBlockedBanner = payoutPublishBlocked && !loadingPayoutGate;

  const handlePayoutSetupNavigate = () => {
    if (isAdmin) {
      navigate("/staff/people?tab=organizers");
    } else {
      navigate("/staff/payouts");
    }
  };

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
        hasPaidCategories,
        payoutReady: hasPaidCategories
          ? loadingPayoutGate
            ? null
            : eventOrganizerPayoutReady === true
          : undefined,
      }),
    [
      activeWaivers,
      courseDraft?.routeGeojson,
      eventDetail?.categories?.length,
      eventOrganizerPayoutReady,
      formik.values,
      hasPaidCategories,
      heroPreviewUrl,
      loadingPayoutGate,
    ],
  );

  const publishBlocked =
    !publishReadiness.hasTitle ||
    !publishReadiness.hasSport ||
    !publishReadiness.hasStartDate ||
    !publishReadiness.hasCategory ||
    waiverPublishBlocked ||
    payoutPublishBlocked;

  const handleEventLocationFromCourse = useCallback((lat: number, lng: number) => {
    void formikRef.current?.setFieldValue("location_lat", String(lat));
    void formikRef.current?.setFieldValue("location_lng", String(lng));
  }, []);

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
      formik.setFieldValue(
        "status",
        isAdmin ? "published" : "pending_approval",
      );
      setPublishPreviewOpen(false);
    }
  };

  const handleRejectApproval = async () => {
    if (!eventId || !isAdmin) return;
    const result = await dispatch(rejectStaffEventApproval({ eventId }));
    if (rejectStaffEventApproval.fulfilled.match(result)) {
      formik.setFieldValue("status", "draft");
    }
  };

  const eventStatus = event?.status ?? formik.values.status;
  const showOrganizerSubmit =
    isOrganizer && !isAdmin && eventStatus === "draft";
  const showAdminPublish =
    isAdmin && eventStatus !== "published" && eventStatus !== "cancelled";
  const showPendingBanner = eventStatus === "pending_approval";
  const rejectionReason =
    event?.approval_rejection_reason?.trim() || null;
  const showRejectionBanner =
    !isAdmin && eventStatus === "draft" && Boolean(rejectionReason);
  const publishActionLabel = isAdmin
    ? eventStatus === "pending_approval"
      ? t("staffPortal.eventEdit.approvePublish")
      : t("staffPortal.eventEdit.publish")
    : t("staffPortal.eventEdit.submitForApproval");

  const handleSaveSponsors = async () => {
    if (!eventId || !role) return;
    setUploadingAssets(true);
    try {
      const next = [...sponsorDrafts];
      for (const [index, file] of sponsorPendingRef.current.entries()) {
        const prepared = await prepareEventImageFile(file, "sponsor");
        const url = await uploadEventAssetToCdn(
          prepared,
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
        const role = mediaDrafts[index]?.asset_type === "banner" ? "banner" : "gallery";
        const prepared = await prepareEventImageFile(file, role);
        const url = await uploadEventAssetToCdn(
          prepared,
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
    const raw = course ?? courseDraft;
    if (!eventId || !raw || !role) return;
    const payload = normalizeCoursePayloadForSave(raw);
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

  if (organizerAccessDenied) {
    return <Navigate to="/staff/events" replace />;
  }

  const awaitingEventLoad =
    !isNew && !eventDetailError && (loadingEventDetail || eventDetail?.event?.id !== eventId);

  if (awaitingEventLoad) {
    return (
      <div className="max-w-4xl mx-auto w-full min-w-0 px-4 py-16 flex flex-col items-center justify-center gap-3 text-muted-foreground">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p>{t("common.loading")}</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto w-full min-w-0 overflow-x-clip space-y-6">
      <MetaHelmet title={pageTitle} description={t("staffPortal.eventEdit.subtitle")} />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Link
            to="/staff/events"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary mb-2"
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
        {showAdminPublish ? (
          <Button
            className="btn-primary shrink-0"
            disabled={publishingEvent || publishBlocked}
            onClick={() => setPublishPreviewOpen(true)}
          >
            {publishingEvent || loadingPayoutGate ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <Rocket className="w-4 h-4 mr-2" />
            )}
            {loadingPayoutGate ? t("staffPortal.payouts.loading") : publishActionLabel}
          </Button>
        ) : null}
        {showOrganizerSubmit ? (
          <Button
            className="btn-primary shrink-0"
            disabled={publishingEvent || publishBlocked}
            onClick={() => setPublishPreviewOpen(true)}
          >
            {publishingEvent || loadingPayoutGate ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <Rocket className="w-4 h-4 mr-2" />
            )}
            {loadingPayoutGate
              ? t("staffPortal.payouts.loading")
              : publishActionLabel}
          </Button>
        ) : null}
        {isAdmin && eventStatus === "pending_approval" ? (
          <Button
            type="button"
            variant="outline"
            className="shrink-0 border-destructive/40 text-destructive hover:bg-destructive/10"
            disabled={rejectingEventApproval}
            onClick={() => void handleRejectApproval()}
          >
            {rejectingEventApproval ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : null}
            {t("staffPortal.eventEdit.rejectApproval")}
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

      {loadingPayoutGate ? (
        <div className="rounded-xl border border-border bg-muted/30 p-4 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin shrink-0" />
          {t("staffPortal.eventEdit.payoutGateLoading")}
        </div>
      ) : null}

      {showPendingBanner ? (
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 text-sm text-foreground">
          {isAdmin
            ? t("staffPortal.eventEdit.pendingApprovalBannerAdmin")
            : t("staffPortal.eventEdit.pendingApprovalBannerOrganizer")}
        </div>
      ) : null}

      {showRejectionBanner ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-foreground space-y-1">
          <p className="font-medium text-destructive">
            {t("staffPortal.eventEdit.rejectionBannerTitle")}
          </p>
          <p className="text-muted-foreground">
            {t("staffPortal.eventEdit.rejectionBannerBody", { reason: rejectionReason })}
          </p>
        </div>
      ) : null}

      {showPayoutBlockedBanner ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <p className="text-sm text-destructive">
            {isAdmin
              ? t("staffPortal.payouts.publishBlockedBannerAdmin")
              : t("staffPortal.payouts.publishBlockedBanner")}
          </p>
          <Button asChild variant="outline" size="sm" className="border-destructive/40 shrink-0">
            {isAdmin ? (
              <Link to="/staff/people?tab=organizers">
                {t("staffPortal.payouts.publishBlockedCtaAdmin")}
              </Link>
            ) : (
              <Link to="/staff/payouts">{t("staffPortal.payouts.publishBlockedCta")}</Link>
            )}
          </Button>
        </div>
      ) : null}

      <EventPublishPreviewDialog
        open={publishPreviewOpen}
        onOpenChange={setPublishPreviewOpen}
        event={event}
        categories={eventDetail?.categories ?? []}
        feePresentation={effectiveFeePresentation}
        serviceFeePercent={staffServiceFeePercent}
        sponsors={sponsorDrafts}
        courseDistanceKm={courseDraft?.distanceKm}
        waiverCount={activeWaivers.length}
        requiresWaiver={formik.values.requires_waiver}
        confirming={publishingEvent}
        payoutBlocked={payoutPublishBlocked}
        payoutBlockedMessage={
          loadingPayoutGate
            ? t("staffPortal.eventEdit.payoutGateLoading")
            : isAdmin
              ? t("staffPortal.payouts.publishBlockedBannerAdmin")
              : t("staffPortal.payouts.publishBlockedBanner")
        }
        confirmLabel={
          isAdmin
            ? t("staffPortal.eventEdit.preview.confirmPublish")
            : t("staffPortal.eventEdit.preview.confirmSubmitApproval")
        }
        onConfirm={() => void handlePublish()}
      />

      <>
          {!isNew ? (
            <StaffEventPublishChecklist
              readiness={publishReadiness}
              onNavigate={setTab}
              onPayoutSetupClick={handlePayoutSetupNavigate}
              className="lg:hidden"
            />
          ) : null}
        <Tabs value={tab} onValueChange={setTab} className="flex flex-col lg:flex-row gap-4 lg:gap-6 items-start">
          <div
            className={cn(
              "w-full lg:w-56 shrink-0 flex flex-col gap-4 min-h-0",
              "lg:sticky lg:top-4 lg:self-start lg:max-h-[calc(100dvh-2rem)]",
            )}
          >
            <VerticalTabsList
              aria-label={t("staffPortal.eventEdit.sectionsLabel")}
              className="max-h-[min(280px,45vh)] lg:max-h-none lg:flex-1 lg:min-h-0"
            >
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
                onPayoutSetupClick={handlePayoutSetupNavigate}
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
                    value={formik.values.sport_type_id > 0 ? String(formik.values.sport_type_id) : ""}
                    onValueChange={(v) => formik.setFieldValue("sport_type_id", Number(v))}
                  >
                    <SelectTrigger id="sport_type_id">
                      <SelectValue placeholder={t("staffPortal.eventEdit.fieldSportPlaceholder")} />
                    </SelectTrigger>
                    <SelectContent>
                      {sportTypes.map((st) => (
                        <SelectItem key={st.id} value={String(st.id)}>
                          {st.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {formik.touched.sport_type_id && formik.errors.sport_type_id ? (
                    <p className="text-xs text-destructive">{formik.errors.sport_type_id}</p>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="start_date">{t("staffPortal.eventEdit.fieldStart")}</Label>
                  <Input
                    id="start_date"
                    type="datetime-local"
                    {...formik.getFieldProps("start_date")}
                  />
                  {formik.touched.start_date && formik.errors.start_date ? (
                    <p className="text-xs text-destructive">{formik.errors.start_date}</p>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="end_date">{t("staffPortal.eventEdit.fieldEnd")}</Label>
                  <Input id="end_date" type="datetime-local" {...formik.getFieldProps("end_date")} />
                  {endDateBeforeStart ? (
                    <p className="text-xs text-destructive">
                      {t("staffPortal.eventEdit.validation.endBeforeStart")}
                    </p>
                  ) : formik.values.end_date ? (
                    <p className="text-xs text-muted-foreground">
                      {t("staffPortal.eventEdit.fieldEndHint")}
                    </p>
                  ) : null}
                  {formik.touched.end_date && formik.errors.end_date ? (
                    <p className="text-xs text-destructive">{formik.errors.end_date}</p>
                  ) : null}
                </div>

                <div className="sm:col-span-2 rounded-xl border border-border/60 bg-muted/20 p-4 space-y-4">
                  <div>
                    <p className="text-sm font-semibold">{t("staffPortal.eventEdit.fieldCheckInSection")}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {t("staffPortal.eventEdit.fieldCheckInSectionHint")}
                    </p>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="check_in_opens_at">
                        {t("staffPortal.eventEdit.fieldCheckInOpens")}
                      </Label>
                      <Input
                        id="check_in_opens_at"
                        type="datetime-local"
                        {...formik.getFieldProps("check_in_opens_at")}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="check_in_closes_at">
                        {t("staffPortal.eventEdit.fieldCheckInCloses")}
                      </Label>
                      <Input
                        id="check_in_closes_at"
                        type="datetime-local"
                        {...formik.getFieldProps("check_in_closes_at")}
                      />
                    </div>
                  </div>
                  {checkInAutoWindowHint ? (
                    <p className="text-xs text-muted-foreground">
                      {t("staffPortal.eventEdit.fieldCheckInAutoHint", {
                        opens: checkInAutoWindowHint.opensAtLocal,
                        closes: checkInAutoWindowHint.closesAtLocal,
                      })}
                    </p>
                  ) : null}
                  {checkInCapHint ? (
                    <p className="text-xs text-muted-foreground">
                      {t("staffPortal.eventEdit.fieldCheckInCapHint", { closes: checkInCapHint })}
                    </p>
                  ) : null}
                  {(formik.touched.check_in_opens_at || formik.touched.check_in_closes_at) &&
                  (formik.errors.check_in_opens_at || formik.errors.check_in_closes_at) ? (
                    <p className="text-xs text-destructive">
                      {formik.errors.check_in_opens_at || formik.errors.check_in_closes_at}
                    </p>
                  ) : null}
                </div>

                <div className="sm:col-span-2 rounded-xl border border-border/60 bg-muted/20 p-4 space-y-4">
                  <div>
                    <p className="text-sm font-semibold">
                      {t("staffPortal.eventEdit.locationSection")}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {t("staffPortal.eventEdit.locationSectionHint")}
                    </p>
                  </div>

                  <GeoCitySelector
                    className="w-full"
                    stateId={geoStateId}
                    cityId={geoCityId}
                    cityName={formik.values.location_city}
                    stateName={formik.values.location_state}
                    staffRole={isAdmin ? "admin" : "organizer"}
                    legacySearchResolved={geoLegacySearchResolved}
                    onChange={(sel) => {
                      geoUserTouchedRef.current = true;
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

                  {citySelectionIncomplete ? (
                    <p className="text-xs text-destructive">
                      {t("staffPortal.eventEdit.validation.cityFromCatalog")}
                    </p>
                  ) : null}

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div className="space-y-2 sm:col-span-2 lg:col-span-3">
                      <Label htmlFor="location_name">{t("staffPortal.eventEdit.fieldVenue")}</Label>
                      <Input id="location_name" {...formik.getFieldProps("location_name")} />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="location_lat">{t("staffPortal.eventEdit.fieldLat")}</Label>
                      <Input
                        id="location_lat"
                        type="text"
                        inputMode="decimal"
                        autoComplete="off"
                        placeholder="19.4326"
                        {...formik.getFieldProps("location_lat")}
                      />
                    </div>

                    <div className="space-y-2 sm:col-span-2 lg:col-span-2">
                      <Label htmlFor="location_lng">{t("staffPortal.eventEdit.fieldLng")}</Label>
                      <Input
                        id="location_lng"
                        type="text"
                        inputMode="decimal"
                        autoComplete="off"
                        placeholder="-99.1332"
                        {...formik.getFieldProps("location_lng")}
                      />
                      <p className="text-xs text-muted-foreground">
                        {t("staffPortal.eventEdit.fieldLocationHint")}
                      </p>
                    </div>
                  </div>
                </div>

                {!isNew && isAdmin ? (
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
                          {(
                            [
                              ["draft", "staffPortal.events.statusDraft"],
                              ["pending_approval", "staffPortal.events.statusPendingApproval"],
                              ["published", "staffPortal.events.statusPublished"],
                              ["completed", "staffPortal.events.statusCompleted"],
                              ["cancelled", "staffPortal.events.statusCancelled"],
                            ] as const
                          ).map(([value, labelKey]) => (
                            <SelectItem key={value} value={value}>
                              {t(labelKey)}
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
                          {(["public", "private", "unlisted"] as const).map((s) => (
                            <SelectItem key={s} value={s}>
                              {t(`staffPortal.eventEdit.visibility.${s}`)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="fee_presentation">
                        {t("staffPortal.eventEdit.fieldFeePresentation")}
                      </Label>
                      <Select
                        value={formik.values.fee_presentation}
                        onValueChange={handleFeePresentationChange}
                      >
                        <SelectTrigger id="fee_presentation">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="inherit">
                            {t("staffPortal.eventEdit.feePresentation.inherit")}
                          </SelectItem>
                          <SelectItem value="pass_through">
                            {t("staffPortal.eventEdit.feePresentation.passThrough")}
                          </SelectItem>
                          <SelectItem value="absorb_all">
                            {t("staffPortal.eventEdit.feePresentation.absorbAll")}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        {t("staffPortal.eventEdit.fieldFeePresentationHint")}
                      </p>
                      {formik.values.fee_presentation === "inherit" ? (
                        <p className="text-xs text-muted-foreground rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
                          {t(
                            effectiveFeePresentation === "absorb_all"
                              ? "staffPortal.eventEdit.feePresentationEffectiveAbsorb"
                              : "staffPortal.eventEdit.feePresentationEffectivePassThrough",
                          )}
                        </p>
                      ) : null}
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
                    imageRole="hero"
                    staffIsAdmin={isAdmin}
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

                <div className="sm:col-span-2 space-y-2">
                  <Label>{t("staffPortal.eventEdit.fieldBanner")}</Label>
                  <EventAssetUpload
                    kind="image"
                    imageRole="banner"
                    staffIsAdmin={isAdmin}
                    previewUrl={bannerPreviewUrl}
                    onSelectFile={(file) => {
                      if (bannerPreviewUrl?.startsWith("blob:")) revokeBlobUrl(bannerPreviewUrl);
                      setBannerPendingFile(file);
                      setBannerPreviewUrl(createBlobPreviewUrl(file));
                    }}
                    onClear={() => {
                      if (bannerPreviewUrl?.startsWith("blob:")) revokeBlobUrl(bannerPreviewUrl);
                      setBannerPendingFile(null);
                      setBannerPreviewUrl(null);
                      void formik.setFieldValue("banner_image_url", "");
                    }}
                  />
                  <Input
                    id="banner_image_url"
                    placeholder={t("staffPortal.eventEdit.fieldBannerUrlFallback")}
                    {...formik.getFieldProps("banner_image_url")}
                  />
                  <p className="text-xs text-muted-foreground">
                    {t("staffPortal.eventEdit.fieldBannerHint")}
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
                    ref={descriptionEditorRef}
                    value={formik.values.description}
                    onChange={(html) => {
                      descriptionHtmlRef.current = html;
                      void formik.setFieldValue("description", html);
                    }}
                    onStageImage={stageDescriptionImage}
                    placeholder={t("staffPortal.eventEdit.fieldDescPlaceholder")}
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={
                  savingEvent ||
                  uploadingAssets ||
                  sportTypes.length === 0 ||
                  formik.values.sport_type_id <= 0
                }
                className="w-full sm:w-auto"
              >
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
                  feePresentation={effectiveFeePresentation}
                  serviceFeePercent={staffServiceFeePercent}
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
                          imageRole="sponsor"
                          staffIsAdmin={isAdmin}
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
                                {t(`staffPortal.eventEdit.sponsorTier.${tier}`)}
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
                            {(["text", "textarea", "select", "checkbox", "number", "date"] as const).map(
                              (type) => (
                                <SelectItem key={type} value={type}>
                                  {t(`staffPortal.eventEdit.fieldType.${type}`)}
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
                            imageRole={resolveEventImageRole(m.asset_type)}
                            staffIsAdmin={isAdmin}
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
    </div>
  );
}

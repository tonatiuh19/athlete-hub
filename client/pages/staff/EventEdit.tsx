import { useEffect, useState } from "react";
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
  Pencil,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import MetaHelmet from "@/components/MetaHelmet";
import PortalErrorAlert from "@/components/athlete/PortalErrorAlert";
import StaffCourseSummaryCard from "@/components/staff/StaffCourseSummaryCard";
import StaffCourseWizardDialog from "@/components/staff/StaffCourseWizardDialog";
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
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchSportTypes } from "@/store/slices/marketplaceSlice";
import {
  addEventCategory,
  clearEventDetail,
  createDiscountCode,
  createOrganizerEvent,
  deleteDiscountCode,
  deleteEventCategory,
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
  updateEventCategory,
  updateEventCourse,
  updateEventMedia,
  updateEventSponsors,
  updateEventWaiver,
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
  StaffEventCategoryPatch,
  StaffEventCoursePayload,
  StaffEventUpsertRequest,
  StaffMediaAssetRow,
  StaffScheduleWaveInput,
} from "@shared/api";
import { getNumberLocale } from "@/utils/dateLocale";
import {
  canOrganizerCreateEvents,
  canOrganizerEditEvents,
} from "@/utils/staffNav";

const eventSchema = Yup.object({
  title: Yup.string().trim().required("Required").max(255),
  sport_type_id: Yup.number().min(1, "Required").required("Required"),
  start_date: Yup.string().required("Required"),
});

function toDatetimeLocal(value?: string | null): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromDatetimeLocal(value: string): string | null {
  if (!value) return null;
  return new Date(value).toISOString();
}

export default function StaffEventEdit() {
  const { eventId: eventIdParam } = useParams<{ eventId: string }>();
  const isNew = eventIdParam === "new";
  const eventId = isNew ? null : Number(eventIdParam);
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const dispatch = useAppDispatch();
  const { role, user } = useAppSelector((s) => s.staffAuth);
  const { sportTypes } = useAppSelector((s) => s.marketplace);
  const {
    eventDetail,
    eventSponsors,
    registrationFields,
    eventWaiver,
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
    savingCategory,
    categoryError,
    savingSponsors,
    sponsorsError,
    savingFields,
    fieldsError,
    savingWaiver,
    waiverError,
    savingWaves,
    wavesError,
    savingCourse,
    courseError,
    savingDiscountCode,
    discountCodesError,
  } = useAppSelector((s) => s.staffPortal);

  const [tab, setTab] = useState("details");
  const [courseWizardOpen, setCourseWizardOpen] = useState(false);
  const [catName, setCatName] = useState("");
  const [catPrice, setCatPrice] = useState("");
  const [editingCategoryId, setEditingCategoryId] = useState<number | null>(null);
  const [categoryDraft, setCategoryDraft] = useState<StaffEventCategoryPatch>({});
  const [fieldDrafts, setFieldDrafts] = useState<EventRegistrationFieldInput[]>([]);
  const [waiverTitle, setWaiverTitle] = useState("");
  const [waiverContent, setWaiverContent] = useState("");
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
  const numLocale = getNumberLocale(i18n.language);
  const isAdmin = role === "admin";
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
    if (eventWaiver) {
      setWaiverTitle(eventWaiver.title);
      setWaiverContent(eventWaiver.content_html);
    }
  }, [eventWaiver]);

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
      start_date: toDatetimeLocal(event?.start_date),
      end_date: toDatetimeLocal(event?.end_date),
      registration_opens_at: toDatetimeLocal(event?.registration_opens_at),
      registration_closes_at: toDatetimeLocal(event?.registration_closes_at),
      location_city: event?.location_city ?? "",
      location_name: event?.location_name ?? "",
      hero_image_url: event?.hero_image_url ?? "",
      max_registrations: event?.max_registrations?.toString() ?? "",
    },
    validationSchema: eventSchema,
    onSubmit: async (values) => {
      if (!role) return;
      const body: StaffEventUpsertRequest = {
        title: values.title.trim(),
        slug: values.slug.trim() || undefined,
        sport_type_id: Number(values.sport_type_id),
        short_description: values.short_description.trim() || null,
        description: values.description.trim() || null,
        status: values.status,
        visibility: values.visibility,
        featured: values.featured,
        start_date: fromDatetimeLocal(values.start_date) ?? values.start_date,
        end_date: fromDatetimeLocal(values.end_date),
        registration_opens_at: fromDatetimeLocal(values.registration_opens_at),
        registration_closes_at: fromDatetimeLocal(values.registration_closes_at),
        location_city: values.location_city.trim() || null,
        location_name: values.location_name.trim() || null,
        hero_image_url: values.hero_image_url.trim() || null,
        max_registrations: values.max_registrations
          ? Number(values.max_registrations)
          : null,
      };

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
    },
  });

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
    }
  };

  const handleAddCategory = async () => {
    if (!eventId || !catName.trim() || !catPrice) return;
    const price_cents = Math.round(Number(catPrice) * 100);
    if (!Number.isFinite(price_cents) || price_cents < 0) return;
    await dispatch(
      addEventCategory({
        eventId,
        role: staffRole,
        body: { name: catName.trim(), price_cents },
      }),
    );
    setCatName("");
    setCatPrice("");
  };

  const handleSaveSponsors = () => {
    if (!eventId || !role) return;
    dispatch(
      updateEventSponsors({
        eventId,
        role: staffRole,
        sponsors: sponsorDrafts.filter((s) => s.name.trim()),
      }),
    );
  };

  const startEditCategory = (c: {
    id: number;
    name: string;
    price_cents: number;
    capacity?: number | null;
    distance_km?: number | null;
    gender_restriction?: string | null;
    waitlist_enabled?: boolean | number;
    registration_opens_at?: string | null;
    registration_closes_at?: string | null;
  }) => {
    setEditingCategoryId(c.id);
    setCategoryDraft({
      name: c.name,
      price_cents: c.price_cents,
      capacity: c.capacity ?? null,
      distance_km: c.distance_km ?? null,
      gender_restriction: c.gender_restriction ?? "any",
      waitlist_enabled: Boolean(c.waitlist_enabled),
      registration_opens_at: toDatetimeLocal(c.registration_opens_at) || null,
      registration_closes_at: toDatetimeLocal(c.registration_closes_at) || null,
    });
  };

  const handleSaveCategoryEdit = async () => {
    if (!eventId || editingCategoryId == null) return;
    const opensLocal =
      typeof categoryDraft.registration_opens_at === "string"
        ? categoryDraft.registration_opens_at
        : "";
    const closesLocal =
      typeof categoryDraft.registration_closes_at === "string"
        ? categoryDraft.registration_closes_at
        : "";
    await dispatch(
      updateEventCategory({
        eventId,
        categoryId: editingCategoryId,
        role: staffRole,
        body: {
          ...categoryDraft,
          registration_opens_at: opensLocal ? fromDatetimeLocal(opensLocal) : null,
          registration_closes_at: closesLocal ? fromDatetimeLocal(closesLocal) : null,
        },
      }),
    );
    setEditingCategoryId(null);
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

  const handleSaveWaiver = () => {
    if (!eventId || !role || !waiverTitle.trim() || !waiverContent.trim()) return;
    dispatch(
      updateEventWaiver({
        eventId,
        role: staffRole,
        title: waiverTitle.trim(),
        content_html: waiverContent.trim(),
      }),
    );
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
    <div className="max-w-4xl mx-auto space-y-6 min-w-0">
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
            disabled={publishingEvent}
            onClick={handlePublish}
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

      {loadingEventDetail && !isNew ? (
        <p className="text-muted-foreground">{t("common.loading")}</p>
      ) : (
        <Tabs value={tab} onValueChange={setTab} className="flex flex-col lg:flex-row gap-4 lg:gap-6 items-start">
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

          <div className="flex-1 min-w-0 w-full">

          <TabsContent value="details" className="mt-0">
            <form onSubmit={formik.handleSubmit} className="card-sport p-6 space-y-5">
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

                <div className="space-y-2">
                  <Label htmlFor="location_city">{t("staffPortal.eventEdit.fieldCity")}</Label>
                  <Input id="location_city" {...formik.getFieldProps("location_city")} />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="location_name">{t("staffPortal.eventEdit.fieldVenue")}</Label>
                  <Input id="location_name" {...formik.getFieldProps("location_name")} />
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

                <div className="space-y-2">
                  <Label htmlFor="hero_image_url">{t("staffPortal.eventEdit.fieldHero")}</Label>
                  <Input id="hero_image_url" {...formik.getFieldProps("hero_image_url")} />
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
                  <Textarea id="description" rows={5} {...formik.getFieldProps("description")} />
                </div>
              </div>

              <Button type="submit" disabled={savingEvent} className="w-full sm:w-auto">
                {savingEvent ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                {isNew ? t("staffPortal.eventEdit.create") : t("staffPortal.eventEdit.save")}
              </Button>
            </form>
          </TabsContent>

          {!isNew ? (
            <TabsContent value="categories" className="mt-0 space-y-4">
              <div className="card-sport p-6 space-y-4">
                <h2 className="font-semibold">{t("staffPortal.eventEdit.categoriesTitle")}</h2>

                {(eventDetail?.categories?.length ?? 0) === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {t("staffPortal.eventEdit.noCategories")}
                  </p>
                ) : (
                  <div className="space-y-2">
                    {eventDetail?.categories.map((c) => (
                      <div
                        key={c.id}
                        className="rounded-xl border border-border p-3 space-y-3"
                      >
                        {editingCategoryId === c.id ? (
                          <div className="grid sm:grid-cols-2 gap-2">
                            <Input
                              value={categoryDraft.name ?? ""}
                              onChange={(e) =>
                                setCategoryDraft((d) => ({ ...d, name: e.target.value }))
                              }
                            />
                            <Input
                              type="number"
                              step={0.01}
                              value={
                                categoryDraft.price_cents != null
                                  ? categoryDraft.price_cents / 100
                                  : ""
                              }
                              onChange={(e) =>
                                setCategoryDraft((d) => ({
                                  ...d,
                                  price_cents: Math.round(Number(e.target.value) * 100),
                                }))
                              }
                            />
                            <Input
                              type="number"
                              placeholder={t("staffPortal.eventEdit.categoryCapacity")}
                              value={categoryDraft.capacity ?? ""}
                              onChange={(e) =>
                                setCategoryDraft((d) => ({
                                  ...d,
                                  capacity: e.target.value ? Number(e.target.value) : null,
                                }))
                              }
                            />
                            <Input
                              type="number"
                              step={0.01}
                              placeholder={t("staffPortal.eventEdit.categoryDistance")}
                              value={categoryDraft.distance_km ?? ""}
                              onChange={(e) =>
                                setCategoryDraft((d) => ({
                                  ...d,
                                  distance_km: e.target.value ? Number(e.target.value) : null,
                                }))
                              }
                            />
                            <label className="sm:col-span-2 flex items-center gap-2 text-sm">
                              <Checkbox
                                checked={Boolean(categoryDraft.waitlist_enabled)}
                                onCheckedChange={(checked) =>
                                  setCategoryDraft((d) => ({
                                    ...d,
                                    waitlist_enabled: checked === true,
                                  }))
                                }
                              />
                              {t("staffPortal.eventEdit.categoryWaitlist")}
                            </label>
                            <div>
                              <Label className="text-xs">
                                {t("staffPortal.eventEdit.categoryRegOpens")}
                              </Label>
                              <Input
                                type="datetime-local"
                                value={
                                  typeof categoryDraft.registration_opens_at === "string"
                                    ? categoryDraft.registration_opens_at
                                    : ""
                                }
                                onChange={(e) =>
                                  setCategoryDraft((d) => ({
                                    ...d,
                                    registration_opens_at: e.target.value || null,
                                  }))
                                }
                              />
                            </div>
                            <div>
                              <Label className="text-xs">
                                {t("staffPortal.eventEdit.categoryRegCloses")}
                              </Label>
                              <Input
                                type="datetime-local"
                                value={
                                  typeof categoryDraft.registration_closes_at === "string"
                                    ? categoryDraft.registration_closes_at
                                    : ""
                                }
                                onChange={(e) =>
                                  setCategoryDraft((d) => ({
                                    ...d,
                                    registration_closes_at: e.target.value || null,
                                  }))
                                }
                              />
                            </div>
                            <div className="sm:col-span-2 flex gap-2">
                              <Button size="sm" onClick={handleSaveCategoryEdit}>
                                {t("staffPortal.eventEdit.save")}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setEditingCategoryId(null)}
                              >
                                {t("common.cancel")}
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="font-medium">{c.name}</p>
                              <p className="text-xs text-muted-foreground">
                                ${(c.price_cents / 100).toLocaleString(numLocale)} MXN ·{" "}
                                {c.sold_count}
                                {c.capacity != null ? ` / ${c.capacity}` : ""}{" "}
                                {t("staffPortal.dashboard.registered").toLowerCase()}
                                {c.distance_km ? ` · ${c.distance_km} km` : ""}
                                {Boolean(c.waitlist_enabled)
                                  ? ` · ${t("staffPortal.eventEdit.waitlistOn")}`
                                  : ""}
                              </p>
                            </div>
                            {canManageCategories ? (
                              <div className="flex gap-1 shrink-0">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => startEditCategory(c)}
                                >
                                  <Pencil className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="text-destructive"
                                  onClick={() =>
                                    eventId &&
                                    dispatch(
                                      deleteEventCategory({
                                        eventId,
                                        categoryId: c.id,
                                        role: staffRole,
                                      }),
                                    )
                                  }
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            ) : null}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {canManageCategories ? (
                  <div className="pt-4 border-t border-border space-y-3">
                    <h3 className="text-sm font-medium">{t("staffPortal.eventEdit.addCategory")}</h3>
                    {categoryError ? (
                      <p className="text-sm text-destructive">{categoryError}</p>
                    ) : null}
                    <div className="flex flex-col sm:flex-row gap-2">
                      <Input
                        placeholder={t("staffPortal.eventEdit.categoryName")}
                        value={catName}
                        onChange={(e) => setCatName(e.target.value)}
                        className="flex-1"
                      />
                      <Input
                        type="number"
                        min={0}
                        step={0.01}
                        placeholder={t("staffPortal.eventEdit.categoryPrice")}
                        value={catPrice}
                        onChange={(e) => setCatPrice(e.target.value)}
                        className="w-full sm:w-32"
                      />
                      <Button
                        type="button"
                        onClick={handleAddCategory}
                        disabled={savingCategory || !catName.trim() || !catPrice}
                      >
                        {savingCategory ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Plus className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>
            </TabsContent>
          ) : null}

          {canManageSponsors ? (
            <TabsContent value="sponsors" className="mt-0 space-y-4">
              <div className="card-sport p-6 space-y-4">
                <h2 className="font-semibold">{t("staffPortal.eventEdit.sponsorsTitle")}</h2>
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
                  <Button type="button" onClick={handleSaveSponsors} disabled={savingSponsors}>
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
              <div className="card-sport p-6 space-y-4">
                <h2 className="font-semibold">{t("staffPortal.eventEdit.waiverTitle")}</h2>
                <p className="text-sm text-muted-foreground">
                  {t("staffPortal.eventEdit.waiverSubtitle")}
                </p>
                {waiverError ? <p className="text-sm text-destructive">{waiverError}</p> : null}
                <Input
                  placeholder={t("staffPortal.eventEdit.waiverName")}
                  value={waiverTitle}
                  onChange={(e) => setWaiverTitle(e.target.value)}
                />
                <Textarea
                  rows={10}
                  placeholder={t("staffPortal.eventEdit.waiverContent")}
                  value={waiverContent}
                  onChange={(e) => setWaiverContent(e.target.value)}
                />
                {eventWaiver ? (
                  <p className="text-xs text-muted-foreground">
                    {t("staffPortal.eventEdit.waiverVersion", { version: eventWaiver.version })}
                  </p>
                ) : null}
                <Button
                  type="button"
                  onClick={handleSaveWaiver}
                  disabled={savingWaiver || !waiverTitle.trim() || !waiverContent.trim()}
                >
                  {savingWaiver ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Save className="w-4 h-4 mr-2" />
                  )}
                  {t("staffPortal.eventEdit.saveWaiver")}
                </Button>
              </div>
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
                  onOpenWizard={() => setCourseWizardOpen(true)}
                />
                <StaffCourseWizardDialog
                  open={courseWizardOpen}
                  onOpenChange={setCourseWizardOpen}
                  value={courseDraft}
                  onSave={handleWizardSave}
                  saving={savingCourse}
                  eventLat={event?.location_lat}
                  eventLng={event?.location_lng}
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
                        <Input
                          className="sm:col-span-7"
                          placeholder="https://..."
                          value={m.url}
                          onChange={(e) => {
                            const next = [...mediaDrafts];
                            next[i] = { ...next[i], url: e.target.value };
                            setMediaDrafts(next);
                          }}
                        />
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
                    disabled={savingEventMedia || !eventId}
                    onClick={() =>
                      eventId &&
                      dispatch(
                        updateEventMedia({
                          eventId,
                          role: staffRole,
                          media: mediaDrafts.filter((m) => m.url.trim()),
                        }),
                      )
                    }
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
      )}
    </div>
  );
}

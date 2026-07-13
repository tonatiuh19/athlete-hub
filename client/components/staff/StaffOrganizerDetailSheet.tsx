import { useEffect, useRef, useState } from "react";
import { useFormik } from "formik";
import { format } from "date-fns";
import { Loader2, Save, Sparkles, UserPlus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { slugify } from "@shared/slugify";
import GeoCitySelector from "@/components/geo/GeoCitySelector";
import StaffStatusBadge from "@/components/staff/StaffStatusBadge";
import StaffFeeCalculatorCard from "@/components/staff/StaffFeeCalculatorCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchGeoCities, fetchGeoStates } from "@/store/slices/geoSlice";
import StaffOrganizerEventsSection from "@/components/staff/StaffOrganizerEventsSection";
import StaffAdminConnectPanel from "@/components/staff/StaffAdminConnectPanel";
import {
  clearStaffOrganizerDetail,
  fetchStaffOrganizerDetail,
  inviteStaffOrganizerMember,
  updateStaffOrganizer,
  updateStaffOrganizerMember,
  updateStaffOrganizerMemberAccess,
} from "@/store/slices/staffPortalSlice";
import { getDateFnsLocale } from "@/utils/dateLocale";
import { isOrganizerCitySelectionValid } from "@/utils/geoCityValidation";
import {
  buildOrganizerUpdatePatch,
  normalizeOrganizerStatus,
  ORGANIZER_SLUG_MAX,
  ORGANIZER_STATUSES,
} from "@/utils/organizerForm";
import type { FeePresentation } from "@shared/checkoutBreakdown";
import { useToast } from "@/hooks/use-toast";

const MEMBER_ROLES = [
  "organizer",
  "operations",
  "marketing",
  "finance",
  "timing",
  "sponsor",
] as const;

interface StaffOrganizerDetailSheetProps {
  organizerId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function StaffOrganizerDetailSheet({
  organizerId,
  open,
  onOpenChange,
}: StaffOrganizerDetailSheetProps) {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const dispatch = useAppDispatch();
  const {
    staffOrganizerDetail,
    loadingStaffOrganizerDetail,
    staffOrganizerDetailError,
    savingStaffOrganizer,
    staffOrganizerSaveError,
    invitingStaffOrganizerMember,
    staffOrganizerMemberError,
  } = useAppSelector((s) => s.staffPortal);
  const [geoStateId, setGeoStateId] = useState<number | null>(null);
  const [geoCityId, setGeoCityId] = useState<number | null>(null);
  const [slugEdited, setSlugEdited] = useState(false);
  const geoHydratedForRef = useRef<number | null>(null);
  const dateLocale = getDateFnsLocale(i18n.language);

  const organizer = staffOrganizerDetail?.organizer;
  const members = staffOrganizerDetail?.members ?? [];
  const linkedEvents = staffOrganizerDetail?.events ?? [];
  const normalizedStatus = normalizeOrganizerStatus(organizer?.status);

  useEffect(() => {
    if (open) dispatch(fetchGeoStates("MX"));
  }, [dispatch, open]);

  useEffect(() => {
    if (!open || !organizerId) return;
    geoHydratedForRef.current = null;
    setGeoStateId(null);
    setGeoCityId(null);
    setSlugEdited(false);
    dispatch(fetchStaffOrganizerDetail({ organizerId }));
  }, [dispatch, open, organizerId]);

  useEffect(() => {
    if (!open || !organizer?.id || !organizer.city?.trim()) return;
    if (geoHydratedForRef.current === organizer.id) return;

    let cancelled = false;
    void dispatch(fetchGeoCities({ q: organizer.city.trim(), country: "MX" })).then((action) => {
      if (cancelled || !fetchGeoCities.fulfilled.match(action)) return;
      const match = action.payload.cities.find(
        (c) => c.name.trim().toLowerCase() === organizer.city!.trim().toLowerCase(),
      );
      if (!match) return;
      geoHydratedForRef.current = organizer.id;
      setGeoStateId(match.state_id);
      setGeoCityId(match.id);
    });

    return () => {
      cancelled = true;
    };
  }, [dispatch, open, organizer?.id, organizer?.city]);

  const profileForm = useFormik({
    enableReinitialize: true,
    initialValues: {
      name: organizer?.name ?? "",
      slug: organizer?.slug ?? "",
      email: organizer?.email ?? "",
      phone: organizer?.phone ?? "",
      city: organizer?.city ?? "",
      status: normalizedStatus,
      service_fee_percent: Number(organizer?.service_fee_percent ?? 11),
      fee_presentation: (organizer?.fee_presentation ?? "pass_through") as FeePresentation,
    },
    onSubmit: async (values) => {
      if (!organizerId) return;
      if (!isOrganizerCitySelectionValid(geoCityId, values.city, organizer?.city)) {
        toast({
          title: t("geo.citySelector.invalidSelectionTitle"),
          description: t("geo.citySelector.supportMessageAdmin"),
          variant: "destructive",
        });
        return;
      }

      const patch = buildOrganizerUpdatePatch({
        name: values.name,
        slug: values.slug,
        email: values.email,
        phone: values.phone,
        city: values.city,
        status: values.status,
        service_fee_percent: values.service_fee_percent,
        fee_presentation: values.fee_presentation,
        geoCityId,
        savedCity: organizer?.city,
        fallbackStatus: normalizedStatus,
      });

      const result = await dispatch(updateStaffOrganizer({ organizerId, patch }));
      if (updateStaffOrganizer.fulfilled.match(result)) {
        toast({ title: t("staffPortal.staffManagement.organizerSaved") });
      }
    },
  });

  const handleNameChange = (name: string) => {
    void profileForm.setFieldValue("name", name);
    if (!slugEdited) {
      void profileForm.setFieldValue("slug", slugify(name, ORGANIZER_SLUG_MAX));
    }
  };

  const handleSlugChange = (raw: string) => {
    setSlugEdited(true);
    void profileForm.setFieldValue("slug", slugify(raw, ORGANIZER_SLUG_MAX));
  };

  const regenerateSlug = () => {
    setSlugEdited(false);
    void profileForm.setFieldValue(
      "slug",
      slugify(profileForm.values.name, ORGANIZER_SLUG_MAX),
    );
  };

  const slugPreview =
    profileForm.values.slug.trim() ||
    slugify(profileForm.values.name, ORGANIZER_SLUG_MAX);

  const absorbAllFees = profileForm.values.fee_presentation === "absorb_all";

  const handleFeePresentationToggle = (checked: boolean) => {
    if (checked && !window.confirm(t("staffPortal.payouts.feePresentationSwitchConfirm"))) {
      return;
    }
    void profileForm.setFieldValue("fee_presentation", checked ? "absorb_all" : "pass_through");
  };

  const handleOpen = (next: boolean) => {
    if (!next) dispatch(clearStaffOrganizerDetail());
    onOpenChange(next);
  };

  const inviteForm = useFormik({
    initialValues: { email: "", first_name: "", last_name: "", role: "organizer" },
    onSubmit: async (values, { resetForm }) => {
      if (!organizerId) return;
      const result = await dispatch(
        inviteStaffOrganizerMember({
          organizerId,
          email: values.email.trim(),
          first_name: values.first_name.trim(),
          last_name: values.last_name.trim(),
          role: values.role,
        }),
      );
      if (inviteStaffOrganizerMember.fulfilled.match(result)) resetForm();
    },
  });

  return (
    <Sheet open={open} onOpenChange={handleOpen}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{t("staffPortal.staffManagement.organizerDetailTitle")}</SheetTitle>
          <SheetDescription>{t("staffPortal.staffManagement.organizerDetailSubtitle")}</SheetDescription>
        </SheetHeader>

        {loadingStaffOrganizerDetail ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : staffOrganizerDetailError ? (
          <p className="text-sm text-destructive mt-6">{staffOrganizerDetailError}</p>
        ) : organizer ? (
          <div className="mt-6 space-y-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold">{organizer.name}</h3>
                <p className="text-sm text-muted-foreground">{organizer.email}</p>
                <p className="text-xs text-muted-foreground mt-1">/{slugPreview}</p>
              </div>
              <StaffStatusBadge status={normalizedStatus} />
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="card-sport p-3">
                <p className="text-muted-foreground">{t("staffPortal.staffManagement.colEvents")}</p>
                <p className="text-xl font-bold text-primary">{organizer.event_count ?? 0}</p>
              </div>
              <div className="card-sport p-3">
                <p className="text-muted-foreground">{t("staffPortal.staffManagement.colMembers")}</p>
                <p className="text-xl font-bold text-primary">{organizer.member_count ?? members.length}</p>
              </div>
            </div>

            {organizer.onboarding_intake?.self_service_registered_at ? (
              <div className="card-sport p-4 space-y-3">
                <h4 className="font-semibold">{t("organizerSignup.adminIntake.title")}</h4>
                <p className="text-xs text-muted-foreground">
                  {t("organizerSignup.adminIntake.registeredAt", {
                    date: format(
                      new Date(organizer.onboarding_intake.self_service_registered_at),
                      "PPp",
                      { locale: dateLocale },
                    ),
                  })}
                </p>
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="text-muted-foreground">{t("organizerSignup.adminIntake.sport")}</dt>
                    <dd className="font-medium">
                      {organizer.onboarding_intake.sport_type_id != null
                        ? `#${organizer.onboarding_intake.sport_type_id}`
                        : t("organizerSignup.adminIntake.none")}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">{t("organizerSignup.adminIntake.roughDate")}</dt>
                    <dd className="font-medium">
                      {organizer.onboarding_intake.rough_date ||
                        t("organizerSignup.adminIntake.none")}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">{t("organizerSignup.adminIntake.expectedSize")}</dt>
                    <dd className="font-medium">
                      {organizer.onboarding_intake.expected_size ||
                        t("organizerSignup.adminIntake.none")}
                    </dd>
                  </div>
                </dl>
              </div>
            ) : null}

            <form onSubmit={profileForm.handleSubmit} className="card-sport p-4 space-y-4">
              <h4 className="font-semibold">{t("staffPortal.staffManagement.editOrganizerSection")}</h4>
              <div className="space-y-2">
                <Label htmlFor="org-edit-name">{t("staffPortal.staffManagement.fieldOrgName")}</Label>
                <Input
                  id="org-edit-name"
                  name="name"
                  value={profileForm.values.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  onBlur={profileForm.handleBlur}
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="org-edit-slug">{t("staffPortal.staffManagement.fieldSlug")}</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-muted-foreground"
                    onClick={regenerateSlug}
                  >
                    <Sparkles className="w-3.5 h-3.5 mr-1" />
                    {t("staffPortal.staffManagement.regenerateSlug")}
                  </Button>
                </div>
                <Input
                  id="org-edit-slug"
                  name="slug"
                  value={profileForm.values.slug}
                  onChange={(e) => handleSlugChange(e.target.value)}
                  onBlur={profileForm.handleBlur}
                  placeholder={t("staffPortal.staffManagement.slugPlaceholder")}
                />
                <p className="text-xs text-muted-foreground">
                  {slugEdited
                    ? t("staffPortal.staffManagement.slugHelp")
                    : t("staffPortal.staffManagement.slugAutoHint")}
                </p>
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="org-edit-email">{t("staffPortal.staffManagement.fieldOrgEmail")}</Label>
                  <Input id="org-edit-email" type="email" {...profileForm.getFieldProps("email")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="org-edit-phone">{t("staffPortal.staffManagement.fieldPhone")}</Label>
                  <Input id="org-edit-phone" {...profileForm.getFieldProps("phone")} />
                </div>
              </div>
              <GeoCitySelector
                stateId={geoStateId}
                cityId={geoCityId}
                cityName={profileForm.values.city}
                staffRole="admin"
                onChange={(sel) => {
                  setGeoStateId(sel.stateId);
                  setGeoCityId(sel.geoCityId);
                  void profileForm.setFieldValue("city", sel.city);
                }}
              />
              <div className="rounded-lg border border-border/60 p-3 space-y-2">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold">
                      {t("staffPortal.payouts.feePresentationTitle")}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t("staffPortal.payouts.feePresentationHint")}
                    </p>
                  </div>
                  <Switch
                    checked={absorbAllFees}
                    onCheckedChange={handleFeePresentationToggle}
                    aria-label={t("staffPortal.payouts.feePresentationTitle")}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  {absorbAllFees
                    ? t("staffPortal.payouts.feePresentationAbsorbActive")
                    : t("staffPortal.payouts.feePresentationPassThroughActive")}
                </p>
                {profileForm.values.fee_presentation !== (organizer?.fee_presentation ?? "pass_through") ? (
                  <p className="text-xs text-muted-foreground">
                    {t("staffPortal.staffManagement.feePresentationSaveHint")}
                  </p>
                ) : null}
              </div>
              <StaffFeeCalculatorCard
                serviceFeePercent={profileForm.values.service_fee_percent}
                feePresentation={profileForm.values.fee_presentation}
                feeEditable
                onFeePercentChange={(fee) => void profileForm.setFieldValue("service_fee_percent", fee)}
                compact
              />
              <div className="space-y-2">
                <Label>{t("staffPortal.staffManagement.fieldStatus")}</Label>
                <Select
                  value={profileForm.values.status}
                  onValueChange={(status) => void profileForm.setFieldValue("status", status)}
                  disabled={savingStaffOrganizer}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("staffPortal.staffManagement.fieldStatus")} />
                  </SelectTrigger>
                  <SelectContent>
                    {ORGANIZER_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {staffOrganizerSaveError ? (
                <p className="text-sm text-destructive">{staffOrganizerSaveError}</p>
              ) : null}
              <Button type="submit" disabled={savingStaffOrganizer} className="w-full sm:w-auto">
                {savingStaffOrganizer ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                {t("staffPortal.staffManagement.saveOrganizer")}
              </Button>
            </form>

            {organizerId ? (
              <StaffOrganizerEventsSection organizerId={organizerId} events={linkedEvents} />
            ) : null}

            <div className="space-y-3">
              <h4 className="font-semibold">{t("staffPortal.staffManagement.teamSection")}</h4>
              <div className="card-sport overflow-hidden">
                <div className="overflow-x-auto overscroll-x-contain">
                <table className="w-full text-sm min-w-[480px]">
                  <thead>
                    <tr className="border-b border-border text-left text-muted-foreground">
                      <th className="p-3 font-medium">{t("staffPortal.team.colName")}</th>
                      <th className="p-3 font-medium">{t("staffPortal.team.colRole")}</th>
                      <th className="p-3 font-medium">{t("staffPortal.staffManagement.eventAccess")}</th>
                      <th className="p-3 font-medium">{t("staffPortal.team.colStatus")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {members.map((m) => (
                      <tr key={m.id} className="border-b border-border/60 align-top">
                        <td className="p-3">
                          <div className="font-medium">
                            {m.first_name} {m.last_name}
                          </div>
                          <div className="text-xs text-muted-foreground">{m.email}</div>
                        </td>
                        <td className="p-3 capitalize">{m.role}</td>
                        <td className="p-3">
                          {m.role === "owner" || m.role === "organizer" ? (
                            <span className="text-xs text-muted-foreground">
                              {t("staffPortal.staffManagement.accessAllEvents")}
                            </span>
                          ) : (
                            <Select
                              value={m.event_access_scope ?? "organization"}
                              onValueChange={(scope) => {
                                if (!organizerId) return;
                                if (scope === "organization") {
                                  dispatch(
                                    updateStaffOrganizerMemberAccess({
                                      organizerId,
                                      memberId: m.id,
                                      event_access_scope: "organization",
                                    }),
                                  );
                                  return;
                                }
                                const ids =
                                  m.assigned_event_ids?.length
                                    ? m.assigned_event_ids
                                    : linkedEvents.slice(0, 1).map((e) => e.id);
                                if (ids.length === 0) return;
                                dispatch(
                                  updateStaffOrganizerMemberAccess({
                                    organizerId,
                                    memberId: m.id,
                                    event_access_scope: "events",
                                    event_ids: ids,
                                  }),
                                );
                              }}
                            >
                              <SelectTrigger className="h-8 w-36">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="organization">
                                  {t("staffPortal.staffManagement.accessAllEvents")}
                                </SelectItem>
                                <SelectItem value="events">
                                  {t("staffPortal.staffManagement.accessSelectedEvents")}
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                          {m.event_access_scope === "events" && m.role !== "owner" && m.role !== "organizer" ? (
                            <div className="mt-2 space-y-1">
                              {linkedEvents.map((e) => {
                                const checked = m.assigned_event_ids?.includes(e.id) ?? false;
                                return (
                                  <label key={e.id} className="flex items-center gap-2 text-xs">
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      onChange={() => {
                                        if (!organizerId) return;
                                        const current = new Set(m.assigned_event_ids ?? []);
                                        if (checked) current.delete(e.id);
                                        else current.add(e.id);
                                        const event_ids = [...current];
                                        if (event_ids.length === 0) return;
                                        dispatch(
                                          updateStaffOrganizerMemberAccess({
                                            organizerId,
                                            memberId: m.id,
                                            event_access_scope: "events",
                                            event_ids,
                                          }),
                                        );
                                      }}
                                    />
                                    <span className="truncate">{e.title}</span>
                                  </label>
                                );
                              })}
                            </div>
                          ) : null}
                        </td>
                        <td className="p-3">
                          {m.role === "owner" ? (
                            <StaffStatusBadge status={m.status} />
                          ) : (
                            <Select
                              value={m.status}
                              onValueChange={(v) =>
                                organizerId &&
                                dispatch(
                                  updateStaffOrganizerMember({
                                    organizerId,
                                    memberId: m.id,
                                    status: v,
                                  }),
                                )
                              }
                            >
                              <SelectTrigger className="h-8 w-28">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {["invited", "active", "inactive", "suspended"].map((s) => (
                                  <SelectItem key={s} value={s}>
                                    {s}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              </div>
            </div>

            <form onSubmit={inviteForm.handleSubmit} className="card-sport p-4 space-y-3">
              <h4 className="font-semibold flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-primary" />
                {t("staffPortal.staffManagement.inviteMember")}
              </h4>
              <div className="grid sm:grid-cols-2 gap-3">
                <Input
                  placeholder={t("staffPortal.team.fieldEmail")}
                  type="email"
                  {...inviteForm.getFieldProps("email")}
                />
                <Select
                  value={inviteForm.values.role}
                  onValueChange={(v) => inviteForm.setFieldValue("role", v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MEMBER_ROLES.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input placeholder={t("staffPortal.team.fieldFirst")} {...inviteForm.getFieldProps("first_name")} />
                <Input placeholder={t("staffPortal.team.fieldLast")} {...inviteForm.getFieldProps("last_name")} />
              </div>
              {staffOrganizerMemberError ? (
                <p className="text-sm text-destructive">{staffOrganizerMemberError}</p>
              ) : null}
              <Button type="submit" size="sm" disabled={invitingStaffOrganizerMember}>
                {invitingStaffOrganizerMember ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : null}
                {t("staffPortal.team.addMember")}
              </Button>
            </form>

            {organizer.created_at ? (
              <p className="text-xs text-muted-foreground">
                {t("staffPortal.staffManagement.createdAt", {
                  date: format(new Date(organizer.created_at), "d MMM yyyy", { locale: dateLocale }),
                })}
              </p>
            ) : null}

            <div className="card-sport p-4 space-y-2 text-sm">
              <h4 className="font-semibold">{t("staffPortal.finance.connectSection")}</h4>
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">{t("staffPortal.finance.connectStatus")}</span>
                <span>
                  {organizer.stripe_onboarding_complete
                    ? t("staffPortal.finance.connectReady")
                    : organizer.stripe_account_id
                      ? t("staffPortal.finance.connectPending")
                      : t("staffPortal.finance.connectNone")}
                </span>
              </div>
              {organizer.service_fee_percent != null ? (
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">{t("staffPortal.finance.serviceFee")}</span>
                  <span>{organizer.service_fee_percent}%</span>
                </div>
              ) : null}
            </div>

            {organizerId ? <StaffAdminConnectPanel organizerId={organizerId} /> : null}
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

import { useEffect } from "react";
import { useFormik } from "formik";
import { format } from "date-fns";
import { Loader2, UserPlus } from "lucide-react";
import { useTranslation } from "react-i18next";
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
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
  const dispatch = useAppDispatch();
  const {
    staffOrganizerDetail,
    loadingStaffOrganizerDetail,
    staffOrganizerDetailError,
    savingStaffOrganizer,
    invitingStaffOrganizerMember,
    staffOrganizerMemberError,
  } = useAppSelector((s) => s.staffPortal);
  const dateLocale = getDateFnsLocale(i18n.language);

  const organizer = staffOrganizerDetail?.organizer;
  const members = staffOrganizerDetail?.members ?? [];
  const linkedEvents = staffOrganizerDetail?.events ?? [];

  useEffect(() => {
    if (open && organizerId) dispatch(fetchStaffOrganizerDetail({ organizerId }));
  }, [dispatch, open, organizerId]);

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

  const setStatus = (status: string) => {
    if (!organizerId) return;
    dispatch(updateStaffOrganizer({ organizerId, patch: { status: status as "active" } }));
  };

  return (
    <Sheet open={open} onOpenChange={handleOpen}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{t("staffPortal.staffManagement.organizerDetailTitle")}</SheetTitle>
          <SheetDescription>{t("staffPortal.staffManagement.organizerDetailSubtitle")}</SheetDescription>
        </SheetHeader>

        {loadingStaffOrganizerDetail ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-cyan" />
          </div>
        ) : staffOrganizerDetailError ? (
          <p className="text-sm text-destructive mt-6">{staffOrganizerDetailError}</p>
        ) : organizer ? (
          <div className="mt-6 space-y-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold">{organizer.name}</h3>
                <p className="text-sm text-muted-foreground">{organizer.email}</p>
                <p className="text-xs text-muted-foreground mt-1">/{organizer.slug}</p>
              </div>
              <StaffStatusBadge status={organizer.status} />
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="card-sport p-3">
                <p className="text-muted-foreground">{t("staffPortal.staffManagement.colEvents")}</p>
                <p className="text-xl font-bold text-cyan">{organizer.event_count ?? 0}</p>
              </div>
              <div className="card-sport p-3">
                <p className="text-muted-foreground">{t("staffPortal.staffManagement.colMembers")}</p>
                <p className="text-xl font-bold text-cyan">{organizer.member_count ?? members.length}</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t("staffPortal.staffManagement.fieldStatus")}</Label>
              <Select value={organizer.status} onValueChange={setStatus} disabled={savingStaffOrganizer}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["pending", "active", "suspended", "inactive"].map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

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
                <UserPlus className="w-4 h-4 text-cyan" />
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

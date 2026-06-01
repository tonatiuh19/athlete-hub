import { useEffect } from "react";
import { useFormik } from "formik";
import * as Yup from "yup";
import { Navigate } from "react-router-dom";
import { format } from "date-fns";
import { Loader2, UserPlus, Users } from "lucide-react";
import { useTranslation } from "react-i18next";
import MetaHelmet from "@/components/MetaHelmet";
import PortalErrorAlert from "@/components/athlete/PortalErrorAlert";
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
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  fetchOrganizerMembers,
  inviteOrganizerMember,
  updateOrganizerMember,
} from "@/store/slices/staffPortalSlice";
import { getDateFnsLocale } from "@/utils/dateLocale";
import { canOrganizerManageTeam } from "@/utils/staffNav";

const inviteSchema = Yup.object({
  email: Yup.string().email("Invalid email").required("Required"),
  first_name: Yup.string().trim().required("Required"),
  last_name: Yup.string().trim().required("Required"),
  role: Yup.string().required("Required"),
});

const MEMBER_ROLES = [
  "organizer",
  "operations",
  "marketing",
  "finance",
  "timing",
  "sponsor",
] as const;

export default function StaffTeam() {
  const { t, i18n } = useTranslation();
  const dispatch = useAppDispatch();
  const { role, user } = useAppSelector((s) => s.staffAuth);
  const { teamMembers, loadingTeam, teamError, invitingMember } = useAppSelector(
    (s) => s.staffPortal,
  );
  const dateLocale = getDateFnsLocale(i18n.language);
  const isOwner = user?.type === "organizer" && canOrganizerManageTeam(user.role);

  useEffect(() => {
    if (role === "organizer") dispatch(fetchOrganizerMembers());
  }, [dispatch, role]);

  const formik = useFormik({
    initialValues: {
      email: "",
      first_name: "",
      last_name: "",
      role: "organizer",
      phone: "",
    },
    validationSchema: inviteSchema,
    onSubmit: async (values, { resetForm }) => {
      const result = await dispatch(
        inviteOrganizerMember({
          email: values.email.trim(),
          first_name: values.first_name.trim(),
          last_name: values.last_name.trim(),
          role: values.role,
          phone: values.phone.trim() || undefined,
        }),
      );
      if (inviteOrganizerMember.fulfilled.match(result)) {
        resetForm();
      }
    },
  });

  if (role !== "organizer") {
    return <Navigate to="/staff" replace />;
  }

  if (user?.type === "organizer" && !canOrganizerManageTeam(user.role)) {
    return <Navigate to="/staff" replace />;
  }

  const reload = () => dispatch(fetchOrganizerMembers());

  return (
    <div className="max-w-4xl mx-auto space-y-6 min-w-0">
      <MetaHelmet
        title={t("staffPortal.team.title")}
        description={t("staffPortal.team.subtitle")}
      />
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Users className="w-7 h-7 text-cyan" />
          {t("staffPortal.team.title")}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">{t("staffPortal.team.subtitle")}</p>
      </div>

      <PortalErrorAlert error={teamError} onRetry={reload} />

      {isOwner ? (
        <form onSubmit={formik.handleSubmit} className="card-sport p-6 space-y-4">
          <h2 className="font-semibold flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-cyan" />
            {t("staffPortal.team.inviteTitle")}
          </h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email">{t("staffPortal.team.fieldEmail")}</Label>
              <Input id="email" type="email" {...formik.getFieldProps("email")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">{t("staffPortal.team.fieldRole")}</Label>
              <Select
                value={formik.values.role}
                onValueChange={(v) => formik.setFieldValue("role", v)}
              >
                <SelectTrigger id="role">
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
            </div>
            <div className="space-y-2">
              <Label htmlFor="first_name">{t("staffPortal.team.fieldFirst")}</Label>
              <Input id="first_name" {...formik.getFieldProps("first_name")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="last_name">{t("staffPortal.team.fieldLast")}</Label>
              <Input id="last_name" {...formik.getFieldProps("last_name")} />
            </div>
          </div>
          <Button type="submit" disabled={invitingMember}>
            {invitingMember ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <UserPlus className="w-4 h-4 mr-2" />
            )}
            {t("staffPortal.team.addMember")}
          </Button>
        </form>
      ) : (
        <p className="text-sm text-muted-foreground card-sport p-4">
          {t("staffPortal.team.ownerOnly")}
        </p>
      )}

      {loadingTeam ? (
        <p className="text-muted-foreground">{t("common.loading")}</p>
      ) : teamError ? null : (
        <div className="card-sport overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="p-4 font-medium">{t("staffPortal.team.colName")}</th>
                  <th className="p-4 font-medium">{t("staffPortal.team.colEmail")}</th>
                  <th className="p-4 font-medium">{t("staffPortal.team.colRole")}</th>
                  <th className="p-4 font-medium">{t("staffPortal.team.colStatus")}</th>
                  <th className="p-4 font-medium">{t("staffPortal.team.colJoined")}</th>
                </tr>
              </thead>
              <tbody>
                {teamMembers.map((m) => (
                  <tr key={m.id} className="border-b border-border/60">
                    <td className="p-4 font-medium whitespace-nowrap">
                      {m.first_name} {m.last_name}
                    </td>
                    <td className="p-4 text-muted-foreground">{m.email}</td>
                    <td className="p-4 capitalize">{m.role}</td>
                    <td className="p-4">
                      {isOwner && m.role !== "owner" ? (
                        <Select
                          value={m.status}
                          onValueChange={(v) =>
                            dispatch(updateOrganizerMember({ memberId: m.id, status: v }))
                          }
                        >
                          <SelectTrigger className="w-32 h-8">
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
                      ) : (
                        <StaffStatusBadge status={m.status} />
                      )}
                    </td>
                    <td className="p-4 text-muted-foreground whitespace-nowrap">
                      {format(new Date(m.created_at), "d MMM yyyy", { locale: dateLocale })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { useFormik } from "formik";
import * as Yup from "yup";
import { format } from "date-fns";
import {
  Building2,
  CalendarDays,
  Loader2,
  Mail,
  Phone,
  Save,
  ShieldCheck,
  User,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import MetaHelmet from "@/components/MetaHelmet";
import PortalErrorAlert from "@/components/athlete/PortalErrorAlert";
import StaffProfileAvatarUpload from "@/components/staff/StaffProfileAvatarUpload";
import { StaffPageSkeleton } from "@/components/staff/skeletons/StaffSkeletons";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  clearStaffError,
  fetchStaffMe,
  updateStaffLanguage,
  updateStaffProfile,
} from "@/store/slices/staffAuthSlice";
import { LOCALE_LABELS, normalizeLocale, type AppLocale } from "@shared/i18n";
import { getDateFnsLocale } from "@/utils/dateLocale";

type ProfileFormValues = {
  firstName: string;
  lastName: string;
  phone: string;
};

export default function StaffProfile() {
  const { t, i18n } = useTranslation();
  const dispatch = useAppDispatch();
  const { user, role, loading, updatingProfile, profileError } = useAppSelector(
    (s) => s.staffAuth,
  );
  const [saved, setSaved] = useState(false);
  const [languageSaved, setLanguageSaved] = useState(false);
  const dateLocale = getDateFnsLocale(i18n.language);
  const currentLocale = normalizeLocale(i18n.language);
  const isAdmin = role === "admin";

  useEffect(() => {
    if (role) dispatch(fetchStaffMe(role));
  }, [dispatch, role]);

  const validationSchema = useMemo(
    () =>
      Yup.object({
        firstName: Yup.string().trim().required(t("staffPortal.profile.validation.firstNameRequired")),
        lastName: Yup.string().trim().required(t("staffPortal.profile.validation.lastNameRequired")),
        phone: Yup.string().trim().max(20, t("staffPortal.profile.validation.phoneMax")),
      }),
    [t],
  );

  const formik = useFormik<ProfileFormValues>({
    enableReinitialize: true,
    initialValues: {
      firstName: user?.firstName ?? "",
      lastName: user?.lastName ?? "",
      phone: user?.phone ?? "",
    },
    validationSchema,
    onSubmit: async (values) => {
      if (!role) return;
      dispatch(clearStaffError());
      const result = await dispatch(
        updateStaffProfile({
          role,
          first_name: values.firstName.trim(),
          last_name: values.lastName.trim(),
          phone: values.phone.trim() || null,
        }),
      );
      if (updateStaffProfile.fulfilled.match(result)) {
        setSaved(true);
        window.setTimeout(() => setSaved(false), 2500);
      }
    },
  });

  const handleLanguageChange = async (locale: AppLocale) => {
    if (!role) return;
    await i18n.changeLanguage(locale);
    await dispatch(updateStaffLanguage({ locale, role }));
    setLanguageSaved(true);
    window.setTimeout(() => setLanguageSaved(false), 2500);
  };

  if (loading && !user) {
    return <StaffPageSkeleton variant="form" className="max-w-2xl py-6" />;
  }

  return (
    <div className="max-w-2xl mx-auto w-full min-w-0 overflow-x-clip space-y-6">
      <MetaHelmet
        title={t("staffPortal.profile.title")}
        description={t("staffPortal.profile.subtitle")}
      />

      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <User className="w-7 h-7 text-primary" />
          {t("staffPortal.profile.title")}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">{t("staffPortal.profile.subtitle")}</p>
      </div>

      <PortalErrorAlert error={profileError} onRetry={() => role && dispatch(fetchStaffMe(role))} />

      <div className="card-sport p-6 space-y-6">
        <StaffProfileAvatarUpload
          firstName={user?.firstName}
          lastName={user?.lastName}
          avatarUrl={user?.avatarUrl}
        />

        <div className="flex items-center gap-3 pt-2 border-t border-border text-sm">
          {isAdmin ? (
            <ShieldCheck className="w-5 h-5 text-primary shrink-0" />
          ) : (
            <Building2 className="w-5 h-5 text-primary shrink-0" />
          )}
          <div>
            <p className="font-medium capitalize">
              {isAdmin ? t("staffPortal.nav.admin") : t("staffPortal.nav.organizer")} ·{" "}
              {user?.role?.replace(/_/g, " ")}
            </p>
            {!isAdmin && user?.type === "organizer" && user.organizerName ? (
              <p className="text-muted-foreground">{user.organizerName}</p>
            ) : null}
          </div>
        </div>
      </div>

      <form onSubmit={formik.handleSubmit} className="card-sport p-6 space-y-5">
        <h2 className="font-semibold">{t("staffPortal.profile.personalSection")}</h2>

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="staff-first">{t("staffPortal.team.fieldFirst")}</Label>
            <Input id="staff-first" {...formik.getFieldProps("firstName")} />
            {formik.touched.firstName && formik.errors.firstName ? (
              <p className="text-xs text-destructive">{formik.errors.firstName}</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="staff-last">{t("staffPortal.team.fieldLast")}</Label>
            <Input id="staff-last" {...formik.getFieldProps("lastName")} />
            {formik.touched.lastName && formik.errors.lastName ? (
              <p className="text-xs text-destructive">{formik.errors.lastName}</p>
            ) : null}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="staff-phone" className="flex items-center gap-2">
            <Phone className="w-4 h-4 text-primary" />
            {t("staffPortal.profile.phone")}
          </Label>
          <Input id="staff-phone" type="tel" placeholder="+52 …" {...formik.getFieldProps("phone")} />
        </div>

        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <Mail className="w-4 h-4 text-primary" />
            {t("staffPortal.team.fieldEmail")}
          </Label>
          <Input value={user?.email ?? ""} disabled className="bg-muted/30" />
          <p className="text-xs text-muted-foreground">{t("staffPortal.profile.emailNote")}</p>
        </div>

        <Button type="submit" disabled={updatingProfile || !formik.dirty}>
          {updatingProfile ? (
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
          ) : (
            <Save className="w-4 h-4 mr-2" />
          )}
          {saved ? t("staffPortal.profile.saved") : t("staffPortal.profile.save")}
        </Button>
      </form>

      <div className="card-sport p-6 space-y-4">
        <h2 className="font-semibold">{t("staffPortal.settings.language")}</h2>
        <div className="flex gap-2">
          {(["es", "en"] as AppLocale[]).map((locale) => (
            <button
              key={locale}
              type="button"
              onClick={() => handleLanguageChange(locale)}
              className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition-all ${
                currentLocale === locale
                  ? "bg-cyan text-navy-deep border-cyan"
                  : "border-border text-muted-foreground hover:border-cyan/40"
              }`}
            >
              {LOCALE_LABELS[locale]}
            </button>
          ))}
        </div>
        {languageSaved ? (
          <p className="text-xs text-primary">{t("staffPortal.settings.languageSaved")}</p>
        ) : null}
      </div>

      <div className="card-sport p-6 space-y-3 text-sm">
        <h2 className="font-semibold">{t("staffPortal.profile.activitySection")}</h2>
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground flex items-center gap-2">
            <CalendarDays className="w-4 h-4" />
            {t("staffPortal.profile.memberSince")}
          </span>
          <span>
            {user?.createdAt
              ? format(new Date(user.createdAt), "d MMM yyyy", { locale: dateLocale })
              : "—"}
          </span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground">{t("staffPortal.staffManagement.colLastLogin")}</span>
          <span>
            {user?.lastLoginAt
              ? format(new Date(user.lastLoginAt), "d MMM yyyy, HH:mm", { locale: dateLocale })
              : t("staffPortal.profile.neverLoggedIn")}
          </span>
        </div>
      </div>

      <p className="text-xs text-muted-foreground text-center">{t("staffPortal.profile.roleNote")}</p>
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useFormik } from "formik";
import * as Yup from "yup";
import { useTranslation } from "react-i18next";
import MetaHelmet from "@/components/MetaHelmet";
import {
  User,
  Mail,
  CreditCard,
  ChevronRight,
  Loader2,
  Phone,
  MapPin,
  HeartPulse,
  Save,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  fetchAthleteMe,
  updateAthleteLanguage,
  updateAthleteProfile,
  clearAthleteError,
} from "@/store/slices/athleteAuthSlice";
import { LOCALE_LABELS, normalizeLocale, type AppLocale } from "@shared/i18n";
import ProfileAvatarUpload from "@/components/athlete/ProfileAvatarUpload";
import PortalErrorAlert from "@/components/athlete/PortalErrorAlert";
import {
  ATHLETE_GENDERS,
  ATHLETE_SHIRT_SIZES,
  type AthleteGender,
  type AthleteShirtSize,
} from "@shared/api";

type ProfileFormValues = {
  firstName: string;
  lastName: string;
  phone: string;
  dateOfBirth: string;
  gender: AthleteGender | "";
  shirtSize: AthleteShirtSize | "";
  country: string;
  city: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
};

function emptyToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export default function AthleteProfile() {
  const { t, i18n } = useTranslation();
  const dispatch = useAppDispatch();
  const { user, loading, updatingProfile, error } = useAppSelector(
    (s) => s.athleteAuth,
  );
  const [languageSaved, setLanguageSaved] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const current = normalizeLocale(i18n.language);

  useEffect(() => {
    dispatch(fetchAthleteMe());
  }, [dispatch]);

  const validationSchema = useMemo(
    () =>
      Yup.object({
        firstName: Yup.string()
          .trim()
          .required(t("athletePortal.profile.validation.firstNameRequired"))
          .max(100, t("athletePortal.profile.validation.maxLength")),
        lastName: Yup.string()
          .trim()
          .required(t("athletePortal.profile.validation.lastNameRequired"))
          .max(100, t("athletePortal.profile.validation.maxLength")),
        phone: Yup.string()
          .trim()
          .max(20, t("athletePortal.profile.validation.phoneMax")),
        dateOfBirth: Yup.string().matches(
          /^$|^\d{4}-\d{2}-\d{2}$/,
          t("athletePortal.profile.validation.dateFormat"),
        ),
        country: Yup.string()
          .trim()
          .length(2, t("athletePortal.profile.validation.countryFormat")),
        city: Yup.string()
          .trim()
          .max(100, t("athletePortal.profile.validation.maxLength")),
        emergencyContactName: Yup.string()
          .trim()
          .max(200, t("athletePortal.profile.validation.maxLength")),
        emergencyContactPhone: Yup.string()
          .trim()
          .max(20, t("athletePortal.profile.validation.phoneMax")),
      }),
    [t],
  );

  const formik = useFormik<ProfileFormValues>({
    enableReinitialize: true,
    initialValues: {
      firstName: user?.firstName ?? "",
      lastName: user?.lastName ?? "",
      phone: user?.phone ?? "",
      dateOfBirth: user?.dateOfBirth ?? "",
      gender: user?.gender ?? "",
      shirtSize: user?.shirtSize ?? "",
      country: user?.country ?? "MX",
      city: user?.city ?? "",
      emergencyContactName: user?.emergencyContactName ?? "",
      emergencyContactPhone: user?.emergencyContactPhone ?? "",
    },
    validationSchema,
    onSubmit: async (values) => {
      dispatch(clearAthleteError());
      setProfileSaved(false);
      const result = await dispatch(
        updateAthleteProfile({
          first_name: values.firstName.trim(),
          last_name: values.lastName.trim(),
          phone: emptyToNull(values.phone),
          date_of_birth: emptyToNull(values.dateOfBirth),
          gender: values.gender || null,
          shirt_size: values.shirtSize || null,
          country: values.country.trim().toUpperCase(),
          city: emptyToNull(values.city),
          emergency_contact_name: emptyToNull(values.emergencyContactName),
          emergency_contact_phone: emptyToNull(values.emergencyContactPhone),
        }),
      );
      if (updateAthleteProfile.fulfilled.match(result)) {
        setProfileSaved(true);
        window.setTimeout(() => setProfileSaved(false), 2500);
      }
    },
  });

  const handleLanguageChange = async (locale: AppLocale) => {
    await i18n.changeLanguage(locale);
    await dispatch(updateAthleteLanguage(locale));
    setLanguageSaved(true);
    setTimeout(() => setLanguageSaved(false), 2000);
  };

  if (loading && !user) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-cyan" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <MetaHelmet
        title={t("athletePortal.profile.title")}
        description={t("athletePortal.profile.subtitle")}
      />
      <div>
        <h1 className="text-2xl font-bold">{t("athletePortal.profile.title")}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t("athletePortal.profile.subtitle")}
        </p>
      </div>

      <div className="card-sport p-6 space-y-5">
        <ProfileAvatarUpload
          firstName={user?.firstName}
          lastName={user?.lastName}
          avatarUrl={user?.avatarUrl}
        />

        <div className="pt-2 border-t border-border">
          <h2 className="text-xl font-bold">
            {user?.firstName} {user?.lastName}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t("athletePortal.profile.role")}
          </p>
        </div>

        {user?.email ? (
          <div className="flex items-center gap-3 text-sm">
            <Mail className="w-4 h-4 text-cyan shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">
                {t("athletePortal.profile.emailLabel")}
              </p>
              <p>{user.email}</p>
            </div>
          </div>
        ) : null}
      </div>

      <PortalErrorAlert error={error} />

      <form onSubmit={formik.handleSubmit} className="card-sport p-6 space-y-5">
        <div className="flex items-center gap-2 text-sm font-semibold text-cyan">
          <User className="w-4 h-4" />
          {t("athletePortal.profile.personalSection")}
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="firstName">{t("auth.athlete.firstNameLabel")}</Label>
            <Input
              id="firstName"
              name="firstName"
              value={formik.values.firstName}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              placeholder={t("auth.athlete.firstNamePlaceholder")}
            />
            {formik.touched.firstName && formik.errors.firstName ? (
              <p className="text-xs text-destructive">{formik.errors.firstName}</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="lastName">{t("auth.athlete.lastNameLabel")}</Label>
            <Input
              id="lastName"
              name="lastName"
              value={formik.values.lastName}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              placeholder={t("auth.athlete.lastNamePlaceholder")}
            />
            {formik.touched.lastName && formik.errors.lastName ? (
              <p className="text-xs text-destructive">{formik.errors.lastName}</p>
            ) : null}
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="phone">{t("athletePortal.profile.phoneLabel")}</Label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="phone"
                name="phone"
                type="tel"
                value={formik.values.phone}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                className="pl-9"
                placeholder={t("auth.athlete.phonePlaceholder")}
              />
            </div>
            {formik.touched.phone && formik.errors.phone ? (
              <p className="text-xs text-destructive">{formik.errors.phone}</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="dateOfBirth">{t("athletePortal.profile.dobLabel")}</Label>
            <Input
              id="dateOfBirth"
              name="dateOfBirth"
              type="date"
              value={formik.values.dateOfBirth}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
            />
            {formik.touched.dateOfBirth && formik.errors.dateOfBirth ? (
              <p className="text-xs text-destructive">{formik.errors.dateOfBirth}</p>
            ) : null}
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>{t("athletePortal.profile.genderLabel")}</Label>
            <Select
              value={formik.values.gender || "unset"}
              onValueChange={(v) =>
                formik.setFieldValue("gender", v === "unset" ? "" : v)
              }
            >
              <SelectTrigger>
                <SelectValue placeholder={t("athletePortal.profile.selectPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unset">
                  {t("athletePortal.profile.notSpecified")}
                </SelectItem>
                {ATHLETE_GENDERS.map((g) => (
                  <SelectItem key={g} value={g}>
                    {t(`athletePortal.profile.gender.${g}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t("athletePortal.profile.shirtSizeLabel")}</Label>
            <Select
              value={formik.values.shirtSize || "unset"}
              onValueChange={(v) =>
                formik.setFieldValue("shirtSize", v === "unset" ? "" : v)
              }
            >
              <SelectTrigger>
                <SelectValue placeholder={t("athletePortal.profile.selectPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unset">
                  {t("athletePortal.profile.notSpecified")}
                </SelectItem>
                {ATHLETE_SHIRT_SIZES.map((size) => (
                  <SelectItem key={size} value={size}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center gap-2 text-sm font-semibold text-cyan pt-2">
          <MapPin className="w-4 h-4" />
          {t("athletePortal.profile.locationSection")}
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="city">{t("athletePortal.profile.cityLabel")}</Label>
            <Input
              id="city"
              name="city"
              value={formik.values.city}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              placeholder={t("athletePortal.profile.cityPlaceholder")}
            />
            {formik.touched.city && formik.errors.city ? (
              <p className="text-xs text-destructive">{formik.errors.city}</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="country">{t("athletePortal.profile.countryLabel")}</Label>
            <Input
              id="country"
              name="country"
              value={formik.values.country}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              maxLength={2}
              placeholder="MX"
              className="uppercase"
            />
            {formik.touched.country && formik.errors.country ? (
              <p className="text-xs text-destructive">{formik.errors.country}</p>
            ) : null}
          </div>
        </div>

        <div className="flex items-center gap-2 text-sm font-semibold text-cyan pt-2">
          <HeartPulse className="w-4 h-4" />
          {t("athletePortal.profile.emergencySection")}
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="emergencyContactName">
              {t("athletePortal.profile.emergencyNameLabel")}
            </Label>
            <Input
              id="emergencyContactName"
              name="emergencyContactName"
              value={formik.values.emergencyContactName}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="emergencyContactPhone">
              {t("athletePortal.profile.emergencyPhoneLabel")}
            </Label>
            <Input
              id="emergencyContactPhone"
              name="emergencyContactPhone"
              type="tel"
              value={formik.values.emergencyContactPhone}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
            />
          </div>
        </div>

        <Button
          type="submit"
          disabled={updatingProfile || !formik.dirty}
          className="w-full sm:w-auto bg-gradient-to-r from-cyan to-blue-electric text-navy-deep font-bold"
        >
          {updatingProfile ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" />
              {t("athletePortal.profile.saveProfile")}
            </>
          )}
        </Button>

        {profileSaved ? (
          <p className="text-xs text-cyan">{t("athletePortal.profile.profileSaved")}</p>
        ) : null}
      </form>

      <div className="card-sport p-6">
        <label className="block text-sm font-medium mb-3">
          {t("athletePortal.profile.language")}
        </label>
        <div className="flex gap-2">
          {(["es", "en"] as AppLocale[]).map((locale) => (
            <button
              key={locale}
              type="button"
              onClick={() => handleLanguageChange(locale)}
              className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition-all ${
                current === locale
                  ? "bg-cyan text-navy-deep border-cyan"
                  : "border-border text-muted-foreground hover:border-cyan/40"
              }`}
            >
              {LOCALE_LABELS[locale]}
            </button>
          ))}
        </div>
        {languageSaved && (
          <p className="text-xs text-cyan mt-2">{t("athletePortal.profile.languageSaved")}</p>
        )}
      </div>

      <Link
        to="/portal/payment-methods"
        className="card-sport p-4 flex items-center gap-3 hover:border-cyan/40 transition-colors group"
      >
        <div className="w-10 h-10 rounded-xl bg-cyan/10 border border-cyan/25 flex items-center justify-center shrink-0">
          <CreditCard className="w-5 h-5 text-cyan" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold">{t("athletePortal.profile.manageCards")}</p>
          <p className="text-xs text-muted-foreground">
            {t("athletePortal.paymentMethods.subtitle")}
          </p>
        </div>
        <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-cyan shrink-0" />
      </Link>
    </div>
  );
}

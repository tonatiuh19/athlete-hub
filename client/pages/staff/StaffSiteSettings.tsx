import { useEffect, useMemo, useState } from "react";
import { Navigate, Link } from "react-router-dom";
import { useFormik } from "formik";
import * as Yup from "yup";
import { useTranslation } from "react-i18next";
import { ExternalLink, Globe, Loader2, Save } from "lucide-react";
import MetaHelmet from "@/components/MetaHelmet";
import PortalErrorAlert from "@/components/athlete/PortalErrorAlert";
import { StaffPageSkeleton } from "@/components/staff/skeletons/StaffSkeletons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  clearSiteAdminErrors,
  fetchAdminSiteProfile,
  updateAdminSiteProfile,
} from "@/store/slices/siteAdminSlice";
import type { ContactPageConfig, LegalEntityConfig, SitePublicProfile } from "@shared/siteLegal";
import { DEFAULT_LEGAL_ENTITY } from "@shared/siteLegal";

type SiteSettingsFormValues = {
  brandName: string;
  legalName: string;
  rfc: string;
  address: string;
  arcoEmail: string;
  supportEmail: string;
  website: string;
  lastUpdated: string;
  phone: string;
  whatsapp: string;
  headline: string;
  subtitle: string;
  supportHint: string;
  organizerHint: string;
  responseTime: string;
  officeHours: string;
  socialInstagram: string;
  socialFacebook: string;
  socialYoutube: string;
};

function fieldToInput(value: string | null | undefined): string {
  return value ?? "";
}

function inputToNullable(value: string): string | null {
  const trimmed = value.trim();
  return trimmed || null;
}

function profileToForm(profile: SitePublicProfile): SiteSettingsFormValues {
  const { legalEntity: le, contact: cp } = profile;
  return {
    brandName: fieldToInput(le.brandName),
    legalName: fieldToInput(le.legalName),
    rfc: fieldToInput(le.rfc),
    address: fieldToInput(le.address),
    arcoEmail: fieldToInput(le.arcoEmail),
    supportEmail: fieldToInput(le.supportEmail),
    website: fieldToInput(le.website),
    lastUpdated: fieldToInput(le.lastUpdated),
    phone: fieldToInput(le.phone),
    whatsapp: fieldToInput(le.whatsapp),
    headline: fieldToInput(cp.headline),
    subtitle: fieldToInput(cp.subtitle),
    supportHint: fieldToInput(cp.supportHint),
    organizerHint: fieldToInput(cp.organizerHint),
    responseTime: fieldToInput(cp.responseTime),
    officeHours: fieldToInput(cp.officeHours),
    socialInstagram: fieldToInput(cp.socialInstagram),
    socialFacebook: fieldToInput(cp.socialFacebook),
    socialYoutube: fieldToInput(cp.socialYoutube),
  };
}

function formToProfile(values: SiteSettingsFormValues): SitePublicProfile {
  const legalEntity: LegalEntityConfig = {
    brandName: values.brandName.trim() || DEFAULT_LEGAL_ENTITY.brandName,
    legalName: inputToNullable(values.legalName),
    rfc: inputToNullable(values.rfc),
    address: inputToNullable(values.address),
    arcoEmail: inputToNullable(values.arcoEmail),
    supportEmail: inputToNullable(values.supportEmail),
    website: inputToNullable(values.website),
    lastUpdated: inputToNullable(values.lastUpdated),
    phone: inputToNullable(values.phone),
    whatsapp: inputToNullable(values.whatsapp),
  };
  const contact: ContactPageConfig = {
    headline: inputToNullable(values.headline),
    subtitle: inputToNullable(values.subtitle),
    supportHint: inputToNullable(values.supportHint),
    organizerHint: inputToNullable(values.organizerHint),
    responseTime: inputToNullable(values.responseTime),
    officeHours: inputToNullable(values.officeHours),
    socialInstagram: inputToNullable(values.socialInstagram),
    socialFacebook: inputToNullable(values.socialFacebook),
    socialYoutube: inputToNullable(values.socialYoutube),
  };
  return { legalEntity, contact };
}

function optionalEmail(message: string) {
  return Yup.string()
    .trim()
    .transform((v) => v || undefined)
    .optional()
    .email(message);
}

function optionalUrl(message: string) {
  return Yup.string()
    .trim()
    .transform((v) => v || undefined)
    .optional()
    .url(message);
}

function Field({
  id,
  label,
  hint,
  ...props
}: {
  id: string;
  label: string;
  hint?: string;
} & React.ComponentProps<typeof Input>) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} {...props} />
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export default function StaffSiteSettings() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const { role } = useAppSelector((s) => s.staffAuth);
  const { profile, loading, saving, error, saveError, loaded } = useAppSelector(
    (s) => s.siteAdmin,
  );
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (role === "admin") {
      dispatch(fetchAdminSiteProfile());
    }
  }, [dispatch, role]);

  const validationSchema = useMemo(
    () =>
      Yup.object({
        brandName: Yup.string().trim().required(t("staffPortal.siteSettings.validation.brandRequired")),
        legalName: Yup.string().trim(),
        rfc: Yup.string().trim(),
        address: Yup.string().trim(),
        arcoEmail: optionalEmail(t("staffPortal.siteSettings.validation.emailInvalid")),
        supportEmail: optionalEmail(t("staffPortal.siteSettings.validation.emailInvalid")),
        website: optionalUrl(t("staffPortal.siteSettings.validation.urlInvalid")),
        lastUpdated: Yup.string().trim(),
        phone: Yup.string().trim(),
        whatsapp: Yup.string().trim(),
        headline: Yup.string().trim(),
        subtitle: Yup.string().trim(),
        supportHint: Yup.string().trim(),
        organizerHint: Yup.string().trim(),
        responseTime: Yup.string().trim(),
        officeHours: Yup.string().trim(),
        socialInstagram: optionalUrl(t("staffPortal.siteSettings.validation.urlInvalid")),
        socialFacebook: optionalUrl(t("staffPortal.siteSettings.validation.urlInvalid")),
        socialYoutube: optionalUrl(t("staffPortal.siteSettings.validation.urlInvalid")),
      }),
    [t],
  );

  const formik = useFormik<SiteSettingsFormValues>({
    enableReinitialize: true,
    initialValues: profileToForm(profile),
    validationSchema,
    onSubmit: async (values) => {
      dispatch(clearSiteAdminErrors());
      setSaved(false);
      const result = await dispatch(updateAdminSiteProfile(formToProfile(values)));
      if (updateAdminSiteProfile.fulfilled.match(result)) {
        setSaved(true);
      }
    },
  });

  if (role !== "admin") {
    return <Navigate to="/staff" replace />;
  }

  return (
    <div className="max-w-3xl mx-auto w-full min-w-0 space-y-8">
      <MetaHelmet
        title={t("staffPortal.siteSettings.title")}
        description={t("staffPortal.siteSettings.subtitle")}
      />

      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-xs text-muted-foreground">
            <Globe className="w-3.5 h-3.5 text-primary" />
            {t("staffPortal.siteSettings.eyebrow")}
          </div>
          <h1 className="text-2xl md:text-3xl font-bold">{t("staffPortal.siteSettings.title")}</h1>
          <p className="text-sm text-muted-foreground max-w-xl">{t("staffPortal.siteSettings.subtitle")}</p>
        </div>
        <Button asChild variant="outline" size="sm" className="shrink-0">
          <Link to="/contact" target="_blank" rel="noopener noreferrer">
            <ExternalLink className="w-4 h-4 mr-2" />
            {t("staffPortal.siteSettings.previewContact")}
          </Link>
        </Button>
      </div>

      {error ? <PortalErrorAlert error={t(error)} /> : null}
      {saveError ? <PortalErrorAlert error={t(saveError)} /> : null}
      {saved ? (
        <div className="rounded-lg border border-accent/30 bg-accent/10 px-4 py-3 text-sm text-foreground">
          {t("staffPortal.siteSettings.saved")}
        </div>
      ) : null}

      {loading && !loaded ? (
        <StaffPageSkeleton variant="form" className="max-w-none" />
      ) : (
        <form onSubmit={formik.handleSubmit} className="space-y-8">
          <section className="rounded-2xl border border-border bg-card/40 p-5 md:p-6 space-y-5">
            <div>
              <h2 className="text-lg font-semibold">{t("staffPortal.siteSettings.sections.legal")}</h2>
              <p className="text-sm text-muted-foreground mt-1">
                {t("staffPortal.siteSettings.sections.legalHint")}
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field
                id="brandName"
                label={t("staffPortal.siteSettings.fields.brandName")}
                name="brandName"
                value={formik.values.brandName}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
              />
              <Field
                id="legalName"
                label={t("staffPortal.siteSettings.fields.legalName")}
                name="legalName"
                value={formik.values.legalName}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
              />
              <Field
                id="rfc"
                label={t("staffPortal.siteSettings.fields.rfc")}
                hint={t("staffPortal.siteSettings.fields.emptyHidden")}
                name="rfc"
                value={formik.values.rfc}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
              />
              <Field
                id="lastUpdated"
                label={t("staffPortal.siteSettings.fields.lastUpdated")}
                name="lastUpdated"
                placeholder="2026-06-13"
                value={formik.values.lastUpdated}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
              />
              <div className="md:col-span-2">
                <Field
                  id="address"
                  label={t("staffPortal.siteSettings.fields.address")}
                  name="address"
                  value={formik.values.address}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                />
              </div>
              <Field
                id="supportEmail"
                label={t("staffPortal.siteSettings.fields.supportEmail")}
                type="email"
                name="supportEmail"
                value={formik.values.supportEmail}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
              />
              <Field
                id="arcoEmail"
                label={t("staffPortal.siteSettings.fields.arcoEmail")}
                type="email"
                name="arcoEmail"
                value={formik.values.arcoEmail}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
              />
              <Field
                id="website"
                label={t("staffPortal.siteSettings.fields.website")}
                name="website"
                value={formik.values.website}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
              />
              <Field
                id="phone"
                label={t("staffPortal.siteSettings.fields.phone")}
                hint={t("staffPortal.siteSettings.fields.emptyHidden")}
                name="phone"
                value={formik.values.phone}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
              />
              <Field
                id="whatsapp"
                label={t("staffPortal.siteSettings.fields.whatsapp")}
                hint={t("staffPortal.siteSettings.fields.whatsappHint")}
                name="whatsapp"
                value={formik.values.whatsapp}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
              />
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-card/40 p-5 md:p-6 space-y-5">
            <div>
              <h2 className="text-lg font-semibold">{t("staffPortal.siteSettings.sections.contact")}</h2>
              <p className="text-sm text-muted-foreground mt-1">
                {t("staffPortal.siteSettings.sections.contactHint")}
              </p>
            </div>
            <div className="grid grid-cols-1 gap-4">
              <Field
                id="headline"
                label={t("staffPortal.siteSettings.fields.headline")}
                hint={t("staffPortal.siteSettings.fields.optionalDefault")}
                name="headline"
                value={formik.values.headline}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
              />
              <div className="space-y-2">
                <Label htmlFor="subtitle">{t("staffPortal.siteSettings.fields.subtitle")}</Label>
                <Textarea
                  id="subtitle"
                  name="subtitle"
                  rows={2}
                  value={formik.values.subtitle}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                />
              </div>
              <Field
                id="supportHint"
                label={t("staffPortal.siteSettings.fields.supportHint")}
                name="supportHint"
                value={formik.values.supportHint}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
              />
              <Field
                id="organizerHint"
                label={t("staffPortal.siteSettings.fields.organizerHint")}
                name="organizerHint"
                value={formik.values.organizerHint}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
              />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field
                  id="responseTime"
                  label={t("staffPortal.siteSettings.fields.responseTime")}
                  name="responseTime"
                  value={formik.values.responseTime}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                />
                <Field
                  id="officeHours"
                  label={t("staffPortal.siteSettings.fields.officeHours")}
                  name="officeHours"
                  value={formik.values.officeHours}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Field
                  id="socialInstagram"
                  label={t("staffPortal.siteSettings.fields.socialInstagram")}
                  name="socialInstagram"
                  value={formik.values.socialInstagram}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                />
                <Field
                  id="socialFacebook"
                  label={t("staffPortal.siteSettings.fields.socialFacebook")}
                  name="socialFacebook"
                  value={formik.values.socialFacebook}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                />
                <Field
                  id="socialYoutube"
                  label={t("staffPortal.siteSettings.fields.socialYoutube")}
                  name="socialYoutube"
                  value={formik.values.socialYoutube}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                />
              </div>
            </div>
          </section>

          <div className="flex justify-end">
            <Button type="submit" disabled={saving || !formik.dirty}>
              {saving ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              {t("staffPortal.siteSettings.save")}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

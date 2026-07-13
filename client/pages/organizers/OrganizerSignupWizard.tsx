import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useFormik } from "formik";
import * as Yup from "yup";
import { useTranslation } from "react-i18next";
import { Loader2, Mail, ArrowLeft, ArrowRight } from "lucide-react";
import MetaHelmet from "@/components/MetaHelmet";
import OtpInput from "@/components/OtpInput";
import GeoCitySelector from "@/components/geo/GeoCitySelector";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  patchOrganizerSignupForm,
  registerOrganizerSelfService,
  setOrganizerSignupStep,
  type OrganizerSignupStep,
} from "@/store/slices/organizerSignupSlice";
import { fetchGeoStates } from "@/store/slices/geoSlice";
import { fetchSportTypes } from "@/store/slices/marketplaceSlice";
import { requestStaffOtp, verifyStaffOtp } from "@/store/slices/staffAuthSlice";
import { isOrganizerCitySelectionValid } from "@/utils/geoCityValidation";
import LegalConsentNotice from "@/components/legal/LegalConsentNotice";
import { legalTermsAcceptanceSchema } from "@/validation/legalConsentSchema";
import type { OrganizerExpectedSizeBand } from "@shared/api";

const STEP_ORDER: OrganizerSignupStep[] = [
  "welcome",
  "owner",
  "organization",
  "intake",
  "verify",
];

function stepProgress(step: OrganizerSignupStep): number {
  const idx = STEP_ORDER.indexOf(step);
  if (idx <= 0) return 0;
  return Math.round((idx / (STEP_ORDER.length - 1)) * 100);
}

function stepNumber(step: OrganizerSignupStep): number {
  const idx = STEP_ORDER.indexOf(step);
  return idx <= 0 ? 0 : idx;
}

export default function OrganizerSignupWizard() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const skipWelcome = searchParams.get("step") === "owner";
  const { step, form, registering, registerError } = useAppSelector((s) => s.organizerSignup);
  const { sportTypes } = useAppSelector((s) => s.marketplace);
  const { requestingOtp, verifyingOtp, error: otpError, otpSentTo } = useAppSelector(
    (s) => s.staffAuth,
  );
  const [otpRequested, setOtpRequested] = useState(false);

  useEffect(() => {
    dispatch(fetchGeoStates("MX"));
    dispatch(fetchSportTypes());
  }, [dispatch]);

  useEffect(() => {
    if (skipWelcome && step === "welcome") {
      dispatch(setOrganizerSignupStep("owner"));
    }
  }, [skipWelcome, step, dispatch]);

  useEffect(() => {
    if (step === "verify" && !otpRequested) {
      setOtpRequested(true);
      void dispatch(requestStaffOtp({ email: form.ownerEmail.trim().toLowerCase() }));
    }
  }, [step, otpRequested, dispatch, form.ownerEmail]);

  const stepTitle = useMemo(() => {
    switch (step) {
      case "owner":
        return t("organizerSignup.steps.ownerTitle");
      case "organization":
        return t("organizerSignup.steps.organizationTitle");
      case "intake":
        return t("organizerSignup.steps.intakeTitle");
      case "verify":
        return t("organizerSignup.steps.verifyTitle");
      default:
        return "";
    }
  }, [step, t]);

  const ownerForm = useFormik({
    initialValues: {
      ownerFirstName: form.ownerFirstName,
      ownerLastName: form.ownerLastName,
      ownerEmail: form.ownerEmail,
      ownerPhone: form.ownerPhone,
    },
    enableReinitialize: true,
    validateOnBlur: false,
    validateOnChange: false,
    validationSchema: Yup.object({
      ownerFirstName: Yup.string().trim().required(t("common.required")),
      ownerLastName: Yup.string().trim().required(t("common.required")),
      ownerEmail: Yup.string()
        .email(t("common.invalidEmail"))
        .required(t("common.required")),
      ownerPhone: Yup.string(),
    }),
    onSubmit: (values) => {
      dispatch(patchOrganizerSignupForm(values));
      dispatch(setOrganizerSignupStep("organization"));
    },
  });

  const orgForm = useFormik({
    initialValues: {
      name: form.name,
      email: form.email,
      phone: form.phone,
      city: form.city,
    },
    enableReinitialize: true,
    validateOnBlur: false,
    validateOnChange: false,
    validationSchema: Yup.object({
      name: Yup.string().trim().required(t("common.required")),
      email: Yup.string().email(t("common.invalidEmail")),
      phone: Yup.string(),
      city: Yup.string().trim().required(t("common.required")),
    }),
    onSubmit: (values) => {
      if (!isOrganizerCitySelectionValid(form.geoCityId, values.city)) {
        orgForm.setFieldError("city", t("organizerSignup.errors.invalidCity"));
        return;
      }
      dispatch(
        patchOrganizerSignupForm({
          ...values,
          email: values.email.trim() || form.ownerEmail.trim(),
        }),
      );
      dispatch(setOrganizerSignupStep("intake"));
    },
  });

  const intakeForm = useFormik({
    initialValues: {
      sportTypeId: form.sportTypeId != null ? String(form.sportTypeId) : "",
      roughDate: form.roughDate,
      expectedSize: form.expectedSize,
      acceptedTerms: false,
    },
    enableReinitialize: true,
    validationSchema: Yup.object({
      acceptedTerms: legalTermsAcceptanceSchema(t),
    }),
    onSubmit: async (values) => {
      dispatch(
        patchOrganizerSignupForm({
          sportTypeId: values.sportTypeId ? Number(values.sportTypeId) : null,
          roughDate: values.roughDate,
          expectedSize: values.expectedSize as OrganizerExpectedSizeBand | "",
        }),
      );
      const result = await dispatch(registerOrganizerSelfService());
      if (registerOrganizerSelfService.rejected.match(result)) {
        return;
      }
    },
  });

  const otpForm = useFormik({
    initialValues: { code: "" },
    validateOnBlur: false,
    validateOnChange: false,
    validationSchema: Yup.object({
      code: Yup.string()
        .matches(/^\d{6}$/, t("common.sixDigits"))
        .required(t("common.required")),
    }),
    onSubmit: async (values) => {
      const email = (otpSentTo || form.ownerEmail).trim().toLowerCase();
      const result = await dispatch(verifyStaffOtp({ email, code: values.code }));
      if (verifyStaffOtp.fulfilled.match(result)) {
        navigate("/staff/onboarding", { replace: true });
      }
    },
  });

  const handleSkipIntake = async () => {
    if (!intakeForm.values.acceptedTerms) {
      intakeForm.setFieldError("acceptedTerms", t("legal.errors.mustAccept"));
      return;
    }
    dispatch(
      patchOrganizerSignupForm({
        sportTypeId: null,
        roughDate: "",
        expectedSize: "",
      }),
    );
    await dispatch(registerOrganizerSelfService());
  };

  const sizeOptions: { value: OrganizerExpectedSizeBand; label: string }[] = [
    { value: "<100", label: t("organizerSignup.intake.sizeUnder100") },
    { value: "100-500", label: t("organizerSignup.intake.size100to500") },
    { value: "500+", label: t("organizerSignup.intake.size500Plus") },
  ];

  return (
    <div className="min-h-[calc(100vh-4.5rem)] bg-gradient-dark flex flex-col">
      <MetaHelmet
        title={t("organizerSignup.metaTitle")}
        description={t("organizerSignup.metaDescription")}
        path="/organizers/signup"
        noindex
      />

      <div className="max-w-lg mx-auto w-full px-4 py-6 md:py-10 flex-1 flex flex-col">
        {step !== "welcome" && (
          <div className="mb-6 space-y-2" aria-live="polite">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {t("organizerSignup.stepLabel", {
                  current: stepNumber(step),
                  total: STEP_ORDER.length - 1,
                })}
              </span>
              <span>{stepTitle}</span>
            </div>
            <Progress value={stepProgress(step)} className="h-2" />
          </div>
        )}

        {step === "welcome" && (
          <div className="flex-1 flex flex-col justify-center space-y-6 animate-slide-up">
            <div className="space-y-3 text-center">
              <h1 className="text-2xl md:text-3xl font-bold">{t("organizerSignup.welcome.title")}</h1>
              <p className="text-muted-foreground">{t("organizerSignup.welcome.subtitle")}</p>
            </div>
            <Button
              size="lg"
              className="h-12 w-full text-base"
              onClick={() => dispatch(setOrganizerSignupStep("owner"))}
            >
              {t("organizerSignup.welcome.cta")}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              {t("organizerSignup.welcome.hasAccount")}{" "}
              <Link to="/staff/login" className="text-primary hover:underline">
                {t("organizerSignup.start.signIn")}
              </Link>
            </p>
          </div>
        )}

        {step === "owner" && (
          <form onSubmit={ownerForm.handleSubmit} className="space-y-5 animate-slide-up">
            <div>
              <h1 className="text-2xl font-bold mb-1">{stepTitle}</h1>
              <p className="text-sm text-muted-foreground">{t("organizerSignup.owner.hint")}</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="owner-first">{t("organizerSignup.owner.firstName")}</Label>
                <Input
                  id="owner-first"
                  className="h-12"
                  autoComplete="given-name"
                  {...ownerForm.getFieldProps("ownerFirstName")}
                />
                {ownerForm.submitCount > 0 && ownerForm.errors.ownerFirstName && (
                  <p className="text-xs text-destructive">{ownerForm.errors.ownerFirstName}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="owner-last">{t("organizerSignup.owner.lastName")}</Label>
                <Input
                  id="owner-last"
                  className="h-12"
                  autoComplete="family-name"
                  {...ownerForm.getFieldProps("ownerLastName")}
                />
                {ownerForm.submitCount > 0 && ownerForm.errors.ownerLastName && (
                  <p className="text-xs text-destructive">{ownerForm.errors.ownerLastName}</p>
                )}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="owner-email">{t("organizerSignup.owner.email")}</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="owner-email"
                  type="email"
                  className="h-12 pl-10"
                  autoComplete="email"
                  {...ownerForm.getFieldProps("ownerEmail")}
                />
              </div>
              {ownerForm.submitCount > 0 && ownerForm.errors.ownerEmail && (
                <p className="text-xs text-destructive">{ownerForm.errors.ownerEmail}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="owner-phone">{t("organizerSignup.owner.phoneOptional")}</Label>
              <Input
                id="owner-phone"
                type="tel"
                className="h-12"
                autoComplete="tel"
                placeholder="+52 …"
                {...ownerForm.getFieldProps("ownerPhone")}
              />
            </div>
            <WizardNav
              onBack={() =>
                skipWelcome
                  ? navigate("/organizers/start")
                  : dispatch(setOrganizerSignupStep("welcome"))
              }
              submitLabel={t("common.continue")}
            />
          </form>
        )}

        {step === "organization" && (
          <form onSubmit={orgForm.handleSubmit} className="space-y-5 animate-slide-up">
            <div>
              <h1 className="text-2xl font-bold mb-1">{stepTitle}</h1>
              <p className="text-sm text-muted-foreground">
                {t("organizerSignup.organization.hint")}
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="org-name">{t("organizerSignup.organization.name")}</Label>
              <Input id="org-name" className="h-12" {...orgForm.getFieldProps("name")} />
              {orgForm.submitCount > 0 && orgForm.errors.name && (
                <p className="text-xs text-destructive">{orgForm.errors.name}</p>
              )}
            </div>
            <GeoCitySelector
              stateId={form.geoStateId}
              cityId={form.geoCityId}
              cityName={form.city}
              onChange={(sel) => {
                dispatch(
                  patchOrganizerSignupForm({
                    geoStateId: sel.stateId,
                    geoCityId: sel.geoCityId,
                    city: sel.city,
                  }),
                );
                orgForm.setFieldValue("city", sel.city);
              }}
              staffRole="organizer"
            />
            {orgForm.submitCount > 0 && orgForm.errors.city && (
              <p className="text-xs text-destructive">{orgForm.errors.city}</p>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="org-email">{t("organizerSignup.organization.emailOptional")}</Label>
              <Input
                id="org-email"
                type="email"
                className="h-12"
                placeholder={form.ownerEmail || t("organizerSignup.organization.emailPlaceholder")}
                {...orgForm.getFieldProps("email")}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="org-phone">{t("organizerSignup.organization.phoneOptional")}</Label>
              <Input id="org-phone" type="tel" className="h-12" {...orgForm.getFieldProps("phone")} />
            </div>
            <WizardNav
              onBack={() => dispatch(setOrganizerSignupStep("owner"))}
              submitLabel={t("common.continue")}
            />
          </form>
        )}

        {step === "intake" && (
          <form onSubmit={intakeForm.handleSubmit} className="space-y-5 animate-slide-up">
            <div>
              <h1 className="text-2xl font-bold mb-1">{stepTitle}</h1>
              <p className="text-sm text-muted-foreground">{t("organizerSignup.intake.hint")}</p>
            </div>
            <div className="space-y-1.5">
              <Label>{t("organizerSignup.intake.sport")}</Label>
              <Select
                value={intakeForm.values.sportTypeId}
                onValueChange={(v) => intakeForm.setFieldValue("sportTypeId", v)}
              >
                <SelectTrigger className="h-12">
                  <SelectValue placeholder={t("organizerSignup.intake.sportPlaceholder")} />
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
            <div className="space-y-1.5">
              <Label htmlFor="rough-date">{t("organizerSignup.intake.dateOptional")}</Label>
              <Input
                id="rough-date"
                type="month"
                className="h-12"
                {...intakeForm.getFieldProps("roughDate")}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("organizerSignup.intake.sizeOptional")}</Label>
              <div className="flex flex-wrap gap-2">
                {sizeOptions.map((opt) => (
                  <Button
                    key={opt.value}
                    type="button"
                    variant={intakeForm.values.expectedSize === opt.value ? "default" : "outline"}
                    className="h-11"
                    onClick={() => intakeForm.setFieldValue("expectedSize", opt.value)}
                  >
                    {opt.label}
                  </Button>
                ))}
              </div>
            </div>
            {registerError && (
              <p className="text-sm text-destructive" role="alert">
                {registerError}
              </p>
            )}
            <LegalConsentNotice
              variant="organizerRegister"
              showCheckbox
              id="organizer-signup-legal"
              checked={intakeForm.values.acceptedTerms}
              onCheckedChange={(v) => intakeForm.setFieldValue("acceptedTerms", v)}
              error={
                intakeForm.submitCount > 0 && intakeForm.errors.acceptedTerms
                  ? String(intakeForm.errors.acceptedTerms)
                  : null
              }
            />
            <WizardNav
              onBack={() => dispatch(setOrganizerSignupStep("organization"))}
              submitLabel={t("organizerSignup.intake.submit")}
              loading={registering}
            />
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              disabled={registering}
              onClick={() => void handleSkipIntake()}
            >
              {t("organizerSignup.intake.skip")}
            </Button>
          </form>
        )}

        {step === "verify" && (
          <form onSubmit={otpForm.handleSubmit} className="space-y-5 animate-slide-up">
            <div>
              <h1 className="text-2xl font-bold mb-1">{stepTitle}</h1>
              <p className="text-sm text-muted-foreground">
                {t("organizerSignup.verify.subtitle", {
                  email: otpSentTo || form.ownerEmail,
                })}
              </p>
            </div>
            <OtpInput
              value={otpForm.values.code}
              onChange={(code) => otpForm.setFieldValue("code", code)}
            />
            {otpForm.submitCount > 0 && otpForm.errors.code && (
              <p className="text-xs text-destructive">{otpForm.errors.code}</p>
            )}
            {(otpError || registerError) && (
              <p className="text-sm text-destructive" role="alert">
                {otpError || registerError}
              </p>
            )}
            <Button type="submit" size="lg" className="h-12 w-full" disabled={verifyingOtp}>
              {verifyingOtp ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t("organizerSignup.verify.verifying")}
                </>
              ) : (
                t("organizerSignup.verify.submit")
              )}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              disabled={requestingOtp}
              onClick={() =>
                void dispatch(
                  requestStaffOtp({ email: (otpSentTo || form.ownerEmail).trim().toLowerCase() }),
                )
              }
            >
              {requestingOtp ? t("organizerSignup.verify.resending") : t("organizerSignup.verify.resend")}
            </Button>
          </form>
        )}

        <p className="text-center text-xs text-muted-foreground mt-8 pb-4">
          {t("organizerSignup.helpPrompt")}{" "}
          <a href="mailto:soporte@triboosport.com" className="text-primary hover:underline">
            {t("organizerSignup.helpEmail")}
          </a>
        </p>
      </div>
    </div>
  );
}

function WizardNav({
  onBack,
  submitLabel,
  loading = false,
}: {
  onBack: () => void;
  submitLabel: string;
  loading?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col sm:flex-row gap-3 pt-2">
      <Button type="button" variant="outline" className="h-12 sm:flex-1" onClick={onBack}>
        <ArrowLeft className="mr-2 h-4 w-4" />
        {t("organizerSignup.back")}
      </Button>
      <Button type="submit" className="h-12 sm:flex-[2]" disabled={loading}>
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {t("common.loading")}
          </>
        ) : (
          <>
            {submitLabel}
            <ArrowRight className="ml-2 h-4 w-4" />
          </>
        )}
      </Button>
    </div>
  );
}

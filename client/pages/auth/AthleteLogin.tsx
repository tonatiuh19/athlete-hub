import { useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@clerk/clerk-react";
import { useFormik } from "formik";
import * as Yup from "yup";
import { useTranslation } from "react-i18next";
import {
  Footprints,
  Mail,
  Loader2,
  CheckCircle,
  Star,
  MapPin,
  User,
  Lock,
  ArrowLeft,
} from "lucide-react";
import MetaHelmet from "@/components/MetaHelmet";
import AuthBrandPanel from "@/components/AuthBrandPanel";
import AuthFlowLoadingPanel from "@/components/auth/AuthFlowLoadingPanel";
import AuthPageHeader from "@/components/auth/AuthPageHeader";
import AuthFormError from "@/components/auth/AuthFormError";
import PasswordStrengthField from "@/components/auth/PasswordStrengthField";
import AthleteOnboardingFields from "@/components/auth/AthleteOnboardingFields";
import { ATHLETE_LOGIN_VIDEO_URL } from "@/constants/tribooBrand";
import ClerkOAuthButtons from "@/components/ClerkOAuthButtons";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { athletePasswordConfirmSchema } from "@/validation/athletePasswordSchema";
import {
  athleteDateOfBirthSchema,
  athleteGenderSchema,
} from "@/validation/athleteOnboardingSchema";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  checkAthleteEmail,
  clearAthleteError,
  clearPasswordResetSent,
  forgotAthletePassword,
  loginAthlete,
  registerAthlete,
} from "@/store/slices/athleteAuthSlice";
import { getAthleteToken, isClerkEnabled } from "@/lib/api";
import { CLERK_SSO_CALLBACK_PATH } from "@/config/clerkUrls";
import {
  clearAthleteIntentionalLogout,
  shouldSkipClerkAthleteResume,
} from "@/utils/athleteSessionLogout";
import LegalConsentNotice from "@/components/legal/LegalConsentNotice";
import { legalTermsAcceptanceSchema } from "@/validation/legalConsentSchema";
import { resumeClerkAthleteSession } from "@/utils/clerkAthleteSync";
import { isAthleteOauthCompleting } from "@/utils/athleteSsoUx";

type AuthStep = "identify" | "login" | "register" | "forgot" | "socialLogin";

export default function AthleteLogin() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const {
    checkingEmail,
    signingIn,
    registering,
    resettingPassword,
    error,
    passwordResetSent,
    syncingClerk,
  } = useAppSelector((s) => s.athleteAuth);
  const [step, setStep] = useState<AuthStep>("identify");
  const [email, setEmail] = useState("");
  const { isLoaded: clerkLoaded, isSignedIn, getToken } = useAuth();
  const clerkResumeAttemptedRef = useRef(false);
  const athleteToken = useAppSelector((s) => s.athleteAuth.token);

  useEffect(() => {
    if (athleteToken || getAthleteToken()) {
      navigate("/portal", { replace: true });
    }
  }, [athleteToken, navigate]);

  useEffect(() => {
    const intentionalLogout = shouldSkipClerkAthleteResume();
    if (
      !isClerkEnabled ||
      !clerkLoaded ||
      !isSignedIn ||
      getAthleteToken() ||
      clerkResumeAttemptedRef.current ||
      intentionalLogout
    ) {
      if (intentionalLogout) {
        clearAthleteIntentionalLogout();
        clerkResumeAttemptedRef.current = true;
      }
      return;
    }
    clerkResumeAttemptedRef.current = true;
    void resumeClerkAthleteSession({ dispatch, getToken }).then((resumed) => {
      if (resumed.ok) {
        navigate(resumed.path, { replace: true });
      }
    });
  }, [clerkLoaded, dispatch, getToken, isSignedIn, navigate]);

  const stats = useMemo(
    () => [
      { value: "50K+", label: t("auth.athlete.statAthletes"), icon: Footprints },
      { value: "200+", label: t("auth.athlete.statEvents"), icon: MapPin },
      { value: "4.9", label: t("auth.athlete.statRating"), icon: Star },
    ],
    [t],
  );

  const testimonials = useMemo(
    () => [
      {
        quote: t("auth.athlete.testimonial1Quote"),
        name: t("auth.athlete.testimonial1Name"),
        detail: t("auth.athlete.testimonial1Detail"),
        initial: "M",
      },
      {
        quote: t("auth.athlete.testimonial2Quote"),
        name: t("auth.athlete.testimonial2Name"),
        detail: t("auth.athlete.testimonial2Detail"),
        initial: "C",
      },
      {
        quote: t("auth.athlete.testimonial3Quote"),
        name: t("auth.athlete.testimonial3Name"),
        detail: t("auth.athlete.testimonial3Detail"),
        initial: "A",
      },
    ],
    [t],
  );

  const goIdentify = () => {
    dispatch(clearAthleteError());
    dispatch(clearPasswordResetSent());
    setStep("identify");
  };

  const identifyForm = useFormik({
    initialValues: { email: "" },
    validateOnBlur: false,
    validateOnChange: false,
    validationSchema: Yup.object({
      email: Yup.string()
        .email(t("common.invalidEmail"))
        .required(t("common.required")),
    }),
    onSubmit: async (values) => {
      const normalized = values.email.trim().toLowerCase();
      const check = await dispatch(checkAthleteEmail({ email: normalized }));
      if (checkAthleteEmail.rejected.match(check)) return;
      setEmail(normalized);
      const { exists, hasPassword, hasSocialLogin } = check.payload!;
      if (exists && hasSocialLogin && !hasPassword) {
        setStep("socialLogin");
      } else {
        setStep(exists ? "login" : "register");
      }
    },
  });

  const loginForm = useFormik({
    initialValues: { password: "" },
    validateOnBlur: false,
    validateOnChange: false,
    validationSchema: Yup.object({
      password: Yup.string().required(t("common.required")),
    }),
    onSubmit: async (values) => {
      const result = await dispatch(loginAthlete({ email, password: values.password }));
      if (loginAthlete.fulfilled.match(result)) {
        navigate("/portal", { replace: true });
      }
    },
  });

  const registerForm = useFormik({
    initialValues: {
      firstName: "",
      lastName: "",
      dateOfBirth: "",
      gender: "" as "" | "male" | "female" | "other" | "prefer_not_to_say",
      password: "",
      confirmPassword: "",
      acceptedTerms: false,
    },
    validateOnBlur: false,
    validateOnChange: false,
    validationSchema: Yup.object({
      firstName: Yup.string().trim().required(t("common.required")),
      lastName: Yup.string().trim().required(t("common.required")),
      dateOfBirth: athleteDateOfBirthSchema(t),
      gender: athleteGenderSchema(t),
      ...athletePasswordConfirmSchema(t).fields,
      acceptedTerms: legalTermsAcceptanceSchema(t),
    }),
    onSubmit: async (values) => {
      const result = await dispatch(
        registerAthlete({
          email,
          firstName: values.firstName.trim(),
          lastName: values.lastName.trim(),
          dateOfBirth: values.dateOfBirth,
          gender: values.gender || null,
          password: values.password,
        }),
      );
      if (registerAthlete.fulfilled.match(result)) {
        navigate("/portal", { replace: true });
      }
    },
  });

  const forgotForm = useFormik({
    initialValues: { email: email || identifyForm.values.email },
    enableReinitialize: true,
    validateOnBlur: false,
    validateOnChange: false,
    validationSchema: Yup.object({
      email: Yup.string()
        .email(t("common.invalidEmail"))
        .required(t("common.required")),
    }),
    onSubmit: async (values) => {
      await dispatch(forgotAthletePassword({ email: values.email.trim().toLowerCase() }));
    },
  });

  const oauthCallbackRedirect =
    isAthleteOauthCompleting() && location.pathname !== CLERK_SSO_CALLBACK_PATH
      ? `${CLERK_SSO_CALLBACK_PATH}${location.search}${location.hash}`
      : null;

  const heading =
    step === "identify" ? (
      <>
        {t("auth.athlete.titleIdentify")}{" "}
        <span className="text-gradient">{t("auth.athlete.titleHighlight")}</span>
      </>
    ) : step === "register" ? (
      <>
        {t("auth.athlete.titleRegister")}{" "}
        <span className="text-gradient">{t("auth.athlete.titleRegisterHighlight")}</span>
      </>
    ) : step === "forgot" ? (
      t("auth.password.forgotTitle")
    ) : step === "socialLogin" ? (
      t("auth.athlete.socialOnlyTitle")
    ) : (
      t("auth.athlete.titleLogin")
    );

  const subtitle =
    step === "identify"
      ? t("auth.athlete.subtitleEmailOnly")
      : step === "register"
        ? t("auth.athlete.subtitleRegisterPassword")
        : step === "forgot"
          ? t("auth.password.forgotSubtitle")
          : step === "socialLogin"
            ? t("auth.athlete.socialOnlySubtitle", { email })
            : t("auth.athlete.subtitleLogin", { email });

  if (oauthCallbackRedirect) {
    return <Navigate to={oauthCallbackRedirect} replace />;
  }

  if (syncingClerk) {
    return (
      <>
        <MetaHelmet title={t("auth.sso.completing")} noindex />
        <AuthFlowLoadingPanel
          statusMessage={t("auth.sso.syncingAccount")}
          step="sync"
        />
      </>
    );
  }

  const busyIdentify = checkingEmail;

  return (
    <div className="h-[100dvh] overflow-hidden flex w-full max-w-full min-w-0 bg-background">
      <MetaHelmet
        title={t("auth.athlete.metaTitle")}
        description={t("auth.athlete.metaDescription")}
        path="/login"
      />

      <div className="flex-1 lg:max-w-[480px] flex flex-col overflow-y-auto border-r border-border/40">
        <AuthPageHeader />

        <div className="flex-1 flex flex-col justify-center px-6 sm:px-10 py-6">
          <div className="w-full max-w-[340px] mx-auto animate-slide-up">
            <div className="flex flex-col items-center text-center mb-8">
              <h1 className="text-2xl font-bold leading-tight mb-2">{heading}</h1>
              <p className="text-sm text-muted-foreground leading-relaxed">{subtitle}</p>
            </div>

            {step === "identify" && (
              <div className="space-y-5">
                <form onSubmit={identifyForm.handleSubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <label htmlFor="athlete-email" className="block text-sm font-medium">
                      {t("common.email")}
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                      <input
                        id="athlete-email"
                        type="email"
                        {...identifyForm.getFieldProps("email")}
                        className="w-full h-12 pl-10 pr-4 rounded-xl border border-input bg-card/80 focus:border-cyan focus:ring-2 focus:ring-cyan/20 outline-none transition-all text-sm"
                        placeholder={t("auth.athlete.emailPlaceholder")}
                        autoComplete="email"
                        autoFocus
                      />
                    </div>
                    {identifyForm.submitCount > 0 && identifyForm.errors.email && (
                      <p className="text-xs text-destructive">{identifyForm.errors.email}</p>
                    )}
                  </div>
                  <AuthFormError error={error} />
                  <button
                    type="submit"
                    disabled={busyIdentify}
                    className="w-full h-12 btn-primary rounded-xl flex items-center justify-center gap-2 text-sm font-semibold disabled:opacity-60"
                  >
                    {busyIdentify ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        {t("common.loading")}
                      </>
                    ) : (
                      t("common.continue")
                    )}
                  </button>
                </form>

                <div className="relative py-1">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-border" />
                  </div>
                  <div className="relative flex justify-center">
                    <span className="px-3 bg-background text-xs text-muted-foreground">
                      {t("common.orContinueWith")}
                    </span>
                  </div>
                </div>
                <ClerkOAuthButtons />
              </div>
            )}

            {step === "login" && (
              <form onSubmit={loginForm.handleSubmit} className="space-y-4">
                <div className="rounded-xl border border-border/60 bg-card/40 px-3 py-2 text-xs text-muted-foreground truncate">
                  {email}
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="athlete-password" className="block text-sm font-medium">
                    {t("auth.password.label")}
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none z-10" />
                    <input
                      id="athlete-password"
                      type="password"
                      {...loginForm.getFieldProps("password")}
                      className="w-full h-12 pl-10 pr-4 rounded-xl border border-input bg-card/80 focus:border-cyan focus:ring-2 focus:ring-cyan/20 outline-none transition-all text-sm"
                      placeholder={t("auth.password.placeholder")}
                      autoComplete="current-password"
                      autoFocus
                    />
                  </div>
                  {loginForm.submitCount > 0 && loginForm.errors.password && (
                    <p className="text-xs text-destructive">{loginForm.errors.password}</p>
                  )}
                </div>
                <AuthFormError error={error} />
                <button
                  type="submit"
                  disabled={signingIn}
                  className="w-full h-12 btn-primary rounded-xl flex items-center justify-center gap-2 text-sm font-semibold disabled:opacity-60"
                >
                  {signingIn ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {t("auth.athlete.signingIn")}
                    </>
                  ) : (
                    t("auth.athlete.enterPortal")
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setStep("forgot");
                    dispatch(clearAthleteError());
                  }}
                  className="w-full text-sm text-primary hover:underline"
                >
                  {t("auth.password.forgotLink")}
                </button>
                <button type="button" onClick={goIdentify} className="w-full text-sm text-muted-foreground hover:text-primary py-1 flex items-center justify-center gap-1">
                  <ArrowLeft className="w-3.5 h-3.5" />
                  {t("registrationWizard.auth.changeEmail")}
                </button>
              </form>
            )}

            {step === "register" && (
              <form onSubmit={registerForm.handleSubmit} className="space-y-4">
                <div className="rounded-xl border border-border/60 bg-card/40 px-3 py-2 text-xs text-muted-foreground truncate">
                  {email}
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="athlete-first-name" className="block text-sm font-medium">
                    {t("auth.athlete.firstNameLabel")}
                  </label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                    <input
                      id="athlete-first-name"
                      type="text"
                      {...registerForm.getFieldProps("firstName")}
                      className="w-full h-12 pl-10 pr-4 rounded-xl border border-input bg-card/80 focus:border-cyan focus:ring-2 focus:ring-cyan/20 outline-none transition-all text-sm"
                      autoComplete="given-name"
                      autoFocus
                    />
                  </div>
                  {registerForm.submitCount > 0 && registerForm.errors.firstName && (
                    <p className="text-xs text-destructive">{registerForm.errors.firstName}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="athlete-last-name" className="block text-sm font-medium">
                    {t("auth.athlete.lastNameLabel")}
                  </label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                    <input
                      id="athlete-last-name"
                      type="text"
                      {...registerForm.getFieldProps("lastName")}
                      className="w-full h-12 pl-10 pr-4 rounded-xl border border-input bg-card/80 focus:border-cyan focus:ring-2 focus:ring-cyan/20 outline-none transition-all text-sm"
                      autoComplete="family-name"
                    />
                  </div>
                  {registerForm.submitCount > 0 && registerForm.errors.lastName && (
                    <p className="text-xs text-destructive">{registerForm.errors.lastName}</p>
                  )}
                </div>
                <AthleteOnboardingFields
                  idPrefix="athlete-register"
                  dateOfBirth={registerForm.values.dateOfBirth}
                  gender={registerForm.values.gender}
                  onDateOfBirthChange={(v) => registerForm.setFieldValue("dateOfBirth", v)}
                  onGenderChange={(v) => registerForm.setFieldValue("gender", v)}
                  dateOfBirthError={
                    registerForm.submitCount > 0 && registerForm.errors.dateOfBirth
                      ? String(registerForm.errors.dateOfBirth)
                      : undefined
                  }
                  genderError={
                    registerForm.submitCount > 0 && registerForm.errors.gender
                      ? String(registerForm.errors.gender)
                      : undefined
                  }
                />
                <div className="space-y-1.5">
                  <label htmlFor="athlete-register-password" className="block text-sm font-medium">
                    {t("auth.password.createLabel")}
                  </label>
                  <PasswordStrengthField
                    id="athlete-register-password"
                    value={registerForm.values.password}
                    onChange={(v) => registerForm.setFieldValue("password", v)}
                    onBlur={() => registerForm.setFieldTouched("password", true)}
                    error={
                      registerForm.submitCount > 0 && registerForm.errors.password
                        ? String(registerForm.errors.password)
                        : undefined
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="athlete-confirm-password" className="block text-sm font-medium">
                    {t("auth.password.confirmLabel")}
                  </label>
                  <input
                    id="athlete-confirm-password"
                    type="password"
                    {...registerForm.getFieldProps("confirmPassword")}
                    className="w-full h-12 px-4 rounded-xl border border-input bg-card/80 focus:border-cyan focus:ring-2 focus:ring-cyan/20 outline-none transition-all text-sm"
                    autoComplete="new-password"
                  />
                  {registerForm.submitCount > 0 && registerForm.errors.confirmPassword && (
                    <p className="text-xs text-destructive">
                      {registerForm.errors.confirmPassword}
                    </p>
                  )}
                </div>
                <LegalConsentNotice
                  variant="athleteRegister"
                  showCheckbox
                  id="athlete-register-legal"
                  checked={registerForm.values.acceptedTerms}
                  onCheckedChange={(v) => registerForm.setFieldValue("acceptedTerms", v)}
                  error={
                    registerForm.submitCount > 0 && registerForm.errors.acceptedTerms
                      ? String(registerForm.errors.acceptedTerms)
                      : null
                  }
                />
                <AuthFormError error={error} />
                <button
                  type="submit"
                  disabled={registering}
                  className="w-full h-12 btn-primary rounded-xl flex items-center justify-center gap-2 text-sm font-semibold disabled:opacity-60"
                >
                  {registering ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {t("auth.athlete.creatingAccount")}
                    </>
                  ) : (
                    t("auth.athlete.createAccount")
                  )}
                </button>
                <button type="button" onClick={goIdentify} className="w-full text-sm text-muted-foreground hover:text-primary py-1">
                  ← {t("registrationWizard.auth.changeEmail")}
                </button>
              </form>
            )}

            {step === "socialLogin" && (
              <div className="space-y-5">
                <div className="rounded-xl border border-border/60 bg-card/40 px-3 py-2 text-xs text-muted-foreground truncate">
                  {email}
                </div>
                <LegalConsentNotice variant="athleteRegister" />
                <ClerkOAuthButtons />
                <button
                  type="button"
                  onClick={() => {
                    setStep("forgot");
                    dispatch(clearAthleteError());
                  }}
                  className="w-full text-sm text-primary hover:underline"
                >
                  {t("auth.athlete.setPasswordViaEmail")}
                </button>
                <button
                  type="button"
                  onClick={goIdentify}
                  className="w-full text-sm text-muted-foreground hover:text-primary py-1 flex items-center justify-center gap-1"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  {t("registrationWizard.auth.changeEmail")}
                </button>
              </div>
            )}

            {step === "forgot" && (
              <form onSubmit={forgotForm.handleSubmit} className="space-y-4">
                {passwordResetSent ? (
                  <div className="rounded-xl border border-accent/30 bg-accent/5 p-4 text-sm text-foreground/90">
                    {t("auth.password.resetEmailSent")}
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <label htmlFor="forgot-email" className="block text-sm font-medium">
                      {t("common.email")}
                    </label>
                    <input
                      id="forgot-email"
                      type="email"
                      {...forgotForm.getFieldProps("email")}
                      className="w-full h-12 px-4 rounded-xl border border-input bg-card/80 focus:border-cyan focus:ring-2 focus:ring-cyan/20 outline-none transition-all text-sm"
                      autoComplete="email"
                      autoFocus
                    />
                  </div>
                )}
                <AuthFormError error={error} />
                {!passwordResetSent && (
                  <button
                    type="submit"
                    disabled={resettingPassword}
                    className="w-full h-12 btn-primary rounded-xl flex items-center justify-center gap-2 text-sm font-semibold disabled:opacity-60"
                  >
                    {resettingPassword ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      t("auth.password.sendReset")
                    )}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setStep(email ? "login" : "identify")}
                  className="w-full text-sm text-muted-foreground hover:text-primary py-1 flex items-center justify-center gap-1"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  {t("common.back")}
                </button>
              </form>
            )}
          </div>
        </div>

        <div className="px-6 pb-6 shrink-0">
          <div className="flex justify-center gap-4 text-xs text-muted-foreground mb-3">
            <span className="flex items-center gap-1">
              <CheckCircle className="w-3.5 h-3.5 text-primary" />
              {t("auth.athlete.trustSecure")}
            </span>
            <span className="flex items-center gap-1">
              <CheckCircle className="w-3.5 h-3.5 text-primary" />
              {t("common.instantQr")}
            </span>
          </div>
          <div className="flex items-center justify-center gap-3 mb-3">
            <LanguageSwitcher variant="ghost" />
          </div>
          <p className="text-center text-[11px] text-muted-foreground/50">
            {t("common.copyright", { year: new Date().getFullYear() })}
          </p>
        </div>
      </div>

      <AuthBrandPanel
        videoUrl={ATHLETE_LOGIN_VIDEO_URL}
        badge=""
        headline={
          <>
            {t("auth.athlete.brandHeadline")}{" "}
            <span className="text-primary">{t("auth.athlete.brandHeadlineHighlight")}</span>{" "}
            {t("auth.athlete.brandHeadlineEnd")}
          </>
        }
        subheadline={t("auth.athlete.brandSub")}
        stats={stats}
        testimonials={testimonials}
        footerNote={t("auth.athlete.brandFooter")}
      />
    </div>
  );
}

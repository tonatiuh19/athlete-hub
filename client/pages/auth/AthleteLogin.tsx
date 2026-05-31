import { useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useFormik } from "formik";
import * as Yup from "yup";
import { useTranslation } from "react-i18next";
import {
  ArrowLeft,
  Footprints,
  Mail,
  Loader2,
  CheckCircle,
  Star,
  Flame,
  MapPin,
} from "lucide-react";
import MetaHelmet from "@/components/MetaHelmet";
import OtpInput from "@/components/OtpInput";
import AuthBrandPanel from "@/components/AuthBrandPanel";
import ClerkOAuthButtons from "@/components/ClerkOAuthButtons";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  requestAthleteOtp,
  verifyAthleteOtp,
} from "@/store/slices/athleteAuthSlice";

export default function AthleteLogin() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { requestingOtp, verifyingOtp, error, otpSentTo } =
    useAppSelector((s) => s.athleteAuth);
  const [step, setStep] = useState<"identify" | "code">("identify");

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
      const result = await dispatch(
        requestAthleteOtp({
          email: values.email,
          channel: "email",
          purpose: "login",
        }),
      );
      if (requestAthleteOtp.fulfilled.match(result)) setStep("code");
    },
  });

  const codeForm = useFormik({
    initialValues: { code: "" },
    validateOnBlur: false,
    validateOnChange: false,
    validationSchema: Yup.object({
      code: Yup.string()
        .matches(/^\d{6}$/, t("common.sixDigits"))
        .required(t("common.required")),
    }),
    onSubmit: async (values) => {
      const result = await dispatch(
        verifyAthleteOtp({
          email: identifyForm.values.email,
          code: values.code,
          channel: "email",
        }),
      );
      if (verifyAthleteOtp.fulfilled.match(result)) {
        navigate("/portal", { replace: true });
      }
    },
  });

  const destination = otpSentTo || identifyForm.values.email;

  return (
    <div className="h-[100dvh] overflow-hidden flex w-full max-w-[100vw] bg-background">
      <MetaHelmet
        title={t("auth.athlete.metaTitle")}
        description={t("auth.athlete.metaDescription")}
        path="/login"
      />

      <div className="flex-1 lg:max-w-[480px] flex flex-col overflow-y-auto border-r border-border/40">
        <header className="sticky top-0 z-20 bg-background/80 backdrop-blur-md border-b border-border/60 shrink-0">
          <div className="px-4 sm:px-6 h-14 flex items-center justify-between gap-2">
            <Link to="/" className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan to-blue-electric flex items-center justify-center shrink-0">
                <Footprints className="w-4 h-4 text-navy-deep" />
              </div>
              <span className="font-bold text-gradient text-sm truncate">
                {t("common.appName")}
              </span>
            </Link>
            <div className="flex items-center gap-2 shrink-0">
              <Link
                to="/"
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-cyan"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                {t("common.back")}
              </Link>
            </div>
          </div>
        </header>

        <div className="flex-1 flex flex-col justify-center px-6 sm:px-10 py-6">
          <div className="w-full max-w-[340px] mx-auto animate-slide-up">
            <div className="flex flex-col items-center text-center mb-8">
              <div className="w-16 h-16 bg-gradient-to-br from-cyan to-blue-electric rounded-2xl flex items-center justify-center mb-5 shadow-glow-cyan">
                <Flame className="w-8 h-8 text-navy-deep" />
              </div>
              <h1 className="text-2xl font-bold leading-tight mb-2">
                {step === "identify" ? (
                  <>
                    {t("auth.athlete.titleIdentify")}{" "}
                    <span className="text-gradient">
                      {t("auth.athlete.titleHighlight")}
                    </span>
                  </>
                ) : (
                  t("auth.athlete.titleCode")
                )}
              </h1>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {step === "identify"
                  ? t("auth.athlete.subtitleEmailOnly")
                  : t("auth.athlete.subtitleCode", { destination })}
              </p>
            </div>

            {step === "identify" ? (
              <div className="space-y-5">
                <form onSubmit={identifyForm.handleSubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <label
                      htmlFor="athlete-email"
                      className="block text-sm font-medium text-foreground/90"
                    >
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
                      <p className="text-xs text-destructive">
                        {identifyForm.errors.email}
                      </p>
                    )}
                  </div>

                  {error && (
                    <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 px-4 py-3 rounded-xl">
                      {error}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={requestingOtp}
                    className="w-full h-12 btn-primary rounded-xl flex items-center justify-center gap-2 text-sm font-semibold disabled:opacity-60"
                  >
                    {requestingOtp ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        {t("common.sending")}
                      </>
                    ) : (
                      t("common.sendCode")
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

                <ClerkOAuthButtons mode="athlete" />
              </div>
            ) : (
              <form onSubmit={codeForm.handleSubmit} className="space-y-5">
                <OtpInput
                  value={codeForm.values.code}
                  onChange={(v) => codeForm.setFieldValue("code", v)}
                  autoFocus
                  hasError={!!(codeForm.submitCount > 0 && codeForm.errors.code)}
                />
                {codeForm.submitCount > 0 && codeForm.errors.code && (
                  <p className="text-xs text-destructive text-center">
                    {codeForm.errors.code}
                  </p>
                )}
                {error && (
                  <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 px-4 py-3 rounded-xl">
                    {error}
                  </div>
                )}
                <button
                  type="submit"
                  disabled={verifyingOtp}
                  className="w-full h-12 btn-primary rounded-xl flex items-center justify-center gap-2 text-sm font-semibold"
                >
                  {verifyingOtp ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {t("common.verifying")}
                    </>
                  ) : (
                    t("auth.athlete.enterPortal")
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setStep("identify");
                    codeForm.resetForm();
                  }}
                  className="w-full text-sm text-muted-foreground hover:text-cyan py-1 truncate"
                >
                  ← {destination}
                </button>
              </form>
            )}
          </div>
        </div>

        <div className="px-6 pb-6 shrink-0">
          <div className="flex justify-center gap-4 text-xs text-muted-foreground mb-3">
            <span className="flex items-center gap-1">
              <CheckCircle className="w-3.5 h-3.5 text-cyan" />
              {t("common.noPassword")}
            </span>
            <span className="flex items-center gap-1">
              <CheckCircle className="w-3.5 h-3.5 text-cyan" />
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
        badge={t("auth.athlete.brandBadge")}
        headline={
          <>
            {t("auth.athlete.brandHeadline")}{" "}
            <span className="text-cyan">{t("auth.athlete.brandHeadlineHighlight")}</span>{" "}
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

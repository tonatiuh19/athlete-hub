import { useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useFormik } from "formik";
import * as Yup from "yup";
import { useTranslation } from "react-i18next";
import {
  ArrowLeft,
  ShieldCheck,
  Mail,
  Loader2,
  CheckCircle,
  Users,
  Calendar,
  BarChart3,
} from "lucide-react";
import MetaHelmet from "@/components/MetaHelmet";
import OtpInput from "@/components/OtpInput";
import AuthBrandPanel from "@/components/AuthBrandPanel";
import ClerkOAuthButtons from "@/components/ClerkOAuthButtons";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { requestStaffOtp, verifyStaffOtp } from "@/store/slices/staffAuthSlice";

export default function StaffLogin() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { requestingOtp, verifyingOtp, error, otpSentTo } = useAppSelector(
    (s) => s.staffAuth,
  );
  const [step, setStep] = useState<"email" | "code">("email");

  const stats = useMemo(
    () => [
      { value: "2K+", label: t("auth.staff.statEvents"), icon: Calendar },
      { value: "500K+", label: t("auth.staff.statRegistrations"), icon: Users },
      { value: "98%", label: t("auth.staff.statSatisfaction"), icon: BarChart3 },
    ],
    [t],
  );

  const testimonials = useMemo(
    () => [
      {
        quote: t("auth.staff.testimonial1Quote"),
        name: t("auth.staff.testimonial1Name"),
        detail: t("auth.staff.testimonial1Detail"),
        initial: "R",
      },
      {
        quote: t("auth.staff.testimonial2Quote"),
        name: t("auth.staff.testimonial2Name"),
        detail: t("auth.staff.testimonial2Detail"),
        initial: "E",
      },
    ],
    [t],
  );

  const emailForm = useFormik({
    initialValues: { email: "" },
    validateOnBlur: false,
    validateOnChange: false,
    validationSchema: Yup.object({
      email: Yup.string()
        .email(t("common.invalidEmail"))
        .required(t("common.required")),
    }),
    onSubmit: async (values) => {
      const result = await dispatch(requestStaffOtp({ email: values.email }));
      if (requestStaffOtp.fulfilled.match(result)) setStep("code");
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
        verifyStaffOtp({
          email: otpSentTo || emailForm.values.email,
          code: values.code,
        }),
      );
      if (verifyStaffOtp.fulfilled.match(result)) {
        navigate("/staff", { replace: true });
      }
    },
  });

  const email = otpSentTo || emailForm.values.email;

  return (
    <div className="h-[100dvh] overflow-hidden flex w-full max-w-[100vw] bg-background">
      <MetaHelmet
        title={t("auth.staff.metaTitle")}
        description={t("auth.staff.metaDescription")}
        path="/staff/login"
        noindex
      />

      <div className="flex-1 lg:max-w-[480px] flex flex-col overflow-y-auto border-r border-border/40">
        <header className="sticky top-0 z-20 bg-background/80 backdrop-blur-md border-b border-border/60 shrink-0">
          <div className="px-4 sm:px-6 h-14 flex items-center justify-between gap-2">
            <Link to="/" className="flex items-center gap-2 min-w-0">
              <ShieldCheck className="w-5 h-5 text-cyan shrink-0" />
              <span className="font-bold text-gradient text-sm truncate">
                {t("staffPortal.nav.console")}
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
              <div className="w-16 h-16 bg-gradient-to-br from-cyan/90 to-purple-accent rounded-2xl flex items-center justify-center mb-5 shadow-glow-cyan">
                <ShieldCheck className="w-8 h-8 text-navy-deep" />
              </div>
              <h1 className="text-2xl font-bold mb-2 leading-tight">
                {step === "email" ? (
                  <>
                    {t("auth.staff.titleUnified")}{" "}
                    <span className="text-gradient">
                      {t("auth.staff.titleUnifiedHighlight")}
                    </span>
                  </>
                ) : (
                  t("auth.staff.titleCode")
                )}
              </h1>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {step === "email"
                  ? t("auth.staff.subtitleUnified")
                  : t("auth.staff.subtitleCode", { email })}
              </p>
            </div>

            {step === "email" ? (
              <div className="space-y-5">
                <form onSubmit={emailForm.handleSubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <label
                      htmlFor="staff-email"
                      className="block text-sm font-medium text-foreground/90"
                    >
                      {t("auth.staff.emailLabel")}
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                      <input
                        id="staff-email"
                        type="email"
                        {...emailForm.getFieldProps("email")}
                        className="w-full h-12 pl-10 pr-4 rounded-xl border border-input bg-card/80 focus:border-cyan focus:ring-2 focus:ring-cyan/20 outline-none transition-all text-sm"
                        placeholder={t("auth.staff.emailPlaceholder")}
                        autoComplete="email"
                        autoFocus
                      />
                    </div>
                    {emailForm.submitCount > 0 && emailForm.errors.email && (
                      <p className="text-xs text-destructive">{emailForm.errors.email}</p>
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

                <ClerkOAuthButtons mode="staff" />
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
                  <div className="text-sm text-destructive bg-destructive/10 px-4 py-3 rounded-xl">
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
                    t("auth.staff.enterConsole")
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setStep("email");
                    codeForm.resetForm();
                  }}
                  className="w-full text-sm text-muted-foreground hover:text-cyan py-1"
                >
                  ← {email}
                </button>
              </form>
            )}
          </div>
        </div>

        <div className="px-6 pb-6 shrink-0">
          <div className="flex justify-center gap-4 text-xs text-muted-foreground mb-3">
            <span className="flex items-center gap-1">
              <CheckCircle className="w-3.5 h-3.5 text-cyan" />
              {t("auth.staff.trustSecure")}
            </span>
            <span className="flex items-center gap-1">
              <CheckCircle className="w-3.5 h-3.5 text-cyan" />
              {t("auth.staff.trustInternal")}
            </span>
          </div>
          <div className="flex items-center justify-center mb-3">
            <LanguageSwitcher variant="ghost" />
          </div>
          <p className="text-center text-[11px] text-muted-foreground/50">
            {t("common.copyright", { year: new Date().getFullYear() })}
          </p>
        </div>
      </div>

      <AuthBrandPanel
        badge={t("auth.staff.brandBadge")}
        headline={
          <>
            {t("auth.staff.brandHeadline")}{" "}
            <span className="text-cyan">{t("auth.staff.brandHeadlineHighlight")}</span>.
          </>
        }
        subheadline={t("auth.staff.brandSub")}
        stats={stats}
        testimonials={testimonials}
        footerNote={t("auth.staff.brandFooter")}
      />
    </div>
  );
}

import { useFormik } from "formik";
import { Loader2 } from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import MetaHelmet from "@/components/MetaHelmet";
import AuthFormError from "@/components/auth/AuthFormError";
import PasswordStrengthField from "@/components/auth/PasswordStrengthField";
import OtpInput from "@/components/OtpInput";
import TribooLogo from "@/components/brand/TribooLogo";
import { athletePasswordConfirmSchema } from "@/validation/athletePasswordSchema";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { resetAthletePassword } from "@/store/slices/athleteAuthSlice";
import * as Yup from "yup";

export default function AthleteResetPassword() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const prefilledEmail = params.get("email") || "";
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { registering, error } = useAppSelector((s) => s.athleteAuth);

  const form = useFormik({
    initialValues: { email: prefilledEmail, code: "", password: "", confirmPassword: "" },
    enableReinitialize: true,
    validationSchema: Yup.object({
      email: Yup.string().email(t("common.invalidEmail")).required(t("common.required")),
      code: Yup.string()
        .matches(/^\d{6}$/, t("common.sixDigits"))
        .required(t("common.required")),
      ...athletePasswordConfirmSchema(t).fields,
    }),
    onSubmit: async (values) => {
      const result = await dispatch(
        resetAthletePassword({
          email: values.email.trim().toLowerCase(),
          code: values.code,
          password: values.password,
        }),
      );
      if (resetAthletePassword.fulfilled.match(result)) {
        navigate("/portal", { replace: true });
      }
    },
  });

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-10 bg-background">
      <MetaHelmet title={t("auth.password.resetTitle")} noindex />
      <div className="w-full max-w-[380px] space-y-6">
        <div className="text-center space-y-2">
          <TribooLogo surface="dark" className="h-10 mx-auto" />
          <h1 className="text-xl font-bold">{t("auth.password.resetTitle")}</h1>
          <p className="text-sm text-muted-foreground">{t("auth.password.resetSubtitleCode")}</p>
        </div>
        <form onSubmit={form.handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="reset-email" className="block text-sm font-medium">
              {t("common.email")}
            </label>
            <input
              id="reset-email"
              type="email"
              {...form.getFieldProps("email")}
              className="w-full h-12 px-4 rounded-xl border border-input bg-card/80 focus:border-cyan focus:ring-2 focus:ring-cyan/20 outline-none text-sm"
              autoComplete="email"
            />
            {form.submitCount > 0 && form.errors.email && (
              <p className="text-xs text-destructive">{form.errors.email}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-center">
              {t("auth.password.resetCodeLabel")}
            </label>
            <OtpInput
              value={form.values.code}
              onChange={(v) => form.setFieldValue("code", v)}
              hasError={!!(form.submitCount > 0 && form.errors.code)}
            />
            {form.submitCount > 0 && form.errors.code && (
              <p className="text-xs text-destructive text-center">{form.errors.code}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <label htmlFor="reset-password" className="block text-sm font-medium">
              {t("auth.password.createLabel")}
            </label>
            <PasswordStrengthField
              id="reset-password"
              value={form.values.password}
              onChange={(v) => form.setFieldValue("password", v)}
              error={
                form.submitCount > 0 && form.errors.password
                  ? String(form.errors.password)
                  : undefined
              }
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="reset-confirm" className="block text-sm font-medium">
              {t("auth.password.confirmLabel")}
            </label>
            <input
              id="reset-confirm"
              type="password"
              {...form.getFieldProps("confirmPassword")}
              className="w-full h-12 px-4 rounded-xl border border-input bg-card/80 focus:border-cyan focus:ring-2 focus:ring-cyan/20 outline-none text-sm"
              autoComplete="new-password"
            />
            {form.submitCount > 0 && form.errors.confirmPassword && (
              <p className="text-xs text-destructive">{form.errors.confirmPassword}</p>
            )}
          </div>
          <AuthFormError error={error} />
          <button
            type="submit"
            disabled={registering}
            className="w-full h-12 btn-primary rounded-xl flex items-center justify-center gap-2 text-sm font-semibold disabled:opacity-60"
          >
            {registering ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {t("common.loading")}
              </>
            ) : (
              t("auth.password.savePassword")
            )}
          </button>
          <Link to="/login" className="block text-center text-sm text-cyan hover:underline">
            {t("auth.sso.backToLogin")}
          </Link>
        </form>
      </div>
    </div>
  );
}

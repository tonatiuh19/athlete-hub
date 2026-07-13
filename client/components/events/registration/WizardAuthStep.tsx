import { useEffect, useMemo, useState } from "react";
import { useFormik } from "formik";
import * as Yup from "yup";
import { Loader2, Mail, ShieldCheck, User, Lock } from "lucide-react";
import { useTranslation } from "react-i18next";
import { isClerkEnabled } from "@/lib/api";
import ClerkOAuthButtons from "@/components/ClerkOAuthButtons";
import PasswordStrengthField from "@/components/auth/PasswordStrengthField";
import AthleteOnboardingFields from "@/components/auth/AthleteOnboardingFields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { athletePasswordConfirmSchema } from "@/validation/athletePasswordSchema";
import {
  athleteDateOfBirthSchema,
  athleteGenderSchema,
} from "@/validation/athleteOnboardingSchema";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  clearAthleteError,
  checkAthleteEmail,
  fetchAthleteMe,
  loginAthlete,
  registerAthlete,
  forgotAthletePassword,
} from "@/store/slices/athleteAuthSlice";
import { getAthleteToken } from "@/lib/api";
import AthleteProfileCompletionForm from "@/components/auth/AthleteProfileCompletionForm";
import { athleteNeedsProfileCompletion } from "@/utils/athleteProfileCompletion";
import LegalConsentNotice from "@/components/legal/LegalConsentNotice";
import { legalTermsAcceptanceSchema } from "@/validation/legalConsentSchema";

interface WizardAuthStepProps {
  onAuthed: () => void;
}

type AuthPhase = "identify" | "login" | "register" | "forgot" | "socialLogin";

export default function WizardAuthStep({ onAuthed }: WizardAuthStepProps) {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const {
    user,
    token,
    checkingEmail,
    signingIn,
    registering,
    resettingPassword,
    syncingClerk,
    error,
    passwordResetSent,
  } = useAppSelector((s) => s.athleteAuth);
  const [phase, setPhase] = useState<AuthPhase>("identify");
  const [email, setEmail] = useState("");

  useEffect(() => {
    dispatch(clearAthleteError());
    if (getAthleteToken()) {
      dispatch(fetchAthleteMe())
        .unwrap()
        .then(() => {
          // advance handled when user state updates
        })
        .catch(() => undefined);
    }
  }, [dispatch]);

  useEffect(() => {
    if (user && token && !athleteNeedsProfileCompletion(user)) {
      onAuthed();
    }
  }, [user, token, onAuthed]);

  const identifyForm = useFormik({
    initialValues: { email: "" },
    validationSchema: Yup.object({
      email: Yup.string().email(t("common.invalidEmail")).required(t("common.required")),
    }),
    onSubmit: async (values) => {
      const normalized = values.email.trim().toLowerCase();
      const check = await dispatch(checkAthleteEmail({ email: normalized }));
      if (checkAthleteEmail.rejected.match(check)) return;
      setEmail(normalized);
      const { exists, hasPassword, hasSocialLogin } = check.payload!;
      if (exists && hasSocialLogin && !hasPassword) {
        setPhase("socialLogin");
      } else {
        setPhase(exists ? "login" : "register");
      }
    },
  });

  const loginForm = useFormik({
    initialValues: { password: "" },
    validationSchema: Yup.object({
      password: Yup.string().required(t("common.required")),
    }),
    onSubmit: async (values) => {
      const result = await dispatch(loginAthlete({ email, password: values.password }));
      if (loginAthlete.fulfilled.match(result)) {
        dispatch(fetchAthleteMe());
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
        onAuthed();
      }
    },
  });

  const forgotForm = useFormik({
    initialValues: { email },
    enableReinitialize: true,
    validationSchema: Yup.object({
      email: Yup.string().email(t("common.invalidEmail")).required(t("common.required")),
    }),
    onSubmit: async (values) => {
      await dispatch(forgotAthletePassword({ email: values.email.trim().toLowerCase() }));
    },
  });

  const perks = useMemo(
    () => [
      t("registrationWizard.auth.perk1"),
      t("registrationWizard.auth.perk2"),
      t("registrationWizard.auth.perk3"),
    ],
    [t],
  );

  if (user && token && athleteNeedsProfileCompletion(user)) {
    return (
      <AthleteProfileCompletionForm
        idPrefix="wizard-profile"
        compact
        onComplete={onAuthed}
      />
    );
  }

  if (user && token) {
    return (
      <div className="flex flex-col items-center justify-center py-10 gap-3 text-muted-foreground">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
        {t("registrationWizard.auth.sessionReady")}
      </div>
    );
  }

  const busyIdentify = checkingEmail;

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-cyan/20 bg-cyan/5 p-4 flex gap-3">
        <ShieldCheck className="w-5 h-5 text-primary shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-foreground">{t("registrationWizard.auth.title")}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {phase === "register"
              ? t("registrationWizard.auth.registerSubtitlePassword")
              : phase === "login"
                ? t("registrationWizard.auth.loginSubtitle")
                : t("registrationWizard.auth.subtitle")}
          </p>
        </div>
      </div>

      <ul className="grid gap-2">
        {perks.map((perk) => (
          <li key={perk} className="text-xs text-muted-foreground flex items-center gap-2">
            <span className="w-1 h-1 rounded-full bg-cyan" />
            {perk}
          </li>
        ))}
      </ul>

      {phase === "identify" && (
        <form onSubmit={identifyForm.handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="wizard-email">{t("common.email")}</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="wizard-email"
                type="email"
                placeholder="you@example.com"
                className="pl-10 bg-card border-border"
                {...identifyForm.getFieldProps("email")}
              />
            </div>
            {identifyForm.touched.email && identifyForm.errors.email && (
              <p className="text-xs text-red-400">{identifyForm.errors.email}</p>
            )}
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <Button
            type="submit"
            disabled={busyIdentify}
            className="w-full bg-gradient-to-r from-cyan to-blue-electric text-navy-deep font-bold"
          >
            {busyIdentify ? <Loader2 className="w-4 h-4 animate-spin" /> : t("common.continue")}
          </Button>
        </form>
      )}

      {phase === "login" && (
        <form onSubmit={loginForm.handleSubmit} className="space-y-4">
          <div className="rounded-lg border border-border bg-card/60 px-3 py-2 text-xs text-muted-foreground truncate">
            {email}
          </div>
          <div className="space-y-2">
            <Label htmlFor="wizard-password">{t("auth.password.label")}</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="wizard-password"
                type="password"
                className="pl-10 bg-card border-border"
                autoComplete="current-password"
                {...loginForm.getFieldProps("password")}
              />
            </div>
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <Button
            type="submit"
            disabled={signingIn}
            className="w-full bg-gradient-to-r from-cyan to-blue-electric text-navy-deep font-bold"
          >
            {signingIn ? <Loader2 className="w-4 h-4 animate-spin" /> : t("registrationWizard.auth.signIn")}
          </Button>
          <button
            type="button"
            className="text-xs text-primary hover:underline w-full text-center"
            onClick={() => setPhase("forgot")}
          >
            {t("auth.password.forgotLink")}
          </button>
          <button
            type="button"
            className="text-xs text-muted-foreground hover:text-primary w-full text-center"
            onClick={() => setPhase("identify")}
          >
            {t("registrationWizard.auth.changeEmail")}
          </button>
        </form>
      )}

      {phase === "register" && (
        <form onSubmit={registerForm.handleSubmit} className="space-y-4">
          <div className="rounded-lg border border-border bg-card/60 px-3 py-2 text-xs text-muted-foreground truncate">
            {email}
          </div>
          <div className="space-y-2">
            <Label htmlFor="wizard-first-name">{t("registrationWizard.auth.firstNameLabel")}</Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="wizard-first-name"
                className="pl-10 bg-card border-border"
                {...registerForm.getFieldProps("firstName")}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="wizard-last-name">{t("registrationWizard.auth.lastNameLabel")}</Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="wizard-last-name"
                className="pl-10 bg-card border-border"
                {...registerForm.getFieldProps("lastName")}
              />
            </div>
          </div>
          <AthleteOnboardingFields
            idPrefix="wizard-register"
            dateOfBirth={registerForm.values.dateOfBirth}
            gender={registerForm.values.gender}
            onDateOfBirthChange={(v) => registerForm.setFieldValue("dateOfBirth", v)}
            onGenderChange={(v) => registerForm.setFieldValue("gender", v)}
            dateOfBirthError={
              registerForm.touched.dateOfBirth && registerForm.errors.dateOfBirth
                ? String(registerForm.errors.dateOfBirth)
                : undefined
            }
            genderError={
              registerForm.touched.gender && registerForm.errors.gender
                ? String(registerForm.errors.gender)
                : undefined
            }
          />
          <div className="space-y-2">
            <Label htmlFor="wizard-register-password">{t("auth.password.createLabel")}</Label>
            <PasswordStrengthField
              id="wizard-register-password"
              value={registerForm.values.password}
              onChange={(v) => registerForm.setFieldValue("password", v)}
              error={
                registerForm.touched.password && registerForm.errors.password
                  ? String(registerForm.errors.password)
                  : undefined
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="wizard-confirm-password">{t("auth.password.confirmLabel")}</Label>
            <Input
              id="wizard-confirm-password"
              type="password"
              className="bg-card border-border"
              autoComplete="new-password"
              {...registerForm.getFieldProps("confirmPassword")}
            />
          </div>
          <LegalConsentNotice
            variant="athleteRegister"
            showCheckbox
            id="wizard-register-legal"
            checked={registerForm.values.acceptedTerms}
            onCheckedChange={(v) => registerForm.setFieldValue("acceptedTerms", v)}
            error={
              registerForm.submitCount > 0 && registerForm.errors.acceptedTerms
                ? String(registerForm.errors.acceptedTerms)
                : null
            }
          />
          {error && <p className="text-sm text-red-400">{error}</p>}
          <Button
            type="submit"
            disabled={registering}
            className="w-full bg-gradient-to-r from-cyan to-blue-electric text-navy-deep font-bold"
          >
            {registering ? <Loader2 className="w-4 h-4 animate-spin" /> : t("auth.athlete.createAccount")}
          </Button>
          <button
            type="button"
            className="text-xs text-muted-foreground hover:text-primary w-full text-center"
            onClick={() => setPhase("identify")}
          >
            {t("registrationWizard.auth.changeEmail")}
          </button>
        </form>
      )}

      {phase === "socialLogin" && (
        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-card/60 px-3 py-2 text-xs text-muted-foreground truncate">
            {email}
          </div>
          <p className="text-sm text-muted-foreground">{t("auth.athlete.socialOnlySubtitle", { email })}</p>
          <LegalConsentNotice variant="athleteRegister" />
          <ClerkOAuthButtons
            returnTo={window.location.pathname + window.location.search}
          />
          <button
            type="button"
            className="text-xs text-primary hover:underline w-full text-center"
            onClick={() => setPhase("forgot")}
          >
            {t("auth.athlete.setPasswordViaEmail")}
          </button>
          <button
            type="button"
            className="text-xs text-muted-foreground hover:text-primary w-full text-center"
            onClick={() => setPhase("identify")}
          >
            {t("registrationWizard.auth.changeEmail")}
          </button>
        </div>
      )}

      {phase === "forgot" && (
        <form onSubmit={forgotForm.handleSubmit} className="space-y-4">
          {passwordResetSent ? (
            <p className="text-sm text-accent">{t("auth.password.resetEmailSent")}</p>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="wizard-forgot-email">{t("common.email")}</Label>
              <Input
                id="wizard-forgot-email"
                type="email"
                className="bg-card border-border"
                {...forgotForm.getFieldProps("email")}
              />
            </div>
          )}
          {error && <p className="text-sm text-red-400">{error}</p>}
          {!passwordResetSent && (
            <Button
              type="submit"
              disabled={resettingPassword}
              className="w-full bg-gradient-to-r from-cyan to-blue-electric text-navy-deep font-bold"
            >
              {resettingPassword ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                t("auth.password.sendReset")
              )}
            </Button>
          )}
          <button
            type="button"
            className="text-xs text-muted-foreground hover:text-primary w-full text-center"
            onClick={() => setPhase("login")}
          >
            {t("common.back")}
          </button>
        </form>
      )}

      {phase === "identify" && (
        <>
          <div className="relative py-2">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <p className="relative text-center text-[10px] uppercase tracking-widest text-muted-foreground bg-background px-3 mx-auto w-fit">
              {t("registrationWizard.auth.orContinue")}
            </p>
          </div>
          <ClerkOAuthButtons
            disabled={syncingClerk}
            returnTo={window.location.pathname + window.location.search}
          />
        </>
      )}
    </div>
  );
}

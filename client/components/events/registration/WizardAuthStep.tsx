import { useEffect, useMemo, useState } from "react";
import { useFormik } from "formik";
import * as Yup from "yup";
import { Loader2, Mail, ShieldCheck } from "lucide-react";
import { useTranslation } from "react-i18next";
import OtpInput from "@/components/OtpInput";
import ClerkOAuthButtons from "@/components/ClerkOAuthButtons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  clearAthleteError,
  fetchAthleteMe,
  requestAthleteOtp,
  verifyAthleteOtp,
} from "@/store/slices/athleteAuthSlice";
import { advanceWizardAfterAuth } from "@/store/slices/registrationCheckoutSlice";
import { getAthleteToken } from "@/lib/api";

interface WizardAuthStepProps {
  onAuthed: () => void;
}

export default function WizardAuthStep({ onAuthed }: WizardAuthStepProps) {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const { user, token, requestingOtp, verifyingOtp, syncingClerk, error, otpSentTo } =
    useAppSelector((s) => s.athleteAuth);
  const [phase, setPhase] = useState<"identify" | "code">("identify");

  useEffect(() => {
    dispatch(clearAthleteError());
    if (getAthleteToken()) {
      dispatch(fetchAthleteMe())
        .unwrap()
        .then(() => {
          dispatch(advanceWizardAfterAuth());
          onAuthed();
        })
        .catch(() => undefined);
    }
  }, [dispatch, onAuthed]);

  useEffect(() => {
    if (user && token) {
      dispatch(advanceWizardAfterAuth());
      onAuthed();
    }
  }, [user, token, dispatch, onAuthed]);

  const identifyForm = useFormik({
    initialValues: { email: "" },
    validationSchema: Yup.object({
      email: Yup.string().email(t("common.invalidEmail")).required(t("common.required")),
    }),
    onSubmit: async (values) => {
      const result = await dispatch(
        requestAthleteOtp({
          email: values.email,
          channel: "email",
          purpose: "login",
        }),
      );
      if (requestAthleteOtp.fulfilled.match(result)) setPhase("code");
    },
  });

  const codeForm = useFormik({
    initialValues: { code: "" },
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
        dispatch(advanceWizardAfterAuth());
        onAuthed();
      }
    },
  });

  const destination = otpSentTo || identifyForm.values.email;

  const perks = useMemo(
    () => [
      t("registrationWizard.auth.perk1"),
      t("registrationWizard.auth.perk2"),
      t("registrationWizard.auth.perk3"),
    ],
    [t],
  );

  if (user && token) {
    return (
      <div className="flex flex-col items-center justify-center py-10 gap-3 text-gray-400">
        <Loader2 className="w-6 h-6 animate-spin text-cyan" />
        {t("registrationWizard.auth.sessionReady")}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-cyan/20 bg-cyan/5 p-4 flex gap-3">
        <ShieldCheck className="w-5 h-5 text-cyan shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-white">{t("registrationWizard.auth.title")}</p>
          <p className="text-xs text-gray-400 mt-1">{t("registrationWizard.auth.subtitle")}</p>
        </div>
      </div>

      <ul className="grid gap-2">
        {perks.map((perk) => (
          <li key={perk} className="text-xs text-gray-500 flex items-center gap-2">
            <span className="w-1 h-1 rounded-full bg-cyan" />
            {perk}
          </li>
        ))}
      </ul>

      {phase === "identify" ? (
        <form onSubmit={identifyForm.handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="wizard-email">{t("common.email")}</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <Input
                id="wizard-email"
                type="email"
                placeholder="you@example.com"
                className="pl-10 bg-surface-dark border-gray-700"
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
            disabled={requestingOtp}
            className="w-full bg-gradient-to-r from-cyan to-blue-electric text-navy-deep font-bold"
          >
            {requestingOtp ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              t("registrationWizard.auth.sendCode")
            )}
          </Button>
        </form>
      ) : (
        <form onSubmit={codeForm.handleSubmit} className="space-y-4">
          <p className="text-sm text-gray-400">
            {t("registrationWizard.auth.codeSent", { email: destination })}
          </p>
          <OtpInput
            value={codeForm.values.code}
            onChange={(v) => codeForm.setFieldValue("code", v)}
          />
          {codeForm.touched.code && codeForm.errors.code && (
            <p className="text-xs text-red-400">{codeForm.errors.code}</p>
          )}
          {error && <p className="text-sm text-red-400">{error}</p>}
          <Button
            type="submit"
            disabled={verifyingOtp}
            className="w-full bg-gradient-to-r from-cyan to-blue-electric text-navy-deep font-bold"
          >
            {verifyingOtp ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              t("registrationWizard.auth.verify")
            )}
          </Button>
          <button
            type="button"
            className="text-xs text-gray-500 hover:text-cyan w-full text-center"
            onClick={() => setPhase("identify")}
          >
            {t("registrationWizard.auth.changeEmail")}
          </button>
        </form>
      )}

      {phase === "identify" && (
        <div className="relative py-2">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-800" />
          </div>
          <p className="relative text-center text-[10px] uppercase tracking-widest text-gray-600 bg-bg-dark px-3 mx-auto w-fit">
            {t("registrationWizard.auth.orContinue")}
          </p>
        </div>
      )}

      {phase === "identify" && (
        <ClerkOAuthButtons
          mode="athlete"
          disabled={syncingClerk}
          onSuccess={async () => {
            /* Clerk redirect handles SSO; optional inline sync if session exists */
          }}
        />
      )}
    </div>
  );
}

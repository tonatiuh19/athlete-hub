import { useFormik } from "formik";
import * as Yup from "yup";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import AthleteOnboardingFields from "@/components/auth/AthleteOnboardingFields";
import { Button } from "@/components/ui/button";
import {
  athleteDateOfBirthSchema,
  athleteGenderRequiredSchema,
} from "@/validation/athleteOnboardingSchema";
import type { AthleteGender, AthleteUser } from "@shared/api";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { updateAthleteProfile } from "@/store/slices/athleteAuthSlice";

interface AthleteProfileCompletionFormProps {
  idPrefix?: string;
  onComplete: () => void;
  compact?: boolean;
}

export default function AthleteProfileCompletionForm({
  idPrefix = "profile-complete",
  onComplete,
  compact = false,
}: AthleteProfileCompletionFormProps) {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const { user, updatingProfile, error } = useAppSelector((s) => s.athleteAuth);

  const formik = useFormik({
    initialValues: {
      dateOfBirth: "",
      gender: "" as "" | AthleteGender,
    },
    validationSchema: Yup.object({
      dateOfBirth: athleteDateOfBirthSchema(t),
      gender: athleteGenderRequiredSchema(t),
    }),
    onSubmit: async (values) => {
      if (!user) return;
      const result = await dispatch(
        updateAthleteProfile(buildProfilePayload(user, values.dateOfBirth, values.gender)),
      );
      if (updateAthleteProfile.fulfilled.match(result)) {
        onComplete();
      }
    },
  });

  return (
    <div className={compact ? "space-y-4" : "space-y-5"}>
      {!compact ? (
        <div>
          <h2 className="text-lg font-bold text-white">
            {t("athletePortal.completeProfile.title")}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {t("athletePortal.completeProfile.subtitle")}
          </p>
        </div>
      ) : (
        <p className="text-sm text-gray-400">{t("athletePortal.completeProfile.wizardHint")}</p>
      )}
      <form onSubmit={formik.handleSubmit} className="space-y-4">
        <AthleteOnboardingFields
          idPrefix={idPrefix}
          requireGender
          dateOfBirth={formik.values.dateOfBirth}
          gender={formik.values.gender}
          onDateOfBirthChange={(v) => formik.setFieldValue("dateOfBirth", v)}
          onGenderChange={(v) => formik.setFieldValue("gender", v)}
          dateOfBirthError={
            formik.submitCount > 0 && formik.errors.dateOfBirth
              ? String(formik.errors.dateOfBirth)
              : undefined
          }
          genderError={
            formik.submitCount > 0 && formik.errors.gender
              ? String(formik.errors.gender)
              : undefined
          }
        />
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <Button
          type="submit"
          disabled={updatingProfile}
          className="w-full bg-gradient-to-r from-cyan to-blue-electric text-navy-deep font-bold"
        >
          {updatingProfile ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            t("athletePortal.completeProfile.submit")
          )}
        </Button>
      </form>
    </div>
  );
}

function buildProfilePayload(
  user: AthleteUser,
  dateOfBirth: string,
  gender: "" | AthleteGender,
) {
  return {
    first_name: user.firstName,
    last_name: user.lastName,
    country: user.country ?? "MX",
    date_of_birth: dateOfBirth,
    gender: gender || null,
  };
}

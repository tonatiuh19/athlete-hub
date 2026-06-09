import { Users } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { AthleteGender } from "@shared/api";
import { ATHLETE_GENDERS } from "@shared/api";
import DatePickerField from "@/components/ui/date-picker-field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface AthleteOnboardingFieldsProps {
  dateOfBirth: string;
  gender: AthleteGender | "";
  onDateOfBirthChange: (value: string) => void;
  onGenderChange: (value: AthleteGender | "") => void;
  dateOfBirthError?: string;
  genderError?: string;
  idPrefix?: string;
  /** When true, gender must be chosen explicitly (no skip / unset option). */
  requireGender?: boolean;
}

export default function AthleteOnboardingFields({
  dateOfBirth,
  gender,
  onDateOfBirthChange,
  onGenderChange,
  dateOfBirthError,
  genderError,
  idPrefix = "athlete",
  requireGender = false,
}: AthleteOnboardingFieldsProps) {
  const { t } = useTranslation();

  return (
    <>
      <div className="space-y-1.5">
        <label htmlFor={`${idPrefix}-dob`} className="block text-sm font-medium">
          {t("auth.athlete.dobLabel")}
        </label>
        <div className="relative">
          <DatePickerField
            id={`${idPrefix}-dob`}
            value={dateOfBirth}
            onChange={onDateOfBirthChange}
            variant="birthDate"
            showIcon
            invalid={Boolean(dateOfBirthError)}
            triggerClassName="relative w-full focus:border-cyan focus:ring-2 focus:ring-cyan/20"
          />
        </div>
        <p className="text-xs text-muted-foreground">{t("auth.athlete.dobHint")}</p>
        {dateOfBirthError ? (
          <p className="text-xs text-destructive">{dateOfBirthError}</p>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <label className="block text-sm font-medium">{t("auth.athlete.genderLabel")}</label>
        <div className="relative">
          <Users className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none z-10" />
          <Select
            value={requireGender ? gender || undefined : gender || "unset"}
            onValueChange={(v) =>
              onGenderChange(v === "unset" ? "" : (v as AthleteGender))
            }
          >
            <SelectTrigger className="h-12 pl-10 rounded-xl border-input bg-card/80">
              <SelectValue
                placeholder={
                  requireGender
                    ? t("auth.athlete.genderSelect")
                    : t("auth.athlete.genderOptional")
                }
              />
            </SelectTrigger>
            <SelectContent>
              {!requireGender ? (
                <SelectItem value="unset">{t("auth.athlete.genderOptional")}</SelectItem>
              ) : null}
              {ATHLETE_GENDERS.map((g) => (
                <SelectItem key={g} value={g}>
                  {t(`athletePortal.profile.gender.${g}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <p className="text-xs text-muted-foreground">{t("auth.athlete.genderHint")}</p>
        {genderError ? <p className="text-xs text-destructive">{genderError}</p> : null}
      </div>
    </>
  );
}

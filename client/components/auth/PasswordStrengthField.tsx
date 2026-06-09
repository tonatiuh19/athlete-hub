import { useMemo, useState } from "react";
import { Check, Eye, EyeOff, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  type PasswordRequirementKey,
  validateAthletePassword,
} from "@shared/passwordPolicy";
import { cn } from "@/lib/utils";

const REQUIREMENT_KEYS: PasswordRequirementKey[] = [
  "minLength",
  "uppercase",
  "lowercase",
  "number",
  "special",
];

const STRENGTH_LABEL_KEYS = [
  "auth.password.strength.weak",
  "auth.password.strength.fair",
  "auth.password.strength.good",
  "auth.password.strength.strong",
  "auth.password.strength.excellent",
] as const;

interface PasswordStrengthFieldProps {
  id: string;
  name?: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  autoComplete?: string;
  autoFocus?: boolean;
  error?: string;
  showRequirements?: boolean;
}

export default function PasswordStrengthField({
  id,
  name,
  value,
  onChange,
  onBlur,
  placeholder,
  autoComplete = "new-password",
  autoFocus,
  error,
  showRequirements = true,
}: PasswordStrengthFieldProps) {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  const validation = useMemo(() => validateAthletePassword(value), [value]);
  const strengthLabel = t(STRENGTH_LABEL_KEYS[validation.score]);
  const barWidth = `${((validation.score + 1) / 5) * 100}%`;

  return (
    <div className="space-y-2">
      <div className="relative">
        <input
          id={id}
          name={name}
          type={visible ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          placeholder={placeholder}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          className={cn(
            "w-full h-12 pl-4 pr-11 rounded-xl border bg-card/80 outline-none transition-all text-sm",
            error
              ? "border-destructive focus:ring-2 focus:ring-destructive/20"
              : "border-input focus:border-cyan focus:ring-2 focus:ring-cyan/20",
          )}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          aria-label={visible ? t("auth.password.hide") : t("auth.password.show")}
        >
          {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>

      {value.length > 0 && (
        <div className="space-y-1.5 animate-fade-in">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-muted-foreground">{t("auth.password.strengthLabel")}</span>
            <span
              className={cn(
                "font-medium",
                validation.score <= 1
                  ? "text-destructive"
                  : validation.score <= 2
                    ? "text-muted-foreground"
                    : "text-accent",
              )}
            >
              {strengthLabel}
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-300",
                validation.score <= 1
                  ? "bg-destructive"
                  : validation.score <= 2
                    ? "bg-muted-foreground/60"
                    : "bg-accent",
              )}
              style={{ width: barWidth }}
            />
          </div>
        </div>
      )}

      {showRequirements && (
        <ul className="grid gap-1.5 pt-1">
          {REQUIREMENT_KEYS.map((key) => {
            const met = !validation.failedRequirements.includes(key);
            return (
              <li
                key={key}
                className={cn(
                  "flex items-center gap-2 text-xs transition-colors",
                  met ? "text-accent" : "text-muted-foreground",
                )}
              >
                {met ? (
                  <Check className="w-3.5 h-3.5 shrink-0" />
                ) : (
                  <X className="w-3.5 h-3.5 shrink-0 opacity-60" />
                )}
                {t(`auth.password.requirements.${key}`)}
              </li>
            );
          })}
        </ul>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

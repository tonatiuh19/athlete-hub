import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { LEGAL_ROUTES } from "@shared/siteLegal";
import { cn } from "@/lib/utils";

type LegalConsentVariant = "athleteRegister" | "checkout" | "organizerRegister";

interface LegalConsentNoticeProps {
  variant: LegalConsentVariant;
  className?: string;
  /** Required checkbox mode for registration flows */
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  showCheckbox?: boolean;
  id?: string;
  error?: string | null;
}

export default function LegalConsentNotice({
  variant,
  className,
  checked = false,
  onCheckedChange,
  showCheckbox = false,
  id = "legal-consent",
  error = null,
}: LegalConsentNoticeProps) {
  const { t } = useTranslation();

  const messageKey =
    variant === "organizerRegister"
      ? "legal.consent.organizerRegister"
      : variant === "checkout"
        ? "legal.consent.checkout"
        : "legal.consent.athleteRegister";

  const body = (
    <span className="text-xs text-muted-foreground leading-relaxed">
      {t(messageKey)}{" "}
      <Link to={LEGAL_ROUTES.terms} className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">
        {t("legal.links.terms")}
      </Link>
      {" · "}
      <Link to={LEGAL_ROUTES.privacy} className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">
        {t("legal.links.privacy")}
      </Link>
      {variant === "organizerRegister" ? (
        <>
          {" · "}
          <Link
            to={LEGAL_ROUTES["organizer-terms"]}
            className="text-primary hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            {t("legal.links.organizerTerms")}
          </Link>
        </>
      ) : null}
    </span>
  );

  if (!showCheckbox) {
    return <div className={cn("rounded-lg border border-border/60 bg-card/40 p-3", className)}>{body}</div>;
  }

  return (
    <div className={cn("space-y-2", className)}>
      <label htmlFor={id} className="flex items-start gap-3 cursor-pointer">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(e) => onCheckedChange?.(e.target.checked)}
          className="mt-1 h-4 w-4 shrink-0 rounded border-input accent-primary"
        />
        {body}
      </label>
      {error ? (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function LegalFooterLinks({ className }: { className?: string }) {
  const { t } = useTranslation();
  return (
    <span className={cn("inline-flex flex-wrap items-center gap-x-2 gap-y-1", className)}>
      <Link to={LEGAL_ROUTES.privacy} className="hover:text-primary transition-colors">
        {t("legal.links.privacy")}
      </Link>
      <span className="text-muted-foreground/50">·</span>
      <Link to={LEGAL_ROUTES.terms} className="hover:text-primary transition-colors">
        {t("legal.links.terms")}
      </Link>
    </span>
  );
}

import { Globe } from "lucide-react";
import { useTranslation } from "react-i18next";
import { normalizeLocale, type AppLocale, LOCALE_LABELS } from "@shared/i18n";

interface LanguageSwitcherProps {
  variant?: "default" | "compact" | "ghost";
  className?: string;
  /** Persist locale (e.g. staff/athlete preferred_language). Called after i18n updates. */
  onLanguageChange?: (locale: AppLocale) => void | Promise<void>;
}

export default function LanguageSwitcher({
  variant = "default",
  className = "",
  onLanguageChange,
}: LanguageSwitcherProps) {
  const { i18n, t } = useTranslation();
  const current = normalizeLocale(i18n.language);

  const toggle = () => {
    const next: AppLocale = current === "es" ? "en" : "es";
    void (async () => {
      await i18n.changeLanguage(next);
      await onLanguageChange?.(next);
    })();
  };

  const base =
    variant === "compact"
      ? "px-2.5 py-1.5 text-xs rounded-lg"
      : variant === "ghost"
        ? "px-3 py-2 text-xs rounded-xl"
        : "px-3 py-2 text-sm rounded-xl";

  return (
    <button
      type="button"
      onClick={toggle}
      title={t("common.language")}
      aria-label={t("common.language")}
      className={`inline-flex items-center gap-1.5 border border-border bg-card/60 hover:border-cyan/40 hover:bg-cyan/5 text-muted-foreground hover:text-primary transition-all ${base} ${className}`}
    >
      <Globe className="w-3.5 h-3.5 shrink-0" />
      <span className="font-medium">{LOCALE_LABELS[current]}</span>
    </button>
  );
}

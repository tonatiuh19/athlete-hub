import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { LOCALE_HTML_LANG, normalizeLocale } from "@shared/i18n";

/** Keeps document lang + axios Accept-Language in sync with i18n */
export default function I18nSync() {
  const { i18n } = useTranslation();

  useEffect(() => {
    const locale = normalizeLocale(i18n.language);
    document.documentElement.lang = LOCALE_HTML_LANG[locale];
  }, [i18n.language]);

  return null;
}

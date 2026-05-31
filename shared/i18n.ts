/** Supported app locales — Spanish (Mexico) default, English US */
export type AppLocale = "es" | "en";

export const DEFAULT_LOCALE: AppLocale = "es";
export const SUPPORTED_LOCALES: AppLocale[] = ["es", "en"];

const LOCALE_STORAGE_KEY = "athlete_hub_locale";

/** Normalize browser / DB / header values to es | en */
export function normalizeLocale(input?: string | null): AppLocale {
  if (!input) return DEFAULT_LOCALE;
  const tag = input.trim().toLowerCase();
  if (tag.startsWith("en")) return "en";
  if (tag.startsWith("es")) return "es";
  return DEFAULT_LOCALE;
}

/** Parse Accept-Language header (first supported match) */
export function localeFromAcceptLanguage(
  header?: string | null,
): AppLocale | null {
  if (!header) return null;
  const parts = header.split(",").map((p) => p.split(";")[0]?.trim());
  for (const part of parts) {
    const normalized = normalizeLocale(part);
    if (SUPPORTED_LOCALES.includes(normalized)) return normalized;
  }
  return null;
}

/** Browser navigator.language with es default */
export function detectBrowserLocale(): AppLocale {
  if (typeof navigator === "undefined") return DEFAULT_LOCALE;
  return normalizeLocale(navigator.language);
}

export function getStoredLocale(): AppLocale | null {
  if (typeof localStorage === "undefined") return null;
  const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
  return stored ? normalizeLocale(stored) : null;
}

export function setStoredLocale(locale: AppLocale): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(LOCALE_STORAGE_KEY, locale);
}

export function resolveLocale(
  ...candidates: (string | null | undefined)[]
): AppLocale {
  for (const c of candidates) {
    if (c) return normalizeLocale(c);
  }
  return DEFAULT_LOCALE;
}

export const LOCALE_LABELS: Record<AppLocale, string> = {
  es: "Español",
  en: "English",
};

export const LOCALE_HTML_LANG: Record<AppLocale, string> = {
  es: "es-MX",
  en: "en",
};

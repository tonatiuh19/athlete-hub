import { LOCALE_HTML_LANG, type AppLocale } from "@shared/i18n";

export const SITE_NAME = "Athlete Hub";
export const SITE_TWITTER_HANDLE = "@AthleteHub";

export const DEFAULT_OG_IMAGE =
  "https://images.unsplash.com/photo-1571008887538-b36bb08c457a?w=1200&h=630&q=80&auto=format&fit=crop";

export const DEFAULT_DESCRIPTION =
  "Discover and register for sports events across Mexico and Latin America. Triathlons, marathons, trails, and elite athlete communities.";

export const DEFAULT_KEYWORDS = [
  "sports events",
  "race registration",
  "triathlon",
  "marathon",
  "trail running",
  "Mexico",
  "Latin America",
  "athletes",
];

/** Open Graph locale tags (underscore format) */
export const OG_LOCALE: Record<AppLocale, string> = {
  es: "es_MX",
  en: "en_US",
};

/** Resolve public site origin for canonical / OG URLs */
export function getSiteOrigin(): string {
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin.replace(/\/$/, "");
  }
  const fromEnv = import.meta.env.VITE_PUBLIC_APP_URL;
  if (typeof fromEnv === "string" && fromEnv.length > 0) {
    return fromEnv.replace(/\/$/, "");
  }
  return "http://localhost:8080";
}

/** Build absolute URL from path or pass-through if already absolute */
export function resolveAbsoluteUrl(pathOrUrl: string, origin = getSiteOrigin()): string {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  const path = pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`;
  return `${origin}${path}`;
}

/** Resolve image to absolute URL for crawlers */
export function resolveAbsoluteImage(
  image?: string | null,
  fallback = DEFAULT_OG_IMAGE,
): string {
  if (!image?.trim()) return fallback;
  return resolveAbsoluteUrl(image.trim());
}

export function formatDocumentTitle(
  title: string,
  options?: { siteName?: string; withSiteSuffix?: boolean },
): string {
  const siteName = options?.siteName ?? SITE_NAME;
  const withSiteSuffix = options?.withSiteSuffix ?? true;
  if (!withSiteSuffix) return title.trim();
  const normalized = title.trim();
  if (normalized.toLowerCase().includes(siteName.toLowerCase())) return normalized;
  return `${normalized} · ${siteName}`;
}

export function truncateMetaText(text: string, maxLength = 160): string {
  const trimmed = text.replace(/\s+/g, " ").trim();
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, maxLength - 1).trimEnd()}…`;
}

export function normalizeKeywords(keywords?: string | string[]): string | undefined {
  if (!keywords) return undefined;
  const list = (Array.isArray(keywords) ? keywords : keywords.split(","))
    .map((k) => k.trim())
    .filter(Boolean);
  return list.length > 0 ? list.join(", ") : undefined;
}

export function getOgLocaleFromAppLocale(locale: AppLocale): string {
  return OG_LOCALE[locale];
}

export function getHtmlLangFromAppLocale(locale: AppLocale): string {
  return LOCALE_HTML_LANG[locale];
}

/** Private/authenticated areas should not be indexed */
export function isPrivateRoute(pathname: string): boolean {
  return (
    pathname.startsWith("/portal") ||
    pathname.startsWith("/staff") ||
    pathname.startsWith("/sso-callback") ||
    pathname.startsWith("/admin")
  );
}

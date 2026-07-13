import { LOCALE_HTML_LANG, type AppLocale } from "@shared/i18n";

export const SITE_NAME = "Triboo Sport";
export const SITE_TAGLINE =
  "Discover and register for sports events across Mexico and Latin America.";
export const SITE_TWITTER_HANDLE = "@TribooSport";

/** Preferred 1200×630 share image — override via VITE_DEFAULT_OG_IMAGE */
export const DEFAULT_OG_IMAGE =
  (typeof import.meta.env.VITE_DEFAULT_OG_IMAGE === "string" &&
    import.meta.env.VITE_DEFAULT_OG_IMAGE.trim()) ||
  "https://disruptinglabs.com/data/athlete-hub/assets/images/og/triboo-sport-share.jpg";

export const DEFAULT_OG_IMAGE_WIDTH = 1200;
export const DEFAULT_OG_IMAGE_HEIGHT = 630;
export const DEFAULT_OG_IMAGE_ALT = "Triboo Sport — sports events and athlete community";

export const THEME_COLOR_DARK = "#05070D";
export const THEME_COLOR_LIGHT = "#f5f6f9";
export const THEME_COLOR = THEME_COLOR_DARK;

export const DEFAULT_DESCRIPTION =
  "Connect. Participate. Push your limits. Discover and register for triathlons, marathons, trails, and races across Mexico and Latin America.";

export const DEFAULT_KEYWORDS = [
  "Triboo Sport",
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

export interface MetaSocialImage {
  url: string;
  alt?: string;
  width?: number;
  height?: number;
  type?: string;
}

export type MetaSocialImageInput = string | MetaSocialImage;

export interface ResolvedMetaImage extends MetaSocialImage {
  url: string;
  alt: string;
  secureUrl: string;
}

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

/** Resolve a single image to absolute URL for crawlers */
export function resolveAbsoluteImage(
  image?: string | null,
  fallback = DEFAULT_OG_IMAGE,
): string {
  if (!image?.trim()) return resolveAbsoluteUrl(fallback);
  return resolveAbsoluteUrl(image.trim());
}

export function inferImageMimeType(url: string): string | undefined {
  const ext = url.split("?")[0]?.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    case "gif":
      return "image/gif";
    case "svg":
      return "image/svg+xml";
    default:
      return undefined;
  }
}

function toHttpsUrl(url: string): string {
  return url.replace(/^http:\/\//i, "https://");
}

function normalizeImageInput(
  input: MetaSocialImageInput,
  defaultAlt: string,
  origin: string,
  defaults?: { width?: number; height?: number; type?: string },
): ResolvedMetaImage {
  const raw =
    typeof input === "string"
      ? { url: input, alt: defaultAlt }
      : { alt: defaultAlt, ...input };

  const url = resolveAbsoluteUrl(raw.url, origin);
  const width = raw.width ?? defaults?.width;
  const height = raw.height ?? defaults?.height;
  const type = raw.type ?? inferImageMimeType(url) ?? defaults?.type;

  return {
    url,
    secureUrl: toHttpsUrl(url),
    alt: raw.alt?.trim() || defaultAlt,
    ...(width ? { width } : {}),
    ...(height ? { height } : {}),
    ...(type ? { type } : {}),
  };
}

/** One or more share images; always returns at least the default OG asset */
export function resolveMetaImages(options: {
  image?: string | null;
  images?: MetaSocialImageInput[];
  imageWidth?: number;
  imageHeight?: number;
  imageType?: string;
  defaultAlt: string;
  origin?: string;
}): ResolvedMetaImage[] {
  const origin = options.origin ?? getSiteOrigin();
  const defaults = {
    width: options.imageWidth ?? DEFAULT_OG_IMAGE_WIDTH,
    height: options.imageHeight ?? DEFAULT_OG_IMAGE_HEIGHT,
    type: options.imageType,
  };

  const inputs: MetaSocialImageInput[] = [];
  if (options.images?.length) {
    inputs.push(...options.images);
  } else if (options.image?.trim()) {
    inputs.push({
      url: options.image,
      alt: options.defaultAlt,
      width: options.imageWidth,
      height: options.imageHeight,
      type: options.imageType,
    });
  }

  if (inputs.length === 0) {
    return [
      normalizeImageInput(
        {
          url: DEFAULT_OG_IMAGE,
          alt: DEFAULT_OG_IMAGE_ALT,
          width: DEFAULT_OG_IMAGE_WIDTH,
          height: DEFAULT_OG_IMAGE_HEIGHT,
        },
        options.defaultAlt,
        origin,
      ),
    ];
  }

  return inputs.map((item, index) =>
    normalizeImageInput(
      item,
      options.defaultAlt,
      origin,
      index === 0 ? defaults : undefined,
    ),
  );
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
    pathname === "/login" ||
    pathname.startsWith("/portal") ||
    pathname.startsWith("/staff") ||
    pathname.startsWith("/sso-callback") ||
    pathname.startsWith("/admin")
  );
}

/** hreflang target — same path; locale is client-side (i18n) */
export function buildPublicAlternateUrl(
  pageUrl: string,
  locale: AppLocale,
): string {
  try {
    const url = new URL(pageUrl);
    url.searchParams.set("lang", locale);
    return url.toString();
  } catch {
    return pageUrl;
  }
}

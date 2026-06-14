/** CDN upload URL normalization — shared by client display and server persistence. */

const STATIC_CDN_PREFIXES = [
  "/data/triboo/assets/",
  "/data/athlete-hub/assets/",
  "/data/optimum/assets/",
  "/data/encore/assets/",
  "/data/intelinota/assets/",
];

const UPLOADED_CDN_PATH =
  /^https:\/\/disruptinglabs\.com\/data\/([a-zA-Z0-9_-]+)\/([a-zA-Z0-9_-]+)\/(main_image|images|files|pdfs)\//;

/**
 * Fix legacy CDN upload URLs missing the /data/api prefix.
 * Without it, Apache serves SPA HTML and <img> requests fail.
 */
export function normalizeCdnUploadUrl(url: string): string;
export function normalizeCdnUploadUrl(url: string | null | undefined): string | null;
export function normalizeCdnUploadUrl(url: string | null | undefined): string | null {
  if (!url?.trim()) return null;
  const trimmed = url.trim();
  if (!trimmed.includes("disruptinglabs.com/data/")) return trimmed;
  if (trimmed.includes("disruptinglabs.com/data/api/")) return trimmed;

  try {
    const parsed = new URL(trimmed);
    if (STATIC_CDN_PREFIXES.some((prefix) => parsed.pathname.startsWith(prefix))) {
      return trimmed;
    }
    if (UPLOADED_CDN_PATH.test(trimmed)) {
      return trimmed.replace(
        "disruptinglabs.com/data/",
        "disruptinglabs.com/data/api/data/",
      );
    }
  } catch {
    return trimmed;
  }

  return trimmed;
}

/** Normalize event hero/banner URLs for API responses and UI. */
export function normalizeEventMediaUrl(url: string | null | undefined): string | null {
  return normalizeCdnUploadUrl(url);
}

/** Target max width for public event image display contexts. */
export type EventMediaDisplaySize = "thumb" | "card" | "featured" | "detail" | "banner" | "full";

const EVENT_MEDIA_DISPLAY_WIDTH: Record<Exclude<EventMediaDisplaySize, "full">, number> = {
  thumb: 120,
  card: 480,
  featured: 640,
  detail: 1280,
  banner: 1600,
};

const EVENT_MEDIA_JPEG_QUALITY: Record<Exclude<EventMediaDisplaySize, "full">, number> = {
  thumb: 70,
  card: 72,
  featured: 75,
  detail: 78,
  banner: 80,
};

function isUnsplashHost(hostname: string): boolean {
  return hostname === "images.unsplash.com" || hostname.endsWith(".unsplash.com");
}

function optimizeUnsplashUrl(url: URL, width: number, quality: number): string {
  url.searchParams.set("w", String(Math.max(1, Math.round(width))));
  url.searchParams.set("q", String(Math.min(100, Math.max(50, Math.round(quality)))));
  url.searchParams.set("auto", "format");
  url.searchParams.set("fit", "crop");
  return url.toString();
}

/**
 * Returns a display-appropriate image URL. Unsplash URLs get width/quality params;
 * CDN uploads are returned normalized (rely on upload compression for byte size).
 */
export function optimizeEventMediaUrl(
  url: string | null | undefined,
  size: EventMediaDisplaySize = "card",
): string | null {
  const normalized = normalizeEventMediaUrl(url);
  if (!normalized || size === "full") return normalized;

  try {
    const parsed = new URL(normalized);
    if (!isUnsplashHost(parsed.hostname)) return normalized;
    const width = EVENT_MEDIA_DISPLAY_WIDTH[size];
    const quality = EVENT_MEDIA_JPEG_QUALITY[size];
    return optimizeUnsplashUrl(parsed, width, quality);
  } catch {
    return normalized;
  }
}

/** Responsive srcset for Unsplash event images; undefined for CDN URLs. */
export function buildEventMediaSrcSet(
  url: string | null | undefined,
  size: EventMediaDisplaySize = "card",
): string | undefined {
  const normalized = normalizeEventMediaUrl(url);
  if (!normalized || size === "full") return undefined;

  try {
    const parsed = new URL(normalized);
    if (!isUnsplashHost(parsed.hostname)) return undefined;

    const width1 = EVENT_MEDIA_DISPLAY_WIDTH[size];
    const width2 = Math.min(width1 * 2, 1920);
    const quality = EVENT_MEDIA_JPEG_QUALITY[size];
    const url1 = optimizeUnsplashUrl(new URL(normalized), width1, quality);
    if (width2 <= width1) return `${url1} ${width1}w`;
    const url2 = optimizeUnsplashUrl(new URL(normalized), width2, quality);
    return `${url1} ${width1}w, ${url2} ${width2}w`;
  } catch {
    return undefined;
  }
}

/** Suggested sizes attribute for common event card layouts. */
export function eventMediaSizesAttr(size: EventMediaDisplaySize): string | undefined {
  switch (size) {
    case "thumb":
      return "48px";
    case "card":
      return "(max-width: 640px) 108px, (max-width: 1024px) 280px, 480px";
    case "featured":
      return "(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 640px";
    case "detail":
      return "100vw";
    case "banner":
      return "100vw";
    default:
      return undefined;
  }
}

const STAFF_PROXY_HOST = "disruptinglabs.com";

/** CDN URLs staff may re-fetch server-side (avoids browser CORS on re-crop). */
export function isStaffProxyableImageUrl(url: string): boolean {
  if (!url?.trim()) return false;
  try {
    const normalized = normalizeCdnUploadUrl(url.trim()) ?? url.trim();
    const parsed = new URL(normalized);
    if (parsed.protocol !== "https:") return false;
    if (parsed.hostname !== STAFF_PROXY_HOST) return false;
    if (!parsed.pathname.startsWith("/data/")) return false;
    if (STATIC_CDN_PREFIXES.some((prefix) => parsed.pathname.startsWith(prefix))) {
      return true;
    }
    return UPLOADED_CDN_PATH.test(normalized) || parsed.pathname.includes("/data/api/");
  } catch {
    return false;
  }
}

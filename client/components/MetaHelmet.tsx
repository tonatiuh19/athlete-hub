import { Helmet } from "react-helmet-async";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";
import {
  DEFAULT_DESCRIPTION,
  DEFAULT_KEYWORDS,
  DEFAULT_OG_IMAGE,
  SITE_NAME,
  SITE_TWITTER_HANDLE,
  formatDocumentTitle,
  getHtmlLangFromAppLocale,
  getOgLocaleFromAppLocale,
  getSiteOrigin,
  isPrivateRoute,
  normalizeKeywords,
  resolveAbsoluteImage,
  resolveAbsoluteUrl,
  truncateMetaText,
} from "@/lib/siteMeta";
import { normalizeLocale, SUPPORTED_LOCALES, type AppLocale } from "@shared/i18n";

export interface MetaHelmetProps {
  /** Page title (site suffix applied by default) */
  title: string;
  /** Append " · Athlete Hub" to document title */
  withSiteSuffix?: boolean;
  description?: string;
  keywords?: string | string[];
  /** OG / Twitter image — absolute or site-relative URL */
  image?: string | null;
  imageAlt?: string;
  /** Path or absolute URL; defaults to current route */
  path?: string;
  /** Override canonical URL (path or absolute) */
  canonical?: string;
  ogType?: "website" | "article" | "profile";
  /** e.g. index,follow or noindex,nofollow */
  robots?: string;
  /** Shortcut for private pages — sets noindex,nofollow */
  noindex?: boolean;
  /** Override document html lang (defaults from i18n) */
  locale?: AppLocale;
  /** hreflang alternates for public pages */
  alternateLocales?: boolean;
  /** JSON-LD structured data (single object or array) */
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
  /** Extra head nodes (additional meta, link, script) */
  children?: React.ReactNode;
}

function buildJsonLdScripts(
  jsonLd: Record<string, unknown> | Record<string, unknown>[],
): React.ReactNode {
  const items = Array.isArray(jsonLd) ? jsonLd : [jsonLd];
  return items.map((item, index) => (
    <script
      // eslint-disable-next-line react/no-danger
      key={`jsonld-${index}`}
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(item) }}
    />
  ));
}

export default function MetaHelmet({
  title,
  withSiteSuffix = true,
  description,
  keywords,
  image,
  imageAlt,
  path,
  canonical,
  ogType = "website",
  robots,
  noindex = false,
  locale: localeProp,
  alternateLocales = false,
  jsonLd,
  children,
}: MetaHelmetProps) {
  const { i18n } = useTranslation();
  const { pathname, search } = useLocation();

  const locale = localeProp ?? normalizeLocale(i18n.language);
  const htmlLang = getHtmlLangFromAppLocale(locale);
  const ogLocale = getOgLocaleFromAppLocale(locale);

  const meta = useMemo(() => {
    const origin = getSiteOrigin();
    const routePath = path ?? `${pathname}${search}`;
    const pageUrl = resolveAbsoluteUrl(routePath, origin);
    const canonicalUrl = canonical
      ? resolveAbsoluteUrl(canonical, origin)
      : pageUrl;
    const pageTitle = formatDocumentTitle(title, { withSiteSuffix });
    const pageDescription = truncateMetaText(description?.trim() || DEFAULT_DESCRIPTION);
    const pageKeywords = normalizeKeywords(keywords) ?? DEFAULT_KEYWORDS.join(", ");
    const pageImage = resolveAbsoluteImage(image);
    const pageImageAlt = imageAlt?.trim() || pageTitle;
    const shouldNoindex = noindex || isPrivateRoute(pathname);
    const robotsContent =
      robots ?? (shouldNoindex ? "noindex, nofollow" : "index, follow");

    const alternateLinks =
      alternateLocales && !shouldNoindex
        ? SUPPORTED_LOCALES.map((loc) => ({
            locale: loc,
            hrefLang: getHtmlLangFromAppLocale(loc),
            href: pageUrl,
          }))
        : [];

    const ogAlternateLocales = SUPPORTED_LOCALES.filter((loc) => loc !== locale).map(
      (loc) => getOgLocaleFromAppLocale(loc),
    );

    return {
      pageTitle,
      pageDescription,
      pageKeywords,
      pageImage,
      pageImageAlt,
      pageUrl,
      canonicalUrl,
      robotsContent,
      alternateLinks,
      ogAlternateLocales,
    };
  }, [
    title,
    withSiteSuffix,
    description,
    keywords,
    image,
    imageAlt,
    path,
    canonical,
    pathname,
    search,
    noindex,
    alternateLocales,
    locale,
  ]);

  return (
    <Helmet prioritizeSeoTags htmlAttributes={{ lang: htmlLang }}>
      <title>{meta.pageTitle}</title>
      <meta name="description" content={meta.pageDescription} />
      <meta name="keywords" content={meta.pageKeywords} />
      <meta name="robots" content={meta.robotsContent} />
      <meta name="author" content={SITE_NAME} />
      <meta name="application-name" content={SITE_NAME} />
      <meta name="theme-color" content="#0A0F1F" />

      <link rel="canonical" href={meta.canonicalUrl} />

      {meta.alternateLinks.map(({ hrefLang, href }) => (
        <link key={hrefLang} rel="alternate" hrefLang={hrefLang} href={href} />
      ))}
      <link rel="alternate" hrefLang="x-default" href={meta.pageUrl} />

      {/* Open Graph */}
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:title" content={meta.pageTitle} />
      <meta property="og:description" content={meta.pageDescription} />
      <meta property="og:type" content={ogType} />
      <meta property="og:url" content={meta.pageUrl} />
      <meta property="og:locale" content={ogLocale} />
      {meta.ogAlternateLocales.map((alt) => (
        <meta key={alt} property="og:locale:alternate" content={alt} />
      ))}
      <meta property="og:image" content={meta.pageImage} />
      <meta property="og:image:secure_url" content={meta.pageImage} />
      <meta property="og:image:alt" content={meta.pageImageAlt} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:site" content={SITE_TWITTER_HANDLE} />
      <meta name="twitter:title" content={meta.pageTitle} />
      <meta name="twitter:description" content={meta.pageDescription} />
      <meta name="twitter:image" content={meta.pageImage} />
      <meta name="twitter:image:alt" content={meta.pageImageAlt} />

      {jsonLd && buildJsonLdScripts(jsonLd)}
      {children}
    </Helmet>
  );
}

/** Re-export defaults for pages building custom JSON-LD */
export { DEFAULT_OG_IMAGE, SITE_NAME };

import { useMemo, type ReactNode } from "react";
import { Helmet } from "react-helmet-async";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";
import {
  DEFAULT_DESCRIPTION,
  DEFAULT_KEYWORDS,
  DEFAULT_OG_IMAGE,
  DEFAULT_OG_IMAGE_ALT,
  DEFAULT_OG_IMAGE_HEIGHT,
  DEFAULT_OG_IMAGE_WIDTH,
  SITE_NAME,
  SITE_TWITTER_HANDLE,
  THEME_COLOR,
  buildPublicAlternateUrl,
  formatDocumentTitle,
  getHtmlLangFromAppLocale,
  getOgLocaleFromAppLocale,
  getSiteOrigin,
  isPrivateRoute,
  normalizeKeywords,
  resolveAbsoluteUrl,
  resolveMetaImages,
  truncateMetaText,
  type MetaSocialImageInput,
  type ResolvedMetaImage,
} from "@/lib/siteMeta";
import { normalizeLocale, SUPPORTED_LOCALES, type AppLocale } from "@shared/i18n";

export interface MetaHelmetProps {
  /** Document & social title (site suffix applied by default) */
  title: string;
  withSiteSuffix?: boolean;
  /** Override Open Graph / Twitter title (defaults to document title) */
  ogTitle?: string;
  description?: string;
  ogDescription?: string;
  keywords?: string | string[];
  /** Primary share image — absolute or site-relative URL */
  image?: string | null;
  /** Additional images (e.g. gallery); first entry is primary for Twitter */
  images?: MetaSocialImageInput[];
  imageAlt?: string;
  imageWidth?: number;
  imageHeight?: number;
  imageType?: string;
  /** Path or absolute URL; defaults to current route */
  path?: string;
  canonical?: string;
  ogType?: "website" | "article" | "profile";
  robots?: string;
  noindex?: boolean;
  locale?: AppLocale;
  alternateLocales?: boolean;
  publishedTime?: string;
  modifiedTime?: string;
  articleAuthor?: string;
  articleSection?: string;
  articleTags?: string[];
  twitterCard?: "summary" | "summary_large_image";
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
  children?: ReactNode;
}

/** Helmet only accepts native head tags — never wrap meta/link in function components */
function openGraphImageElements(images: ResolvedMetaImage[]): ReactNode[] {
  return images.flatMap((img) => {
    const tags: ReactNode[] = [
      <meta key={`${img.url}-og`} property="og:image" content={img.url} />,
      <meta
        key={`${img.url}-secure`}
        property="og:image:secure_url"
        content={img.secureUrl}
      />,
      <meta key={`${img.url}-alt`} property="og:image:alt" content={img.alt} />,
    ];
    if (img.width != null) {
      tags.push(
        <meta
          key={`${img.url}-w`}
          property="og:image:width"
          content={String(img.width)}
        />,
      );
    }
    if (img.height != null) {
      tags.push(
        <meta
          key={`${img.url}-h`}
          property="og:image:height"
          content={String(img.height)}
        />,
      );
    }
    if (img.type) {
      tags.push(
        <meta key={`${img.url}-type`} property="og:image:type" content={img.type} />,
      );
    }
    return tags;
  });
}

function jsonLdScriptElements(
  jsonLd: Record<string, unknown> | Record<string, unknown>[],
): ReactNode[] {
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
  ogTitle,
  description,
  ogDescription,
  keywords,
  image,
  images,
  imageAlt,
  imageWidth,
  imageHeight,
  imageType,
  path,
  canonical,
  ogType = "website",
  robots,
  noindex = false,
  locale: localeProp,
  alternateLocales = false,
  publishedTime,
  modifiedTime,
  articleAuthor,
  articleSection,
  articleTags,
  twitterCard,
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
    const canonicalUrl = canonical ? resolveAbsoluteUrl(canonical, origin) : pageUrl;

    const pageTitle = formatDocumentTitle(title, { withSiteSuffix });
    const socialTitle = ogTitle?.trim() || pageTitle;
    const pageDescription = truncateMetaText(
      description?.trim() || DEFAULT_DESCRIPTION,
    );
    const socialDescription = truncateMetaText(
      ogDescription?.trim() || description?.trim() || DEFAULT_DESCRIPTION,
    );
    const pageKeywords = normalizeKeywords(keywords) ?? DEFAULT_KEYWORDS.join(", ");
    const shouldNoindex = noindex || isPrivateRoute(pathname);
    const robotsContent =
      robots ?? (shouldNoindex ? "noindex, nofollow" : "index, follow");

    const shareImages = resolveMetaImages({
      image,
      images,
      imageWidth,
      imageHeight,
      imageType,
      defaultAlt: imageAlt?.trim() || socialTitle,
      origin,
    });

    const card: "summary" | "summary_large_image" =
      twitterCard ?? "summary_large_image";

    const alternateLinks =
      alternateLocales && !shouldNoindex
        ? SUPPORTED_LOCALES.map((loc) => ({
            locale: loc,
            hrefLang: getHtmlLangFromAppLocale(loc),
            href: buildPublicAlternateUrl(canonicalUrl, loc),
          }))
        : [];

    const ogAlternateLocales = SUPPORTED_LOCALES.filter((loc) => loc !== locale).map(
      (loc) => getOgLocaleFromAppLocale(loc),
    );

    const xDefaultHref =
      alternateLinks.find((l) => l.locale === "es")?.href ?? canonicalUrl;

    return {
      pageTitle,
      socialTitle,
      pageDescription,
      socialDescription,
      pageKeywords,
      shareImages,
      pageUrl,
      canonicalUrl,
      robotsContent,
      alternateLinks,
      ogAlternateLocales,
      xDefaultHref,
      card,
    };
  }, [
    title,
    withSiteSuffix,
    ogTitle,
    description,
    ogDescription,
    keywords,
    image,
    images,
    imageAlt,
    imageWidth,
    imageHeight,
    imageType,
    path,
    canonical,
    pathname,
    search,
    noindex,
    alternateLocales,
    locale,
    twitterCard,
  ]);

  const primaryImage = meta.shareImages[0];

  return (
    <Helmet prioritizeSeoTags htmlAttributes={{ lang: htmlLang }}>
      <title>{meta.pageTitle}</title>

      <meta name="title" content={meta.pageTitle} />
      <meta name="description" content={meta.pageDescription} />
      <meta name="keywords" content={meta.pageKeywords} />
      <meta name="robots" content={meta.robotsContent} />
      <meta name="googlebot" content={meta.robotsContent} />
      <meta name="author" content={SITE_NAME} />
      <meta name="application-name" content={SITE_NAME} />
      <meta name="theme-color" content={THEME_COLOR} />
      <meta name="color-scheme" content="dark" />
      <meta name="format-detection" content="telephone=no" />

      <meta itemProp="name" content={meta.socialTitle} />
      <meta itemProp="description" content={meta.socialDescription} />
      {primaryImage ? (
        <meta itemProp="image" content={primaryImage.secureUrl} />
      ) : null}

      <link rel="canonical" href={meta.canonicalUrl} />

      {meta.alternateLinks.map(({ hrefLang, href }) => (
        <link key={hrefLang} rel="alternate" hrefLang={hrefLang} href={href} />
      ))}
      {meta.alternateLinks.length > 0 ? (
        <link rel="alternate" hrefLang="x-default" href={meta.xDefaultHref} />
      ) : null}

      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:title" content={meta.socialTitle} />
      <meta property="og:description" content={meta.socialDescription} />
      <meta property="og:type" content={ogType} />
      <meta property="og:url" content={meta.canonicalUrl} />
      <meta property="og:locale" content={ogLocale} />
      {meta.ogAlternateLocales.map((alt) => (
        <meta key={alt} property="og:locale:alternate" content={alt} />
      ))}

      {openGraphImageElements(meta.shareImages)}

      {ogType === "article" && publishedTime ? (
        <meta property="article:published_time" content={publishedTime} />
      ) : null}
      {ogType === "article" && modifiedTime ? (
        <meta property="article:modified_time" content={modifiedTime} />
      ) : null}
      {ogType === "article" && articleAuthor ? (
        <meta property="article:author" content={articleAuthor} />
      ) : null}
      {ogType === "article" && articleSection ? (
        <meta property="article:section" content={articleSection} />
      ) : null}
      {ogType === "article"
        ? articleTags?.map((tag) => (
            <meta key={tag} property="article:tag" content={tag} />
          ))
        : null}

      <meta name="twitter:card" content={meta.card} />
      <meta name="twitter:site" content={SITE_TWITTER_HANDLE} />
      <meta name="twitter:title" content={meta.socialTitle} />
      <meta name="twitter:description" content={meta.socialDescription} />
      {primaryImage ? (
        <meta name="twitter:image" content={primaryImage.secureUrl} />
      ) : null}
      {primaryImage ? (
        <meta name="twitter:image:src" content={primaryImage.secureUrl} />
      ) : null}
      {primaryImage ? (
        <meta name="twitter:image:alt" content={primaryImage.alt} />
      ) : null}

      {jsonLd ? jsonLdScriptElements(jsonLd) : null}
      {children}
    </Helmet>
  );
}

export {
  DEFAULT_OG_IMAGE,
  DEFAULT_OG_IMAGE_ALT,
  DEFAULT_OG_IMAGE_HEIGHT,
  DEFAULT_OG_IMAGE_WIDTH,
  SITE_NAME,
};

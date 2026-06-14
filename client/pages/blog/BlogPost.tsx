import { useEffect, useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { format } from "date-fns";
import { useTranslation } from "react-i18next";
import {
  ArrowLeft,
  Calendar,
  Clock,
  ExternalLink,
  Loader2,
  User,
} from "lucide-react";
import MetaHelmet from "@/components/MetaHelmet";
import PortalErrorAlert from "@/components/athlete/PortalErrorAlert";
import { Button } from "@/components/ui/button";
import {
  BlogLocaleBadge,
  BlogOriginBadge,
} from "@/components/blog/BlogOriginBadge";
import { getBlogOrigin } from "@/utils/blogOrigin";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { clearPublicBlogPost, fetchPublicBlogPost } from "@/store/slices/blogsSlice";
import { resolveAbsoluteImage, resolveAbsoluteUrl, SITE_NAME } from "@/lib/siteMeta";
import { getDateFnsLocale } from "@/utils/dateLocale";

export default function BlogPost() {
  const { slug } = useParams<{ slug: string }>();
  const { t, i18n } = useTranslation();
  const dispatch = useAppDispatch();
  const { publicPost, publicPostLoading, publicPostError } = useAppSelector((s) => s.blogs);
  const dateLocale = getDateFnsLocale(i18n.language);

  useEffect(() => {
    if (slug) dispatch(fetchPublicBlogPost(slug));
    return () => {
      dispatch(clearPublicBlogPost());
    };
  }, [dispatch, slug]);

  const postPath = slug ? `/blog/${slug}` : "/blog";
  const coverImage = publicPost?.ogImageUrl || publicPost?.coverImageUrl;
  const metaTitle = publicPost?.seoTitle || publicPost?.title || t("blog.meta.indexTitle");
  const metaDescription =
    publicPost?.seoDescription ||
    publicPost?.excerpt ||
    publicPost?.title ||
    t("blog.meta.indexDescription");

  const blogJsonLd = useMemo(() => {
    if (!publicPost) return undefined;
    return {
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      headline: publicPost.title,
      description: publicPost.excerpt || publicPost.title,
      image: coverImage ? resolveAbsoluteImage(coverImage) : undefined,
      datePublished: publicPost.publishedAt || publicPost.updatedAt,
      dateModified: publicPost.updatedAt,
      author: publicPost.authorName
        ? { "@type": "Person", name: publicPost.authorName }
        : { "@type": "Organization", name: SITE_NAME },
      publisher: {
        "@type": "Organization",
        name: SITE_NAME,
      },
      mainEntityOfPage: resolveAbsoluteUrl(postPath),
      url: resolveAbsoluteUrl(postPath),
      inLanguage: publicPost.locale,
    };
  }, [publicPost, coverImage, postPath]);

  if (publicPostLoading) {
    return (
      <div className="min-h-below-nav bg-background flex flex-col">
        <div className="flex-1 flex items-center justify-center gap-3 text-muted-foreground">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
          <span>{t("blog.post.loading")}</span>
        </div>
      </div>
    );
  }

  if (publicPostError || !publicPost) {
    return (
      <div className="min-h-below-nav bg-background flex flex-col">
        <MetaHelmet title={t("blog.post.notFoundTitle")} description={t("blog.post.notFound")} noindex />
        <main className="flex-1 max-w-3xl mx-auto px-4 py-16 w-full">
          <PortalErrorAlert error={publicPostError || t("blog.post.notFound")} />
          <Link
            to="/blog"
            className="inline-flex items-center gap-2 text-sm text-primary hover:underline mt-6"
          >
            <ArrowLeft className="w-4 h-4" />
            {t("blog.post.backToBlog")}
          </Link>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-below-nav bg-background flex flex-col">
      <MetaHelmet
        title={metaTitle}
        description={metaDescription}
        image={coverImage}
        imageAlt={publicPost.title}
        path={postPath}
        ogType="article"
        publishedTime={publicPost.publishedAt || undefined}
        modifiedTime={publicPost.updatedAt}
        articleAuthor={publicPost.authorName || SITE_NAME}
        articleSection={publicPost.organizerName || "Blog"}
        alternateLocales
        keywords={[publicPost.title, publicPost.organizerName, "Triboo Sport"].filter(
          (v): v is string => Boolean(v),
        )}
        jsonLd={blogJsonLd}
      />

      <main className="flex-1 w-full min-w-0">
        <section className="relative min-h-[240px] md:min-h-[360px] overflow-hidden border-b border-border">
          {publicPost.coverImageUrl ? (
            <img
              src={publicPost.coverImageUrl}
              alt=""
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 bg-triboo-gradient opacity-30" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-background/30" />
          <div className="relative max-w-4xl mx-auto px-4 md:px-6 py-10 md:py-14 flex flex-col justify-end min-h-[240px] md:min-h-[360px]">
            <Link
              to="/blog"
              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary mb-6 w-fit transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              {t("blog.post.backToBlog")}
            </Link>

            {publicPost.organizerName ? (
              <span className="text-primary text-xs font-bold uppercase tracking-widest mb-2">
                {publicPost.organizerName}
              </span>
            ) : null}

            <div className="flex flex-wrap items-center gap-2 mb-4">
              <BlogOriginBadge origin={getBlogOrigin(publicPost)} size="md" />
              <BlogLocaleBadge locale={publicPost.locale} />
            </div>

            <h1 className="text-3xl md:text-5xl font-bold text-foreground leading-tight">
              {publicPost.title}
            </h1>

            {publicPost.excerpt ? (
              <p className="text-muted-foreground mt-4 max-w-2xl text-base md:text-lg">
                {publicPost.excerpt}
              </p>
            ) : null}

            <div className="flex flex-wrap gap-4 mt-6 text-sm text-muted-foreground">
              {publicPost.publishedAt ? (
                <span className="inline-flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-primary" />
                  {format(new Date(publicPost.publishedAt), "PPP", { locale: dateLocale })}
                </span>
              ) : null}
              <span className="inline-flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary" />
                {t("blog.post.readTime", { count: publicPost.readTimeMinutes })}
              </span>
              {publicPost.authorName ? (
                <span className="inline-flex items-center gap-2">
                  <User className="w-4 h-4 text-primary" />
                  {publicPost.authorName}
                </span>
              ) : null}
            </div>
          </div>
        </section>

        <article className="max-w-3xl mx-auto px-4 md:px-6 py-10 md:py-14 w-full min-w-0">
          {publicPost.bodyHtml ? (
            <div
              className="blog-prose text-foreground [&_a]:text-primary [&_a]:underline [&_h2]:text-foreground [&_h3]:text-foreground [&_img]:rounded-xl [&_img]:my-6 [&_blockquote]:border-l-primary [&_blockquote]:border-l-4 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-muted-foreground"
              // eslint-disable-next-line react/no-danger
              dangerouslySetInnerHTML={{ __html: publicPost.bodyHtml }}
            />
          ) : null}

          {publicPost.eventSlug ? (
            <div className="card-sport mt-12 p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-primary mb-1">
                  {t("blog.post.relatedEvent")}
                </p>
                <p className="font-semibold text-foreground">
                  {publicPost.eventTitle || publicPost.eventSlug}
                </p>
              </div>
              <Button asChild className="btn-primary shrink-0">
                <Link to={`/events/${publicPost.eventSlug}`}>
                  {t("blog.post.viewEvent")}
                  <ExternalLink className="w-4 h-4 ml-2" />
                </Link>
              </Button>
            </div>
          ) : null}
        </article>
      </main>
    </div>
  );
}

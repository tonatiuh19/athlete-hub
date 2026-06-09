import { useEffect, useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { format } from "date-fns";
import { useTranslation } from "react-i18next";
import { ArrowRight, Clock, Loader2, Sparkles, User } from "lucide-react";
import MetaHelmet from "@/components/MetaHelmet";
import HomeNavbar from "@/components/home/HomeNavbar";
import SiteFooter from "@/components/SiteFooter";
import PortalErrorAlert from "@/components/athlete/PortalErrorAlert";
import {
  BlogLocaleBadge,
  BlogOriginBadge,
  BlogOriginLegend,
} from "@/components/blog/BlogOriginBadge";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchPublicBlogList } from "@/store/slices/blogsSlice";
import { getDateFnsLocale } from "@/utils/dateLocale";
import { getBlogOrigin, normalizeBlogLocale } from "@/utils/blogOrigin";
import type { BlogPostPublic } from "@shared/api";

function formatPublished(date: string | null, locale: ReturnType<typeof getDateFnsLocale>) {
  if (!date) return "";
  return format(new Date(date), "PPP", { locale });
}

function BlogCard({ post, featured = false }: { post: BlogPostPublic; featured?: boolean }) {
  const { t, i18n } = useTranslation();
  const dateLocale = getDateFnsLocale(i18n.language);

  return (
    <article
      className={`card-sport group flex flex-col h-full ${featured ? "md:col-span-2 md:flex-row" : ""}`}
    >
      <Link
        to={`/blog/${post.slug}`}
        className={`relative overflow-hidden shrink-0 ${featured ? "md:w-1/2 h-56 md:h-auto" : "h-48"}`}
      >
        {post.coverImageUrl ? (
          <img
            src={post.coverImageUrl}
            alt=""
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full bg-triboo-gradient opacity-80 min-h-[12rem]" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent" />
        {post.featured ? (
          <span className="absolute top-4 left-4 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-triboo-gradient text-primary-foreground text-xs font-bold shadow-glow-triboo">
            <Sparkles className="w-3.5 h-3.5" />
            {t("blog.index.featuredBadge")}
          </span>
        ) : null}
      </Link>

      <div className={`p-5 md:p-6 flex flex-col flex-1 ${featured ? "md:justify-center" : ""}`}>
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <BlogOriginBadge origin={getBlogOrigin(post)} />
          <BlogLocaleBadge locale={post.locale} />
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground mb-3">
          {post.publishedAt ? (
            <time dateTime={post.publishedAt}>{formatPublished(post.publishedAt, dateLocale)}</time>
          ) : null}
          <span className="inline-flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-primary" />
            {t("blog.index.readTime", { count: post.readTimeMinutes })}
          </span>
        </div>

        <h2
          className={`font-bold text-foreground group-hover:text-primary transition-colors line-clamp-2 ${
            featured ? "text-xl md:text-2xl mb-3" : "text-lg mb-2"
          }`}
        >
          <Link to={`/blog/${post.slug}`}>{post.title}</Link>
        </h2>

        {post.excerpt ? (
          <p className={`text-muted-foreground text-sm mb-4 ${featured ? "line-clamp-3" : "line-clamp-2"}`}>
            {post.excerpt}
          </p>
        ) : null}

        <div className="mt-auto flex items-center justify-between gap-3 pt-2">
          {post.authorName ? (
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <User className="w-3.5 h-3.5 text-primary" />
              {t("blog.index.byAuthor", { author: post.authorName })}
            </span>
          ) : (
            <span />
          )}
          <Link
            to={`/blog/${post.slug}`}
            className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
          >
            {t("blog.index.readMore")}
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </article>
  );
}

export default function BlogIndex() {
  const { t, i18n } = useTranslation();
  const [searchParams] = useSearchParams();
  const dispatch = useAppDispatch();
  const { publicPosts, publicLoading, publicError } = useAppSelector((s) => s.blogs);
  const organizerFilter = searchParams.get("organizer")?.trim() || undefined;
  const blogLocale = normalizeBlogLocale(i18n.language);

  useEffect(() => {
    dispatch(
      fetchPublicBlogList({
        limit: 24,
        locale: blogLocale,
        organizer: organizerFilter,
      }),
    );
  }, [dispatch, blogLocale, organizerFilter]);

  const { featuredPost, gridPosts } = useMemo(() => {
    const featured = publicPosts.find((p) => p.featured) ?? publicPosts[0] ?? null;
    const rest = featured
      ? publicPosts.filter((p) => p.id !== featured.id)
      : publicPosts;
    return { featuredPost: featured, gridPosts: rest };
  }, [publicPosts]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <MetaHelmet
        title={t("blog.meta.indexTitle")}
        description={t("blog.meta.indexDescription")}
        path="/blog"
        alternateLocales
        keywords={["Triboo Sport", "blog", "sports", "events"]}
      />

      <HomeNavbar />

      <main className="flex-1 w-full">
        <section className="relative overflow-hidden border-b border-border">
          <div className="absolute inset-0 bg-triboo-gradient opacity-[0.07]" />
          <div className="relative max-w-7xl mx-auto px-4 md:px-6 py-12 md:py-16">
            <span className="text-primary text-xs font-bold uppercase tracking-widest mb-3 block">
              Triboo Sport
            </span>
            <h1 className="text-3xl md:text-5xl font-bold text-foreground max-w-3xl">
              {t("blog.index.title")}
            </h1>
            <p className="text-muted-foreground mt-4 max-w-2xl text-base md:text-lg">
              {t("blog.index.subtitle")}
            </p>
            <p className="text-xs text-muted-foreground mt-3">
              {t("blog.index.localeHint", { locale: t(`blog.locale.${blogLocale}`) })}
            </p>
            {organizerFilter ? (
              <p className="text-sm text-primary mt-2">
                {t("blog.index.organizerFilter", { organizer: organizerFilter })}
                {" · "}
                <Link to="/blog" className="underline hover:text-primary/80">
                  {t("blog.index.clearFilter")}
                </Link>
              </p>
            ) : null}
          </div>
        </section>

        <section className="max-w-7xl mx-auto px-4 md:px-6 py-10 md:py-14 w-full min-w-0">
          <BlogOriginLegend className="mb-8 pb-6 border-b border-border" />
          {publicError ? <PortalErrorAlert error={publicError} /> : null}

          {publicLoading ? (
            <div className="flex items-center justify-center py-24 text-muted-foreground gap-3">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
              <span>{t("blog.index.loading")}</span>
            </div>
          ) : publicPosts.length === 0 ? (
            <div className="card-sport p-12 text-center text-muted-foreground">
              {t("blog.index.empty")}
            </div>
          ) : (
            <div className="space-y-10">
              {featuredPost ? (
                <div>
                  <h2 className="text-sm font-bold uppercase tracking-widest text-primary mb-4">
                    {t("blog.index.featuredSection")}
                  </h2>
                  <BlogCard post={featuredPost} featured />
                </div>
              ) : null}

              {gridPosts.length > 0 ? (
                <div>
                  <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-4">
                    {t("blog.index.latestSection")}
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {gridPosts.map((post) => (
                      <BlogCard key={post.id} post={post} />
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}

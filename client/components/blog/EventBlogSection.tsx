import { useEffect } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { useTranslation } from "react-i18next";
import { ArrowRight, Clock, FileText } from "lucide-react";
import {
  BlogLocaleBadge,
  BlogOriginBadge,
} from "@/components/blog/BlogOriginBadge";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchEventBlogPosts } from "@/store/slices/blogsSlice";
import { getDateFnsLocale } from "@/utils/dateLocale";
import { getBlogOrigin, normalizeBlogLocale } from "@/utils/blogOrigin";

export interface EventBlogSectionProps {
  eventSlug: string;
  organizerSlug?: string;
  organizerName?: string;
  className?: string;
}

export default function EventBlogSection({
  eventSlug,
  organizerSlug,
  organizerName,
  className = "",
}: EventBlogSectionProps) {
  const { t, i18n } = useTranslation();
  const dispatch = useAppDispatch();
  const { eventPosts, eventPostsLoading } = useAppSelector((s) => s.blogs);
  const dateLocale = getDateFnsLocale(i18n.language);

  useEffect(() => {
    dispatch(
      fetchEventBlogPosts({
        event: eventSlug,
        locale: normalizeBlogLocale(i18n.language),
        limit: 6,
      }),
    );
  }, [dispatch, eventSlug, i18n.language]);

  const posts = eventPosts;
  if (!eventPostsLoading && posts.length === 0) return null;

  return (
    <section className={`space-y-4 ${className}`}>
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            {t("eventDetail.blogSectionTitle")}
          </h2>
          <p className="text-sm text-gray-400 mt-1">
            {organizerName
              ? t("eventDetail.blogSectionSubtitleOrganizer", { organizer: organizerName })
              : t("eventDetail.blogSectionSubtitle")}
          </p>
        </div>
        {organizerSlug || organizerName ? (
          <Link
            to={`/blog?organizer=${encodeURIComponent(organizerSlug ?? posts[0]?.organizerSlug ?? "")}`}
            className="text-sm font-semibold text-primary hover:underline inline-flex items-center gap-1"
          >
            {t("eventDetail.blogViewAll")}
            <ArrowRight className="w-4 h-4" />
          </Link>
        ) : null}
      </div>

      {eventPostsLoading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {[1, 2].map((i) => (
            <div key={i} className="h-32 rounded-xl bg-surface-dark/40 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {posts.map((post) => (
            <article
              key={post.id}
              className="rounded-xl border border-gray-700/50 bg-surface-dark/40 p-4 hover:border-primary/40 transition-colors group"
            >
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <BlogOriginBadge origin={getBlogOrigin(post)} />
                <BlogLocaleBadge locale={post.locale} />
                {post.eventId ? (
                  <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
                    {t("eventDetail.blogLinkedToEvent")}
                  </span>
                ) : null}
              </div>
              <h3 className="font-semibold text-white group-hover:text-primary transition-colors line-clamp-2">
                <Link to={`/blog/${post.slug}`}>{post.title}</Link>
              </h3>
              {post.excerpt ? (
                <p className="text-sm text-gray-400 mt-2 line-clamp-2">{post.excerpt}</p>
              ) : null}
              <div className="flex items-center justify-between mt-3 text-xs text-gray-500">
                <span className="inline-flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-primary" />
                  {t("blog.index.readTime", { count: post.readTimeMinutes })}
                </span>
                {post.publishedAt ? (
                  <time dateTime={post.publishedAt}>
                    {format(new Date(post.publishedAt), "PP", { locale: dateLocale })}
                  </time>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

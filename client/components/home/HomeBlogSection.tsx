import { useEffect } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { useTranslation } from "react-i18next";
import { ArrowRight, Clock } from "lucide-react";
import { motion } from "framer-motion";
import SectionHeader from "@/components/home/SectionHeader";
import {
  BlogLocaleBadge,
  BlogOriginBadge,
} from "@/components/blog/BlogOriginBadge";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchPublicBlogList } from "@/store/slices/blogsSlice";
import { getDateFnsLocale } from "@/utils/dateLocale";
import { getBlogOrigin, normalizeBlogLocale } from "@/utils/blogOrigin";

export default function HomeBlogSection() {
  const { t, i18n } = useTranslation();
  const dispatch = useAppDispatch();
  const { publicPosts, publicLoading } = useAppSelector((s) => s.blogs);
  const dateLocale = getDateFnsLocale(i18n.language);

  useEffect(() => {
    dispatch(
      fetchPublicBlogList({ limit: 3, locale: normalizeBlogLocale(i18n.language) }),
    );
  }, [dispatch, i18n.language]);

  const posts = publicPosts.slice(0, 3);
  if (!publicLoading && posts.length === 0) return null;

  return (
    <section id="blog" className="py-16 md:py-24 px-4 md:px-6">
      <div className="max-w-7xl mx-auto">
        <SectionHeader
          title={t("home.blog.title")}
          subtitle={t("home.blog.subtitle")}
          actionLabel={t("home.blog.viewAll")}
          actionHref="/blog"
        />

        <div className="grid gap-6 md:grid-cols-3 mt-10">
          {publicLoading
            ? Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="card-sport h-72 animate-pulse bg-secondary/40"
                />
              ))
            : posts.map((post, index) => (
                <motion.article
                  key={post.id}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: index * 0.08 }}
                  className="card-sport group flex flex-col h-full overflow-hidden"
                >
                  <Link to={`/blog/${post.slug}`} className="block relative h-44 overflow-hidden">
                    {post.coverImageUrl ? (
                      <img
                        src={post.coverImageUrl}
                        alt=""
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      <div className="w-full h-full bg-triboo-gradient opacity-80" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
                  </Link>
                  <div className="p-5 flex flex-col flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <BlogOriginBadge origin={getBlogOrigin(post)} />
                      <BlogLocaleBadge locale={post.locale} />
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mb-2">
                      {post.publishedAt ? (
                        <time dateTime={post.publishedAt}>
                          {format(new Date(post.publishedAt), "PP", { locale: dateLocale })}
                        </time>
                      ) : null}
                      <span className="inline-flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-primary" />
                        {t("blog.index.readTime", { count: post.readTimeMinutes })}
                      </span>
                    </div>
                    <h3 className="text-lg font-bold text-foreground line-clamp-2 group-hover:text-primary transition-colors">
                      <Link to={`/blog/${post.slug}`}>{post.title}</Link>
                    </h3>
                    {post.excerpt ? (
                      <p className="text-sm text-muted-foreground mt-2 line-clamp-3 flex-1">
                        {post.excerpt}
                      </p>
                    ) : null}
                    <Link
                      to={`/blog/${post.slug}`}
                      className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary mt-4 hover:underline"
                    >
                      {t("home.blog.readMore")}
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                  </div>
                </motion.article>
              ))}
        </div>
      </div>
    </section>
  );
}

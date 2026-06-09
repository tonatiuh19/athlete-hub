import { format } from "date-fns";
import { useTranslation } from "react-i18next";
import { Calendar, Clock, User } from "lucide-react";
import { getDateFnsLocale } from "@/utils/dateLocale";
import { cn } from "@/lib/utils";

export interface BlogArticlePreviewProps {
  title: string;
  excerpt?: string;
  coverImageUrl?: string | null;
  bodyHtml?: string | null;
  authorName?: string | null;
  readTimeMinutes?: number;
  publishedAt?: string | null;
  organizerName?: string | null;
  compact?: boolean;
  className?: string;
}

export default function BlogArticlePreview({
  title,
  excerpt,
  coverImageUrl,
  bodyHtml,
  authorName,
  readTimeMinutes = 5,
  publishedAt,
  organizerName,
  compact = false,
  className,
}: BlogArticlePreviewProps) {
  const { t, i18n } = useTranslation();
  const dateLocale = getDateFnsLocale(i18n.language);

  return (
    <div className={cn("bg-background text-foreground", className)}>
      <section
        className={cn(
          "relative overflow-hidden border-b border-border",
          compact ? "min-h-[160px]" : "min-h-[220px]",
        )}
      >
        {coverImageUrl ? (
          <img
            src={coverImageUrl}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-triboo-gradient opacity-30" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-background/30" />
        <div
          className={cn(
            "relative px-4 md:px-6 flex flex-col justify-end",
            compact ? "py-6 min-h-[160px]" : "py-8 min-h-[220px]",
          )}
        >
          {organizerName ? (
            <span className="text-primary text-xs font-bold uppercase tracking-widest mb-2">
              {organizerName}
            </span>
          ) : null}
          <h2
            className={cn(
              "font-bold text-foreground leading-tight",
              compact ? "text-xl md:text-2xl" : "text-2xl md:text-4xl",
            )}
          >
            {title || t("staffPortal.blog.preview.untitled")}
          </h2>
          {excerpt ? (
            <p className="text-muted-foreground mt-3 max-w-2xl text-sm md:text-base line-clamp-3">
              {excerpt}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-4 mt-4 text-xs md:text-sm text-muted-foreground">
            {publishedAt ? (
              <span className="inline-flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-primary" />
                {format(new Date(publishedAt), "PPP", { locale: dateLocale })}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-primary/80">
                {t("staffPortal.blog.preview.draftLabel")}
              </span>
            )}
            <span className="inline-flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-primary" />
              {t("blog.post.readTime", { count: readTimeMinutes })}
            </span>
            {authorName ? (
              <span className="inline-flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-primary" />
                {authorName}
              </span>
            ) : null}
          </div>
        </div>
      </section>

      {bodyHtml ? (
        <article className={cn("px-4 md:px-6 py-6 md:py-8", compact && "max-h-[40vh] overflow-y-auto")}>
          <div
            className="blog-prose text-foreground [&_a]:text-primary [&_a]:underline [&_h2]:text-foreground [&_h3]:text-foreground [&_img]:rounded-xl [&_img]:my-4 [&_blockquote]:border-l-primary [&_blockquote]:border-l-4 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-muted-foreground"
            // eslint-disable-next-line react/no-danger
            dangerouslySetInnerHTML={{ __html: bodyHtml }}
          />
        </article>
      ) : (
        <p className="px-4 md:px-6 py-8 text-sm text-muted-foreground italic">
          {t("staffPortal.blog.preview.noBody")}
        </p>
      )}
    </div>
  );
}

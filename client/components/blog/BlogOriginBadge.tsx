import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Building2, Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BlogOriginInfo } from "@/utils/blogOrigin";

export interface BlogOriginBadgeProps {
  origin: BlogOriginInfo;
  size?: "sm" | "md";
  className?: string;
}

export function BlogOriginBadge({
  origin,
  size = "sm",
  className,
}: BlogOriginBadgeProps) {
  const { t } = useTranslation();
  const isPlatform = origin.kind === "platform";

  const label = isPlatform
    ? t("blog.origin.platform")
    : origin.organizerName || t("blog.origin.organizer");

  const inner = (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border font-bold uppercase tracking-wide",
        size === "sm" ? "px-2.5 py-0.5 text-[10px]" : "px-3 py-1 text-xs",
        isPlatform
          ? "bg-primary/15 text-primary border-primary/30"
          : "bg-accent/15 text-accent border-accent/30",
        className,
      )}
    >
      {isPlatform ? (
        <Globe className={size === "sm" ? "w-3 h-3" : "w-3.5 h-3.5"} />
      ) : (
        <Building2 className={size === "sm" ? "w-3 h-3" : "w-3.5 h-3.5"} />
      )}
      {label}
    </span>
  );

  if (!isPlatform && origin.organizerSlug) {
    return (
      <Link
        to={`/blog?organizer=${encodeURIComponent(origin.organizerSlug)}`}
        className="hover:opacity-90 transition-opacity"
        onClick={(e) => e.stopPropagation()}
      >
        {inner}
      </Link>
    );
  }

  return inner;
}

export function BlogOriginLegend({ className }: { className?: string }) {
  const { t } = useTranslation();

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-muted-foreground",
        className,
      )}
    >
      <span className="font-semibold text-foreground">{t("blog.origin.legendTitle")}</span>
      <span className="inline-flex items-center gap-2">
        <BlogOriginBadge origin={{ kind: "platform" }} />
        <span>{t("blog.origin.legendPlatform")}</span>
      </span>
      <span className="inline-flex items-center gap-2">
        <BlogOriginBadge origin={{ kind: "organizer", organizerName: t("blog.origin.legendOrganizerExample") }} />
        <span>{t("blog.origin.legendOrganizer")}</span>
      </span>
    </div>
  );
}

export function BlogLocaleBadge({
  locale,
  className,
}: {
  locale: string;
  className?: string;
}) {
  const { t } = useTranslation();
  const code = locale.startsWith("en") ? "en" : "es";

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border border-border bg-secondary/60 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground",
        className,
      )}
      title={t(`blog.locale.${code}`)}
    >
      {t(`blog.locale.${code}`)}
    </span>
  );
}

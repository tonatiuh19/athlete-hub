import { memo } from "react";
import type { CSSProperties } from "react";
import type { Area } from "react-easy-crop";
import { Star } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { EventImagePreviewContext } from "@/constants/eventImageContexts";
import { cropAreaToImageStyle } from "@/utils/cropPreviewStyle";
import { cn } from "@/lib/utils";

function aspectRatioStyle(aspect: string): CSSProperties {
  const [w, h] = aspect.split("/").map((part) => Number(part.trim()));
  if (!Number.isFinite(w) || !Number.isFinite(h) || h === 0) return {};
  return { aspectRatio: `${w} / ${h}` };
}

interface EventImageContextPreviewProps {
  context: EventImagePreviewContext;
  imageSrc: string | null;
  croppedArea: Area | null;
  className?: string;
}

function EventImageContextPreview({
  context,
  imageSrc,
  croppedArea,
  className,
}: EventImageContextPreviewProps) {
  const { t } = useTranslation();
  const showImage = Boolean(imageSrc && croppedArea);

  return (
    <div className={cn("space-y-2", className)}>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {t(context.labelKey)}
      </p>
      <div
        className={cn(
          "relative overflow-hidden rounded-lg border border-border bg-card shadow-sm",
          context.frameClass,
        )}
      >
        <div
          className="relative w-full overflow-hidden bg-muted/30"
          style={aspectRatioStyle(context.aspect)}
        >
          {showImage ? (
            <div className="absolute inset-0 overflow-hidden">
              <img
                src={imageSrc!}
                alt=""
                draggable={false}
                className={cn(
                  context.objectFit === "contain" && "p-2",
                  context.variant.startsWith("sponsor-") &&
                    "brightness-0 invert opacity-80",
                )}
                style={cropAreaToImageStyle(croppedArea!)}
              />
            </div>
          ) : (
            <div className="absolute inset-0 bg-muted/40" />
          )}

          {context.variant === "marketplace-card" ? (
            <>
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-bg-dark/70 via-transparent to-transparent" />
              <span className="absolute left-2 top-2 z-10 inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[8px] font-bold uppercase text-primary-foreground">
                <Star className="h-2.5 w-2.5" />
                {t("staffPortal.eventEdit.imageCrop.mockFeatured")}
              </span>
              <span className="absolute right-2 top-2 z-10 rounded-md border border-primary/25 bg-bg-dark/80 px-1.5 py-0.5 text-[8px] font-medium text-primary">
                {t("staffPortal.eventEdit.imageCrop.mockSport")}
              </span>
              <div className="absolute inset-x-0 bottom-0 z-10 space-y-1 p-2">
                <div className="h-2 w-3/4 rounded bg-white/80" />
                <div className="h-1.5 w-1/2 rounded bg-white/40" />
              </div>
            </>
          ) : null}

          {context.variant === "home-featured" ? (
            <>
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
              <span className="absolute right-3 top-3 rounded-full bg-triboo-gradient px-2 py-1 text-[8px] font-bold text-primary-foreground">
                {t("staffPortal.eventEdit.imageCrop.mockSport")}
              </span>
              <div className="absolute inset-x-0 bottom-0 p-3">
                <div className="h-2.5 w-4/5 rounded bg-white/85" />
              </div>
            </>
          ) : null}

          {context.variant === "detail-hero" ? (
            <>
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-bg-dark via-bg-dark/60 to-bg-dark/20" />
              <div className="absolute inset-x-0 bottom-0 space-y-2 p-3">
                <div className="h-1.5 w-16 rounded bg-primary/70" />
                <div className="h-3 w-2/3 rounded bg-white/90" />
                <div className="h-2 w-1/2 rounded bg-white/45" />
              </div>
            </>
          ) : null}

          {context.variant === "compact-list" ? (
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-bg-dark/50 to-transparent" />
          ) : null}

          {context.variant === "search-thumb" ? (
            <div className="pointer-events-none absolute inset-0 rounded-lg ring-1 ring-white/10" />
          ) : null}

          {context.variant.startsWith("sponsor-") ? (
            <div className="pointer-events-none absolute inset-0 rounded-md border border-border/60 bg-bg-dark/50" />
          ) : null}

          {context.variant === "gallery-standard" || context.variant === "gallery-featured" ? (
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default memo(EventImageContextPreview);

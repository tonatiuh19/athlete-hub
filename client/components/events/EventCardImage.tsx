import { useState } from "react";
import SportKindIcon from "@/components/events/SportKindIcon";
import { resolveSportKind } from "@/utils/sportKind";
import {
  buildEventMediaSrcSet,
  eventMediaSizesAttr,
  optimizeEventMediaUrl,
  type EventMediaDisplaySize,
} from "@/lib/cdn-url";
import { cn } from "@/lib/utils";

const SPORT_GRADIENTS: Record<string, string> = {
  running: "from-cyan/30 to-blue-electric/20",
  trail: "from-emerald-500/25 to-cyan/15",
  triathlon: "from-orange-500/25 to-amber-400/15",
  cycling: "from-blue-electric/30 to-purple-accent/15",
  hyrox: "from-red-500/25 to-orange-400/15",
  ocr: "from-amber-500/25 to-orange-400/15",
  fitness: "from-blue-500/25 to-cyan/15",
  virtual: "from-purple-accent/30 to-cyan/15",
  fishing: "from-primary/25 to-accent/20",
  default: "from-cyan/20 to-purple-accent/20",
};

function sportGradient(sportSlug?: string, sportName?: string): string {
  return SPORT_GRADIENTS[resolveSportKind(sportSlug, sportName)] ?? SPORT_GRADIENTS.default;
}

function SportIcon({ sportSlug, sportName }: { sportSlug?: string; sportName?: string }) {
  return (
    <SportKindIcon sportSlug={sportSlug} sportName={sportName} className="w-8 h-8 text-cyan/40" />
  );
}

interface EventCardImageProps {
  src?: string | null;
  sportSlug?: string;
  sportName?: string;
  className?: string;
  imgClassName?: string;
  /** Smaller variants load faster on cards and list thumbnails. */
  displaySize?: EventMediaDisplaySize;
  fetchPriority?: "high" | "low" | "auto";
}

export default function EventCardImage({
  src,
  sportSlug,
  sportName,
  className,
  imgClassName,
  displaySize = "card",
  fetchPriority = "auto",
}: EventCardImageProps) {
  const [failed, setFailed] = useState(false);
  const resolvedSrc = optimizeEventMediaUrl(src, displaySize);
  const srcSet = buildEventMediaSrcSet(src, displaySize);
  const sizes = eventMediaSizesAttr(displaySize);
  const showFallback = !resolvedSrc || failed;
  const imgFetchPriority =
    fetchPriority === "high" || fetchPriority === "low" ? fetchPriority : undefined;

  return (
    <div className={cn("relative overflow-hidden bg-surface-dark", className)}>
      {!showFallback ? (
        <img
          src={resolvedSrc}
          srcSet={srcSet}
          sizes={srcSet ? sizes : undefined}
          alt=""
          className={cn("w-full h-full object-cover", imgClassName)}
          loading={fetchPriority === "high" ? "eager" : "lazy"}
          decoding="async"
          {...(imgFetchPriority
            ? ({ fetchpriority: imgFetchPriority } as React.ImgHTMLAttributes<HTMLImageElement>)
            : {})}
          onError={() => setFailed(true)}
        />
      ) : (
        <div
          className={cn(
            "w-full h-full flex items-center justify-center bg-gradient-to-br",
            sportGradient(sportSlug, sportName),
          )}
        >
          <SportIcon sportSlug={sportSlug} sportName={sportName} />
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-bg-dark/60 via-transparent to-transparent pointer-events-none" />
    </div>
  );
}

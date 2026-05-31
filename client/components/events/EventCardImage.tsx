import { useState } from "react";
import { Footprints, Zap, Waves, Bike } from "lucide-react";
import { resolveSportKind } from "@/utils/sportKind";
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
  default: "from-cyan/20 to-purple-accent/20",
};

function sportGradient(sportSlug?: string, sportName?: string): string {
  return SPORT_GRADIENTS[resolveSportKind(sportSlug, sportName)] ?? SPORT_GRADIENTS.default;
}

function SportIcon({ sportSlug, sportName }: { sportSlug?: string; sportName?: string }) {
  const kind = resolveSportKind(sportSlug, sportName);
  if (kind === "triathlon") return <Waves className="w-8 h-8 text-cyan/40" />;
  if (kind === "cycling") return <Bike className="w-8 h-8 text-cyan/40" />;
  if (kind === "hyrox") return <Zap className="w-8 h-8 text-cyan/40" />;
  return <Footprints className="w-8 h-8 text-cyan/40" />;
}

interface EventCardImageProps {
  src?: string | null;
  sportSlug?: string;
  sportName?: string;
  className?: string;
  imgClassName?: string;
}

export default function EventCardImage({
  src,
  sportSlug,
  sportName,
  className,
  imgClassName,
}: EventCardImageProps) {
  const [failed, setFailed] = useState(false);
  const showFallback = !src || failed;

  return (
    <div className={cn("relative overflow-hidden bg-surface-dark", className)}>
      {!showFallback ? (
        <img
          src={src}
          alt=""
          className={cn("w-full h-full object-cover", imgClassName)}
          loading="lazy"
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

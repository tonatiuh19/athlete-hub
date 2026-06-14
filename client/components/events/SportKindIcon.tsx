import {
  Bike,
  Dumbbell,
  Fish,
  Footprints,
  Globe,
  Mountain,
  Shield,
  Waves,
  Zap,
} from "lucide-react";
import { resolveSportKind } from "@/utils/sportKind";
import { cn } from "@/lib/utils";

interface SportKindIconProps {
  sportSlug?: string;
  sportName?: string;
  className?: string;
}

export default function SportKindIcon({
  sportSlug,
  sportName,
  className,
}: SportKindIconProps) {
  const kind = resolveSportKind(sportSlug, sportName);
  const iconClass = cn("shrink-0", className);

  switch (kind) {
    case "triathlon":
      return <Waves className={iconClass} aria-hidden />;
    case "cycling":
      return <Bike className={iconClass} aria-hidden />;
    case "hyrox":
      return <Zap className={iconClass} aria-hidden />;
    case "trail":
      return <Mountain className={iconClass} aria-hidden />;
    case "ocr":
      return <Shield className={iconClass} aria-hidden />;
    case "fitness":
      return <Dumbbell className={iconClass} aria-hidden />;
    case "virtual":
      return <Globe className={iconClass} aria-hidden />;
    case "fishing":
      return <Fish className={iconClass} aria-hidden />;
    default:
      return <Footprints className={iconClass} aria-hidden />;
  }
}

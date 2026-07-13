import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

interface SectionHeaderProps {
  id?: string;
  title: string;
  subtitle: string;
  actionLabel?: string;
  actionHref?: string;
  /** Hide descriptive subtitle on small screens to reduce scroll clutter */
  hideSubtitleOnMobile?: boolean;
  /** Hide the entire header block on small screens */
  hideOnMobile?: boolean;
}

export default function SectionHeader({
  id,
  title,
  subtitle,
  actionLabel,
  actionHref,
  hideSubtitleOnMobile = false,
  hideOnMobile = false,
}: SectionHeaderProps) {
  return (
    <motion.div
      id={id}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6 }}
      className={cn(
        "flex flex-col md:flex-row md:items-end justify-between gap-6 min-w-0",
        hideOnMobile && "hidden md:flex",
        !hideOnMobile && (hideSubtitleOnMobile ? "mb-8 md:mb-16" : "mb-12 md:mb-16"),
        hideOnMobile && "mb-0 md:mb-16",
      )}
    >
      <div className="max-w-2xl min-w-0">
        <div className="w-12 h-1 bg-triboo-gradient rounded-full mb-3 md:mb-4" />
        <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-foreground tracking-tight break-words">
          {title}
        </h2>
        <p
          className={cn(
            "text-muted-foreground mt-2 md:mt-3 text-base md:text-lg leading-relaxed",
            hideSubtitleOnMobile && "hidden md:block",
          )}
        >
          {subtitle}
        </p>
      </div>
      {actionLabel && actionHref && (
        <Link
          to={actionHref}
          className="hidden md:inline-flex items-center gap-2 text-primary hover:text-foreground font-semibold text-sm shrink-0 group"
        >
          {actionLabel}
          <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
        </Link>
      )}
    </motion.div>
  );
}

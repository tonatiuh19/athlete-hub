import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

interface SectionHeaderProps {
  id?: string;
  title: string;
  subtitle: string;
  actionLabel?: string;
  actionHref?: string;
}

export default function SectionHeader({
  id,
  title,
  subtitle,
  actionLabel,
  actionHref,
}: SectionHeaderProps) {
  return (
    <motion.div
      id={id}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6 }}
      className="mb-12 md:mb-16 flex flex-col md:flex-row md:items-end justify-between gap-6 min-w-0"
    >
      <div className="max-w-2xl min-w-0">
        <div className="w-12 h-1 bg-gradient-to-r from-cyan to-blue-electric rounded-full mb-4" />
        <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-white tracking-tight break-words">
          {title}
        </h2>
        <p className="text-gray-400 mt-3 text-base md:text-lg leading-relaxed">
          {subtitle}
        </p>
      </div>
      {actionLabel && actionHref && (
        <Link
          to={actionHref}
          className="hidden md:inline-flex items-center gap-2 text-cyan hover:text-cyan-light font-semibold text-sm shrink-0 group"
        >
          {actionLabel}
          <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
        </Link>
      )}
    </motion.div>
  );
}

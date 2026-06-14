import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import SectionHeader from "@/components/home/SectionHeader";
import { cn } from "@/lib/utils";

function ShimmerBone({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-md bg-secondary/50",
        className,
      )}
    >
      <div
        className="absolute inset-0 -translate-x-full animate-[featured-skeleton-shimmer_2s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-primary/15 to-transparent"
        aria-hidden
      />
    </div>
  );
}

function FeaturedEventCardSkeleton({ index }: { index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: index * 0.08 }}
      className="card-sport overflow-hidden h-full flex flex-col"
      aria-hidden
    >
      <div className="relative h-52 md:h-56 shrink-0 overflow-hidden">
        <ShimmerBone className="absolute inset-0 rounded-none" />
        <ShimmerBone className="absolute top-4 right-4 h-7 w-24 rounded-full" />
      </div>

      <div className="p-5 md:p-6 flex flex-col flex-1">
        <ShimmerBone className="h-6 w-[88%] mb-3" />
        <ShimmerBone className="h-6 w-[62%] mb-5" />

        <div className="space-y-3 mb-5">
          <div className="flex items-center gap-2.5">
            <ShimmerBone className="h-4 w-4 shrink-0 rounded" />
            <ShimmerBone className="h-4 flex-1 max-w-[140px]" />
          </div>
          <div className="flex items-center gap-2.5">
            <ShimmerBone className="h-4 w-4 shrink-0 rounded" />
            <ShimmerBone className="h-4 flex-1 max-w-[120px]" />
          </div>
          <div className="flex items-center gap-2.5">
            <ShimmerBone className="h-4 w-4 shrink-0 rounded" />
            <ShimmerBone className="h-4 flex-1 max-w-[100px]" />
          </div>
        </div>

        <div className="flex items-center justify-end pt-4 border-t border-gray-700/50 mt-auto">
          <ShimmerBone className="h-4 w-16" />
        </div>
      </div>
    </motion.div>
  );
}

type FeaturedEventsSkeletonProps = {
  count?: number;
};

export default function FeaturedEventsSkeleton({
  count = 8,
}: FeaturedEventsSkeletonProps) {
  const { t } = useTranslation();

  return (
    <section
      id="events"
      className="pt-3 pb-14 md:pt-8 md:pb-20 px-4 md:px-6 scroll-mt-[4.5rem]"
      aria-busy="true"
      aria-label={t("home.events.loadingLabel")}
    >
      <div className="max-w-7xl mx-auto w-full min-w-0">
        <SectionHeader
          title={t("home.events.title")}
          subtitle={t("home.events.subtitle")}
          hideOnMobile
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {Array.from({ length: count }).map((_, i) => (
            <FeaturedEventCardSkeleton key={i} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}

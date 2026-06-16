import { useTranslation } from "react-i18next";
import SectionHeader from "@/components/home/SectionHeader";
import {
  DesktopFeaturedEventCardSkeleton,
  MobileFeaturedEventsRowsSkeleton,
  MobileMapSectionSkeleton,
} from "@/components/home/homeSkeletonPrimitives";

type FeaturedEventsSkeletonProps = {
  count?: number;
};

export default function FeaturedEventsSkeleton({
  count = 8,
}: FeaturedEventsSkeletonProps) {
  const { t } = useTranslation();

  return (
    <>
      {/* Mobile — matches HomeFeaturedEventsMobile + HomeEventsMapSection */}
      <section
        id="events"
        className="md:hidden pt-2 pb-4 px-4 scroll-mt-[4.5rem]"
        aria-busy="true"
        aria-label={t("home.events.loadingLabel")}
      >
        <div className="max-w-7xl mx-auto w-full min-w-0 space-y-4">
          <MobileFeaturedEventsRowsSkeleton />
          <MobileMapSectionSkeleton />
        </div>
      </section>

      {/* Desktop — grid with section header */}
      <section
        className="hidden md:block pt-3 pb-14 md:pt-8 md:pb-20 px-4 md:px-6 scroll-mt-[4.5rem]"
        aria-busy="true"
        aria-label={t("home.events.loadingLabel")}
      >
        <div className="max-w-7xl mx-auto w-full min-w-0">
          <SectionHeader
            title={t("home.events.title")}
            subtitle={t("home.events.subtitle")}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {Array.from({ length: count }).map((_, i) => (
              <DesktopFeaturedEventCardSkeleton key={i} index={i} />
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

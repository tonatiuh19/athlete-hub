import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import SportTypesCardCarousel from "@/components/events/SportTypesCardCarousel";
import SportTypesChipCarousel from "@/components/events/SportTypesChipCarousel";
import { SportChipsSkeleton } from "@/components/home/homeSkeletonPrimitives";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchSportTypes } from "@/store/slices/marketplaceSlice";

export default function HomeSportTypesSection() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const { sportTypes } = useAppSelector((s) => s.marketplace);

  useEffect(() => {
    if (sportTypes.length === 0) {
      dispatch(fetchSportTypes());
    }
  }, [dispatch, sportTypes.length]);

  if (sportTypes.length === 0) {
    return (
      <section
        aria-label={t("home.sportTypes.sectionLabel")}
        className="px-4 pt-2 pb-1 md:hidden scroll-mt-[4.5rem]"
        aria-busy="true"
      >
        <div className="max-w-7xl mx-auto w-full min-w-0">
          <SportChipsSkeleton />
        </div>
      </section>
    );
  }

  return (
    <section
      aria-label={t("home.sportTypes.sectionLabel")}
      className="px-4 pt-2 pb-1 md:pt-6 md:pb-2 scroll-mt-[4.5rem]"
    >
      <div className="max-w-7xl mx-auto w-full min-w-0">
        <p className="hidden md:block text-xs font-semibold uppercase tracking-widest text-primary mb-3">
          {t("home.disciplinesLabel")}
        </p>
        <div className="md:hidden">
          <SportTypesChipCarousel sportTypes={sportTypes} />
        </div>
        <div className="hidden md:block">
            <SportTypesCardCarousel
              mode="navigate"
              sportTypes={sportTypes}
              showAll={false}
              cardSize="lg"
          />
        </div>
      </div>
    </section>
  );
}

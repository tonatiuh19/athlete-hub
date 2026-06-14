import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import SportTypesCardCarousel from "@/components/events/SportTypesCardCarousel";
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

  if (sportTypes.length === 0) return null;

  return (
    <section
      aria-label={t("home.sportTypes.sectionLabel")}
      className="px-4 pt-3 pb-1 md:pt-6 md:pb-2 scroll-mt-[4.5rem]"
    >
      <div className="max-w-7xl mx-auto w-full min-w-0">
        <p className="md:hidden text-[11px] font-semibold uppercase tracking-widest text-primary mb-2.5">
          {t("home.disciplinesLabel")}
        </p>
        <p className="hidden md:block text-xs font-semibold uppercase tracking-widest text-primary mb-3">
          {t("home.disciplinesLabel")}
        </p>
        <SportTypesCardCarousel
          mode="navigate"
          sportTypes={sportTypes}
          showAll={false}
          cardSize="lg"
        />
      </div>
    </section>
  );
}

import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import MarketplaceSearchBar from "@/components/events/MarketplaceSearchBar";
import HeroMobileFiltersSheet from "@/components/home/HeroMobileFiltersSheet";
import { marketplaceFiltersToSearchParams } from "@/utils/eventsBrowseFilters";

export default function HeroMobileSearchPanel() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [query, setQuery] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const navigateToEvents = useCallback(
    (q: string) => {
      const params = marketplaceFiltersToSearchParams({
        q,
        sport: "",
        city: "",
        geoCityId: "",
        featured: false,
        dateFrom: "",
        dateTo: "",
        minPrice: "",
        maxPrice: "",
        sort: "date_asc",
      });
      const qs = params.toString();
      navigate(qs ? `/events?${qs}` : "/events");
    },
    [navigate],
  );

  return (
    <>
      <MarketplaceSearchBar
        className="md:hidden"
        value={query}
        onChange={setQuery}
        onApplyQuery={navigateToEvents}
        onApplySport={(sport) =>
          navigate(`/events?sport=${encodeURIComponent(sport)}`)
        }
        onApplyCity={(city, geoCityId) =>
          navigate(
            geoCityId
              ? `/events?geoCityId=${geoCityId}`
              : `/events?city=${encodeURIComponent(city)}`,
          )
        }
        placeholder={t("home.hero.searchEvents")}
        listboxId="hero-mobile-search-listbox"
        tone="hero"
        showFilters
        filtersOpen={filtersOpen}
        onFiltersClick={() => setFiltersOpen(true)}
      />

      <HeroMobileFiltersSheet
        open={filtersOpen}
        onOpenChange={setFiltersOpen}
        searchQuery={query}
      />
    </>
  );
}

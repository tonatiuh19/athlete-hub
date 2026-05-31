import { useTranslation } from "react-i18next";
import { RotateCcw } from "lucide-react";
import type { FilterCity, SportType } from "@shared/api";
import type { MarketplaceFilters } from "@/store/slices/marketplaceSlice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

interface EventsFiltersSidebarProps {
  filters: MarketplaceFilters;
  sportTypes: SportType[];
  cities: FilterCity[];
  onChange: (patch: Partial<MarketplaceFilters>) => void;
  onReset: () => void;
}

export default function EventsFiltersSidebar({
  filters,
  sportTypes,
  cities,
  onChange,
  onReset,
}: EventsFiltersSidebarProps) {
  const { t } = useTranslation();

  return (
    <aside className="space-y-4 p-5 rounded-2xl border border-gray-700/50 bg-surface-dark/60 backdrop-blur-md shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
      <div className="flex items-center justify-between pb-1 border-b border-gray-700/40">
        <h2 className="text-xs font-bold text-white uppercase tracking-widest">
          {t("eventsBrowse.filters")}
        </h2>
        <Button type="button" variant="ghost" size="sm" onClick={onReset} className="h-8 px-2 text-gray-400 hover:text-cyan -mr-1">
          <RotateCcw className="w-3.5 h-3.5 mr-1" />
          {t("eventsBrowse.reset")}
        </Button>
      </div>

      <div className="space-y-2">
        <Label className="text-xs text-gray-400">{t("eventsBrowse.sport")}</Label>
        <Select
          value={filters.sport || "all"}
          onValueChange={(v) => onChange({ sport: v === "all" ? "" : v })}
        >
          <SelectTrigger className="bg-bg-dark/60 border-gray-700/80 rounded-lg h-10">
            <SelectValue placeholder={t("eventsBrowse.allSports")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("eventsBrowse.allSports")}</SelectItem>
            {sportTypes.map((st) => (
              <SelectItem key={st.slug} value={st.slug}>
                {st.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label className="text-xs text-gray-400">{t("eventsBrowse.city")}</Label>
        <Select
          value={filters.city || "all"}
          onValueChange={(v) => onChange({ city: v === "all" ? "" : v })}
        >
          <SelectTrigger className="bg-bg-dark/60 border-gray-700/80 rounded-lg h-10">
            <SelectValue placeholder={t("eventsBrowse.allCities")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("eventsBrowse.allCities")}</SelectItem>
            {cities.map((c) => (
              <SelectItem key={`${c.city}-${c.state}`} value={c.city}>
                {c.city}
                {c.state ? `, ${c.state}` : ""} ({c.event_count})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label className="text-xs text-gray-400">{t("eventsBrowse.minPrice")}</Label>
          <Input
            type="number"
            min={0}
            value={filters.minPrice}
            onChange={(e) => onChange({ minPrice: e.target.value })}
            className="bg-bg-dark/60 border-gray-700/80 rounded-lg h-10"
            placeholder="0"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-xs text-gray-400">{t("eventsBrowse.maxPrice")}</Label>
          <Input
            type="number"
            min={0}
            value={filters.maxPrice}
            onChange={(e) => onChange({ maxPrice: e.target.value })}
            className="bg-bg-dark/60 border-gray-700/80 rounded-lg h-10"
            placeholder="5000"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label className="text-xs text-gray-400">{t("eventsBrowse.dateFrom")}</Label>
          <Input
            type="date"
            value={filters.dateFrom}
            onChange={(e) => onChange({ dateFrom: e.target.value })}
            className="bg-bg-dark/60 border-gray-700/80 rounded-lg h-10"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-xs text-gray-400">{t("eventsBrowse.dateTo")}</Label>
          <Input
            type="date"
            value={filters.dateTo}
            onChange={(e) => onChange({ dateTo: e.target.value })}
            className="bg-bg-dark/60 border-gray-700/80 rounded-lg h-10"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-xs text-gray-400">{t("eventsBrowse.sort")}</Label>
        <Select value={filters.sort} onValueChange={(v) => onChange({ sort: v as MarketplaceFilters["sort"] })}>
          <SelectTrigger className="bg-bg-dark/60 border-gray-700/80 rounded-lg h-10">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="date_asc">{t("eventsBrowse.sortDateAsc")}</SelectItem>
            <SelectItem value="date_desc">{t("eventsBrowse.sortDateDesc")}</SelectItem>
            <SelectItem value="price_asc">{t("eventsBrowse.sortPriceAsc")}</SelectItem>
            <SelectItem value="price_desc">{t("eventsBrowse.sortPriceDesc")}</SelectItem>
            <SelectItem value="popular">{t("eventsBrowse.sortPopular")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center justify-between py-2 px-1 rounded-lg bg-bg-dark/40 border border-gray-800/60">
        <Label htmlFor="featured-only" className="text-sm text-gray-300">
          {t("eventsBrowse.featuredOnly")}
        </Label>
        <Switch
          id="featured-only"
          checked={filters.featured}
          onCheckedChange={(featured) => onChange({ featured })}
        />
      </div>
    </aside>
  );
}

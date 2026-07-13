import { useTranslation } from "react-i18next";
import { CalendarDays, RotateCcw } from "lucide-react";
import type { FilterCity, SportType } from "@shared/api";
import type { MarketplaceFilters } from "@/store/slices/marketplaceSlice";
import { Button } from "@/components/ui/button";
import DatePickerField from "@/components/ui/date-picker-field";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
    <aside className="space-y-4 p-5 rounded-2xl border border-border bg-card/80 backdrop-blur-md shadow-sm">
      <div className="flex items-center justify-between pb-1 border-b border-border/60">
        <h2 className="text-xs font-bold text-foreground uppercase tracking-widest">
          {t("eventsBrowse.filters")}
        </h2>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onReset}
          className="h-8 px-2 text-muted-foreground hover:text-primary -mr-1"
        >
          <RotateCcw className="w-3.5 h-3.5 mr-1" />
          {t("eventsBrowse.reset")}
        </Button>
      </div>

      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">{t("eventsBrowse.sport")}</Label>
        <Select
          value={filters.sport || "all"}
          onValueChange={(v) => onChange({ sport: v === "all" ? "" : v })}
        >
          <SelectTrigger className="bg-background/60 border-border rounded-xl h-11">
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
        <Label className="text-xs text-muted-foreground">{t("eventsBrowse.city")}</Label>
        <Select
          value={filters.geoCityId || "all"}
          onValueChange={(v) =>
            onChange({
              geoCityId: v === "all" ? "" : v,
              city: "",
            })
          }
        >
          <SelectTrigger className="bg-background/60 border-border rounded-xl h-11">
            <SelectValue placeholder={t("eventsBrowse.allCities")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("eventsBrowse.allCities")}</SelectItem>
            {cities.map((c) => (
              <SelectItem key={c.id} value={String(c.id)}>
                {c.city}
                {c.state ? `, ${c.state}` : ""} ({c.event_count})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-xl border border-border bg-muted/30 overflow-hidden">
        <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border/60 bg-gradient-to-r from-primary/10 to-transparent">
          <CalendarDays className="w-4 h-4 text-primary shrink-0" />
          <span className="text-xs font-semibold text-foreground uppercase tracking-wider">
            {t("eventsBrowse.dateRange")}
          </span>
        </div>
        <div className="p-3 space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">{t("eventsBrowse.dateFrom")}</Label>
            <DatePickerField
              value={filters.dateFrom}
              onChange={(v) => onChange({ dateFrom: v })}
              clearable
              triggerClassName="h-11 rounded-xl bg-background/60 border-border text-foreground hover:border-primary/40"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">{t("eventsBrowse.dateTo")}</Label>
            <DatePickerField
              value={filters.dateTo}
              onChange={(v) => onChange({ dateTo: v })}
              clearable
              minDate={filters.dateFrom ? new Date(filters.dateFrom + "T12:00:00") : undefined}
              triggerClassName="h-11 rounded-xl bg-background/60 border-border text-foreground hover:border-primary/40"
            />
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">{t("eventsBrowse.sort")}</Label>
        <Select
          value={filters.sort}
          onValueChange={(v) => onChange({ sort: v as MarketplaceFilters["sort"] })}
        >
          <SelectTrigger className="bg-background/60 border-border rounded-xl h-11">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="date_asc">{t("eventsBrowse.sortDateAsc")}</SelectItem>
            <SelectItem value="date_desc">{t("eventsBrowse.sortDateDesc")}</SelectItem>
            <SelectItem value="popular">{t("eventsBrowse.sortPopular")}</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </aside>
  );
}

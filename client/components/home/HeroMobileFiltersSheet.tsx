import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { format, startOfMonth, endOfMonth, addMonths } from "date-fns";
import {
  CalendarDays,
  Loader2,
  MapPin,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import type { FilterCity } from "@shared/api";
import SportTypesChipCarousel from "@/components/events/SportTypesChipCarousel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchFilterCities, fetchSportTypes } from "@/store/slices/marketplaceSlice";
import type { MarketplaceFilters } from "@/store/slices/marketplaceSlice";
import { marketplaceFiltersToSearchParams } from "@/utils/eventsBrowseFilters";
import { cn } from "@/lib/utils";

export type DatePreset = "all" | "thisMonth" | "nextThreeMonths";

const emptyDraft: Pick<
  MarketplaceFilters,
  "sport" | "geoCityId" | "city" | "dateFrom" | "dateTo"
> = {
  sport: "",
  geoCityId: "",
  city: "",
  dateFrom: "",
  dateTo: "",
};

function datePresetRange(preset: DatePreset): { dateFrom: string; dateTo: string } {
  if (preset === "all") return { dateFrom: "", dateTo: "" };
  const today = new Date();
  if (preset === "thisMonth") {
    return {
      dateFrom: format(startOfMonth(today), "yyyy-MM-dd"),
      dateTo: format(endOfMonth(today), "yyyy-MM-dd"),
    };
  }
  return {
    dateFrom: format(startOfMonth(today), "yyyy-MM-dd"),
    dateTo: format(endOfMonth(addMonths(today, 2)), "yyyy-MM-dd"),
  };
}

function countActiveFilters(
  draft: Pick<MarketplaceFilters, "sport" | "geoCityId" | "city" | "dateFrom" | "dateTo">,
  datePreset: DatePreset = "all",
): number {
  let n = 0;
  if (draft.sport) n++;
  if (draft.geoCityId || draft.city) n++;
  if (datePreset !== "all" || draft.dateFrom || draft.dateTo) n++;
  return n;
}

interface HeroMobileFiltersSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  searchQuery?: string;
}

export default function HeroMobileFiltersSheet({
  open,
  onOpenChange,
  searchQuery = "",
}: HeroMobileFiltersSheetProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { sportTypes, cities, loadingMeta } = useAppSelector((s) => s.marketplace);

  const [draft, setDraft] = useState(emptyDraft);
  const [citySearch, setCitySearch] = useState("");
  const [datePreset, setDatePreset] = useState<DatePreset>("all");

  useEffect(() => {
    if (!open) return;
    dispatch(fetchSportTypes());
    dispatch(fetchFilterCities());
    setDraft(emptyDraft);
    setCitySearch("");
    setDatePreset("all");
  }, [dispatch, open]);

  const filteredCities = useMemo(() => {
    const q = citySearch.trim().toLowerCase();
    if (!q) return cities;
    return cities.filter(
      (c) =>
        c.city.toLowerCase().includes(q) ||
        (c.state?.toLowerCase().includes(q) ?? false),
    );
  }, [cities, citySearch]);

  const activeCount = countActiveFilters(draft, datePreset);

  const applyFilters = () => {
    const range = datePresetRange(datePreset);
    const params = marketplaceFiltersToSearchParams({
      q: searchQuery.trim(),
      sport: draft.sport,
      city: draft.geoCityId ? "" : draft.city,
      geoCityId: draft.geoCityId,
      featured: false,
      dateFrom: range.dateFrom,
      dateTo: range.dateTo,
      minPrice: "",
      maxPrice: "",
      sort: "date_asc",
    });
    const qs = params.toString();
    navigate(qs ? `/events?${qs}` : "/events");
    onOpenChange(false);
  };

  const resetFilters = () => {
    setDraft(emptyDraft);
    setCitySearch("");
    setDatePreset("all");
  };

  const selectCity = (city: FilterCity | null) => {
    if (!city) {
      setDraft((d) => ({ ...d, geoCityId: "", city: "" }));
      return;
    }
    setDraft((d) => ({
      ...d,
      geoCityId: String(city.id),
      city: "",
    }));
  };

  const dateOptions: { id: DatePreset; label: string }[] = [
    { id: "all", label: t("home.hero.mobileAllDates") },
    { id: "thisMonth", label: t("home.hero.mobileThisMonth") },
    { id: "nextThreeMonths", label: t("home.hero.mobileNextThreeMonths") },
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="z-[70] max-h-[min(92vh,720px)] rounded-t-[1.75rem] border-border/80 bg-card p-0 pb-[max(1rem,env(safe-area-inset-bottom))] overflow-hidden flex flex-col"
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-primary/10 to-transparent" />

        <SheetHeader className="relative shrink-0 space-y-1 px-5 pt-5 pb-3 text-left border-b border-border/60">
          <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-border" aria-hidden />
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 border border-primary/25">
              <SlidersHorizontal className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0">
              <SheetTitle className="text-base font-bold text-foreground">
                {t("home.hero.filters.title")}
              </SheetTitle>
              <SheetDescription className="text-xs text-muted-foreground mt-0.5">
                {t("home.hero.filters.subtitle")}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="relative flex-1 overflow-y-auto overscroll-contain px-5 py-4 space-y-6">
          <section className="space-y-2.5">
            <p className="text-[11px] font-bold uppercase tracking-widest text-primary">
              {t("eventsBrowse.sport")}
            </p>
            {sportTypes.length > 0 ? (
              <SportTypesChipCarousel
                mode="filter"
                sportTypes={sportTypes}
                activeSlug={draft.sport}
                showAll
                onSelect={(slug) => setDraft((d) => ({ ...d, sport: slug }))}
              />
            ) : (
              <div className="flex gap-2 overflow-hidden py-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-9 w-20 shrink-0 rounded-full bg-muted/50 animate-pulse"
                  />
                ))}
              </div>
            )}
          </section>

          <section className="space-y-2.5">
            <p className="text-[11px] font-bold uppercase tracking-widest text-primary">
              {t("eventsBrowse.city")}
            </p>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={citySearch}
                onChange={(e) => setCitySearch(e.target.value)}
                placeholder={t("home.hero.filters.citySearch")}
                className="h-11 pl-9 rounded-xl bg-background/80 border-border/80"
              />
            </div>
            <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto overscroll-contain pr-0.5">
              <button
                type="button"
                onClick={() => selectCity(null)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-semibold transition-colors",
                  !draft.geoCityId && !draft.city
                    ? "border-primary/60 bg-primary/15 text-primary"
                    : "border-border/70 bg-background/60 text-foreground/90",
                )}
              >
                {t("home.hero.mobileAllCities")}
              </button>
              {loadingMeta && cities.length === 0 ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                  {t("common.loading")}
                </div>
              ) : (
                filteredCities.map((c) => {
                  const selected = draft.geoCityId === String(c.id);
                  return (
                    <button
                      key={`${c.id}-${c.city}`}
                      type="button"
                      onClick={() => selectCity(c)}
                      className={cn(
                        "inline-flex max-w-full items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-semibold transition-colors",
                        selected
                          ? "border-primary/60 bg-primary/15 text-primary"
                          : "border-border/70 bg-background/60 text-foreground/90",
                      )}
                    >
                      <MapPin className="h-3.5 w-3.5 shrink-0 opacity-70" />
                      <span className="truncate">
                        {c.city}
                        {c.state ? `, ${c.state}` : ""}
                      </span>
                      <span className="text-[10px] opacity-60 tabular-nums">({c.event_count})</span>
                    </button>
                  );
                })
              )}
            </div>
          </section>

          <section className="space-y-2.5">
            <p className="text-[11px] font-bold uppercase tracking-widest text-primary flex items-center gap-1.5">
              <CalendarDays className="h-3.5 w-3.5" />
              {t("home.hero.filters.when")}
            </p>
            <div className="grid grid-cols-1 gap-2">
              {dateOptions.map((opt) => {
                const selected = datePreset === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setDatePreset(opt.id)}
                    className={cn(
                      "flex items-center justify-between rounded-xl border px-4 py-3 text-sm font-medium transition-all",
                      selected
                        ? "border-primary/50 bg-primary/10 text-primary shadow-[inset_0_0_0_1px_rgba(255,90,31,0.15)]"
                        : "border-border/70 bg-background/50 text-foreground/90 hover:border-primary/30",
                    )}
                  >
                    {opt.label}
                    {selected ? (
                      <Sparkles className="h-4 w-4 text-primary shrink-0" />
                    ) : null}
                  </button>
                );
              })}
            </div>
          </section>
        </div>

        <div className="shrink-0 border-t border-border/60 bg-card/95 backdrop-blur-md px-5 py-4 flex gap-3">
          <Button
            type="button"
            variant="outline"
            className="h-12 flex-1 rounded-xl border-border"
            onClick={resetFilters}
            disabled={activeCount === 0 && datePreset === "all"}
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            {t("eventsBrowse.reset")}
          </Button>
          <Button
            type="button"
            className="h-12 flex-[1.4] rounded-xl bg-triboo-gradient text-primary-foreground font-bold shadow-glow-triboo hover:brightness-110"
            onClick={applyFilters}
          >
            {activeCount > 0
              ? t("home.hero.filters.applyWithCount", { count: activeCount })
              : t("home.hero.filters.apply")}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
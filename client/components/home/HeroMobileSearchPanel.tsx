import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CalendarDays,
  ChevronDown,
  Loader2,
  LocateFixed,
  MapPin,
  Search,
  X,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { format, startOfMonth, endOfMonth, addMonths } from "date-fns";
import { toast } from "sonner";
import HeroSearchDropdown, {
  buildHeroSearchFlatItems,
  type HeroSearchFlatItem,
} from "@/components/home/HeroSearchDropdown";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  clearSearchSuggestions,
  fetchFilterCities,
  fetchSearchSuggestions,
} from "@/store/slices/marketplaceSlice";
import { marketplaceFiltersToSearchParams } from "@/utils/eventsBrowseFilters";
import { findNearestFilterCity } from "@/utils/nearestFilterCity";
import { requestUserPosition } from "@/utils/userGeolocation";

const heroMobileInputClass =
  "w-full min-w-0 flex-1 bg-transparent border-0 p-0 m-0 text-base text-white placeholder:text-white/40 outline-none shadow-none ring-0 appearance-none focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 caret-primary";

type DatePreset = "all" | "thisMonth" | "nextThreeMonths";

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

export default function HeroMobileSearchPanel() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { searchSuggestions, searchSuggestionsLoading, cities, loadingMeta } =
    useAppSelector((s) => s.marketplace);

  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const [cityLabel, setCityLabel] = useState("");
  const [geoCityId, setGeoCityId] = useState("");
  const [datePreset, setDatePreset] = useState<DatePreset>("all");
  const [citySheetOpen, setCitySheetOpen] = useState(false);
  const [dateSheetOpen, setDateSheetOpen] = useState(false);
  const [locating, setLocating] = useState(false);

  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const trimmed = query.trim();
  const flatItems = useMemo(
    () => buildHeroSearchFlatItems(searchSuggestions),
    [searchSuggestions],
  );

  useEffect(() => {
    dispatch(fetchFilterCities());
  }, [dispatch]);

  useEffect(() => {
    if (trimmed.length < 2) {
      dispatch(clearSearchSuggestions());
      return;
    }
    const id = window.setTimeout(() => {
      dispatch(fetchSearchSuggestions(trimmed));
    }, 280);
    return () => window.clearTimeout(id);
  }, [trimmed, dispatch]);

  useEffect(() => {
    setHighlightIndex(flatItems.length > 0 ? 0 : -1);
  }, [flatItems]);

  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  const openCitySheet = useCallback(() => {
    setOpen(false);
    setCitySheetOpen(true);
  }, []);

  const locateNearestCity = useCallback(async () => {
    if (locating) return;
    setOpen(false);
    setLocating(true);

    try {
      const position = await requestUserPosition();
      const nearest = findNearestFilterCity(cities, position.lat, position.lng);

      if (!nearest) {
        toast.error(t("home.hero.mobileLocationNoCity"));
        return;
      }

      setCityLabel(nearest.city);
      setGeoCityId(String(nearest.id));
      toast.success(
        t("home.hero.mobileLocationFound", {
          city: nearest.state ? `${nearest.city}, ${nearest.state}` : nearest.city,
        }),
      );
    } catch (error) {
      const code = error instanceof Error ? error.message : "unknown";
      const messageKey =
        code === "denied"
          ? "home.hero.mobileLocationDenied"
          : code === "unavailable"
            ? "home.hero.mobileLocationUnavailable"
            : code === "timeout"
              ? "home.hero.mobileLocationTimeout"
              : code === "unsupported"
                ? "home.hero.mobileLocationUnsupported"
                : "home.hero.mobileLocationUnavailable";
      toast.error(t(messageKey));
    } finally {
      setLocating(false);
    }
  }, [cities, locating, t]);

  const navigateToEvents = useCallback(
    (patch?: { q?: string; geoCityId?: string; city?: string; datePreset?: DatePreset }) => {
      const range = datePresetRange(patch?.datePreset ?? datePreset);
      const params = marketplaceFiltersToSearchParams({
        q: patch?.q ?? trimmed,
        sport: "",
        city: patch?.city ?? (geoCityId ? "" : cityLabel),
        geoCityId: patch?.geoCityId ?? geoCityId,
        featured: false,
        dateFrom: range.dateFrom,
        dateTo: range.dateTo,
        minPrice: "",
        maxPrice: "",
        sort: "date_asc",
      });
      const qs = params.toString();
      navigate(qs ? `/events?${qs}` : "/events");
      setOpen(false);
      dispatch(clearSearchSuggestions());
    },
    [cityLabel, datePreset, dispatch, geoCityId, navigate, trimmed],
  );

  const goToItem = useCallback(
    (item: HeroSearchFlatItem) => {
      switch (item.kind) {
        case "event":
          navigate(`/events/${item.slug}`);
          break;
        case "city":
          navigate(
            item.geoCityId
              ? `/events?geoCityId=${item.geoCityId}`
              : `/events?city=${encodeURIComponent(item.city)}`,
          );
          break;
        case "sport":
          navigate(`/events?sport=${encodeURIComponent(item.slug)}`);
          break;
        case "view-all":
          navigateToEvents({ q: trimmed });
          break;
      }
      setOpen(false);
      setQuery("");
      dispatch(clearSearchSuggestions());
    },
    [dispatch, navigate, navigateToEvents, trimmed],
  );

  const submitSearch = useCallback(() => {
    if (highlightIndex >= 0 && flatItems[highlightIndex]) {
      goToItem(flatItems[highlightIndex]);
      return;
    }
    navigateToEvents();
  }, [flatItems, goToItem, highlightIndex, navigateToEvents]);

  const dateLabel =
    datePreset === "all"
      ? t("home.hero.mobileAllDates")
      : datePreset === "thisMonth"
        ? t("home.hero.mobileThisMonth")
        : t("home.hero.mobileNextThreeMonths");

  return (
    <div
      ref={rootRef}
      className={cn(
        "relative w-full min-w-0 md:hidden group",
        open && trimmed.length >= 2 && "z-[200]",
      )}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submitSearch();
        }}
        className="relative"
      >
        <div
          className="absolute -inset-1 z-0 rounded-[1.35rem] bg-triboo-gradient opacity-20 blur-xl pointer-events-none"
          aria-hidden
        />
        <div
          className={cn(
            "relative z-10 overflow-hidden rounded-2xl border bg-white/[0.08] backdrop-blur-2xl transition-[border-color,box-shadow] duration-200",
            open
              ? "border-primary/30 shadow-none"
              : "border-white/12 shadow-[0_20px_60px_rgba(0,0,0,0.5)]",
          )}
        >
          <div
            className={cn(
              "flex items-center gap-2.5 px-3 min-h-[52px] min-w-0",
              trimmed && !open && "bg-white/[0.04]",
            )}
          >
            <button
              type="button"
              onClick={submitSearch}
              className="shrink-0 touch-manipulation rounded-lg p-1 -ml-1 text-primary/80 hover:text-primary active:scale-95 transition-transform"
              aria-label={t("home.hero.searchCta")}
            >
              <Search className="w-5 h-5" aria-hidden />
            </button>
            <input
              ref={inputRef}
              type="text"
              inputMode="search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setOpen(true);
              }}
              onFocus={() => trimmed.length >= 2 && setOpen(true)}
              placeholder={t("home.hero.searchEvents")}
              className={heroMobileInputClass}
              autoComplete="off"
              enterKeyHint="search"
              role="combobox"
              aria-expanded={open && trimmed.length >= 2}
              aria-controls="hero-mobile-search-listbox"
            />
            {query.length > 0 ? (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setOpen(false);
                  dispatch(clearSearchSuggestions());
                  inputRef.current?.focus();
                }}
                className="shrink-0 rounded-full p-1 text-white/40 hover:text-white hover:bg-white/10 transition-colors"
                aria-label={t("home.hero.searchClear")}
              >
                <X className="w-4 h-4" />
              </button>
            ) : null}
          </div>

          <div className="relative z-20 flex items-center gap-2 border-t border-white/10 px-2 py-2">
            <Button
              type="button"
              size="icon"
              disabled={locating}
              onClick={locateNearestCity}
              className="h-11 w-11 shrink-0 rounded-xl bg-triboo-gradient text-primary-foreground hover:brightness-110 shadow-glow-triboo border-0 touch-manipulation active:scale-95 disabled:opacity-70"
              aria-label={t("home.hero.mobileLocateMe")}
            >
              {locating ? (
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
              ) : (
                <LocateFixed className="w-4 h-4" aria-hidden />
              )}
            </Button>

            <button
              type="button"
              onClick={openCitySheet}
              className="flex min-w-0 flex-1 items-center gap-1.5 rounded-lg px-2 py-2.5 min-h-[44px] text-left text-sm text-white/85 touch-manipulation active:bg-white/[0.06]"
            >
              <MapPin className="w-4 h-4 shrink-0 text-white/55" />
              <span className="truncate">{cityLabel || t("home.hero.mobileAllCities")}</span>
              <ChevronDown className="w-3.5 h-3.5 shrink-0 text-white/45 ml-auto" />
            </button>

            <div className="h-6 w-px shrink-0 bg-white/15" aria-hidden />

            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setDateSheetOpen(true);
              }}
              className="flex min-w-0 flex-1 items-center gap-1.5 rounded-lg px-2 py-2.5 min-h-[44px] text-left text-sm text-white/85 touch-manipulation active:bg-white/[0.06]"
            >
              <CalendarDays className="w-4 h-4 shrink-0 text-white/55" />
              <span className="truncate">{dateLabel}</span>
              <ChevronDown className="w-3.5 h-3.5 shrink-0 text-white/45 ml-auto" />
            </button>
          </div>
        </div>
      </form>

      <div
        id="hero-mobile-search-listbox"
        className="relative z-[100] mt-2 pointer-events-none [&>*]:pointer-events-auto"
      >
        <HeroSearchDropdown
          open={open}
          loading={searchSuggestionsLoading}
          query={trimmed}
          data={searchSuggestions}
          highlightIndex={highlightIndex}
          flatItems={flatItems}
          onHighlight={setHighlightIndex}
          onSelect={goToItem}
        />
      </div>

      <Sheet open={citySheetOpen} onOpenChange={setCitySheetOpen}>
        <SheetContent
          side="bottom"
          className="z-[60] rounded-t-2xl bg-card border-border max-h-[75vh] pb-28"
        >
          <SheetHeader>
            <SheetTitle>{t("home.hero.mobilePickCity")}</SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-1 overflow-y-auto max-h-[55vh] pb-4">
            {loadingMeta && cities.length === 0 ? (
              <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground text-sm">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                {t("common.loading")}
              </div>
            ) : null}
            <button
              type="button"
              className="w-full rounded-xl px-3 py-3 text-left text-sm hover:bg-muted/40 transition-colors touch-manipulation"
              onClick={() => {
                setCityLabel("");
                setGeoCityId("");
                setCitySheetOpen(false);
              }}
            >
              {t("home.hero.mobileAllCities")}
            </button>
            {cities.map((c) => (
              <button
                key={`${c.city}-${c.state}`}
                type="button"
                className={cn(
                  "w-full rounded-xl px-3 py-3 text-left text-sm transition-colors touch-manipulation",
                  geoCityId === String(c.id)
                    ? "bg-primary/15 text-primary"
                    : "hover:bg-muted/40",
                )}
                onClick={() => {
                  setCityLabel(c.city);
                  setGeoCityId(String(c.id));
                  setCitySheetOpen(false);
                }}
              >
                <span className="font-medium">{c.city}</span>
                {c.state ? (
                  <span className="text-muted-foreground"> · {c.state}</span>
                ) : null}
              </button>
            ))}
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={dateSheetOpen} onOpenChange={setDateSheetOpen}>
        <SheetContent side="bottom" className="z-[60] rounded-t-2xl bg-card border-border pb-28">
          <SheetHeader>
            <SheetTitle>{t("home.hero.mobilePickDates")}</SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-1 pb-6">
            {(["all", "thisMonth", "nextThreeMonths"] as DatePreset[]).map((preset) => (
              <button
                key={preset}
                type="button"
                className={cn(
                  "w-full rounded-xl px-3 py-3 text-left text-sm transition-colors",
                  datePreset === preset ? "bg-primary/15 text-primary" : "hover:bg-muted/40",
                )}
                onClick={() => {
                  setDatePreset(preset);
                  setDateSheetOpen(false);
                }}
              >
                {preset === "all"
                  ? t("home.hero.mobileAllDates")
                  : preset === "thisMonth"
                    ? t("home.hero.mobileThisMonth")
                    : t("home.hero.mobileNextThreeMonths")}
              </button>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

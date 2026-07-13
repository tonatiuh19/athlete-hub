import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import HeroSearchDropdown, {
  buildHeroSearchFlatItems,
  type HeroSearchFlatItem,
} from "@/components/home/HeroSearchDropdown";
import {
  marketplaceSearchGlowClass,
  marketplaceSearchInnerClass,
  marketplaceSearchInputClass,
  marketplaceSearchOuterClass,
} from "@/components/events/marketplaceSearchBarStyles";
import { cn } from "@/lib/utils";
import { useIsDarkTheme } from "@/hooks/use-is-dark-theme";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  clearSearchSuggestions,
  fetchSearchSuggestions,
} from "@/store/slices/marketplaceSlice";

export interface MarketplaceSearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onApplyQuery: (query: string) => void;
  onApplySport: (sportSlug: string) => void;
  onApplyCity: (city: string, geoCityId?: number) => void;
  placeholder?: string;
  listboxId?: string;
  className?: string;
  showFilters?: boolean;
  filtersOpen?: boolean;
  onFiltersClick?: () => void;
}

export default function MarketplaceSearchBar({
  value,
  onChange,
  onApplyQuery,
  onApplySport,
  onApplyCity,
  placeholder,
  listboxId = "marketplace-search-listbox",
  className,
  showFilters = false,
  filtersOpen = false,
  onFiltersClick,
}: MarketplaceSearchBarProps) {
  const { t } = useTranslation();
  const isDark = useIsDarkTheme();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { searchSuggestions, searchSuggestionsLoading } = useAppSelector(
    (s) => s.marketplace,
  );

  const [open, setOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);

  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const trimmed = value.trim();
  const flatItems = useMemo(
    () => buildHeroSearchFlatItems(searchSuggestions),
    [searchSuggestions],
  );

  const active = open || filtersOpen;

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

  const closeAndClearSuggestions = useCallback(() => {
    setOpen(false);
    dispatch(clearSearchSuggestions());
  }, [dispatch]);

  const goToItem = useCallback(
    (item: HeroSearchFlatItem) => {
      switch (item.kind) {
        case "event":
          navigate(`/events/${item.slug}`);
          onChange("");
          break;
        case "city":
          if (item.geoCityId) {
            onApplyCity(item.city, item.geoCityId);
          } else {
            onApplyCity(item.city);
          }
          onChange("");
          break;
        case "sport":
          onApplySport(item.slug);
          onChange("");
          break;
        case "view-all":
          onApplyQuery(trimmed);
          onChange(trimmed);
          break;
      }
      closeAndClearSuggestions();
    },
    [
      closeAndClearSuggestions,
      navigate,
      onApplyCity,
      onApplyQuery,
      onApplySport,
      onChange,
      trimmed,
    ],
  );

  const submitSearch = useCallback(() => {
    if (highlightIndex >= 0 && flatItems[highlightIndex]) {
      goToItem(flatItems[highlightIndex]);
      return;
    }
    onApplyQuery(trimmed);
    closeAndClearSuggestions();
  }, [
    closeAndClearSuggestions,
    flatItems,
    goToItem,
    highlightIndex,
    onApplyQuery,
    trimmed,
  ]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      setOpen(true);
      return;
    }
    if (e.key === "Escape") {
      setOpen(false);
      return;
    }
    if (!flatItems.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIndex((i) => (i + 1) % flatItems.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIndex((i) => (i <= 0 ? flatItems.length - 1 : i - 1));
    } else if (e.key === "Enter" && open && highlightIndex >= 0) {
      e.preventDefault();
      goToItem(flatItems[highlightIndex]);
    }
  };

  const resolvedPlaceholder =
    placeholder ?? t("home.hero.searchEvents");

  return (
    <div
      ref={rootRef}
      className={cn(
        "relative flex-1 min-w-0",
        open && trimmed.length >= 2 && "z-[200]",
        className,
      )}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submitSearch();
        }}
        className="relative"
      >
        <div className={marketplaceSearchGlowClass(active)} aria-hidden />
        <div className={marketplaceSearchOuterClass(active)}>
          <div className={marketplaceSearchInnerClass(active)}>
            <button
              type="submit"
              className="shrink-0 touch-manipulation rounded-xl p-2.5 text-primary active:scale-95 transition-transform"
              aria-label={t("home.hero.searchCta")}
            >
              <Search className="w-5 h-5" aria-hidden />
            </button>
            <input
              ref={inputRef}
              type="search"
              name="q"
              value={value}
              onChange={(e) => {
                onChange(e.target.value);
                setOpen(true);
              }}
              onFocus={() => trimmed.length >= 2 && setOpen(true)}
              onKeyDown={onKeyDown}
              placeholder={resolvedPlaceholder}
              className={marketplaceSearchInputClass()}
              autoComplete="off"
              enterKeyHint="search"
              role="combobox"
              aria-expanded={open && trimmed.length >= 2}
              aria-autocomplete="list"
              aria-controls={listboxId}
            />
            {value.length > 0 ? (
              <button
                type="button"
                onClick={() => {
                  onChange("");
                  setOpen(false);
                  dispatch(clearSearchSuggestions());
                  inputRef.current?.focus();
                }}
                className="shrink-0 rounded-full p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                aria-label={t("home.hero.searchClear")}
              >
                <X className="w-4 h-4" />
              </button>
            ) : null}
            {showFilters ? (
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  onFiltersClick?.();
                }}
                className={cn(
                  "relative shrink-0 flex h-10 w-10 items-center justify-center rounded-xl transition-colors touch-manipulation active:scale-95 lg:hidden",
                  filtersOpen
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:text-primary hover:bg-primary/10",
                )}
                aria-label={t("home.hero.openFilters")}
                aria-expanded={filtersOpen}
              >
                <SlidersHorizontal className="w-5 h-5" />
              </button>
            ) : null}
          </div>
        </div>
      </form>

      <div
        id={listboxId}
        className={cn(
          "relative z-[100] mt-2 pointer-events-none [&>*]:pointer-events-auto",
          !isDark && "md:absolute md:inset-x-0 md:top-full md:mt-2",
        )}
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
          variant={isDark ? "dark" : "light"}
        />
      </div>
    </div>
  );
}

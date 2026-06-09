import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import HeroSearchDropdown, {
  buildHeroSearchFlatItems,
  type HeroSearchFlatItem,
} from "@/components/home/HeroSearchDropdown";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  clearSearchSuggestions,
  fetchSearchSuggestions,
} from "@/store/slices/marketplaceSlice";

interface EventsSearchComboboxProps {
  value: string;
  onChange: (value: string) => void;
  onApplyQuery: (query: string) => void;
  onApplySport: (sportSlug: string) => void;
  onApplyCity: (city: string, geoCityId?: number) => void;
  className?: string;
}

export default function EventsSearchCombobox({
  value,
  onChange,
  onApplyQuery,
  onApplySport,
  onApplyCity,
  className,
}: EventsSearchComboboxProps) {
  const { t } = useTranslation();
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
    const onPointerDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
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

  return (
    <div
      ref={rootRef}
      className={cn("relative flex-1 min-w-0", open && "z-50", className)}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submitSearch();
        }}
        className="relative"
      >
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none z-10" />
        <Input
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
          placeholder={t("eventsBrowse.searchPlaceholder")}
          className="pl-10 pr-10 h-11 bg-surface-dark/80 border-gray-700/80 focus-visible:ring-cyan rounded-xl"
          autoComplete="off"
          enterKeyHint="search"
          role="combobox"
          aria-expanded={open && trimmed.length >= 2}
          aria-autocomplete="list"
          aria-controls="events-browse-search-listbox"
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
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full text-gray-500 hover:text-white hover:bg-white/10 transition-colors z-10"
            aria-label={t("home.hero.searchClear")}
          >
            <X className="w-4 h-4" />
          </button>
        ) : null}
      </form>

      <div
        id="events-browse-search-listbox"
        className="absolute inset-x-0 top-full z-[100] pointer-events-none [&>*]:pointer-events-auto"
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
    </div>
  );
}

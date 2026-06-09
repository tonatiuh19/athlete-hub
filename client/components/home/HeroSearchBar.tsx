import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import HeroSearchDropdown, {
  buildHeroSearchFlatItems,
  type HeroSearchFlatItem,
} from "@/components/home/HeroSearchDropdown";
import { cn } from "@/lib/utils";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  clearSearchSuggestions,
  fetchSearchSuggestions,
} from "@/store/slices/marketplaceSlice";

const heroInputClass =
  "w-full min-w-0 h-12 flex-1 bg-transparent border-0 p-0 m-0 text-base text-white placeholder:text-white/40 outline-none shadow-none ring-0 appearance-none focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 caret-primary";

export default function HeroSearchBar() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { searchSuggestions, searchSuggestionsLoading } = useAppSelector(
    (s) => s.marketplace,
  );

  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);

  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const trimmed = query.trim();
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
          navigate(`/events?q=${encodeURIComponent(trimmed)}`);
          break;
      }
      setOpen(false);
      setQuery("");
      dispatch(clearSearchSuggestions());
    },
    [dispatch, navigate, trimmed],
  );

  const submitSearch = useCallback(() => {
    if (highlightIndex >= 0 && flatItems[highlightIndex]) {
      goToItem(flatItems[highlightIndex]);
      return;
    }
    const params = new URLSearchParams();
    if (trimmed) params.set("q", trimmed);
    const qs = params.toString();
    navigate(qs ? `/events?${qs}` : "/events");
    setOpen(false);
    dispatch(clearSearchSuggestions());
  }, [dispatch, flatItems, goToItem, highlightIndex, navigate, trimmed]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    submitSearch();
  };

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
      className={cn(
        "relative w-full max-w-3xl min-w-0 group isolate",
        open && "z-50",
      )}
    >
      <form onSubmit={handleSearch} className="relative z-10">
        <div
          className="absolute -inset-1 z-0 rounded-[1.35rem] bg-triboo-gradient opacity-20 blur-xl group-hover:opacity-35 transition-opacity duration-500 pointer-events-none"
          aria-hidden
        />
        <div
          className={cn(
            "relative z-10 flex flex-col sm:flex-row gap-2 sm:gap-0 rounded-2xl border bg-white/[0.08] backdrop-blur-2xl p-2 transition-[border-color,box-shadow] duration-200",
            open
              ? "border-primary/30 shadow-none"
              : "border-white/12 shadow-[0_20px_60px_rgba(0,0,0,0.5)]",
          )}
        >
          <div
            className={cn(
              "flex flex-1 items-center gap-2.5 px-3 min-h-[52px] min-w-0 rounded-xl sm:rounded-l-xl sm:rounded-r-none transition-colors duration-200",
              trimmed && !open && "bg-white/[0.04]",
            )}
          >
            <Search
              className={cn(
                "w-5 h-5 shrink-0 transition-colors",
                trimmed ? "text-primary" : "text-primary/80",
              )}
              aria-hidden
            />
            <input
              ref={inputRef}
              type="text"
              name="q"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setOpen(true);
              }}
              onFocus={() => trimmed.length >= 2 && setOpen(true)}
              onKeyDown={onKeyDown}
              placeholder={t("home.hero.searchEvents")}
              className={heroInputClass}
              autoComplete="off"
              enterKeyHint="search"
              role="combobox"
              aria-expanded={open && trimmed.length >= 2}
              aria-autocomplete="list"
              aria-controls="hero-search-listbox"
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
                className="shrink-0 p-1 rounded-full text-white/40 hover:text-white hover:bg-white/10 transition-colors"
                aria-label={t("home.hero.searchClear")}
              >
                <X className="w-4 h-4" />
              </button>
            ) : null}
          </div>
          <Button
            type="submit"
            className="h-12 w-full sm:w-auto sm:min-w-[128px] rounded-xl bg-triboo-gradient text-primary-foreground font-bold text-base hover:brightness-110 shadow-glow-triboo border-0 shrink-0"
          >
            {t("home.hero.searchCta")}
          </Button>
        </div>
      </form>

      <div id="hero-search-listbox" className="absolute inset-x-0 top-full z-[100] pointer-events-none [&>*]:pointer-events-auto">
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

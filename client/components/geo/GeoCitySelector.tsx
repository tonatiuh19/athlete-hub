import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { AlertCircle, Check, ChevronsUpDown, Loader2, MapPin } from "lucide-react";
import type { GeoCity } from "@shared/api";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchGeoCities, fetchGeoStates } from "@/store/slices/geoSlice";
import { cn } from "@/lib/utils";

export type GeoLocationSelection = {
  stateId: number | null;
  geoCityId: number | null;
  city: string;
  state: string;
  lat?: number | null;
  lng?: number | null;
};

type GeoCitySelectorProps = {
  stateId: number | null;
  cityId: number | null;
  cityName?: string;
  stateName?: string;
  onChange: (value: GeoLocationSelection) => void;
  disabled?: boolean;
  country?: string;
  /** Drives support copy when a city is missing from the catalog */
  staffRole?: "admin" | "organizer";
  /** Parent finished a cross-state name lookup without finding a catalog match */
  legacySearchResolved?: boolean;
  className?: string;
};

export default function GeoCitySelector({
  stateId,
  cityId,
  cityName = "",
  stateName = "",
  onChange,
  disabled = false,
  country = "MX",
  staffRole = "organizer",
  legacySearchResolved = false,
  className,
}: GeoCitySelectorProps) {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const { states, citiesByStateId, loadingStates, loadingCities, statesError, citiesError } =
    useAppSelector((s) => s.geo);

  const [cityOpen, setCityOpen] = useState(false);
  const [citySearch, setCitySearch] = useState("");

  useEffect(() => {
    if (states.length === 0) {
      dispatch(fetchGeoStates(country));
    }
  }, [dispatch, states.length, country]);

  useEffect(() => {
    if (!stateId) return;
    if (!citiesByStateId[stateId]) {
      dispatch(fetchGeoCities({ stateId, country }));
    }
  }, [dispatch, stateId, citiesByStateId, country]);

  useEffect(() => {
    if (!stateId || !citySearch.trim()) return;
    const timer = window.setTimeout(() => {
      dispatch(fetchGeoCities({ stateId, q: citySearch, country }));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [dispatch, stateId, citySearch, country]);

  const cities = stateId ? (citiesByStateId[stateId] ?? []) : [];
  const citiesLoadedForState =
    stateId != null && citiesByStateId[stateId] !== undefined && !loadingCities;

  const selectedCity = useMemo(() => {
    if (cityId) {
      return cities.find((c) => c.id === cityId) ?? null;
    }
    if (cityName && stateId) {
      return cities.find((c) => c.name === cityName) ?? null;
    }
    return null;
  }, [cityId, cities, cityName, stateId]);

  const unresolvedLegacy = useMemo(() => {
    if (!cityName.trim() || cityId != null || selectedCity) return false;
    if (stateId && citiesLoadedForState) {
      return !cities.some((c) => c.name === cityName.trim());
    }
    if (legacySearchResolved && !stateId) return true;
    return false;
  }, [
    cityName,
    cityId,
    selectedCity,
    stateId,
    citiesLoadedForState,
    cities,
    legacySearchResolved,
  ]);

  const selectedState = states.find((s) => s.id === stateId) ?? null;

  const supportMessage =
    staffRole === "admin"
      ? t("geo.citySelector.supportMessageAdmin")
      : t("geo.citySelector.supportMessageOrganizer");

  const handleStateChange = (value: string) => {
    if (value === "none") {
      onChange({
        stateId: null,
        geoCityId: null,
        city: "",
        state: "",
        lat: null,
        lng: null,
      });
      return;
    }
    const nextStateId = Number(value);
    const state = states.find((s) => s.id === nextStateId);
    onChange({
      stateId: nextStateId,
      geoCityId: null,
      city: "",
      state: state?.name ?? "",
      lat: null,
      lng: null,
    });
  };

  const handleCitySelect = (city: GeoCity) => {
    onChange({
      stateId: city.state_id,
      geoCityId: city.id,
      city: city.name,
      state: city.state_name,
      lat: city.lat != null ? Number(city.lat) : null,
      lng: city.lng != null ? Number(city.lng) : null,
    });
    setCityOpen(false);
    setCitySearch("");
  };

  const handleClearLegacy = () => {
    onChange({
      stateId: null,
      geoCityId: null,
      city: "",
      state: "",
      lat: null,
      lng: null,
    });
  };

  const cityLabel = unresolvedLegacy
    ? t("geo.citySelector.notInCatalog")
    : selectedCity?.name ??
      (cityId ? cityName : null) ??
      t("geo.citySelector.cityPlaceholder");

  return (
    <div className={cn("space-y-3 w-full min-w-0", className)}>
      {unresolvedLegacy ? (
        <Alert variant="destructive" className="border-destructive/40 bg-destructive/5">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>{t("geo.citySelector.unresolvedTitle")}</AlertTitle>
          <AlertDescription className="space-y-2 text-sm">
            <p>
              {t("geo.citySelector.unresolvedBody", {
                city: cityName,
                state: stateName || t("geo.citySelector.unknownState"),
              })}
            </p>
            <p>{supportMessage}</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-1"
              onClick={handleClearLegacy}
            >
              {t("geo.citySelector.clearAndReselect")}
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      {statesError ? (
        <Alert variant="destructive" className="border-destructive/40 bg-destructive/5">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{t("geo.citySelector.statesLoadError")}</AlertDescription>
        </Alert>
      ) : null}

      {citiesError && stateId ? (
        <Alert variant="destructive" className="border-destructive/40 bg-destructive/5">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{t("geo.citySelector.citiesLoadError")}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2 min-w-0">
          <Label>{t("geo.citySelector.state")}</Label>
          <Select
            value={stateId ? String(stateId) : "none"}
            onValueChange={handleStateChange}
            disabled={disabled || loadingStates}
          >
            <SelectTrigger className="w-full min-w-0">
              <SelectValue placeholder={t("geo.citySelector.statePlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">{t("geo.citySelector.statePlaceholder")}</SelectItem>
              {states.map((s) => (
                <SelectItem key={s.id} value={String(s.id)}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2 min-w-0">
          <Label>{t("geo.citySelector.city")}</Label>
          <Popover open={cityOpen} onOpenChange={setCityOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                role="combobox"
                aria-expanded={cityOpen}
                disabled={disabled || !stateId}
                className={cn(
                  "w-full min-w-0 justify-between font-normal",
                  !selectedCity && "text-muted-foreground",
                  unresolvedLegacy && "border-destructive/60",
                )}
              >
                <span className="flex items-center gap-2 truncate">
                  <MapPin className="w-3.5 h-3.5 shrink-0 opacity-60" />
                  {cityLabel}
                </span>
                {loadingCities ? (
                  <Loader2 className="w-4 h-4 shrink-0 animate-spin opacity-50" />
                ) : (
                  <ChevronsUpDown className="w-4 h-4 shrink-0 opacity-50" />
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
              <Command shouldFilter={false}>
                <CommandInput
                  placeholder={t("geo.citySelector.searchPlaceholder")}
                  value={citySearch}
                  onValueChange={setCitySearch}
                />
                <CommandList>
                  <CommandEmpty>
                    <div className="px-2 py-3 text-center text-sm text-muted-foreground space-y-1">
                      <p>{t("geo.citySelector.noResults")}</p>
                      <p className="text-xs">{supportMessage}</p>
                    </div>
                  </CommandEmpty>
                  <CommandGroup>
                    {cities.map((city) => (
                      <CommandItem
                        key={city.id}
                        value={String(city.id)}
                        onSelect={() => handleCitySelect(city)}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            selectedCity?.id === city.id || cityId === city.id
                              ? "opacity-100"
                              : "opacity-0",
                          )}
                        />
                        {city.name}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
          {selectedState ? (
            <p className="text-xs text-muted-foreground">
              {t("geo.citySelector.hint", { state: selectedState.name })}
            </p>
          ) : !stateId ? (
            <p className="text-xs text-muted-foreground">
              {t("geo.citySelector.selectStateFirst")}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

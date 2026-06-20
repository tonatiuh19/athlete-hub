type SavedEventLocation = {
  city: string | null | undefined;
  state: string | null | undefined;
};

function locationMatchesSaved(
  city: string,
  state: string,
  saved: SavedEventLocation,
): boolean {
  return (
    city.trim() === (saved.city ?? "").trim() &&
    state.trim() === (saved.state ?? "").trim()
  );
}

/** Location city must come from geo catalog when set (no free-text). */
export function isCatalogCitySelectionValid(
  geoCityId: number | null,
  locationCity: string,
  savedLocation?: SavedEventLocation,
  locationState = "",
): boolean {
  if (!locationCity.trim()) return true;
  if (geoCityId != null) return true;
  if (
    savedLocation &&
    locationMatchesSaved(locationCity, locationState, savedLocation)
  ) {
    return true;
  }
  return false;
}

/** Organizer city: catalog id, unchanged saved city, or empty. */
export function isOrganizerCitySelectionValid(
  geoCityId: number | null,
  city: string,
  savedCity?: string | null,
): boolean {
  if (!city.trim()) return true;
  if (geoCityId != null) return true;
  if (savedCity && city.trim() === savedCity.trim()) return true;
  return false;
}

/** Strip denormalized city/state unless a catalog row was selected. */
export function enforceCatalogCityOnEventBody<
  T extends { location_city?: string | null; location_state?: string | null },
>(
  body: T,
  geoCityId: number | null,
  savedLocation?: SavedEventLocation,
): T {
  if (geoCityId != null) return body;
  const city = (body.location_city ?? "").trim();
  const state = (body.location_state ?? "").trim();
  if (!city) return body;
  if (savedLocation && locationMatchesSaved(city, state, savedLocation)) {
    return body;
  }
  return { ...body, location_city: null, location_state: null };
}

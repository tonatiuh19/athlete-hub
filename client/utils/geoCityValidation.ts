/** Location city must come from geo catalog when set (no free-text). */
export function isCatalogCitySelectionValid(
  geoCityId: number | null,
  locationCity: string,
): boolean {
  if (!locationCity.trim()) return true;
  return geoCityId != null;
}

/** Strip denormalized city/state unless a catalog row was selected. */
export function enforceCatalogCityOnEventBody<
  T extends { location_city?: string | null; location_state?: string | null },
>(body: T, geoCityId: number | null): T {
  if (geoCityId != null) return body;
  return { ...body, location_city: null, location_state: null };
}

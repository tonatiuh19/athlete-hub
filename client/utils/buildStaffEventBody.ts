import type { StaffEventUpsertRequest } from "@shared/api";
import { fromDatetimeLocal } from "@/utils/datetimeLocal";

export type EventEditFormValues = {
  title: string;
  slug: string;
  sport_type_id: number;
  short_description: string;
  description: string;
  status: string;
  visibility: string;
  featured: boolean;
  requires_waiver: boolean;
  start_date: string;
  end_date: string;
  registration_opens_at: string;
  registration_closes_at: string;
  location_city: string;
  location_state: string;
  location_name: string;
  location_lat: string;
  location_lng: string;
  hero_image_url: string;
  max_registrations: string;
};

export function buildStaffEventBody(
  values: EventEditFormValues,
  overrides?: Partial<StaffEventUpsertRequest>,
): StaffEventUpsertRequest {
  const latRaw = values.location_lat.trim();
  const lngRaw = values.location_lng.trim();

  return {
    title: values.title.trim(),
    slug: values.slug.trim() || undefined,
    sport_type_id: Number(values.sport_type_id),
    short_description: values.short_description.trim() || null,
    description: values.description.trim() || null,
    status: values.status,
    visibility: values.visibility,
    featured: values.featured,
    requires_waiver: values.requires_waiver,
    start_date: fromDatetimeLocal(values.start_date) ?? values.start_date,
    end_date: fromDatetimeLocal(values.end_date),
    registration_opens_at: fromDatetimeLocal(values.registration_opens_at),
    registration_closes_at: fromDatetimeLocal(values.registration_closes_at),
    location_city: values.location_city.trim() || null,
    location_state: values.location_state.trim() || null,
    location_name: values.location_name.trim() || null,
    location_lat: latRaw ? Number(latRaw) : null,
    location_lng: lngRaw ? Number(lngRaw) : null,
    hero_image_url: values.hero_image_url.trim() || null,
    max_registrations: values.max_registrations
      ? Number(values.max_registrations)
      : null,
    ...overrides,
  };
}

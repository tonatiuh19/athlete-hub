import type { StaffEventDetail, StaffEventUpsertRequest, FeePresentation } from "@shared/api";
import { fromDatetimeLocal, toDatetimeLocal } from "@/utils/datetimeLocal";
import { parseFormCoordinate } from "@/utils/formCoordinates";

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
  check_in_opens_at: string;
  check_in_closes_at: string;
  location_city: string;
  location_state: string;
  location_name: string;
  location_lat: string;
  location_lng: string;
  hero_image_url: string;
  banner_image_url: string;
  max_registrations: string;
  max_registrations_per_order: string;
  fee_presentation: "inherit" | FeePresentation;
};

export function buildEventEditFormValues(
  event: StaffEventDetail | undefined,
  sportTypes: { id: number }[],
): EventEditFormValues {
  return {
    title: event?.title ?? "",
    slug: event?.slug ?? "",
    sport_type_id: event?.sport_type_id ?? sportTypes[0]?.id ?? 0,
    short_description: event?.short_description ?? "",
    description: event?.description ?? "",
    status: event?.status ?? "draft",
    visibility: event?.visibility ?? "public",
    featured: Boolean(event?.featured),
    requires_waiver: Boolean(event?.requires_waiver),
    start_date: toDatetimeLocal(event?.start_date),
    end_date: toDatetimeLocal(event?.end_date),
    registration_opens_at: toDatetimeLocal(event?.registration_opens_at),
    registration_closes_at: toDatetimeLocal(event?.registration_closes_at),
    check_in_opens_at: toDatetimeLocal(event?.check_in_opens_at),
    check_in_closes_at: toDatetimeLocal(event?.check_in_closes_at),
    location_city: event?.location_city ?? "",
    location_state: event?.location_state ?? "",
    location_name: event?.location_name ?? "",
    location_lat:
      event?.location_lat != null && event.location_lat !== ""
        ? String(event.location_lat)
        : "",
    location_lng:
      event?.location_lng != null && event.location_lng !== ""
        ? String(event.location_lng)
        : "",
    hero_image_url: event?.hero_image_url ?? "",
    banner_image_url: event?.banner_image_url ?? "",
    max_registrations: event?.max_registrations?.toString() ?? "",
    max_registrations_per_order:
      event?.max_registrations_per_order?.toString() ?? "10",
    fee_presentation: event?.fee_presentation ?? "inherit",
  };
}

export function buildStaffEventBody(
  values: EventEditFormValues,
  overrides?: Partial<StaffEventUpsertRequest>,
): StaffEventUpsertRequest {
  const location_lat = parseFormCoordinate(values.location_lat);
  const location_lng = parseFormCoordinate(values.location_lng);

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
    check_in_opens_at: fromDatetimeLocal(values.check_in_opens_at),
    check_in_closes_at: fromDatetimeLocal(values.check_in_closes_at),
    location_city: values.location_city.trim() || null,
    location_state: values.location_state.trim() || null,
    location_name: values.location_name.trim() || null,
    location_lat,
    location_lng,
    hero_image_url: values.hero_image_url.trim() || null,
    banner_image_url: values.banner_image_url.trim() || null,
    max_registrations: values.max_registrations
      ? Number(values.max_registrations)
      : null,
    max_registrations_per_order: values.max_registrations_per_order
      ? Number(values.max_registrations_per_order)
      : 10,
    fee_presentation:
      values.fee_presentation === "inherit" ? null : values.fee_presentation,
    ...overrides,
  };
}

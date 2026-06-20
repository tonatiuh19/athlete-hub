import type { AdminOrganizerUpdateRequest } from "@shared/api";
import { slugify } from "@shared/slugify";

export const ORGANIZER_SLUG_MAX = 80;

export const ORGANIZER_STATUSES = [
  "pending",
  "active",
  "suspended",
  "inactive",
] as const;

export type OrganizerStatus = (typeof ORGANIZER_STATUSES)[number];

export function normalizeOrganizerStatus(raw: unknown): OrganizerStatus {
  const normalized = String(raw ?? "")
    .trim()
    .toLowerCase();
  return (ORGANIZER_STATUSES as readonly string[]).includes(normalized)
    ? (normalized as OrganizerStatus)
    : "pending";
}

export function isOrganizerStatus(value: string): value is OrganizerStatus {
  return (ORGANIZER_STATUSES as readonly string[]).includes(value);
}

export function buildOrganizerUpdatePatch(input: {
  name: string;
  email: string;
  phone: string;
  city: string;
  slug: string;
  status: unknown;
  service_fee_percent: number;
  fee_presentation: "pass_through" | "absorb_all";
  geoCityId: number | null;
  savedCity?: string | null;
  fallbackStatus?: OrganizerStatus;
}): AdminOrganizerUpdateRequest {
  const rawStatus = String(input.status ?? "").trim().toLowerCase();
  const status = (ORGANIZER_STATUSES as readonly string[]).includes(rawStatus)
    ? (rawStatus as OrganizerStatus)
    : (input.fallbackStatus ?? "pending");

  const patch: AdminOrganizerUpdateRequest = {
    name: input.name.trim(),
    email: input.email.trim(),
    status,
    service_fee_percent: input.service_fee_percent,
    fee_presentation: input.fee_presentation,
  };

  const phone = input.phone.trim();
  patch.phone = phone || null;

  const city = input.city.trim();
  const savedCity = input.savedCity?.trim() ?? "";
  if (city) {
    const cityChanged = savedCity && city !== savedCity;
    if (input.geoCityId != null || !cityChanged) {
      patch.city = city;
    }
  } else {
    patch.city = null;
  }

  const slug = slugify(input.slug.trim() || input.name.trim(), ORGANIZER_SLUG_MAX);
  if (slug) {
    patch.slug = slug;
  }

  return patch;
}

/**
 * Shared types between client and server
 */

export interface HealthResponse {
  status: string;
  database?: string;
  timestamp: string;
}

export interface PingResponse {
  message: string;
}

export interface AppVersionResponse {
  version: string | null;
}

export interface SportType {
  id: number;
  slug: string;
  name: string;
  icon?: string;
}

export interface SportTypesResponse {
  sportTypes: SportType[];
}

export interface EventListItem {
  id: number;
  slug: string;
  title: string;
  short_description?: string;
  start_date: string;
  end_date?: string;
  location_city?: string;
  location_state?: string;
  location_country: string;
  location_lat?: number | string | null;
  location_lng?: number | string | null;
  featured?: boolean;
  hero_image_url?: string;
  registration_count: number;
  registration_closes_at?: string;
  sport_slug: string;
  sport_name: string;
  organizer_name: string;
  organizer_slug: string;
  from_price_cents?: number | null;
}

export interface EventsListResponse {
  events: EventListItem[];
  total: number;
  limit: number;
  offset: number;
}

export type EventsSort =
  | "date_asc"
  | "date_desc"
  | "price_asc"
  | "price_desc"
  | "popular";

export interface EventsQueryParams {
  q?: string;
  sport?: string;
  city?: string;
  featured?: boolean;
  dateFrom?: string;
  dateTo?: string;
  minPrice?: number;
  maxPrice?: number;
  sort?: EventsSort;
  limit?: number;
  offset?: number;
}

export interface FilterCity {
  city: string;
  state?: string;
  event_count: number;
}

export type CoursePointType =
  | "start"
  | "finish"
  | "hydration"
  | "aid"
  | "km_marker"
  | "transition"
  | "other";

export interface CoursePoint {
  type: CoursePointType;
  name: string;
  lat: number;
  lng: number;
  km?: number;
  description?: string;
}

export interface GeoJsonLineString {
  type: "LineString";
  coordinates: [number, number][];
}

export interface EventCourse {
  routeGeojson: GeoJsonLineString | Record<string, unknown>;
  points: CoursePoint[];
  distanceKm?: number | string;
  elevationGainM?: number;
}

export interface EventMediaAsset {
  asset_type: string;
  url: string;
  alt_text?: string;
  mime_type?: string;
  sort_order: number;
  is_primary?: boolean;
}

export interface EventDetailEvent {
  id: number;
  slug: string;
  title: string;
  short_description?: string;
  description?: string;
  start_date: string;
  end_date?: string;
  registration_opens_at?: string;
  registration_closes_at?: string;
  timezone: string;
  location_name?: string;
  location_address?: string;
  location_city?: string;
  location_state?: string;
  location_country: string;
  location_lat?: number | string | null;
  location_lng?: number | string | null;
  hero_image_url?: string;
  banner_image_url?: string;
  featured?: boolean;
  registration_count: number;
  max_registrations?: number;
  requires_waiver?: boolean;
  sport_slug: string;
  sport_name: string;
  organizer_name: string;
  organizer_slug: string;
  organizer_logo?: string;
  venue_name?: string;
  venue_address?: string;
  venue_lat?: number | string | null;
  venue_lng?: number | string | null;
  status: string;
}

export type SponsorTier = "title" | "gold" | "silver" | "bronze" | "partner";

export interface EventSponsor {
  id?: number;
  name: string;
  logo_url?: string;
  website_url?: string;
  tier?: SponsorTier;
  sort_order: number;
}

export interface EventSponsorInput {
  name: string;
  logo_url?: string;
  website_url?: string;
  tier?: SponsorTier;
  sort_order?: number;
}

export interface EventSponsorsUpdateRequest {
  sponsors: EventSponsorInput[];
}

export interface EventSponsorsResponse {
  sponsors: EventSponsor[];
}

export interface EventTag {
  slug: string;
  name: string;
  category?: string;
}

export interface ScheduleWave {
  id: number;
  name: string;
  starts_at: string;
  capacity?: number;
  registered_count: number;
  sort_order: number;
}

export interface EventCategory {
  id: number;
  name: string;
  description?: string;
  distance_km?: number;
  difficulty?: string;
  capacity?: number;
  sold_count: number;
  price_cents: number;
  service_fee_cents?: number;
  total_cents?: number;
  price_formatted?: string;
  service_fee_formatted?: string;
  total_formatted?: string;
  gender_restriction: string;
  min_age?: number;
  max_age?: number;
  sort_order: number;
}

export interface EventRegistrationField {
  id: number;
  field_key: string;
  label: string;
  field_type: "text" | "textarea" | "select" | "checkbox" | "number" | "date" | "file";
  options_json?: string[] | null;
  is_required: boolean | number;
  sort_order: number;
}

export interface EventDetailResponse {
  event: EventDetailEvent;
  categories: EventCategory[];
  registrationFields: EventRegistrationField[];
  sponsors: EventSponsor[];
  tags: EventTag[];
  scheduleWaves: ScheduleWave[];
  serviceFeePercent: number;
  course: EventCourse | null;
  media: EventMediaAsset[];
}

export interface AthleteUser {
  id: number;
  email?: string;
  phone?: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string;
  preferredLanguage?: string;
}

export type StaffRole = "admin" | "organizer";

export interface AdminUser {
  type: "admin";
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
}

export interface OrganizerMemberUser {
  type: "organizer";
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  organizerId: number;
}

export type StaffUser = AdminUser | OrganizerMemberUser;

export interface AthleteProfile {
  id: number;
  email?: string;
  phone?: string;
  first_name: string;
  last_name: string;
  date_of_birth?: string;
  gender?: string;
  shirt_size?: string;
  country?: string;
  city?: string;
  avatar_url?: string;
  preferred_language: string;
  created_at: string;
}

export interface AuthVerifyResponse {
  token: string;
  athlete?: {
    id: number;
    email?: string;
    firstName: string;
    lastName: string;
  };
  member?: {
    id: number;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    organizerId: number;
  };
  admin?: {
    id: number;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
  };
}

export interface RegistrationItem {
  id: number;
  registration_number: string;
  qr_code_token: string;
  bib_number?: string;
  status: string;
  total_cents: number;
  created_at: string;
  event_title: string;
  event_slug: string;
  start_date: string;
  category_name: string;
}

export interface AthleteRegistrationsResponse {
  registrations: RegistrationItem[];
}

export interface PaymentConfigResponse {
  publishableKey: string | null;
  mockMode: boolean;
  currency: string;
}

export interface RegistrationCheckoutRequest {
  categoryId: number;
  fieldValues: Record<string, string | boolean>;
  idempotencyKey: string;
}

export interface RegistrationCheckoutResponse {
  registrationPublicUuid: string;
  paymentPublicUuid: string;
  clientSecret: string | null;
  mockMode: boolean;
  amountCents: number;
  registrationAmountCents: number;
  serviceFeeCents: number;
  currency: string;
  categoryName: string;
  eventTitle: string;
}

export interface RegistrationConfirmRequest {
  registrationPublicUuid: string;
  paymentIntentId?: string;
}

export interface RegistrationConfirmResponse {
  success: boolean;
  registration: {
    public_uuid: string;
    registration_number: string;
    qr_code_token: string;
    status: string;
    total_cents: number;
    category_name: string;
    event_title: string;
    event_slug: string;
  };
  error?: string;
}

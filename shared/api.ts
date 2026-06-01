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
  | "medical"
  | "restroom"
  | "spectator"
  | "risk"
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

export interface ElevationProfilePoint {
  km: number;
  elevation_m: number;
}

export interface EventCourse {
  routeGeojson: GeoJsonLineString | Record<string, unknown>;
  points: CoursePoint[];
  distanceKm?: number | string;
  elevationGainM?: number;
  elevationProfile?: ElevationProfilePoint[];
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
  waitlist_enabled?: boolean | number;
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

export interface EventMyRegistration {
  status: "confirmed";
  registrationPublicUuid: string;
  registrationNumber: string;
  categoryId: number;
  categoryName: string;
}

export interface EventWaiverPublic {
  id: number;
  title: string;
  content_html: string;
  version: number;
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
  waiver?: EventWaiverPublic | null;
  myRegistration?: EventMyRegistration | null;
}

export interface AthleteUser {
  id: number;
  email?: string;
  phone?: string;
  firstName: string;
  lastName: string;
  dateOfBirth?: string | null;
  gender?: AthleteGender | null;
  shirtSize?: AthleteShirtSize | null;
  country?: string;
  city?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  avatarUrl?: string;
  preferredLanguage?: string;
}

export type AthleteGender = "male" | "female" | "other" | "prefer_not_to_say";
export type AthleteShirtSize = "XS" | "S" | "M" | "L" | "XL" | "XXL";

export const ATHLETE_GENDERS: AthleteGender[] = [
  "male",
  "female",
  "other",
  "prefer_not_to_say",
];

export const ATHLETE_SHIRT_SIZES: AthleteShirtSize[] = [
  "XS",
  "S",
  "M",
  "L",
  "XL",
  "XXL",
];

export interface AthleteProfileUpdateRequest {
  first_name: string;
  last_name: string;
  phone?: string | null;
  date_of_birth?: string | null;
  gender?: AthleteGender | null;
  shirt_size?: AthleteShirtSize | null;
  country?: string;
  city?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
}

export interface AthleteMeResponse {
  athlete: AthleteProfile;
}

/** Maps snake_case API athlete row to client AthleteUser. */
export function mapAthleteApiRow(a: Record<string, unknown>): AthleteUser {
  return {
    id: a.id as number,
    email: (a.email as string | null) || undefined,
    phone: (a.phone as string | null) || undefined,
    firstName: String(a.first_name ?? a.firstName ?? ""),
    lastName: String(a.last_name ?? a.lastName ?? ""),
    dateOfBirth: (a.date_of_birth as string | null) ?? null,
    gender: (a.gender as AthleteGender | null) ?? null,
    shirtSize: (a.shirt_size as AthleteShirtSize | null) ?? null,
    country: (a.country as string | undefined) ?? "MX",
    city: (a.city as string | null) ?? null,
    emergencyContactName: (a.emergency_contact_name as string | null) ?? null,
    emergencyContactPhone: (a.emergency_contact_phone as string | null) ?? null,
    avatarUrl: (a.avatar_url ?? a.avatarUrl) as string | undefined,
    preferredLanguage: (a.preferred_language ?? a.preferredLanguage) as
      | string
      | undefined,
  };
}

export interface AthleteCheckEmailResponse {
  exists: boolean;
}

export type StaffRole = "admin" | "organizer";

export interface AdminUser {
  type: "admin";
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  phone?: string | null;
  avatarUrl?: string | null;
  preferredLanguage?: string;
  lastLoginAt?: string | null;
  createdAt?: string;
}

export interface OrganizerMemberUser {
  type: "organizer";
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  organizerId: number;
  organizerName?: string;
  phone?: string | null;
  avatarUrl?: string | null;
  preferredLanguage?: string;
  lastLoginAt?: string | null;
  createdAt?: string;
}

export interface StaffProfileUpdateRequest {
  first_name?: string;
  last_name?: string;
  phone?: string | null;
  preferred_language?: string;
}

export type StaffUser = AdminUser | OrganizerMemberUser;

export interface AthleteProfile {
  id: number;
  public_uuid?: string;
  email?: string;
  phone?: string;
  first_name: string;
  last_name: string;
  date_of_birth?: string | null;
  gender?: AthleteGender | null;
  shirt_size?: AthleteShirtSize | null;
  country?: string;
  city?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
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
  public_uuid: string;
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
  allows_transfers?: boolean | number;
}

export type AthleteResultStatus = "finished" | "dnf" | "dns" | "dq";

export interface AthleteResultItem {
  id: number;
  event_title: string;
  event_slug: string;
  start_date: string;
  category_name: string;
  registration_number: string;
  bib_number?: string | null;
  overall_rank?: number | null;
  category_rank?: number | null;
  gender_rank?: number | null;
  finish_time_ms?: number | null;
  pace_per_km_ms?: number | null;
  status: AthleteResultStatus;
  published_at: string;
  splits?: ResultSplitRow[];
}

export interface AthleteResultVisualization {
  resultId: number;
  finishTimeMs?: number | null;
  splits: ResultSplitRow[];
  course: EventCourse | null;
  paceSegments: PaceHeatmapSegment[];
}

export interface PaceHeatmapSegment {
  kmStart: number;
  kmEnd: number;
  pacePerKmMs: number;
  intensity: number;
}

export interface AthleteResultsResponse {
  results: AthleteResultItem[];
}

export interface AthleteAvatarUpdateRequest {
  image: string;
}

export interface AthleteAvatarResponse {
  ok: boolean;
  avatar_url: string | null;
}

export interface AthleteRegistrationsResponse {
  registrations: RegistrationItem[];
}

export interface PaymentConfigResponse {
  publishableKey: string;
  currency: string;
}

export interface RegistrationCheckoutRequest {
  categoryId: number;
  fieldValues: Record<string, string | boolean>;
  idempotencyKey: string;
  discountCode?: string;
  waiverId?: number;
  waiverSignature?: string;
  waitlistEntryId?: number;
}

export interface RegistrationCheckoutResponse {
  paymentPublicUuid: string;
  clientSecret: string | null;
  amountCents: number;
  registrationAmountCents: number;
  serviceFeeCents: number;
  currency: string;
  categoryName: string;
  eventTitle: string;
  discountAmountCents?: number;
  discountCode?: string;
}

export interface DiscountValidateRequest {
  code: string;
  categoryId: number;
}

export interface DiscountValidateResponse {
  valid: true;
  code: string;
  discountCodeId: number;
  discountType: "percent" | "fixed_cents";
  discountValue: number;
  appliesTo: "registration" | "service_fee" | "total";
  discountAmountCents: number;
  priceCents: number;
  serviceFeeCents: number;
  totalCents: number;
  originalPriceCents: number;
  originalServiceFeeCents: number;
  originalTotalCents: number;
}

export interface WaitlistJoinRequest {
  categoryId: number;
}

export interface WaitlistEntry {
  id: number;
  event_id: number;
  event_category_id: number;
  status: string;
  position: number;
  offered_at?: string | null;
  offer_expires_at?: string | null;
  created_at: string;
  event_title?: string;
  event_slug?: string;
  category_name?: string;
  can_claim?: boolean;
}

export interface AthleteWaitlistResponse {
  entries: WaitlistEntry[];
}

export interface StaffWaitlistEntry extends WaitlistEntry {
  athlete_id: number;
  athlete_first_name?: string;
  athlete_last_name?: string;
  athlete_email?: string;
}

export interface StaffWaitlistResponse {
  entries: StaffWaitlistEntry[];
}

export interface WaitlistOfferRequest {
  waitlistEntryId: number;
  offerExpiresHours?: number;
}

export interface RegistrationTransferRequest {
  recipientEmail: string;
}

export interface RegistrationTransferResponse {
  ok: boolean;
  transfer: {
    id: number;
    registration_id: number;
    status: string;
    completed_at?: string | null;
  };
}

export interface BulkBibRow {
  folio: string;
  bib: string;
}

export interface BulkBibImportRequest {
  rows: BulkBibRow[];
}

export interface BulkBibImportResponse {
  updated: number;
  errors: Array<{ folio: string; error: string }>;
}

export interface ResultSplitRow {
  id?: number;
  split_name: string;
  split_order: number;
  distance_km?: number | null;
  elapsed_ms: number;
  pace_per_km_ms?: number | null;
}

export interface ResultSplitsResponse {
  splits: ResultSplitRow[];
}

export interface ResultSplitsUpdateRequest {
  splits: ResultSplitRow[];
}

export interface StaffMediaAssetRow {
  id?: number;
  public_uuid?: string;
  asset_type: string;
  url: string;
  alt_text?: string | null;
  mime_type?: string | null;
  file_size_bytes?: number | null;
  width_px?: number | null;
  height_px?: number | null;
  sort_order: number;
  is_primary?: boolean;
}

export interface EventMediaResponse {
  media: StaffMediaAssetRow[];
}

export interface EventMediaUpdateRequest {
  media: StaffMediaAssetRow[];
}

export interface AdminEventCreateRequest extends StaffEventUpsertRequest {
  organizer_id: number;
}

export interface RegistrationConfirmRequest {
  paymentPublicUuid: string;
  paymentIntentId?: string;
  paymentMethodId?: string;
}

export interface AthletePaymentMethod {
  id: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
  isDefault: boolean;
}

export interface AthletePaymentMethodsResponse {
  paymentMethods: AthletePaymentMethod[];
  defaultPaymentMethodId: string | null;
}

export interface PaymentMethodSetupIntentResponse {
  clientSecret: string;
}

export interface SetDefaultPaymentMethodRequest {
  paymentMethodId: string;
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

export interface StaffDashboardStats {
  athletes?: number;
  organizers?: number;
  published_events?: number;
  confirmed_registrations?: number;
  total_revenue_cents?: number;
}

export interface StaffEventRow {
  id: number;
  slug: string;
  title: string;
  status: string;
  start_date: string;
  registration_count: number;
  sport_name?: string;
  organizer_name?: string;
  location_city?: string;
}

export interface AdminAthleteRow {
  id: number;
  email?: string | null;
  phone?: string | null;
  first_name: string;
  last_name: string;
  city?: string | null;
  country?: string;
  status: string;
  created_at: string;
  registration_count: number;
}

export interface AdminAnalyticsResponse {
  stats: StaffDashboardStats;
  last_30_days: {
    registrations: number;
    revenue_cents: number;
  };
  top_events: Array<{
    id: number;
    title: string;
    slug: string;
    registration_count: number;
    revenue_cents: number;
  }>;
}

export interface OrganizerRegistrationRow {
  id: number;
  registration_number: string;
  bib_number?: string | null;
  status: string;
  total_cents: number;
  created_at: string;
  checked_in_at?: string | null;
  event_id: number;
  event_title: string;
  event_slug: string;
  category_name: string;
  athlete_first_name: string;
  athlete_last_name: string;
  athlete_email?: string | null;
}

export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedRegistrationsResponse {
  registrations: OrganizerRegistrationRow[];
  pagination: PaginationInfo;
}

export interface StaffRegistrationPayment {
  id: number;
  public_uuid: string;
  amount_cents: number;
  registration_amount_cents: number;
  service_fee_cents: number;
  currency: string;
  status: string;
  provider: string;
  stripe_payment_intent_id?: string | null;
  stripe_charge_id?: string | null;
  paid_at?: string | null;
  created_at: string;
}

export interface StaffRegistrationFieldValue {
  field_key: string;
  label: string;
  field_type: string;
  value_text?: string | null;
  value_file_url?: string | null;
}

export interface StaffRegistrationWaiver {
  signed_at: string;
  signature_data?: string | null;
  waiver_name: string;
  waiver_version?: string | null;
}

export interface StaffRegistrationStatusHistoryRow {
  from_status?: string | null;
  to_status: string;
  actor_type: string;
  reason?: string | null;
  created_at: string;
}

export interface StaffRegistrationTransferRow {
  status: string;
  transfer_fee_cents: number;
  completed_at?: string | null;
  created_at: string;
  from_first_name: string;
  from_last_name: string;
  to_first_name: string;
  to_last_name: string;
}

export interface StaffPaymentRefundRow {
  id: number;
  amount_cents: number;
  currency: string;
  status: string;
  reason?: string | null;
  stripe_refund_id?: string | null;
  processed_at?: string | null;
  created_at: string;
}

export interface StaffRegistrationDetailRow extends OrganizerRegistrationRow {
  public_uuid: string;
  qr_code_token: string;
  price_cents: number;
  service_fee_cents: number;
  source: string;
  waiver_signed_at?: string | null;
  updated_at: string;
  event_category_id: number;
  athlete_id: number;
  athlete_phone?: string | null;
  payment_id?: number | null;
}

export interface StaffRegistrationDetailResponse {
  registration: StaffRegistrationDetailRow;
  payment: StaffRegistrationPayment | null;
  field_values: StaffRegistrationFieldValue[];
  waiver: StaffRegistrationWaiver | null;
  status_history: StaffRegistrationStatusHistoryRow[];
  transfers: StaffRegistrationTransferRow[];
  refunds: StaffPaymentRefundRow[];
}

export interface StaffManualRegistrationRequest {
  event_category_id: number;
  athlete_id?: number;
  athlete_email?: string;
  comp?: boolean;
  bib_number?: string;
  field_values?: Record<string, string>;
}

export interface AdminPaymentRow {
  id: number;
  public_uuid: string;
  registration_id?: number | null;
  athlete_id: number;
  organizer_id: number;
  event_id?: number | null;
  amount_cents: number;
  registration_amount_cents: number;
  service_fee_cents: number;
  currency: string;
  status: string;
  provider: string;
  stripe_payment_intent_id?: string | null;
  paid_at?: string | null;
  created_at: string;
  athlete_first_name?: string | null;
  athlete_last_name?: string | null;
  athlete_email?: string | null;
  event_title?: string | null;
  event_slug?: string | null;
  organizer_name?: string | null;
  registration_number?: string | null;
}

export interface PaginatedAdminPaymentsResponse {
  payments: AdminPaymentRow[];
  pagination: PaginationInfo;
}

export interface AdminPaymentDetail extends AdminPaymentRow {
  registration_status?: string | null;
  bib_number?: string | null;
  failure_code?: string | null;
  failure_message?: string | null;
  stripe_charge_id?: string | null;
}

export interface AdminPaymentDetailResponse {
  payment: AdminPaymentDetail;
}

export interface PaginatedAdminAthletesResponse {
  athletes: AdminAthleteRow[];
  pagination: PaginationInfo;
}

export interface StaffEventDetail {
  id: number;
  public_uuid: string;
  organizer_id: number;
  sport_type_id: number;
  slug: string;
  title: string;
  short_description?: string | null;
  description?: string | null;
  status: string;
  visibility: string;
  featured: number | boolean;
  start_date: string;
  end_date?: string | null;
  registration_opens_at?: string | null;
  registration_closes_at?: string | null;
  timezone?: string;
  location_name?: string | null;
  location_city?: string | null;
  location_state?: string | null;
  location_country?: string;
  location_lat?: number | string | null;
  location_lng?: number | string | null;
  hero_image_url?: string | null;
  registration_count: number;
  max_registrations?: number | null;
  sport_name?: string;
  organizer_name?: string;
}

export interface StaffEventCategory {
  id: number;
  public_uuid: string;
  name: string;
  description?: string | null;
  distance_km?: number | null;
  capacity?: number | null;
  sold_count: number;
  price_cents: number;
  currency?: string;
  gender_restriction?: string | null;
  min_age?: number | null;
  max_age?: number | null;
  sort_order: number;
  is_active: number | boolean;
  waitlist_enabled?: boolean | number;
  registration_opens_at?: string | null;
  registration_closes_at?: string | null;
}

export interface StaffEventDetailResponse {
  event: StaffEventDetail;
  categories: StaffEventCategory[];
}

export interface StaffEventCategorySummary {
  id: number;
  name: string;
  capacity: number | null;
  sold_count: number;
}

export interface StaffEventHubSummary {
  confirmed_count: number;
  pending_count: number;
  cancelled_count: number;
  checked_in_count: number;
  revenue_cents: number;
  waitlist_count: number;
  categories: StaffEventCategorySummary[];
}

export interface StaffEventHubSummaryResponse {
  summary: StaffEventHubSummary;
}

export interface StaffEventHubRegistrationsResponse {
  registrations: OrganizerRegistrationRow[];
}

export interface StaffEventUpsertRequest {
  title: string;
  slug?: string;
  sport_type_id: number;
  short_description?: string | null;
  description?: string | null;
  status?: string;
  visibility?: string;
  featured?: boolean;
  start_date: string;
  end_date?: string | null;
  registration_opens_at?: string | null;
  registration_closes_at?: string | null;
  location_city?: string | null;
  location_name?: string | null;
  hero_image_url?: string | null;
  max_registrations?: number | null;
}

export interface StaffEventCategoryInput {
  name: string;
  description?: string;
  price_cents: number;
  capacity?: number | null;
  sort_order?: number;
}

export interface AdminAthleteDetail extends AdminAthleteRow {
  date_of_birth?: string | null;
  gender?: string | null;
  shirt_size?: string | null;
  last_login_at?: string | null;
}

export interface AdminAthleteDetailResponse {
  athlete: AdminAthleteDetail;
  registrations: Array<{
    id: number;
    registration_number: string;
    status: string;
    total_cents: number;
    created_at: string;
    event_title: string;
    event_slug: string;
  }>;
}

export interface RegistrationLookupResponse {
  registration: OrganizerRegistrationRow & { qr_code_token?: string };
}

export interface CheckInResponse {
  ok: boolean;
  registration: {
    id: number;
    registration_number: string;
    bib_number?: string | null;
    status: string;
    checked_in_at: string;
    event_title: string;
    athlete_first_name: string;
    athlete_last_name: string;
  };
}

export interface OrganizerMemberRow {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  phone?: string | null;
  role: string;
  event_access_scope?: "organization" | "events";
  assigned_event_ids?: number[];
  status: string;
  invited_at?: string | null;
  last_login_at?: string | null;
  created_at: string;
}

export interface AnalyticsTimeSeries {
  registrations_by_day: Array<{ day: string; registrations: number }>;
  revenue_by_day: Array<{ day: string; revenue_cents: number }>;
}

export interface OrganizerAnalyticsResponse {
  stats: {
    total_events?: number;
    published_events?: number;
    confirmed_registrations?: number;
    total_revenue_cents?: number;
  };
  registrations_by_day: AnalyticsTimeSeries["registrations_by_day"];
  revenue_by_day: AnalyticsTimeSeries["revenue_by_day"];
}

export interface EventRegistrationFieldRow {
  id?: number;
  field_key: string;
  label: string;
  field_type: string;
  options_json?: string | string[] | null;
  is_required: number | boolean;
  sort_order: number;
  is_active: number | boolean;
}

export interface EventRegistrationFieldInput {
  field_key?: string;
  label: string;
  field_type: string;
  options?: string[];
  is_required?: boolean;
  sort_order?: number;
  is_active?: boolean;
}

export interface EventWaiverRow {
  id: number;
  title: string;
  content_html: string;
  version: number;
  is_active: number | boolean;
  created_at: string;
}

export interface StaffEventResultRow {
  id: number;
  registration_id: number;
  event_category_id?: number;
  overall_rank?: number | null;
  category_rank?: number | null;
  gender_rank?: number | null;
  finish_time_ms?: number | null;
  status: string;
  published_at?: string | null;
  registration_number: string;
  bib_number?: string | null;
  athlete_first_name?: string;
  athlete_last_name?: string;
  category_name?: string;
}

export interface StaffResultInput {
  registration_number: string;
  finish_time?: string;
  finish_time_ms?: number;
  overall_rank?: number | null;
  category_rank?: number | null;
  gender_rank?: number | null;
  status?: string;
}

export interface StaffEventCategoryPatch {
  name?: string;
  description?: string | null;
  price_cents?: number;
  capacity?: number | null;
  distance_km?: number | null;
  gender_restriction?: string;
  min_age?: number | null;
  max_age?: number | null;
  sort_order?: number;
  is_active?: boolean;
  waitlist_enabled?: boolean;
  registration_opens_at?: string | null;
  registration_closes_at?: string | null;
}

export interface StaffScheduleWaveRow {
  id: number;
  event_category_id?: number | null;
  name: string;
  starts_at: string;
  capacity?: number | null;
  registered_count: number;
  sort_order: number;
}

export interface StaffScheduleWaveInput {
  name: string;
  starts_at: string;
  event_category_id?: number | null;
  capacity?: number | null;
  sort_order?: number;
}

export interface StaffEventCoursePayload {
  routeGeojson: GeoJsonLineString | Record<string, unknown>;
  points: CoursePoint[];
  distanceKm?: number | null;
  elevationGainM?: number | null;
  elevationProfile?: ElevationProfilePoint[] | null;
}

export interface AdminOrganizerRow {
  id: number;
  name: string;
  slug: string;
  email: string;
  city?: string | null;
  country?: string;
  status: string;
  logo_url?: string | null;
  event_count?: number;
  member_count?: number;
  created_at?: string;
}

export interface AdminOrganizersResponse {
  organizers: AdminOrganizerRow[];
}

export interface PaginatedAdminOrganizersResponse {
  organizers: AdminOrganizerRow[];
  pagination: PaginationInfo;
}

export interface AdminOrganizerDetail extends AdminOrganizerRow {
  phone?: string | null;
  website_url?: string | null;
  description?: string | null;
  legal_name?: string | null;
  billing_email?: string | null;
  stripe_account_id?: string | null;
  stripe_onboarding_complete?: number | boolean;
  service_fee_percent?: number | string;
  rfc?: string | null;
}

export interface AdminOrganizerLinkedEvent {
  id: number;
  title: string;
  slug: string;
  status: string;
  start_date: string;
  organizer_id: number;
  organizer_name?: string;
  registration_count?: number;
}

export interface AdminOrganizerDetailResponse {
  organizer: AdminOrganizerDetail;
  members: OrganizerMemberRow[];
  events: AdminOrganizerLinkedEvent[];
}

export interface AdminOrganizerCreateRequest {
  name: string;
  email: string;
  slug?: string;
  city?: string;
  country?: string;
  phone?: string;
  owner_email: string;
  owner_first_name: string;
  owner_last_name: string;
  event_ids?: number[];
}

export interface AdminOrganizerUpdateRequest {
  name?: string;
  email?: string;
  slug?: string;
  city?: string;
  country?: string;
  phone?: string;
  status?: "pending" | "active" | "suspended" | "inactive";
}

export interface AdminStaffRow {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  phone?: string | null;
  role: string;
  status: string;
  last_login_at?: string | null;
  created_at: string;
}

export interface PaginatedAdminStaffResponse {
  admins: AdminStaffRow[];
  pagination: PaginationInfo;
}

export interface AdminStaffCreateRequest {
  email: string;
  first_name: string;
  last_name: string;
  role?: "admin" | "super_admin";
  phone?: string;
}

export interface AdminStaffUpdateRequest {
  status?: "active" | "inactive" | "suspended";
  role?: "admin" | "super_admin";
}

export interface SponsorAnalyticsRow {
  sponsor_id: number;
  name: string;
  tier: string;
  impressions: number;
  clicks: number;
  ctr: number;
}

export interface SponsorAnalyticsResponse {
  sponsors: SponsorAnalyticsRow[];
  totals: { impressions: number; clicks: number; ctr: number };
}

export interface SponsorTrackRequest {
  sponsorId: number;
  type: "impression" | "click";
}

export interface StaffDiscountCodeRow {
  id: number;
  event_id?: number | null;
  code: string;
  description?: string | null;
  discount_type: "percent" | "fixed_cents";
  discount_value: number;
  applies_to: "registration" | "service_fee" | "total";
  max_uses?: number | null;
  used_count: number;
  min_purchase_cents?: number | null;
  valid_from?: string | null;
  valid_until?: string | null;
  is_active: number | boolean;
  created_at: string;
}

export interface StaffDiscountCodeInput {
  code: string;
  description?: string;
  discount_type?: "percent" | "fixed_cents";
  discount_value: number;
  applies_to?: "registration" | "service_fee" | "total";
  max_uses?: number | null;
  min_purchase_cents?: number | null;
  valid_from?: string | null;
  valid_until?: string | null;
  is_active?: boolean;
}

export interface StaffDiscountCodePatch {
  description?: string | null;
  discount_type?: "percent" | "fixed_cents";
  discount_value?: number;
  applies_to?: "registration" | "service_fee" | "total";
  max_uses?: number | null;
  min_purchase_cents?: number | null;
  valid_from?: string | null;
  valid_until?: string | null;
  is_active?: boolean;
}

// ── Phase 2: Teams & Gamification ───────────────────────────────────────────

export interface TeamRow {
  id: number;
  public_uuid: string;
  name: string;
  slug: string;
  owner_athlete_id: number;
  description?: string | null;
  avatar_url?: string | null;
  invite_code: string;
  is_public: boolean;
  member_count: number;
  created_at: string;
  my_role?: string;
}

export interface TeamMemberRow {
  id: number;
  team_id: number;
  athlete_id: number;
  role: "owner" | "member";
  joined_at: string;
  first_name: string;
  last_name: string;
  avatar_url?: string | null;
  public_uuid: string;
}

export interface TeamsListResponse {
  teams: TeamRow[];
}

export interface TeamDetailResponse {
  team: TeamRow;
  members: TeamMemberRow[];
}

export interface CreateTeamRequest {
  name: string;
  description?: string | null;
  avatar_url?: string | null;
  is_public?: boolean;
}

export interface JoinTeamRequest {
  invite_code: string;
}

export interface GamificationProfile {
  athlete_id: number;
  xp_total: number;
  level: number;
  streak_days: number;
  last_activity_date?: string | null;
  updated_at: string;
}

export interface AchievementRow {
  id: number;
  athlete_id: number;
  achievement_id: number;
  slug: string;
  name: string;
  description?: string | null;
  icon?: string | null;
  xp_reward: number;
  criteria_type: "registration" | "result" | "streak" | "team";
  earned_at: string;
  event_id?: number | null;
}

export interface GamificationResponse {
  profile: GamificationProfile;
  recentAchievements: AchievementRow[];
  nextLevelXp: number;
}

export interface AchievementsListResponse {
  achievements: AchievementRow[];
}

export interface BulkMessageRequest {
  subject: string;
  body: string;
}

export interface BulkMessageResponse {
  queued: number;
  skipped: number;
  total: number;
}

export interface TransferRequest {
  recipientEmail: string;
}

export interface RegistrationTransferRow {
  id: number;
  registration_id: number;
  from_athlete_id: number;
  to_athlete_id: number;
  transfer_fee_cents: number;
  status: "pending" | "completed" | "cancelled";
  payment_id?: number | null;
  completed_at?: string | null;
  created_at: string;
}

export interface TransferInitiateResponse {
  transfer: RegistrationTransferRow;
}

export interface PublicPlatformStats {
  published_events: number;
  active_athletes: number;
  confirmed_registrations: number;
  public_teams: number;
  achievements_earned: number;
}

export interface PublicLeaderboardAthlete {
  rank: number;
  first_name: string;
  last_name: string;
  xp_total: number;
  level: number;
}

export interface PublicTeamPreview {
  id: number;
  name: string;
  slug: string;
  member_count: number;
  avatar_url?: string | null;
}

export interface PublicHomeDataResponse {
  stats: PublicPlatformStats;
  featured_events: EventListItem[];
  upcoming_events: EventListItem[];
  top_athletes: PublicLeaderboardAthlete[];
  top_teams: PublicTeamPreview[];
}

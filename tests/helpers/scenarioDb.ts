import type { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { WAIVER_ACCEPTANCE_SIGNATURE } from "../../shared/waiverConstants";
import {
  applyExtraSeedEnhancements,
  handleExtrasScenarioSql,
  type ExtraSeedEnhancements,
  type ExtrasSqlContext,
} from "./extrasScenarioSql.js";
import {
  applyRegistrationFieldSeedEnhancements,
  handleRegistrationFieldsScenarioSql,
  type RegistrationFieldCategoryRow,
  type RegistrationFieldRow,
} from "./registrationFieldsScenarioSql.js";
import {
  handleFolioSegmentsScenarioSql,
  type FolioCounterRow,
  type FolioSegmentCategoryRow,
  type FolioSegmentRow,
} from "./folioSegmentsScenarioSql.js";

export const SCENARIO = {
  athleteId: 1001,
  organizerId: 7,
  eventId: 42,
  categoryId: 10,
  slug: "mock-marathon-2026",
  eventTitle: "Mock Marathon 2026",
} as const;

type PaymentRow = RowDataPacket & {
  id: number;
  public_uuid: string;
  idempotency_key: string;
  registration_id: number | null;
  athlete_id: number;
  organizer_id: number;
  event_id: number;
  amount_cents: number;
  registration_amount_cents: number;
  service_fee_cents: number;
  currency: string;
  status: string;
  provider: string;
  metadata_json: string | Record<string, unknown>;
  stripe_payment_intent_id: string | null;
  stripe_charge_id: string | null;
  stripe_transfer_id: string | null;
  stripe_application_fee_id: string | null;
  paid_at: string | null;
  created_at: string;
};

type RegistrationRow = RowDataPacket & {
  id: number;
  public_uuid: string;
  event_id: number;
  event_category_id: number;
  athlete_id: number;
  registration_number: string;
  qr_code_token: string;
  status: string;
  price_cents: number;
  service_fee_cents: number;
  total_cents: number;
  discount_code_id: number | null;
  currency: string;
  source: string;
  payment_id: number | null;
  guest_claim_token?: string | null;
  order_id?: number | null;
  deleted_at: string | null;
  waiver_signed_at: string | null;
};

type WaitlistRow = RowDataPacket & {
  id: number;
  athlete_id: number;
  event_id: number;
  event_category_id: number;
  status: string;
  offer_expires_at: string | null;
  converted_registration_id: number | null;
};

type DiscountCodeSeed = {
  id: number;
  code: string;
  discount_type: "percent" | "fixed_cents";
  discount_value: number;
  applies_to: "registration" | "service_fee" | "total";
  min_purchase_cents?: number | null;
  max_uses?: number | null;
  used_count?: number;
  event_id?: number | null;
};

export type OrganizerConnectSeed = {
  status?: "active" | "suspended" | "inactive";
  email?: string;
  legal_name?: string | null;
  billing_email?: string | null;
  rfc?: string | null;
  tax_regime?: string | null;
  service_fee_percent?: number;
  fee_presentation?: "pass_through" | "absorb_all";
  stripe_account_id?: string | null;
  stripe_onboarding_complete?: number;
  stripe_connect_status?: string;
  stripe_charges_enabled?: number;
  stripe_payouts_enabled?: number;
  stripe_details_submitted?: number;
  stripe_connect_onboarded_at?: string | null;
  stripe_connect_last_synced_at?: string | null;
  stripe_connect_onboarding_mode?: string | null;
  payout_terms_accepted_at?: string | null;
  payout_fee_acknowledged_at?: string | null;
};

export interface ScenarioSeed {
  requiresWaiver?: boolean;
  waivers?: Array<{ id: number; title: string; version: number }>;
  discountCodes?: DiscountCodeSeed[];
  organizer?: OrganizerConnectSeed;
  event?: {
    fee_presentation?: "pass_through" | "absorb_all" | null;
    start_date?: string;
    end_date?: string | null;
    status?: string;
    check_in_opens_at?: string | null;
    check_in_closes_at?: string | null;
    max_registrations_per_order?: number;
    bib_mode?: "folio" | "separate";
  };
  category?: {
    name?: string;
    price_cents?: number;
    capacity?: number | null;
    waitlist_enabled?: boolean;
  };
  confirmedRegistrationCount?: number;
  athleteAlreadyRegistered?: boolean;
  waitlistOffer?: { id: number; status: "offered" | "waiting" | "expired" };
  extraAthletes?: Array<{
    id: number;
    email: string;
    first_name: string;
    last_name: string;
    date_of_birth?: string;
    gender?: string;
  }>;
  maxRegistrationsPerOrder?: number;
  fields?: Array<{
    id: number;
    field_key: string;
    label: string;
    field_type: string;
    is_required: boolean;
    options_json?: string | null;
    scope_type?: "all_categories" | "selected_categories";
    category_ids?: number[];
  }>;
  extras?: Array<{
    id?: number;
    name: string;
    price_cents: number;
    extra_type?: string;
    max_per_athlete?: number;
    capacity?: number | null;
    sold_count?: number;
    is_required?: boolean;
    is_active?: boolean;
    sort_order?: number;
  } & ExtraSeedEnhancements>;
}

function normalizeSql(sql: string): string {
  return sql.replace(/\s+/g, " ").trim().toLowerCase();
}

function eventDayOpenForCheckIn(): { start_date: string; end_date: string } {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dayKey = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };
  // Span today → tomorrow so check-in stays open after typical event end times
  // (custom check_in_closes_at is capped at event end_date).
  return {
    start_date: `${dayKey(now)} 00:00:00`,
    end_date: `${dayKey(tomorrow)} 23:59:59`,
  };
}

function header(insertId = 0, affectedRows = 1): ResultSetHeader {
  return { insertId, affectedRows } as ResultSetHeader;
}

export class RegistrationScenarioDb {
  readonly payments: PaymentRow[] = [];
  readonly registrations: RegistrationRow[] = [];
  readonly registrationExtras: RowDataPacket[] = [];
  readonly registrationExtraFieldValues: RowDataPacket[] = [];
  readonly extraFields: RowDataPacket[] = [];
  readonly extraCategories: RowDataPacket[] = [];
  readonly registrationFieldCategories: RegistrationFieldCategoryRow[] = [];
  readonly folioSegments: FolioSegmentRow[] = [];
  readonly folioSegmentCategories: FolioSegmentCategoryRow[] = [];
  readonly folioCounters: FolioCounterRow[] = [];
  readonly fieldValues: RowDataPacket[] = [];
  readonly waitlist: WaitlistRow[] = [];
  readonly webhookEvents = new Map<
    string,
    { status: string; event_type: string; error_message: string | null }
  >();

  private nextPaymentId = 5000;
  private nextRegistrationId = 9000;
  private nextFieldValueId = 1;
  private txSnapshot: string | null = null;

  readonly athleteProfiles = new Map<number, { date_of_birth: string; gender: string }>();
  readonly extraAthletes = new Map<
    number,
    { id: number; email: string; first_name: string; last_name: string }
  >();
  readonly registrationOrders: RowDataPacket[] = [];
  private nextAthleteId = 1100;
  private nextOrderId = 1;

  private nextFieldId = { current: 30001 };
  private nextSegmentId = { current: 700 };
  private nextFolioCounterId = { current: 1 };

  readonly requiresWaiver: boolean;
  readonly waivers: Array<{ id: number; title: string; version: number; is_active: number }>;
  readonly category: RowDataPacket;
  readonly event: RowDataPacket;
  readonly fields: RowDataPacket[];
  readonly athleteProfile: { date_of_birth: string; gender: string };
  readonly discountCodes: Array<
    DiscountCodeSeed & { is_active: number; organizer_id: number }
  >;
  readonly organizer: RowDataPacket;
  readonly extras: RowDataPacket[];
  athleteStripeCustomerId: string | null = null;

  private nextExtraId = 200;
  private nextRegistrationExtraId = 1;
  private nextExtraFieldId = { current: 1 };
  private nextRegExtraFieldValueId = { current: 1 };

  private extrasSqlContext(): ExtrasSqlContext {
    return {
      extras: this.extras,
      extraFields: this.extraFields,
      extraCategories: this.extraCategories,
      registrationExtraFieldValues: this.registrationExtraFieldValues,
      nextExtraFieldId: this.nextExtraFieldId,
      nextRegExtraFieldValueId: this.nextRegExtraFieldValueId,
      resolveCategoryIds: (eventId, categoryIds) => {
        if (eventId !== SCENARIO.eventId) return [];
        return categoryIds.filter((id) => id === SCENARIO.categoryId);
      },
      eventRegistrationWindow: () => ({
        registration_opens_at: this.event.registration_opens_at as string | null,
        registration_closes_at: this.event.registration_closes_at as string | null,
      }),
      categoryRegistrationWindows: (eventId) => {
        if (eventId !== SCENARIO.eventId) return [];
        return [
          {
            registration_opens_at: this.category.registration_opens_at as string | null,
            registration_closes_at: this.category.registration_closes_at as string | null,
          },
        ];
      },
    };
  }

  private registrationFieldsSqlContext() {
    return {
      fields: this.fields as RegistrationFieldRow[],
      fieldCategories: this.registrationFieldCategories,
      nextFieldId: this.nextFieldId,
      eventId: SCENARIO.eventId,
      resolveCategoryIds: (eventId: number, categoryIds: number[]) => {
        if (eventId !== SCENARIO.eventId) return [];
        return categoryIds.filter((id) => id === SCENARIO.categoryId);
      },
    };
  }

  private folioSegmentsSqlContext() {
    return {
      segments: this.folioSegments,
      segmentCategories: this.folioSegmentCategories,
      counters: this.folioCounters,
      nextSegmentId: this.nextSegmentId,
      nextCounterId: this.nextFolioCounterId,
      resolveCategoryIds: (eventId: number, categoryIds: number[]) => {
        if (eventId !== SCENARIO.eventId) return [];
        return categoryIds.filter((id) => id === SCENARIO.categoryId);
      },
    };
  }

  constructor(seed: ScenarioSeed = {}) {
    this.requiresWaiver = seed.requiresWaiver ?? false;
    this.waivers = (seed.waivers ?? []).map((w) => ({ ...w, is_active: 1 }));

    const priceCents = seed.category?.price_cents ?? 0;
    this.category = {
      id: SCENARIO.categoryId,
      name: seed.category?.name ?? "10K Elite",
      price_cents: priceCents,
      capacity: seed.category?.capacity ?? 100,
      currency: "MXN",
      waitlist_enabled: seed.category?.waitlist_enabled ? 1 : 0,
      registration_opens_at: null,
      registration_closes_at: null,
      min_age: null,
      max_age: null,
      gender_restriction: "any",
      is_active: 1,
      sold_count: 0,
      event_id: SCENARIO.eventId,
    } as RowDataPacket;

    this.event = {
      id: SCENARIO.eventId,
      title: SCENARIO.eventTitle,
      slug: SCENARIO.slug,
      organizer_id: SCENARIO.organizerId,
      service_fee_percent: 11,
      org_fee_percent: 11,
      fee_presentation: seed.event?.fee_presentation ?? null,
      org_fee_presentation: seed.organizer?.fee_presentation ?? "pass_through",
      requires_waiver: this.requiresWaiver ? 1 : 0,
      registration_opens_at: null,
      registration_closes_at: null,
      registration_count: 0,
      ...eventDayOpenForCheckIn(),
      ...(seed.event?.start_date
        ? {
            start_date: seed.event.start_date,
            end_date: seed.event.end_date ?? seed.event.start_date,
          }
        : {}),
      status: seed.event?.status ?? "published",
      timezone: "America/Mexico_City",
      check_in_opens_at: seed.event?.check_in_opens_at ?? "2020-01-01 00:00:00",
      check_in_closes_at: seed.event?.check_in_closes_at ?? "2030-12-31 23:59:59",
      max_registrations_per_order:
        seed.maxRegistrationsPerOrder ?? seed.event?.max_registrations_per_order ?? 10,
      bib_mode: seed.event?.bib_mode ?? "separate",
    } as RowDataPacket;

    this.athleteProfiles.set(SCENARIO.athleteId, { ...this.athleteProfile });
    for (const a of seed.extraAthletes ?? []) {
      this.extraAthletes.set(a.id, {
        id: a.id,
        email: a.email,
        first_name: a.first_name,
        last_name: a.last_name,
      });
      this.athleteProfiles.set(a.id, {
        date_of_birth: a.date_of_birth ?? "1992-01-01",
        gender: a.gender ?? "female",
      });
    }

    this.athleteProfile = {
      date_of_birth: "1990-01-15",
      gender: "male",
    };

    this.fields = (seed.fields ?? []).map((field, index) => ({
      id: field.id,
      event_id: SCENARIO.eventId,
      field_key: field.field_key,
      label: field.label,
      field_type: field.field_type,
      options_json: field.options_json ?? null,
      is_required: field.is_required ? 1 : 0,
      sort_order: index,
      is_active: 1,
      scope_type: field.scope_type ?? "all_categories",
    })) as RegistrationFieldRow[];

    for (const field of seed.fields ?? []) {
      applyRegistrationFieldSeedEnhancements(this.registrationFieldsSqlContext(), field.id, {
        scope_type: field.scope_type,
        category_ids: field.category_ids,
      });
    }

    this.extras = (seed.extras ?? []).map((extra, index) => {
      const id = extra.id ?? this.nextExtraId++;
      return {
        id,
        public_uuid: `extra-uuid-${id}`,
        event_id: SCENARIO.eventId,
        name: extra.name,
        description: null,
        price_cents: extra.price_cents,
        currency: "MXN",
        image_url: null,
        extra_type: extra.extra_type ?? "custom",
        max_per_athlete: extra.max_per_athlete ?? 1,
        capacity: extra.capacity ?? null,
        sold_count: extra.sold_count ?? 0,
        is_required: extra.is_required ? 1 : 0,
        sort_order: extra.sort_order ?? index,
        is_active: extra.is_active === false ? 0 : 1,
        scope_type: extra.scope_type ?? "all_categories",
        sales_opens_at: extra.sales_opens_at ?? null,
        sales_closes_at: extra.sales_closes_at ?? null,
      } as RowDataPacket;
    }) as RowDataPacket[];

    for (const extra of seed.extras ?? []) {
      const id = Number(extra.id ?? this.extras.find((row) => row.name === extra.name)?.id);
      if (id > 0) {
        applyExtraSeedEnhancements(this.extrasSqlContext(), id, extra);
      }
    }

    this.discountCodes = (seed.discountCodes ?? []).map((d) => ({
      ...d,
      is_active: 1,
      organizer_id: SCENARIO.organizerId,
      event_id: d.event_id ?? SCENARIO.eventId,
      used_count: d.used_count ?? 0,
      min_purchase_cents: d.min_purchase_cents ?? null,
      max_uses: d.max_uses ?? null,
    }));

    const org = seed.organizer ?? {};
    this.organizer = {
      organizer_id: SCENARIO.organizerId,
      id: SCENARIO.organizerId,
      email: org.email ?? "organizer@test.local",
      legal_name: org.legal_name ?? null,
      billing_email: org.billing_email ?? null,
      rfc: org.rfc ?? null,
      tax_regime: org.tax_regime ?? null,
      service_fee_percent: org.service_fee_percent ?? 11,
      fee_presentation: org.fee_presentation ?? "pass_through",
      status: org.status ?? "active",
      stripe_account_id: org.stripe_account_id ?? null,
      stripe_onboarding_complete: org.stripe_onboarding_complete ?? 0,
      stripe_connect_status: org.stripe_connect_status ?? "not_started",
      stripe_charges_enabled: org.stripe_charges_enabled ?? 0,
      stripe_payouts_enabled: org.stripe_payouts_enabled ?? 0,
      stripe_details_submitted: org.stripe_details_submitted ?? 0,
      stripe_connect_onboarded_at: org.stripe_connect_onboarded_at ?? null,
      stripe_connect_last_synced_at: org.stripe_connect_last_synced_at ?? null,
      stripe_connect_onboarding_mode: org.stripe_connect_onboarding_mode ?? null,
      payout_terms_accepted_at: org.payout_terms_accepted_at ?? null,
      payout_fee_acknowledged_at: org.payout_fee_acknowledged_at ?? null,
      deleted_at: null,
    } as RowDataPacket;

    const confirmedCount = seed.confirmedRegistrationCount ?? 0;
    for (let i = 0; i < confirmedCount; i++) {
      this.registrations.push(this.makeRegistration(i + 1, SCENARIO.athleteId + i + 100));
    }

    if (seed.athleteAlreadyRegistered) {
      this.registrations.push(this.makeRegistration(999, SCENARIO.athleteId));
    }

    if (seed.waitlistOffer) {
      this.waitlist.push({
        id: seed.waitlistOffer.id,
        athlete_id: SCENARIO.athleteId,
        event_id: SCENARIO.eventId,
        event_category_id: SCENARIO.categoryId,
        status: seed.waitlistOffer.status,
        offer_expires_at:
          seed.waitlistOffer.status === "offered"
            ? new Date(Date.now() + 86400000).toISOString()
            : null,
        converted_registration_id: null,
      } as WaitlistRow);
    }
  }

  private makeRegistration(id: number, athleteId: number): RegistrationRow {
    return {
      id,
      public_uuid: `reg-uuid-${id}`,
      event_id: SCENARIO.eventId,
      event_category_id: SCENARIO.categoryId,
      athlete_id: athleteId,
      registration_number: `REG-0042-${String(id).padStart(5, "0")}`,
      qr_code_token: `qr-${id}`,
      status: "confirmed",
      price_cents: 0,
      service_fee_cents: 0,
      total_cents: 0,
      discount_code_id: null,
      currency: "MXN",
      source: "web",
      payment_id: null,
      deleted_at: null,
      waiver_signed_at: null,
    } as RegistrationRow;
  }

  private soldCount(categoryId = SCENARIO.categoryId): number {
    return this.registrations.filter(
      (r) =>
        r.event_category_id === categoryId &&
        r.status === "confirmed" &&
        r.deleted_at == null,
    ).length;
  }

  private categoryRow(): RowDataPacket {
    return {
      ...this.category,
      sold_count: this.soldCount(),
    };
  }

  private findPaymentByUuid(uuid: string): PaymentRow | undefined {
    return this.payments.find((p) => p.public_uuid === uuid);
  }

  private eventWithOrganizer(): RowDataPacket {
    return {
      ...this.event,
      stripe_account_id: this.organizer.stripe_account_id,
      stripe_onboarding_complete: this.organizer.stripe_onboarding_complete,
      stripe_connect_status: this.organizer.stripe_connect_status,
      stripe_charges_enabled: this.organizer.stripe_charges_enabled,
      stripe_payouts_enabled: this.organizer.stripe_payouts_enabled,
      org_fee_percent: this.organizer.service_fee_percent,
      org_fee_presentation: this.organizer.fee_presentation ?? "pass_through",
      fee_presentation: this.event.fee_presentation ?? null,
    } as RowDataPacket;
  }

  private registrationLookupRow(reg: RegistrationRow): RowDataPacket {
    return {
      id: reg.id,
      registration_number: reg.registration_number,
      bib_number: null,
      status: reg.status,
      qr_code_token: reg.qr_code_token,
      checked_in_at: null,
      waiver_signed_at: reg.waiver_signed_at,
      total_cents: reg.total_cents,
      created_at: new Date().toISOString(),
      event_id: reg.event_id,
      event_title: SCENARIO.eventTitle,
      event_slug: SCENARIO.slug,
      requires_waiver: this.requiresWaiver ? 1 : 0,
      category_name: this.category.name ?? "General",
      athlete_first_name: "Test",
      athlete_last_name: "Athlete",
      athlete_email: "athlete@test.local",
    } as RowDataPacket;
  }

  query = async (
    sql: string,
    params: unknown[] = [],
  ): Promise<[unknown, unknown]> => {
    const q = normalizeSql(sql);

    const extrasHit = handleExtrasScenarioSql(q, params, this.extrasSqlContext());
    if (extrasHit?.type === "rows") return [extrasHit.rows, []];
    if (extrasHit?.type === "header") return [extrasHit.header, []];

    const regFieldsHit = handleRegistrationFieldsScenarioSql(
      q,
      params,
      this.registrationFieldsSqlContext(),
    );
    if (regFieldsHit?.type === "rows") return [regFieldsHit.rows, []];
    if (regFieldsHit?.type === "header") return [regFieldsHit.header, []];

    const folioHit = handleFolioSegmentsScenarioSql(
      q,
      params,
      this.folioSegmentsSqlContext(),
    );
    if (folioHit?.type === "rows") return [folioHit.rows, []];
    if (folioHit?.type === "header") return [folioHit.header, []];

    if (q.includes("update waitlist_entries set status = 'expired'")) {
      for (const w of this.waitlist) {
        if (w.status === "offered" && w.offer_expires_at && new Date(w.offer_expires_at) < new Date()) {
          w.status = "expired";
        }
      }
      return [header(0, 0), []];
    }

    if (q.includes("from events e") && q.includes("join organizers o") && q.includes("slug")) {
      return [[this.eventWithOrganizer()], []];
    }

    if (
      q.includes("from athletes where email = ?") &&
      q.includes("deleted_at is null") &&
      q.includes("status = 'active'")
    ) {
      const email = String(params[0] ?? "").toLowerCase();
      if (email === "athlete@test.local") {
        return [
          [
            {
              id: SCENARIO.athleteId,
              email: "athlete@test.local",
              first_name: "Test",
              last_name: "Athlete",
              date_of_birth: this.athleteProfile.date_of_birth,
              gender: this.athleteProfile.gender,
            },
          ],
          [],
        ];
      }
      for (const a of this.extraAthletes.values()) {
        if (a.email.toLowerCase() === email) {
          const profile = this.athleteProfiles.get(a.id);
          return [
            [
              {
                ...a,
                date_of_birth: profile?.date_of_birth ?? "1992-01-01",
                gender: profile?.gender ?? "female",
              },
            ],
            [],
          ];
        }
      }
      return [[], []];
    }

    if (q.startsWith("insert into athletes")) {
      const id = this.nextAthleteId++;
      const email = String(params[1]).toLowerCase();
      this.extraAthletes.set(id, {
        id,
        email,
        first_name: String(params[2]),
        last_name: String(params[3]),
      });
      this.athleteProfiles.set(id, {
        date_of_birth: String(params[4]),
        gender: String(params[5]),
      });
      return [header(id, 1), []];
    }

    if (
      q.includes("from athletes where id = ?") &&
      q.includes("deleted_at is null") &&
      q.includes("status = 'active'") &&
      q.includes("select id, email")
    ) {
      const athleteId = Number(params[0]);
      if (athleteId === SCENARIO.athleteId) {
        return [[{ id: SCENARIO.athleteId, email: "athlete@test.local" }], []];
      }
      const extra = this.extraAthletes.get(athleteId);
      return extra ? [[{ id: extra.id, email: extra.email }], []] : [[], []];
    }

    if (
      q.includes("from athletes where id = ?") &&
      q.includes("first_name") &&
      q.includes("deleted_at is null limit 1")
    ) {
      const athleteId = Number(params[0]);
      if (athleteId === SCENARIO.athleteId) {
        return [
          [
            {
              id: SCENARIO.athleteId,
              email: "athlete@test.local",
              first_name: "Test",
              last_name: "Athlete",
              date_of_birth: this.athleteProfile.date_of_birth,
              gender: this.athleteProfile.gender,
            },
          ],
          [],
        ];
      }
      const extra = this.extraAthletes.get(athleteId);
      if (!extra) return [[], []];
      const profile = this.athleteProfiles.get(athleteId);
      return [
        [
          {
            ...extra,
            date_of_birth: profile?.date_of_birth ?? "1992-01-01",
            gender: profile?.gender ?? "female",
          },
        ],
        [],
      ];
    }

    if (q.includes("where r.guest_claim_token = ?")) {
      const token = String(params[0] ?? "");
      const reg = this.registrations.find(
        (r) => r.guest_claim_token === token && r.status === "confirmed" && !r.deleted_at,
      );
      if (!reg) return [[], []];
      const athlete =
        reg.athlete_id === SCENARIO.athleteId
          ? { email: "athlete@test.local", first_name: "Test", last_name: "Athlete" }
          : this.extraAthletes.get(reg.athlete_id);
      return [
        [
          {
            ...reg,
            guest_email: athlete?.email ?? "",
            event_slug: SCENARIO.slug,
            event_title: SCENARIO.eventTitle,
            category_name: this.category.name,
          },
        ],
        [],
      ];
    }

    if (q.startsWith("update registrations set athlete_id")) {
      const athleteId = Number(params[0]);
      const regId = Number(params[1]);
      const reg = this.registrations.find((r) => r.id === regId);
      if (reg) {
        reg.athlete_id = athleteId;
        reg.guest_claim_token = null;
      }
      return [header(0, reg ? 1 : 0), []];
    }

    if (q.startsWith("update registrations set guest_claim_token = null")) {
      const regId = Number(params[0]);
      const reg = this.registrations.find((r) => r.id === regId);
      if (reg) reg.guest_claim_token = null;
      return [header(0, reg ? 1 : 0), []];
    }

    if (q.includes("from registration_orders")) {
      if (q.includes("public_uuid = ?")) {
        const uuid = String(params[0]);
        const hit = this.registrationOrders.find((o) => o.public_uuid === uuid);
        if (!hit) return [[], []];
        const row = {
          id: hit.id,
          public_uuid: hit.public_uuid,
          status: hit.status ?? "confirmed",
        } as RowDataPacket;
        if (q.includes("item_count")) {
          row.item_count = hit.item_count;
          row.total_cents = hit.total_cents;
          row.event_title = SCENARIO.eventTitle;
          row.athlete_id = hit.purchaser_athlete_id;
          row.athlete_email = "athlete@test.local";
          row.athlete_first_name = "Test";
          row.preferred_language = "en";
        }
        return [[row], []];
      }
      if (q.includes("ro.id = ?") && q.includes("purchaser_athlete_id = ?")) {
        const orderId = Number(params[0]);
        const purchaserId = Number(params[1]);
        const hit = this.registrationOrders.find(
          (o) => o.id === orderId && o.purchaser_athlete_id === purchaserId,
        );
        if (!hit) return [[], []];
        return [
          [
            {
              id: hit.id,
              public_uuid: hit.public_uuid,
              total_cents: hit.total_cents,
              item_count: hit.item_count,
              event_title: SCENARIO.eventTitle,
              athlete_id: purchaserId,
              athlete_email: "athlete@test.local",
              athlete_first_name: "Test",
              preferred_language: "en",
            },
          ],
          [],
        ];
      }
      const paymentId = Number(params[0]);
      const hit = this.registrationOrders.find((o) => o.payment_id === paymentId);
      return [hit ? [{ id: hit.id, public_uuid: hit.public_uuid }] : [], []];
    }

    if (q.startsWith("insert into registration_orders")) {
      const order = {
        id: this.nextOrderId++,
        public_uuid: String(params[0]),
        event_id: Number(params[1]),
        purchaser_athlete_id: Number(params[2]),
        payment_id: Number(params[3]),
        status: "confirmed",
        item_count: Number(params[4]),
        subtotal_cents: Number(params[5]),
        service_fee_cents: Number(params[6]),
        discount_code_id: params[7] as number | null,
        discount_amount_cents: Number(params[8]),
        total_cents: Number(params[9]),
        currency: String(params[10]),
      } as RowDataPacket;
      this.registrationOrders.push(order);
      return [header(order.id as number, 1), []];
    }

    if (q.includes("from notification_queue")) {
      return [[], []];
    }

    if (q.startsWith("insert into notification_queue")) {
      return [header(1, 1), []];
    }

    if (q.includes("update notification_queue")) {
      return [header(0, 1), []];
    }

    if (q.includes("select email from athletes") && q.includes("where id = ?") && q.includes("deleted_at is null")) {
      const athleteId = Number(params[0]);
      if (athleteId === SCENARIO.athleteId) {
        return [[{ email: "athlete@test.local" }], []];
      }
      return [[], []];
    }

    if (
      q.includes("select id, public_uuid, email, first_name, last_name, stripe_customer_id") &&
      q.includes("from athletes")
    ) {
      const athleteId = Number(params[0]);
      if (athleteId !== SCENARIO.athleteId) return [[], []];
      return [
        [
          {
            id: SCENARIO.athleteId,
            public_uuid: "athlete-uuid-1001",
            email: "athlete@test.local",
            first_name: "Test",
            last_name: "Athlete",
            stripe_customer_id: this.athleteStripeCustomerId,
          },
        ],
        [],
      ];
    }

    if (q.startsWith("update athletes set stripe_customer_id")) {
      this.athleteStripeCustomerId = String(params[0]);
      return [header(0, 1), []];
    }

    if (q.includes("from organizers o") && q.includes("where o.id = ?") && q.includes("deleted_at is null")) {
      const organizerId = Number(params[0]);
      if (organizerId !== SCENARIO.organizerId) return [[], []];
      return [[{ ...this.organizer }], []];
    }

    if (q.includes("select stripe_connect_status from organizers") && q.includes("deleted_at is null")) {
      const organizerId = Number(params[0]);
      if (organizerId !== SCENARIO.organizerId) return [[], []];
      return [[{ stripe_connect_status: this.organizer.stripe_connect_status }], []];
    }

    if (q.startsWith("update organizers set stripe_connect_last_synced_at")) {
      this.organizer.stripe_connect_last_synced_at = new Date().toISOString();
      return [header(0, 1), []];
    }

    if (q.startsWith("update organizers set") && q.includes("stripe_connect_status")) {
      this.organizer.stripe_account_id = String(params[0]);
      this.organizer.stripe_onboarding_complete = Number(params[1]);
      this.organizer.stripe_connect_status = String(params[2]);
      this.organizer.stripe_charges_enabled = Number(params[3]);
      this.organizer.stripe_payouts_enabled = Number(params[4]);
      this.organizer.stripe_details_submitted = Number(params[5]);
      if (Number(params[6]) === 1 && !this.organizer.stripe_connect_onboarded_at) {
        this.organizer.stripe_connect_onboarded_at = new Date().toISOString();
      }
      this.organizer.stripe_connect_last_synced_at = new Date().toISOString();
      if (params[7] != null) {
        this.organizer.stripe_connect_onboarding_mode = params[7];
      }
      return [header(0, 1), []];
    }

    if (q.includes("select requires_waiver from events")) {
      return [[{ requires_waiver: this.requiresWaiver ? 1 : 0 }], []];
    }

    if (q.startsWith("update payments set status = 'failed'") && q.includes("failure_code")) {
      const message = String(params[0]);
      const payId = Number(params[1]);
      const pay = this.payments.find((p) => p.id === payId);
      if (pay) {
        pay.status = "failed";
        (pay as PaymentRow & { failure_code?: string; failure_message?: string }).failure_code =
          "pi_create_failed";
        (pay as PaymentRow & { failure_message?: string }).failure_message = message;
      }
      return [header(0, pay ? 1 : 0), []];
    }

    if (q.includes("insert into stripe_webhook_events")) {
      const eventId = String(params[0]);
      if (this.webhookEvents.has(eventId)) {
        const err = new Error("Duplicate entry") as Error & { code?: string };
        err.code = "ER_DUP_ENTRY";
        throw err;
      }
      this.webhookEvents.set(eventId, {
        status: "processing",
        event_type: String(params[1]),
        error_message: null,
      });
      return [header(this.webhookEvents.size, 1), []];
    }

    if (q.includes("select status from stripe_webhook_events")) {
      const eventId = String(params[0]);
      const row = this.webhookEvents.get(eventId);
      return [row ? [{ status: row.status }] : [], []];
    }

    if (q.includes("update stripe_webhook_events") && q.includes("status = 'processing'")) {
      const eventId = String(params[0]);
      const row = this.webhookEvents.get(eventId);
      if (row) {
        row.status = "processing";
        row.error_message = null;
      }
      return [header(0, row ? 1 : 0), []];
    }

    if (q.includes("update stripe_webhook_events") && q.includes("status = 'processed'")) {
      const eventId = String(params[0]);
      const row = this.webhookEvents.get(eventId);
      if (row) row.status = "processed";
      return [header(0, row ? 1 : 0), []];
    }

    if (q.includes("update stripe_webhook_events") && q.includes("status = 'ignored'")) {
      const eventId = String(params[0]);
      const row = this.webhookEvents.get(eventId);
      if (row) row.status = "ignored";
      return [header(0, row ? 1 : 0), []];
    }

    if (q.includes("update stripe_webhook_events") && q.includes("status = 'failed'")) {
      const eventId = String(params[1]);
      const row = this.webhookEvents.get(eventId);
      if (row) {
        row.status = "failed";
        row.error_message = String(params[0]);
      }
      return [header(0, row ? 1 : 0), []];
    }

    if (q.startsWith("update payments set stripe_payment_intent_id")) {
      const piId = String(params[0]);
      const payId = Number(params[1]);
      const pay = this.payments.find((p) => p.id === payId);
      if (pay) {
        pay.stripe_payment_intent_id = piId;
        pay.status = "processing";
      }
      return [header(0, pay ? 1 : 0), []];
    }

    if (q.includes("select date_of_birth, gender from athletes")) {
      const athleteId = Number(params[0]);
      const profile = this.athleteProfiles.get(athleteId);
      if (profile) return [[{ ...profile }], []];
      return [[], []];
    }

    if (q.includes("select id from events where slug")) {
      return [[{ id: SCENARIO.eventId }], []];
    }

    if (
      q.includes("select id from registrations") &&
      q.includes("status = 'confirmed'") &&
      q.includes("deleted_at is null")
    ) {
      const eventId = Number(params[0]);
      const athleteId = Number(params[1]);
      const excludeId =
        q.includes("id <>") && params[2] != null ? Number(params[2]) : null;
      const hit = this.registrations.find(
        (r) =>
          r.event_id === eventId &&
          r.athlete_id === athleteId &&
          r.status === "confirmed" &&
          !r.deleted_at &&
          (excludeId == null || r.id !== excludeId),
      );
      return [hit ? [{ id: hit.id }] : [], []];
    }

    if (q.includes("select 1 from event_categories") && q.includes("price_cents > 0")) {
      const eventId = Number(params[0]);
      if (eventId !== SCENARIO.eventId || this.category.price_cents <= 0) {
        return [[], []];
      }
      return [[{ 1: 1 }], []];
    }

    if (q.includes("from event_categories") && q.includes("is_active = 1")) {
      if (q.includes("where event_id = ?") && q.includes("order by sort_order")) {
        const eventId = Number(params[0]);
        if (eventId !== SCENARIO.eventId) return [[], []];
        return [[this.categoryRow()], []];
      }
      const catId = Number(params[0]);
      const eventId = Number(params[1]);
      if (catId !== SCENARIO.categoryId || eventId !== SCENARIO.eventId) {
        return [[], []];
      }
      const row = this.categoryRow();
      if (q.includes("price_cents, currency")) {
        return [[{ id: row.id, price_cents: row.price_cents, currency: row.currency }], []];
      }
      return [[row], []];
    }

    if (q.includes("from discount_codes")) {
      const code = String(params[0] ?? "").toUpperCase();
      const eventId = Number(params[1]);
      const organizerId = Number(params[2]);
      const hit = this.discountCodes.find(
        (d) =>
          d.code.toUpperCase() === code &&
          d.is_active === 1 &&
          (d.event_id === eventId ||
            (d.event_id == null && d.organizer_id === organizerId)),
      );
      if (!hit) return [[], []];
      return [
        [
          {
            id: hit.id,
            code: hit.code,
            discount_type: hit.discount_type,
            discount_value: hit.discount_value,
            applies_to: hit.applies_to,
            min_purchase_cents: hit.min_purchase_cents,
            max_uses: hit.max_uses,
            used_count: hit.used_count ?? 0,
          },
        ],
        [],
      ];
    }


    if (q.includes("from event_extras")) {
      const eventId = Number(params[0]);
      if (eventId !== SCENARIO.eventId) return [[], []];

      let rows = this.extras.filter((e) => Number(e.event_id) === eventId);

      if (q.includes("is_active = 1")) {
        rows = rows.filter((e) => Number(e.is_active) === 1);
      }

      if (q.includes("is_required = 1")) {
        rows = rows.filter((e) => Number(e.is_required) === 1);
        if (q.includes("limit 1")) {
          rows = rows.slice(0, 1);
        }
      }

      if (q.includes("id in (")) {
        const ids = params.slice(1).map((p) => Number(p));
        rows = rows.filter(
          (e) => ids.includes(Number(e.id)) && Number(e.is_active) === 1,
        );
      } else if (q.includes("where id = ? and event_id = ?")) {
        const extraId = Number(params[0]);
        rows = rows.filter((e) => Number(e.id) === extraId);
      }

      rows = [...rows].sort(
        (a, b) =>
          Number(a.sort_order) - Number(b.sort_order) ||
          Number(a.id) - Number(b.id),
      );

      if (q.includes("public_uuid, name, description")) {
        return [
          rows.map((e) => ({
            id: e.id,
            public_uuid: e.public_uuid,
            name: e.name,
            description: e.description,
            price_cents: e.price_cents,
            currency: e.currency,
            image_url: e.image_url,
            extra_type: e.extra_type,
            max_per_athlete: e.max_per_athlete,
            capacity: e.capacity,
            sold_count: e.sold_count,
            is_required: e.is_required,
            sort_order: e.sort_order,
          })),
          [],
        ];
      }

      if (q.includes("id, price_cents, sold_count")) {
        return [
          rows.map((e) => ({
            id: e.id,
            price_cents: e.price_cents,
            sold_count: e.sold_count,
          })),
          [],
        ];
      }

      if (q.includes("id, name, price_cents, max_per_athlete")) {
        return [
          rows.map((e) => ({
            id: e.id,
            name: e.name,
            price_cents: e.price_cents,
            max_per_athlete: e.max_per_athlete,
            capacity: e.capacity,
            sold_count: e.sold_count,
            is_required: e.is_required,
          })),
          [],
        ];
      }

      if (q.includes("id, name")) {
        return [rows.map((e) => ({ id: e.id, name: e.name })), []];
      }

      if (q.includes("sold_count from event_extras")) {
        return [
          rows.map((e) => ({ sold_count: e.sold_count })),
          [],
        ];
      }

      return [rows.map((e) => ({ ...e })), []];
    }

    if (q.includes("insert into registration_extras")) {
      const row = {
        id: this.nextRegistrationExtraId++,
        registration_id: Number(params[0]),
        event_extra_id: Number(params[1]),
        name: String(params[2]),
        quantity: Number(params[3]),
        unit_price_cents: Number(params[4]),
        total_cents: Number(params[5]),
      };
      this.registrationExtras.push(row as RowDataPacket);
      return [header(row.id, 1), []];
    }

    if (q.includes("from registration_extras")) {
      const regId = Number(params[0]);
      const rows = this.registrationExtras
        .filter((e) => Number(e.registration_id) === regId)
        .map((e, index) => ({
          id: e.id ?? index + 1,
          event_extra_id: e.event_extra_id,
          name: e.name,
          quantity: e.quantity,
          unit_price_cents: e.unit_price_cents,
          total_cents: e.total_cents,
        }))
        .sort((a, b) => String(a.name).localeCompare(String(b.name)));
      return [rows, []];
    }

    if (q.includes("update event_extras set sold_count = sold_count +")) {
      const quantity = Number(params[0]);
      const extraId = Number(params[1]);
      const extra = this.extras.find((e) => Number(e.id) === extraId);
      if (!extra) return [header(0, 0), []];
      const capacity =
        extra.capacity != null ? Number(extra.capacity) : null;
      const sold = Number(extra.sold_count) || 0;
      if (capacity != null && sold + quantity > capacity) {
        return [header(0, 0), []];
      }
      extra.sold_count = sold + quantity;
      return [header(0, 1), []];
    }

    if (q.includes("from event_sponsors")) {
      return [[], []];
    }

    if (q.includes("from event_tags et")) {
      return [[], []];
    }

    if (q.includes("from event_schedule_waves")) {
      return [[], []];
    }

    if (q.includes("from event_courses")) {
      return [[], []];
    }

    if (q.includes("from media_assets") && q.includes("entity_type = 'event'")) {
      return [[], []];
    }

    if (q.includes("from event_waivers") && q.includes("is_active = 1")) {
      return [this.waivers.map((w) => ({ ...w })), []];
    }

    if (q.includes("select version from event_waivers where id")) {
      const waiverId = Number(params[0]);
      const w = this.waivers.find((x) => x.id === waiverId);
      return [w ? [{ version: w.version }] : [], []];
    }

    if (q.includes("from waitlist_entries") && q.includes("status = 'offered'")) {
      const entryId = Number(params[0]);
      const athleteId = Number(params[1]);
      const eventId = Number(params[2]);
      const categoryId = Number(params[3]);
      const row = this.waitlist.find(
        (w) =>
          w.id === entryId &&
          w.athlete_id === athleteId &&
          w.event_id === eventId &&
          w.event_category_id === categoryId &&
          w.status === "offered",
      );
      return [row ? [{ id: row.id }] : [], []];
    }

    if (q.includes("from payments") && q.includes("idempotency_key")) {
      const key = String(params[0]);
      const athleteId = Number(params[1]);
      const hit = this.payments.find(
        (p) =>
          p.idempotency_key === key &&
          p.athlete_id === athleteId &&
          p.registration_id == null &&
          ["pending", "processing", "succeeded"].includes(p.status),
      );
      return [hit ? [{ public_uuid: hit.public_uuid }] : [], []];
    }

    if (q.startsWith("update payments set metadata_json")) {
      const metadata = String(params[0]);
      const amountCents = Number(params[1]);
      const registrationAmountCents = Number(params[2]);
      const serviceFeeCents = Number(params[3]);
      const uuid = String(params[4]);
      const pay = this.findPaymentByUuid(uuid);
      if (pay) {
        pay.metadata_json = metadata;
        pay.amount_cents = amountCents;
        pay.registration_amount_cents = registrationAmountCents;
        pay.service_fee_cents = serviceFeeCents;
      }
      return [header(0, pay ? 1 : 0), []];
    }

    if (q.includes("update discount_codes set used_count = used_count + 1")) {
      const id = Number(params[0]);
      const row = this.discountCodes.find((d) => d.id === id);
      if (row && (row.max_uses == null || (row.used_count ?? 0) < row.max_uses)) {
        row.used_count = (row.used_count ?? 0) + 1;
        return [header(0, 1), []];
      }
      return [header(0, 0), []];
    }

    if (q.startsWith("insert into payments")) {
      const pay: PaymentRow = {
        id: this.nextPaymentId++,
        public_uuid: String(params[0]),
        idempotency_key: String(params[1]),
        registration_id: params[2] as number | null,
        athlete_id: Number(params[3]),
        organizer_id: Number(params[4]),
        event_id: Number(params[5]),
        amount_cents: Number(params[6]),
        registration_amount_cents: Number(params[7]),
        service_fee_cents: Number(params[8]),
        currency: String(params[9]),
        status: String(params[10]),
        provider: String(params[11]),
        metadata_json: String(params[12]),
        stripe_payment_intent_id: null,
        stripe_charge_id: null,
        stripe_transfer_id: null,
        stripe_application_fee_id: null,
        paid_at: q.includes("paid_at") ? new Date().toISOString() : null,
        created_at: new Date().toISOString(),
      } as PaymentRow;
      this.payments.push(pay);
      return [header(pay.id, 1), []];
    }

    if (
      q.includes("select stripe_payment_intent_id, amount_cents") &&
      q.includes("from payments") &&
      q.includes("public_uuid")
    ) {
      const uuid = String(params[0]);
      const pay = this.findPaymentByUuid(uuid);
      return [
        pay
          ? [
              {
                stripe_payment_intent_id: pay.stripe_payment_intent_id,
                amount_cents: pay.amount_cents,
                service_fee_cents: pay.service_fee_cents,
              },
            ]
          : [],
        [],
      ];
    }

    if (q.includes("select p.id, p.registration_id") && q.includes("public_uuid")) {
      const uuid = String(params[0]);
      const athleteId = Number(params[1]);
      const pay = this.payments.find((p) => p.public_uuid === uuid && p.athlete_id === athleteId);
      return [
        pay
          ? [
              {
                id: pay.id,
                registration_id: pay.registration_id,
                stripe_payment_intent_id: pay.stripe_payment_intent_id,
                provider: pay.provider,
                status: pay.status,
                amount_cents: pay.amount_cents,
              },
            ]
          : [],
        [],
      ];
    }

    if (q.includes("select provider, amount_cents from payments")) {
      const uuid = String(params[0]);
      const athleteId = Number(params[1]);
      const pay = this.payments.find((p) => p.public_uuid === uuid && p.athlete_id === athleteId);
      return [pay ? [{ provider: pay.provider, amount_cents: pay.amount_cents }] : [], []];
    }

    if (q.includes("from payments p") && q.includes("join events e") && q.includes("where p.public_uuid = ? and p.athlete_id = ? limit 1")) {
      const uuid = String(params[0]);
      const athleteId = Number(params[1]);
      const pay = this.payments.find((p) => p.public_uuid === uuid && p.athlete_id === athleteId);
      if (!pay) return [[], []];
      return [
        [
          {
            ...pay,
            event_title: SCENARIO.eventTitle,
            event_slug: SCENARIO.slug,
          },
        ],
        [],
      ];
    }

    if (
      q.includes("from payments p") &&
      q.includes("join events e") &&
      q.includes("registration_id is null") &&
      q.includes("order by p.created_at desc")
    ) {
      const athleteId = Number(params[0]);
      const slugFilter = q.includes("e.slug = ?") && params.length > 1 ? String(params[1]) : null;
      let rows = this.payments.filter(
        (p) =>
          p.athlete_id === athleteId &&
          p.registration_id == null &&
          ["pending", "processing", "succeeded"].includes(p.status),
      );
      if (slugFilter) {
        rows = rows.filter(() => slugFilter === SCENARIO.slug);
      }
      rows = rows.slice(0, slugFilter ? 1 : 5);
      return [
        rows.map((p) => ({
          public_uuid: p.public_uuid,
          amount_cents: p.amount_cents,
          currency: p.currency,
          status: p.status,
          created_at: p.created_at,
          metadata_json: p.metadata_json,
          event_title: SCENARIO.eventTitle,
          event_slug: SCENARIO.slug,
        })),
        [],
      ];
    }

    if (
      q.includes("from payments p") &&
      q.includes("join events e") &&
      q.includes("where p.public_uuid")
    ) {
      const uuid = String(params[0]);
      if (params.length >= 3) {
        const athleteId = Number(params[1]);
        const eventId = Number(params[2]);
        const pay = this.payments.find(
          (p) =>
            p.public_uuid === uuid &&
            p.athlete_id === athleteId &&
            p.event_id === eventId,
        );
        if (!pay) return [[], []];
        return [
          [
            {
              ...pay,
              event_title: SCENARIO.eventTitle,
              event_slug: SCENARIO.slug,
            },
          ],
          [],
        ];
      }
      if (params.length === 2) {
        const athleteId = Number(params[1]);
        const pay = this.payments.find(
          (p) => p.public_uuid === uuid && p.athlete_id === athleteId,
        );
        if (!pay) return [[], []];
        return [
          [
            {
              ...pay,
              event_title: SCENARIO.eventTitle,
              event_slug: SCENARIO.slug,
            },
          ],
          [],
        ];
      }
    }

    if (
      q.includes("from payments p") &&
      q.includes("join events e") &&
      q.includes("idempotency_key")
    ) {
      const key = String(params[0]);
      const athleteId = Number(params[1]);
      const eventId = Number(params[2]);
      const pay = this.payments
        .filter(
          (p) =>
            p.idempotency_key === key &&
            p.athlete_id === athleteId &&
            p.event_id === eventId &&
            p.registration_id == null,
        )
        .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
      if (!pay) return [[], []];
      return [
        [
          {
            ...pay,
            event_title: SCENARIO.eventTitle,
            event_slug: SCENARIO.slug,
          },
        ],
        [],
      ];
    }

    if (
      q.includes("from payments p") &&
      q.includes("join events e") &&
      q.includes("join athletes a") &&
      q.includes("for update")
    ) {
      const uuid = String(params[0]);
      const pay = this.findPaymentByUuid(uuid);
      if (!pay) return [[], []];
      return [
        [
          {
            ...pay,
            event_slug: SCENARIO.slug,
            event_title: SCENARIO.eventTitle,
            registration_opens_at: null,
            registration_closes_at: null,
            athlete_email: "athlete@test.local",
            athlete_first_name: "Test",
            athlete_preferred_language: "en",
          },
        ],
        [],
      ];
    }

    if (q.includes("select p.*") && q.includes("for update") && q.includes("public_uuid")) {
      const uuid = String(params[0]);
      const pay = this.findPaymentByUuid(uuid);
      if (!pay) return [[], []];
      return [
        [
          {
            ...pay,
            event_slug: SCENARIO.slug,
            event_title: SCENARIO.eventTitle,
            registration_opens_at: null,
            registration_closes_at: null,
            athlete_email: "athlete@test.local",
            athlete_first_name: "Test",
            athlete_preferred_language: "en",
          },
        ],
        [],
      ];
    }

    if (q.includes("select requires_waiver from events where id")) {
      return [[{ requires_waiver: this.requiresWaiver ? 1 : 0 }], []];
    }

    if (
      q.includes("select slug, starts_at from events where id") ||
      q.includes("select slug, start_date from events where id")
    ) {
      return [
        [
          {
            slug: SCENARIO.slug,
            starts_at: this.event.start_date ?? "2026-09-01T10:00:00.000Z",
            start_date: this.event.start_date ?? "2026-09-01T10:00:00.000Z",
          },
        ],
        [],
      ];
    }

    if (q.includes("select bib_mode from events where id")) {
      return [[{ bib_mode: this.event.bib_mode ?? "separate" }], []];
    }

    if (
      q.includes("from organizer_members") &&
      q.includes("event_access_scope") &&
      q.includes("status = 'active'")
    ) {
      return [[{ role: "owner", event_access_scope: "organization" }], []];
    }

    if (q.includes("select role from organizer_members") && q.includes("status = 'active'")) {
      return [[{ role: "owner" }], []];
    }

    if (q.includes("select id from events where id = ? and organizer_id = ?")) {
      const eventId = Number(params[0]);
      const organizerId = Number(params[1]);
      if (eventId === SCENARIO.eventId && organizerId === SCENARIO.organizerId) {
        return [[{ id: eventId }], []];
      }
      return [[], []];
    }

    if (
      q.includes("from events e") &&
      q.includes("check_in_opens_at") &&
      q.includes("deleted_at is null") &&
      q.includes("where e.id = ?")
    ) {
      return [
        [
          {
            event_id: SCENARIO.eventId,
            title: SCENARIO.eventTitle,
            status: String(this.event.status ?? "published"),
            start_date: String(this.event.start_date),
            end_date: this.event.end_date != null ? String(this.event.end_date) : null,
            timezone: String(this.event.timezone ?? "America/Mexico_City"),
            check_in_opens_at: this.event.check_in_opens_at ?? null,
            check_in_closes_at: this.event.check_in_closes_at ?? null,
          },
        ],
        [],
      ];
    }

    if (
      q.includes("from registrations r") &&
      q.includes("join events e on e.id = r.event_id and e.organizer_id = ?")
    ) {
      const organizerId = Number(params[0]);
      const tokens = params.slice(1).map((value) => String(value));
      const reg = this.registrations.find(
        (row) =>
          row.deleted_at == null &&
          row.status === "confirmed" &&
          tokens.some(
            (token) =>
              row.qr_code_token === token || row.registration_number === token,
          ),
      );
      if (!reg || organizerId !== SCENARIO.organizerId) return [[], []];
      return [[this.registrationLookupRow(reg)], []];
    }

    if (
      q.includes("from registrations r") &&
      q.includes("join events e on e.id = r.event_id") &&
      q.includes("waiver_signed_at") &&
      q.includes("where r.id = ?") &&
      !q.includes("qr_code_token")
    ) {
      const regId = Number(params[0]);
      const reg = this.registrations.find((row) => row.id === regId && row.deleted_at == null);
      if (!reg) return [[], []];
      return [
        [
          {
            event_id: reg.event_id,
            waiver_signed_at: reg.waiver_signed_at,
            requires_waiver: this.requiresWaiver ? 1 : 0,
          },
        ],
        [],
      ];
    }

    if (
      q.includes("from registrations r") &&
      q.includes("r.event_id = ?") &&
      q.includes("qr_code_token = ?")
    ) {
      const eventId = Number(params[0]);
      const tokens = params.slice(1).map((value) => String(value));
      const reg = this.registrations.find(
        (row) =>
          row.event_id === eventId &&
          row.deleted_at == null &&
          row.status === "confirmed" &&
          tokens.some(
            (token) =>
              row.qr_code_token === token || row.registration_number === token,
          ),
      );
      if (!reg) return [[], []];
      return [[this.registrationLookupRow(reg)], []];
    }

    if (q.includes("select count(*) as cnt from registrations") && q.includes("status = 'confirmed'")) {
      const eventId = Number(params[0]);
      const count = this.registrations.filter(
        (r) => r.event_id === eventId && r.status === "confirmed",
      ).length;
      return [[{ cnt: count }], []];
    }

    if (q.includes("select count(*) as c from registrations where event_id = ? and folio_segment_id is null")) {
      const eventId = Number(params[0]);
      const count = this.registrations.filter(
        (r) => r.event_id === eventId && (r as RegistrationRow & { folio_segment_id?: number | null }).folio_segment_id == null,
      ).length;
      return [[{ c: count }], []];
    }

    if (q.includes("select count(*) as c from registrations where event_id")) {
      const eventId = Number(params[0]);
      const count = this.registrations.filter((r) => r.event_id === eventId).length;
      return [[{ c: count }], []];
    }

    if (q.startsWith("insert into registrations")) {
      const hasBibCol = sql.toLowerCase().includes("bib_number");
      const bibOffset = hasBibCol ? 1 : 0;
      const reg: RegistrationRow = {
        id: this.nextRegistrationId++,
        public_uuid: String(params[0]),
        event_id: Number(params[1]),
        event_category_id: Number(params[2]),
        athlete_id: Number(params[3]),
        registration_number: String(params[4]),
        qr_code_token: String(params[6]),
        bib_number: hasBibCol ? ((params[7] as string | null) ?? null) : null,
        status: String(params[7 + bibOffset]),
        price_cents: Number(params[8 + bibOffset]),
        service_fee_cents: Number(params[9 + bibOffset]),
        total_cents: Number(params[10 + bibOffset]),
        discount_code_id: params[11 + bibOffset] as number | null,
        currency: String(params[12 + bibOffset]),
        source: String(params[13 + bibOffset]),
        payment_id: Number(params[14 + bibOffset]),
        order_id: params[15 + bibOffset] != null ? Number(params[15 + bibOffset]) : null,
        purchaser_athlete_id:
          params[16 + bibOffset] != null ? Number(params[16 + bibOffset]) : null,
        guest_claim_token:
          params[17 + bibOffset] != null && String(params[17 + bibOffset]).trim()
            ? String(params[17 + bibOffset])
            : null,
        deleted_at: null,
        waiver_signed_at: null,
      } as RegistrationRow;
      (reg as RegistrationRow & { folio_segment_id?: number | null }).folio_segment_id =
        params[5] != null ? Number(params[5]) : null;
      this.registrations.push(reg);
      return [header(reg.id, 1), []];
    }

    if (q.startsWith("insert into registration_field_values")) {
      this.fieldValues.push({
        id: this.nextFieldValueId,
        registration_id: Number(params[0]),
        field_id: Number(params[1]),
        value_text: params[2] != null ? String(params[2]) : null,
      } as RowDataPacket);
      return [header(this.nextFieldValueId++, 1), []];
    }

    if (q.includes("insert into registration_waiver_signatures")) {
      return [header(1, 1), []];
    }

    if (q.startsWith("update registrations set waiver_signed_at")) {
      const regId = Number(params[0]);
      const reg = this.registrations.find((r) => r.id === regId);
      if (reg) reg.waiver_signed_at = new Date().toISOString();
      return [header(0, reg ? 1 : 0), []];
    }

    if (q.startsWith("update payments set status = 'succeeded'") && q.includes("registration_id = null")) {
      const payId = Number(params[params.length - 1]);
      const pay = this.payments.find((p) => p.id === payId);
      if (pay) {
        pay.status = "succeeded";
        pay.registration_id = null;
        pay.paid_at = new Date().toISOString();
        const chargeId = params[0] != null ? String(params[0]) : null;
        const piId = params[1] != null ? String(params[1]) : null;
        if (chargeId && chargeId !== "null") pay.stripe_charge_id = chargeId;
        if (piId) pay.stripe_payment_intent_id = piId;
      }
      return [header(0, pay ? 1 : 0), []];
    }

    if (q.startsWith("update payments set status = 'succeeded'")) {
      const regId = Number(params[0]);
      const chargeId = params[1] != null ? String(params[1]) : null;
      const piId = params[2] != null ? String(params[2]) : null;
      const transferId = params[3] != null ? String(params[3]) : null;
      const appFeeId = params[4] != null ? String(params[4]) : null;
      const payId = Number(params[5] ?? params[3]);
      const pay = this.payments.find((p) => p.id === payId);
      if (pay) {
        pay.status = "succeeded";
        pay.registration_id = regId;
        pay.paid_at = new Date().toISOString();
        if (chargeId) pay.stripe_charge_id = chargeId;
        if (piId) pay.stripe_payment_intent_id = piId;
        if (transferId) pay.stripe_transfer_id = transferId;
        if (appFeeId) pay.stripe_application_fee_id = appFeeId;
      }
      return [header(0, 1), []];
    }

    if (q.includes("update event_categories set sold_count = sold_count + 1")) {
      return [header(0, 1), []];
    }

    if (q.includes("update waitlist_entries") && q.includes("converted")) {
      const regId = Number(params[0]);
      const entryId = Number(params[1]);
      const athleteId = Number(params[2]);
      const row = this.waitlist.find(
        (w) => w.id === entryId && w.athlete_id === athleteId && w.status === "offered",
      );
      if (row) {
        row.status = "converted";
        row.converted_registration_id = regId;
      }
      return [header(0, row ? 1 : 0), []];
    }

    if (q.includes("update events set registration_count")) {
      return [header(0, 1), []];
    }

    if (
      q.includes("from registrations r") &&
      q.includes("join event_categories ec") &&
      q.includes("join athletes a") &&
      q.includes("where r.order_id = ?")
    ) {
      const orderId = Number(params[0]);
      const rows = this.registrations
        .filter((r) => r.order_id === orderId && !r.deleted_at)
        .map((reg) => {
          const athlete =
            reg.athlete_id === SCENARIO.athleteId
              ? {
                  first_name: "Test",
                  last_name: "Athlete",
                  email: "athlete@test.local",
                }
              : this.extraAthletes.get(reg.athlete_id);
          return {
            public_uuid: reg.public_uuid,
            registration_number: reg.registration_number,
            qr_code_token: reg.qr_code_token,
            status: reg.status,
            total_cents: reg.total_cents,
            category_name: this.category.name,
            event_title: SCENARIO.eventTitle,
            event_slug: SCENARIO.slug,
            participant_label: athlete
              ? `${athlete.first_name} ${athlete.last_name}`.trim()
              : "Participant",
            participant_email: athlete?.email ?? "",
            guest_claim_token: reg.guest_claim_token ?? null,
          };
        });
      return [rows, []];
    }

    if (
      q.includes("from registrations r") &&
      q.includes("join athletes a") &&
      q.includes("r.registration_number") &&
      q.includes("guest_claim_token") &&
      q.includes("where r.id = ?")
    ) {
      const regId = Number(params[0]);
      const reg = this.registrations.find((r) => r.id === regId && !r.deleted_at);
      if (!reg || reg.status !== "confirmed") return [[], []];
      const athlete =
        reg.athlete_id === SCENARIO.athleteId
          ? {
              id: SCENARIO.athleteId,
              email: "athlete@test.local",
              first_name: "Test",
              preferred_language: "en",
            }
          : this.extraAthletes.get(reg.athlete_id);
      if (!athlete) return [[], []];
      return [
        [
          {
            registration_number: reg.registration_number,
            status: reg.status,
            guest_claim_token: reg.guest_claim_token ?? null,
            athlete_id: reg.athlete_id,
            athlete_email: athlete.email,
            athlete_first_name: athlete.first_name,
            preferred_language: "en",
            event_title: SCENARIO.eventTitle,
            category_name: this.category.name,
          },
        ],
        [],
      ];
    }

    if (
      q.includes("from registrations r") &&
      q.includes("join event_categories ec") &&
      q.includes("join events e")
    ) {
      const regId = Number(params[0]);
      const reg = this.registrations.find((r) => r.id === regId && !r.deleted_at);
      if (!reg) return [[], []];
      return [
        [
          {
            public_uuid: reg.public_uuid,
            registration_number: reg.registration_number,
            qr_code_token: reg.qr_code_token,
            status: reg.status,
            total_cents: reg.total_cents,
            category_name: this.category.name,
            event_title: SCENARIO.eventTitle,
            event_slug: SCENARIO.slug,
          },
        ],
        [],
      ];
    }

    if (
      q.includes("select id, stripe_payment_intent_id, provider, status") &&
      q.includes("idempotency_key <>")
    ) {
      return [[], []];
    }

    if (q.includes("from payments") && q.includes("registration_id is null") && q.includes("cancel")) {
      return [[], []];
    }

    if (
      q.startsWith("update payments set status = 'failed'") &&
      q.includes("superseded")
    ) {
      return [header(0, 0), []];
    }

    if (q.startsWith("update payments set status = 'cancelled'")) {
      return [header(0, 0), []];
    }

    throw new Error(`[ScenarioDb] Unhandled SQL: ${sql.slice(0, 160)}…`);
  };

  getConnection = async (): Promise<PoolConnection> => {
    const self = this;
    return {
      query: self.query,
      beginTransaction: async () => {
        self.txSnapshot = JSON.stringify({
          payments: self.payments,
          registrations: self.registrations,
          waitlist: self.waitlist,
        });
      },
      commit: async () => {
        self.txSnapshot = null;
      },
      rollback: async () => {
        if (self.txSnapshot) {
          const snap = JSON.parse(self.txSnapshot) as {
            payments: PaymentRow[];
            registrations: RegistrationRow[];
            waitlist: WaitlistRow[];
          };
          self.payments.length = 0;
          self.payments.push(...snap.payments);
          self.registrations.length = 0;
          self.registrations.push(...snap.registrations);
          self.waitlist.length = 0;
          self.waitlist.push(...snap.waitlist);
          self.txSnapshot = null;
        }
      },
      release: async () => {},
    } as unknown as PoolConnection;
  };

  asPool(): Pool {
    return {
      query: this.query,
      getConnection: this.getConnection,
    } as unknown as Pool;
  }

  /** Seed a paid Stripe checkout awaiting confirmation (resume → checkout state). */
  seedPendingStripeCheckout(opts: {
    publicUuid: string;
    idempotencyKey: string;
    amountCents?: number;
    metadata?: Record<string, unknown>;
  }): void {
    this.payments.push({
      id: this.nextPaymentId++,
      public_uuid: opts.publicUuid,
      idempotency_key: opts.idempotencyKey,
      registration_id: null,
      athlete_id: SCENARIO.athleteId,
      organizer_id: SCENARIO.organizerId,
      event_id: SCENARIO.eventId,
      amount_cents: opts.amountCents ?? 85000,
      registration_amount_cents: 80000,
      service_fee_cents: 5000,
      currency: "MXN",
      status: "processing",
      provider: "stripe",
      metadata_json: JSON.stringify(
        opts.metadata ?? {
          categoryId: SCENARIO.categoryId,
          categoryName: "10K Elite",
          fieldValues: {},
        },
      ),
      stripe_payment_intent_id: "pi_mock_processing",
      paid_at: null,
      created_at: new Date().toISOString(),
    } as PaymentRow);
  }
}

export function defaultWaiverSignatures() {
  return [
    { waiverId: 1, signature: WAIVER_ACCEPTANCE_SIGNATURE, waiverVersion: 2 },
    { waiverId: 2, signature: WAIVER_ACCEPTANCE_SIGNATURE, waiverVersion: 1 },
  ];
}

export const seeds = {
  freeOpen: (): ScenarioSeed => ({
    requiresWaiver: false,
    category: { price_cents: 0, capacity: 100 },
  }),
  groupFreeMaxTwo: (): ScenarioSeed => ({
    requiresWaiver: false,
    category: { price_cents: 0, capacity: 100 },
    maxRegistrationsPerOrder: 2,
  }),
  groupFreeOpen: (): ScenarioSeed => ({
    requiresWaiver: false,
    category: { price_cents: 0, capacity: 100 },
    maxRegistrationsPerOrder: 10,
  }),
  freeWithWaiver: (): ScenarioSeed => ({
    requiresWaiver: true,
    category: { price_cents: 0, capacity: 100 },
    waivers: [
      { id: 1, title: "General", version: 2 },
      { id: 2, title: "Medical", version: 1 },
    ],
  }),
  alreadyRegistered: (): ScenarioSeed => ({
    requiresWaiver: false,
    category: { price_cents: 0 },
    athleteAlreadyRegistered: true,
  }),
  soldOutWaitlist: (): ScenarioSeed => ({
    requiresWaiver: false,
    category: { price_cents: 0, capacity: 2, waitlist_enabled: true },
    confirmedRegistrationCount: 2,
  }),
  waitlistClaim: (): ScenarioSeed => ({
    requiresWaiver: false,
    category: { price_cents: 0, capacity: 2, waitlist_enabled: true },
    confirmedRegistrationCount: 2,
    waitlistOffer: { id: 501, status: "offered" },
  }),
  paidNoStripe: (): ScenarioSeed => ({
    requiresWaiver: false,
    category: { price_cents: 50000, capacity: 100 },
  }),
  paidWithDiscount: (): ScenarioSeed => ({
    requiresWaiver: false,
    category: { price_cents: 95000, capacity: 100 },
    discountCodes: [
      {
        id: 5,
        code: "EARLY10",
        discount_type: "percent",
        discount_value: 10,
        applies_to: "total",
      },
    ],
  }),
  freeWithFullDiscount: (): ScenarioSeed => ({
    requiresWaiver: false,
    category: { price_cents: 50000, capacity: 100 },
    discountCodes: [
      {
        id: 6,
        code: "FREE100",
        discount_type: "percent",
        discount_value: 100,
        applies_to: "total",
      },
    ],
  }),
  paidConnectReady: (): ScenarioSeed => ({
    requiresWaiver: false,
    category: { price_cents: 80_000, capacity: 100 },
    organizer: {
      legal_name: "Trail MX SA",
      rfc: "TRM123456ABC",
      billing_email: "billing@trail.mx",
      payout_terms_accepted_at: "2026-01-01 00:00:00",
      payout_fee_acknowledged_at: "2026-01-01 00:00:00",
      fee_presentation: "pass_through",
      stripe_account_id: "acct_test_ready",
      stripe_onboarding_complete: 1,
      stripe_connect_status: "ready",
      stripe_charges_enabled: 1,
      stripe_payouts_enabled: 1,
      stripe_details_submitted: 1,
      stripe_connect_onboarded_at: "2026-01-01 00:00:00",
    },
  }),
  paidConnectAbsorbAll: (): ScenarioSeed => ({
    requiresWaiver: false,
    category: { price_cents: 100_000, capacity: 100 },
    organizer: {
      legal_name: "Trail MX SA",
      rfc: "TRM123456ABC",
      billing_email: "billing@trail.mx",
      payout_terms_accepted_at: "2026-01-01 00:00:00",
      payout_fee_acknowledged_at: "2026-01-01 00:00:00",
      fee_presentation: "absorb_all",
      stripe_account_id: "acct_test_ready",
      stripe_onboarding_complete: 1,
      stripe_connect_status: "ready",
      stripe_charges_enabled: 1,
      stripe_payouts_enabled: 1,
      stripe_details_submitted: 1,
      stripe_connect_onboarded_at: "2026-01-01 00:00:00",
    },
  }),
  paidConnectNotReady: (): ScenarioSeed => ({
    requiresWaiver: false,
    category: { price_cents: 50_000, capacity: 100 },
    organizer: {
      stripe_account_id: "acct_test_pending",
      stripe_connect_status: "pending",
      stripe_charges_enabled: 0,
      stripe_payouts_enabled: 0,
    },
  }),
  paidConnectDisabled: (): ScenarioSeed => ({
    requiresWaiver: false,
    category: { price_cents: 50_000, capacity: 100 },
    organizer: {
      legal_name: "Trail MX SA",
      rfc: "TRM123456ABC",
      billing_email: "billing@trail.mx",
      payout_terms_accepted_at: "2026-01-01 00:00:00",
      payout_fee_acknowledged_at: "2026-01-01 00:00:00",
      stripe_account_id: "acct_test_disabled",
      stripe_connect_status: "disabled",
      stripe_charges_enabled: 0,
      stripe_payouts_enabled: 0,
    },
  }),
  withOptionalExtras: (): ScenarioSeed => ({
    requiresWaiver: false,
    category: { price_cents: 50_000, capacity: 100 },
    extras: [
      {
        id: 201,
        name: "Official Tee",
        price_cents: 4_500,
        extra_type: "merch",
        max_per_athlete: 2,
      },
      {
        id: 202,
        name: "Gold Folio",
        price_cents: 1_500,
        extra_type: "folio",
        max_per_athlete: 1,
      },
    ],
  }),
  withRequiredExtra: (): ScenarioSeed => ({
    requiresWaiver: false,
    category: { price_cents: 0, capacity: 100 },
    extras: [
      {
        id: 203,
        name: "Chip Timing",
        price_cents: 1_200,
        is_required: true,
        max_per_athlete: 1,
      },
    ],
  }),
  withLimitedExtra: (): ScenarioSeed => ({
    requiresWaiver: false,
    category: { price_cents: 0, capacity: 100 },
    extras: [
      {
        id: 204,
        name: "VIP Parking",
        price_cents: 2_500,
        capacity: 2,
        sold_count: 1,
        max_per_athlete: 2,
      },
    ],
  }),
  withInactiveExtra: (): ScenarioSeed => ({
    requiresWaiver: false,
    category: { price_cents: 0, capacity: 100 },
    extras: [
      { id: 205, name: "Hidden Item", price_cents: 1_000, is_active: false },
      { id: 206, name: "Visible Item", price_cents: 2_000, is_active: true },
    ],
  }),
  paidWithExtrasAndDiscount: (): ScenarioSeed => ({
    requiresWaiver: false,
    category: { price_cents: 95_000, capacity: 100 },
    discountCodes: [
      {
        id: 5,
        code: "EARLY10",
        discount_type: "percent",
        discount_value: 10,
        applies_to: "total",
      },
    ],
    extras: [{ id: 207, name: "Meal Voucher", price_cents: 3_000, max_per_athlete: 1 }],
  }),
  paidConnectReadyWithExtras: (): ScenarioSeed => ({
    requiresWaiver: false,
    category: { price_cents: 80_000, capacity: 100 },
    organizer: {
      legal_name: "Trail MX SA",
      rfc: "TRM123456ABC",
      billing_email: "billing@trail.mx",
      payout_terms_accepted_at: "2026-01-01 00:00:00",
      payout_fee_acknowledged_at: "2026-01-01 00:00:00",
      fee_presentation: "pass_through",
      stripe_account_id: "acct_test_ready",
      stripe_onboarding_complete: 1,
      stripe_connect_status: "ready",
      stripe_charges_enabled: 1,
      stripe_payouts_enabled: 1,
      stripe_details_submitted: 1,
      stripe_connect_onboarded_at: "2026-01-01 00:00:00",
    },
    extras: [{ id: 208, name: "Recovery Kit", price_cents: 2_800, max_per_athlete: 1 }],
  }),
  withExtrasAndFields: (): ScenarioSeed => ({
    requiresWaiver: false,
    category: { price_cents: 0, capacity: 100 },
    extras: [
      {
        id: 210,
        name: "Official Tee",
        price_cents: 4_500,
        max_per_athlete: 1,
        fields: [
          {
            field_key: "shirt_size",
            label: "T-shirt size",
            field_type: "select",
            options_json: ["S", "M", "L", "XL"],
            is_required: true,
          },
        ],
      },
    ],
  }),
  withCategoryScopedExtras: (): ScenarioSeed => ({
    requiresWaiver: false,
    category: { price_cents: 0, capacity: 100 },
    extras: [
      {
        id: 211,
        name: "Category Hoodie",
        price_cents: 5_000,
        scope_type: "selected_categories",
        category_ids: [SCENARIO.categoryId],
      },
      {
        id: 212,
        name: "Wrong Category Item",
        price_cents: 3_000,
        scope_type: "selected_categories",
        category_ids: [999],
      },
    ],
  }),
  withExpiredSalesExtra: (): ScenarioSeed => ({
    requiresWaiver: false,
    category: { price_cents: 0, capacity: 100 },
    extras: [
      {
        id: 213,
        name: "Late Extra",
        price_cents: 1_000,
        sales_closes_at: new Date(Date.now() - 86_400_000).toISOString(),
      },
    ],
  }),
  withFutureSalesExtra: (): ScenarioSeed => ({
    requiresWaiver: false,
    category: { price_cents: 0, capacity: 100 },
    extras: [
      {
        id: 214,
        name: "Early Bird Extra",
        price_cents: 1_000,
        sales_opens_at: new Date(Date.now() + 86_400_000).toISOString(),
      },
    ],
  }),
  withFreeExtra: (): ScenarioSeed => ({
    requiresWaiver: false,
    category: { price_cents: 0, capacity: 100 },
    extras: [{ id: 215, name: "Free Sticker", price_cents: 0 }],
  }),
  withFreeExtraAndFields: (): ScenarioSeed => ({
    requiresWaiver: false,
    category: { price_cents: 0, capacity: 100 },
    extras: [
      {
        id: 216,
        name: "Finisher Tee",
        price_cents: 0,
        max_per_athlete: 1,
        fields: [
          {
            field_key: "shirt_size",
            label: "T-shirt size",
            field_type: "select",
            options_json: ["S", "M", "L", "XL"],
            is_required: true,
          },
        ],
      },
    ],
  }),
  withCategoryScopedRegistrationFields: (): ScenarioSeed => ({
    requiresWaiver: false,
    category: { price_cents: 0, capacity: 100 },
    fields: [
      {
        id: 30010,
        field_key: "elite_bib_name",
        label: "Elite bib name",
        field_type: "text",
        is_required: true,
        scope_type: "selected_categories",
        category_ids: [SCENARIO.categoryId],
      },
      {
        id: 30011,
        field_key: "other_distance_note",
        label: "Other distance note",
        field_type: "text",
        is_required: true,
        scope_type: "selected_categories",
        category_ids: [999],
      },
    ],
  }),
  withRequiredRegistrationField: (): ScenarioSeed => ({
    requiresWaiver: false,
    category: { price_cents: 0, capacity: 100 },
    fields: [
      {
        id: 30020,
        field_key: "emergency_contact",
        label: "Emergency contact",
        field_type: "text",
        is_required: true,
        scope_type: "all_categories",
      },
    ],
  }),
};
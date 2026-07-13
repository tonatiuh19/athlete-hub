import type { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import {
  handleExtrasScenarioSql,
  type ExtrasSqlContext,
} from "./extrasScenarioSql.js";
import {
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

export const STAFF_SCENARIO = {
  memberId: 2001,
  financeMemberId: 2002,
  sellerMemberId: 2003,
  organizerId: 7,
  sportTypeId: 1,
  defaultEventId: 100,
} as const;

export type StaffMemberRole =
  | "owner"
  | "organizer"
  | "operations"
  | "marketing"
  | "finance"
  | "timing"
  | "sponsor"
  | "seller";

type EventRow = RowDataPacket & {
  id: number;
  public_uuid: string;
  organizer_id: number;
  sport_type_id: number;
  slug: string;
  title: string;
  short_description: string | null;
  description: string | null;
  status: string;
  visibility: string;
  featured: number;
  start_date: string;
  end_date: string | null;
  registration_opens_at: string | null;
  registration_closes_at: string | null;
  check_in_opens_at: string | null;
  check_in_closes_at: string | null;
  timezone: string;
  location_name: string | null;
  location_city: string | null;
  location_state: string | null;
  location_country: string;
  location_lat: number | null;
  location_lng: number | null;
  hero_image_url: string | null;
  banner_image_url: string | null;
  max_registrations: number | null;
  requires_waiver: number;
  deleted_at: string | null;
  submitted_for_approval_at: string | null;
  approval_rejection_reason: string | null;
};

type CategoryRow = RowDataPacket & {
  id: number;
  public_uuid: string;
  event_id: number;
  name: string;
  description: string | null;
  distance_km: number | null;
  difficulty: string | null;
  capacity: number | null;
  price_cents: number;
  currency: string;
  gender_restriction: string | null;
  min_age: number | null;
  max_age: number | null;
  waitlist_enabled: number;
  registration_opens_at: string | null;
  registration_closes_at: string | null;
  sort_order: number;
  is_active: number;
};

type OrganizerRow = RowDataPacket & {
  id: number;
  public_uuid: string;
  slug: string;
  name: string;
  email: string;
  phone: string | null;
  city: string | null;
  country: string;
  status: string;
  service_fee_percent: number;
  fee_presentation: string;
  legal_name: string | null;
  billing_email: string | null;
  rfc: string | null;
  tax_regime: string | null;
  stripe_account_id: string | null;
  stripe_onboarding_complete: number;
  stripe_connect_status: string;
  stripe_charges_enabled: number;
  stripe_payouts_enabled: number;
  stripe_details_submitted: number;
  stripe_connect_onboarded_at: string | null;
  stripe_connect_last_synced_at: string | null;
  stripe_connect_onboarding_mode: string | null;
  payout_terms_accepted_at: string | null;
  payout_fee_acknowledged_at: string | null;
  deleted_at: string | null;
};

type OrganizerMemberRow = RowDataPacket & {
  id: number;
  public_uuid: string;
  organizer_id: number;
  email: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  role: StaffMemberRole | string;
  event_access_scope: string;
  status: string;
  preferred_language: string;
  deleted_at: string | null;
};

type ManualPaymentSeed = {
  sellerMemberId: number;
  amount_cents: number;
  provider?: "manual" | "stripe" | "mock";
  status?: string;
};

export interface StaffPortalSeed {
  memberRole?: StaffMemberRole;
  /** When set, mount harness uses this member id (e.g. finance user). */
  memberId?: number;
  events?: Array<{
    id?: number;
    status?: string;
    slug?: string;
    title?: string;
    requires_waiver?: boolean;
    categories?: Array<{ price_cents?: number; is_active?: number }>;
  }>;
  manualPayments?: ManualPaymentSeed[];
}

function normalizeSql(sql: string): string {
  return sql.replace(/\s+/g, " ").trim().toLowerCase();
}

function header(insertId = 0, affectedRows = 1): ResultSetHeader {
  return { insertId, affectedRows } as ResultSetHeader;
}

function defaultEvent(partial: StaffPortalSeed["events"] extends (infer E)[] | undefined ? E : never): EventRow {
  const id = partial.id ?? STAFF_SCENARIO.defaultEventId;
  return {
    id,
    public_uuid: `event-uuid-${id}`,
    organizer_id: STAFF_SCENARIO.organizerId,
    sport_type_id: STAFF_SCENARIO.sportTypeId,
    slug: partial.slug ?? `test-event-${id}`,
    title: partial.title ?? "Test Event",
    short_description: null,
    description: null,
    status: partial.status ?? "draft",
    visibility: "public",
    featured: 0,
    start_date: "2026-09-01T10:00:00.000Z",
    end_date: null,
    registration_opens_at: null,
    registration_closes_at: null,
    check_in_opens_at: null,
    check_in_closes_at: null,
    timezone: "America/Mexico_City",
    location_name: null,
    location_city: "Ciudad de México",
    location_state: "CDMX",
    location_country: "MX",
    location_lat: null,
    location_lng: null,
    hero_image_url: null,
    banner_image_url: null,
    max_registrations: null,
    requires_waiver: partial.requires_waiver ? 1 : 0,
    deleted_at: null,
    submitted_for_approval_at:
      partial.status === "pending_approval" ? new Date().toISOString() : null,
    approval_rejection_reason: null,
  } as EventRow;
}

export class StaffPortalScenarioDb {
  readonly events: EventRow[] = [];
  readonly categories: CategoryRow[] = [];
  readonly memberRole: StaffMemberRole;
  readonly memberId: number;
  readonly financeMemberId = STAFF_SCENARIO.financeMemberId;
  readonly organizers: OrganizerRow[] = [];
  readonly members: OrganizerMemberRow[] = [];
  readonly organizerSettings: Array<{
    organizer_id: number;
    setting_key: string;
    setting_value: unknown;
  }> = [];
  readonly extras: RowDataPacket[] = [];
  readonly extraFields: RowDataPacket[] = [];
  readonly extraCategories: RowDataPacket[] = [];
  readonly registrationFields: RegistrationFieldRow[] = [];
  readonly registrationFieldCategories: RegistrationFieldCategoryRow[] = [];
  readonly folioSegments: FolioSegmentRow[] = [];
  readonly folioSegmentCategories: FolioSegmentCategoryRow[] = [];
  readonly folioCounters: FolioCounterRow[] = [];
  readonly payments: Array<{
    id: number;
    public_uuid: string;
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
    recorded_by_member_id: number | null;
    stripe_payment_intent_id: string | null;
    paid_at: string | null;
    created_at: string;
    registration_number?: string | null;
  }> = [];
  readonly athletes: Array<{
    id: number;
    first_name: string;
    last_name: string;
    email: string;
  }> = [
    {
      id: 9001,
      first_name: "Test",
      last_name: "Athlete",
      email: "athlete@test.local",
    },
  ];

  private nextExtraId = 300;
  private nextFieldId = { current: 400 };
  private nextSegmentId = { current: 600 };
  private nextCounterId = { current: 1 };
  private nextExtraFieldId = { current: 1 };
  private nextRegExtraFieldValueId = { current: 1 };

  private extrasSqlContext(): ExtrasSqlContext {
    return {
      extras: this.extras,
      extraFields: this.extraFields,
      extraCategories: this.extraCategories,
      registrationExtraFieldValues: [],
      nextExtraFieldId: this.nextExtraFieldId,
      nextRegExtraFieldValueId: this.nextRegExtraFieldValueId,
      resolveCategoryIds: (eventId, categoryIds) => {
        const active = this.categories
          .filter((c) => c.event_id === eventId && c.is_active === 1)
          .map((c) => c.id);
        return categoryIds.filter((id) => active.includes(id));
      },
      eventRegistrationWindow: (eventId) => {
        const event = this.getEvent(eventId);
        return {
          registration_opens_at: event?.registration_opens_at ?? null,
          registration_closes_at: event?.registration_closes_at ?? null,
        };
      },
      categoryRegistrationWindows: (eventId) =>
        this.categories
          .filter((c) => c.event_id === eventId && c.is_active === 1)
          .map((c) => ({
            registration_opens_at: c.registration_opens_at,
            registration_closes_at: c.registration_closes_at,
          })),
    };
  }

  private registrationFieldsSqlContext() {
    return {
      fields: this.registrationFields,
      fieldCategories: this.registrationFieldCategories,
      nextFieldId: this.nextFieldId,
      eventId: STAFF_SCENARIO.defaultEventId,
      resolveCategoryIds: (eventId, categoryIds) => {
        const active = this.categories
          .filter((c) => c.event_id === eventId && c.is_active === 1)
          .map((c) => c.id);
        return categoryIds.filter((id) => active.includes(id));
      },
    };
  }

  private folioSegmentsSqlContext() {
    return {
      segments: this.folioSegments,
      segmentCategories: this.folioSegmentCategories,
      counters: this.folioCounters,
      nextSegmentId: this.nextSegmentId,
      nextCounterId: this.nextCounterId,
      resolveCategoryIds: (eventId: number, categoryIds: number[]) => {
        const active = this.categories
          .filter((c) => c.event_id === eventId && c.is_active === 1)
          .map((c) => c.id);
        return categoryIds.filter((id) => active.includes(id));
      },
    };
  }

  private nextEventId: number;
  private nextCategoryId = 500;
  private nextPublicUuid = 1;
  private nextOrganizerId = STAFF_SCENARIO.organizerId + 1;
  private nextMemberId = STAFF_SCENARIO.sellerMemberId + 1;
  private nextPaymentId = 8001;
  private lastRegisteredOrganizerId: number | null = null;
  private lastRegisteredMemberId: number | null = null;

  constructor(seed: StaffPortalSeed = {}) {
    this.memberRole = seed.memberRole ?? "owner";
    this.memberId = seed.memberId ?? STAFF_SCENARIO.memberId;
    this.nextEventId = STAFF_SCENARIO.defaultEventId;

    this.organizers.push({
      id: STAFF_SCENARIO.organizerId,
      public_uuid: "org-uuid-7",
      slug: "test-organizer",
      name: "Test Organizer",
      email: "org@test.local",
      phone: null,
      city: "Ciudad de México",
      country: "MX",
      status: "active",
      service_fee_percent: 11,
      fee_presentation: "pass_through",
      legal_name: null,
      billing_email: null,
      rfc: null,
      tax_regime: null,
      stripe_account_id: null,
      stripe_onboarding_complete: 0,
      stripe_connect_status: "not_started",
      stripe_charges_enabled: 0,
      stripe_payouts_enabled: 0,
      stripe_details_submitted: 0,
      stripe_connect_onboarded_at: null,
      stripe_connect_last_synced_at: null,
      stripe_connect_onboarding_mode: null,
      payout_terms_accepted_at: null,
      payout_fee_acknowledged_at: null,
      deleted_at: null,
    } as OrganizerRow);

    this.members.push(
      {
        id: STAFF_SCENARIO.memberId,
        public_uuid: "member-uuid-2001",
        organizer_id: STAFF_SCENARIO.organizerId,
        email: "organizer@test.local",
        first_name: "Test",
        last_name: "Owner",
        phone: null,
        role: this.memberRole,
        event_access_scope: "organization",
        status: "active",
        preferred_language: "es",
        deleted_at: null,
      } as OrganizerMemberRow,
      {
        id: STAFF_SCENARIO.financeMemberId,
        public_uuid: "member-uuid-2002",
        organizer_id: STAFF_SCENARIO.organizerId,
        email: "finance@test.local",
        first_name: "Finance",
        last_name: "User",
        phone: null,
        role: "finance",
        event_access_scope: "organization",
        status: "active",
        preferred_language: "es",
        deleted_at: null,
      } as OrganizerMemberRow,
      {
        id: STAFF_SCENARIO.sellerMemberId,
        public_uuid: "member-uuid-2003",
        organizer_id: STAFF_SCENARIO.organizerId,
        email: "seller@test.local",
        first_name: "Booth",
        last_name: "Seller",
        phone: null,
        role: "seller",
        event_access_scope: "organization",
        status: "active",
        preferred_language: "es",
        deleted_at: null,
      } as OrganizerMemberRow,
    );

    for (const ev of seed.events ?? []) {
      const row = defaultEvent(ev);
      this.events.push(row);
      this.nextEventId = Math.max(this.nextEventId, row.id + 1);
      for (const cat of ev.categories ?? [{ price_cents: 0, is_active: 1 }]) {
        this.categories.push({
          id: this.nextCategoryId++,
          public_uuid: `cat-uuid-${this.nextCategoryId}`,
          event_id: row.id,
          name: "General",
          description: null,
          distance_km: null,
          difficulty: null,
          capacity: null,
          price_cents: cat.price_cents ?? 0,
          currency: "MXN",
          gender_restriction: null,
          min_age: null,
          max_age: null,
          waitlist_enabled: 0,
          registration_opens_at: null,
          registration_closes_at: null,
          sort_order: 0,
          is_active: cat.is_active ?? 1,
        } as CategoryRow);
      }
    }

    for (const pay of seed.manualPayments ?? []) {
      const eventId = seed.events?.[0]?.id ?? STAFF_SCENARIO.defaultEventId;
      this.payments.push({
        id: this.nextPaymentId++,
        public_uuid: `pay-uuid-${this.nextPaymentId}`,
        registration_id: 7001,
        athlete_id: this.athletes[0].id,
        organizer_id: STAFF_SCENARIO.organizerId,
        event_id: eventId,
        amount_cents: pay.amount_cents,
        registration_amount_cents: pay.amount_cents,
        service_fee_cents: 0,
        currency: "MXN",
        status: pay.status ?? "succeeded",
        provider: pay.provider ?? "manual",
        recorded_by_member_id: pay.sellerMemberId,
        stripe_payment_intent_id: null,
        paid_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        registration_number: "MAN-001",
      });
    }
  }

  private memberRowById(memberId: number): OrganizerMemberRow | undefined {
    return this.members.find((m) => m.id === memberId);
  }

  private filterPayments(params: unknown[], q: string) {
    let rows = [...this.payments];
    let paramIdx = 0;

    if (q.includes("p.organizer_id = ?")) {
      const organizerId = Number(params[paramIdx++]);
      rows = rows.filter((p) => p.organizer_id === organizerId);
    }
    if (q.includes("p.status = ?")) {
      const status = String(params[paramIdx++]);
      rows = rows.filter((p) => p.status === status);
    }
    if (q.includes("p.provider = ?")) {
      const provider = String(params[paramIdx++]);
      rows = rows.filter((p) => p.provider === provider);
    }
    if (q.includes("p.event_id = ?")) {
      const eventId = Number(params[paramIdx++]);
      rows = rows.filter((p) => p.event_id === eventId);
    }
    if (q.includes("p.recorded_by_member_id is null")) {
      rows = rows.filter((p) => p.recorded_by_member_id == null);
    } else if (q.includes("p.recorded_by_member_id = ?")) {
      const memberId = Number(params[paramIdx++]);
      rows = rows.filter((p) => p.recorded_by_member_id === memberId);
    }

    return rows;
  }

  private paymentListRow(p: (typeof this.payments)[number]) {
    const athlete = this.athletes.find((a) => a.id === p.athlete_id);
    const event = this.getEvent(p.event_id);
    const seller = p.recorded_by_member_id
      ? this.memberRowById(p.recorded_by_member_id)
      : undefined;
    return {
      ...p,
      athlete_first_name: athlete?.first_name ?? null,
      athlete_last_name: athlete?.last_name ?? null,
      athlete_email: athlete?.email ?? null,
      event_title: event?.title ?? "Test Event",
      event_slug: event?.slug ?? "test-event",
      organizer_name: "Test Organizer",
      seller_first_name: seller?.first_name ?? null,
      seller_last_name: seller?.last_name ?? null,
      seller_email: seller?.email ?? null,
    };
  }

  getEvent(eventId: number): EventRow | undefined {
    return this.events.find((e) => e.id === eventId && !e.deleted_at);
  }

  publishedSlugs(): string[] {
    return this.events
      .filter((e) => e.status === "published" && !e.deleted_at)
      .map((e) => e.slug);
  }

  getLastRegisteredOrganizerId(): number {
    if (this.lastRegisteredOrganizerId == null) {
      throw new Error("No self-service organizer registered in scenario");
    }
    return this.lastRegisteredOrganizerId;
  }

  getLastRegisteredMemberId(): number {
    if (this.lastRegisteredMemberId == null) {
      throw new Error("No self-service organizer member registered in scenario");
    }
    return this.lastRegisteredMemberId;
  }

  private memberRow(memberId: number): OrganizerMemberRow | undefined {
    return this.members.find((m) => m.id === memberId && !m.deleted_at);
  }

  private eventDetailRow(event: EventRow): RowDataPacket {
    return {
      ...event,
      registration_count: 0,
      sport_name: "Running",
      organizer_name: "Test Organizer",
    };
  }

  private categoriesForEvent(eventId: number): RowDataPacket[] {
    return this.categories
      .filter((c) => c.event_id === eventId)
      .map((c) => ({ ...c, sold_count: 0 }));
  }

  private organizerConnectRow(organizerId: number): RowDataPacket | null {
    const org = this.organizers.find((o) => o.id === organizerId && !o.deleted_at);
    if (!org) return null;
    return {
      organizer_id: org.id,
      email: org.email,
      legal_name: org.legal_name,
      billing_email: org.billing_email,
      rfc: org.rfc,
      tax_regime: org.tax_regime,
      service_fee_percent: org.service_fee_percent,
      fee_presentation: org.fee_presentation,
      status: org.status,
      stripe_account_id: org.stripe_account_id,
      stripe_onboarding_complete: org.stripe_onboarding_complete,
      stripe_connect_status: org.stripe_connect_status,
      stripe_charges_enabled: org.stripe_charges_enabled,
      stripe_payouts_enabled: org.stripe_payouts_enabled,
      stripe_details_submitted: org.stripe_details_submitted,
      stripe_connect_onboarded_at: org.stripe_connect_onboarded_at,
      stripe_connect_last_synced_at: org.stripe_connect_last_synced_at,
      stripe_connect_onboarding_mode: org.stripe_connect_onboarding_mode,
      payout_terms_accepted_at: org.payout_terms_accepted_at,
      payout_fee_acknowledged_at: org.payout_fee_acknowledged_at,
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

    if (
      q.includes("select role from organizer_members") &&
      q.includes("where id = ? and organizer_id = ?")
    ) {
      const memberId = Number(params[0]);
      const organizerId = Number(params[1]);
      const row = this.memberRow(memberId);
      if (!row || row.organizer_id !== organizerId) return [[], []];
      return [[{ role: row.role }], []];
    }

    if (
      q.includes("select role, event_access_scope from organizer_members") &&
      q.includes("where id = ? and organizer_id = ?")
    ) {
      const memberId = Number(params[0]);
      const organizerId = Number(params[1]);
      const row = this.memberRow(memberId);
      if (!row || row.organizer_id !== organizerId) return [[], []];
      return [
        [
          {
            role: row.role,
            event_access_scope: row.event_access_scope,
          },
        ],
        [],
      ];
    }

    if (
      q.includes("select event_id from organizer_member_events where organizer_member_id = ?")
    ) {
      return [[], []];
    }

    if (
      q.includes("select id from events where id = ? and organizer_id = ? and deleted_at is null")
    ) {
      const eventId = Number(params[0]);
      const organizerId = Number(params[1]);
      const hit = this.events.find(
        (e) => e.id === eventId && e.organizer_id === organizerId && !e.deleted_at,
      );
      return hit ? [[{ id: hit.id }], []] : [[], []];
    }

    if (q.includes("select id from events where slug = ?")) {
      const slug = String(params[0]);
      const excludeId = params.length > 1 ? Number(params[1]) : null;
      const hit = this.events.find(
        (e) =>
          e.slug === slug &&
          !e.deleted_at &&
          (excludeId == null || e.id !== excludeId),
      );
      return hit ? [[{ id: hit.id }], []] : [[], []];
    }

    if (q.includes("select id from sport_types where id = ? and is_active = 1")) {
      const sportId = Number(params[0]);
      if (sportId === STAFF_SCENARIO.sportTypeId) {
        return [[{ id: sportId }], []];
      }
      return [[], []];
    }

    if (q.includes("insert into events")) {
      const id = this.nextEventId++;
      const row = defaultEvent({
        title: String(params[5]),
        slug: String(params[4]),
        status: "draft",
      });
      row.id = id;
      row.public_uuid = `event-uuid-${this.nextPublicUuid++}`;
      row.organizer_id = Number(params[1]);
      row.sport_type_id = Number(params[2]);
      row.slug = String(params[3]);
      row.title = String(params[4]);
      row.short_description = params[5] as string | null;
      row.description = params[6] as string | null;
      row.visibility = String(params[8]);
      row.featured = Number(params[9]);
      row.start_date = String(params[10]);
      row.end_date = (params[11] as string | null) ?? null;
      row.registration_opens_at = (params[12] as string | null) ?? null;
      row.registration_closes_at = (params[13] as string | null) ?? null;
      row.check_in_opens_at = (params[14] as string | null) ?? null;
      row.check_in_closes_at = (params[15] as string | null) ?? null;
      row.location_name = params[16] as string | null;
      row.location_city = params[17] as string | null;
      row.location_state = params[18] as string | null;
      row.location_lat = params[19] as number | null;
      row.location_lng = params[20] as number | null;
      row.hero_image_url = params[21] as string | null;
      row.banner_image_url = params[22] as string | null;
      row.max_registrations = params[23] as number | null;
      row.requires_waiver = Number(params[25] ?? params[24]);
      this.events.push(row);
      return [header(id, 1), []];
    }

    if (
      q.includes("select status from events where id = ? and organizer_id = ? and deleted_at is null")
    ) {
      const eventId = Number(params[0]);
      const event = this.getEvent(eventId);
      if (!event || event.organizer_id !== Number(params[1])) return [[], []];
      return [[{ status: event.status }], []];
    }

    if (
      q.includes("select requires_waiver from events where id = ? and deleted_at is null")
    ) {
      const event = this.getEvent(Number(params[0]));
      if (!event) return [[], []];
      return [[{ requires_waiver: event.requires_waiver }], []];
    }

    if (
      q.includes("from event_waivers") &&
      q.includes("is_active = 1")
    ) {
      return [[], []];
    }

    if (
      q.includes("select 1 from event_categories") &&
      q.includes("price_cents > 0")
    ) {
      const eventId = Number(params[0]);
      const paid = this.categories.some(
        (c) => c.event_id === eventId && c.is_active === 1 && c.price_cents > 0,
      );
      return paid ? [[{ 1: 1 }], []] : [[], []];
    }

    if (
      q.includes("from event_categories where event_id = ?") &&
      q.includes("order by sort_order")
    ) {
      return [this.categoriesForEvent(Number(params[0])), []];
    }

    if (
      q.includes("from events e") &&
      q.includes("join sport_types st") &&
      q.includes("join organizers o") &&
      q.includes("where e.id = ? and e.deleted_at is null")
    ) {
      const event = this.getEvent(Number(params[0]));
      return event ? [[this.eventDetailRow(event)], []] : [[], []];
    }

    if (q.includes("update events set") && q.includes("status = 'pending_approval'")) {
      const eventId = Number(params[0]);
      const event = this.getEvent(eventId);
      if (event) {
        event.status = "pending_approval";
        event.submitted_for_approval_at = new Date().toISOString();
      }
      return [header(0, 1), []];
    }

    if (q.includes("update events set") && q.includes("status = 'published'")) {
      const eventId = Number(params[params.length - 1]);
      const event = this.getEvent(eventId);
      if (event) {
        event.status = "published";
        event.submitted_for_approval_at = null;
        event.approval_rejection_reason = null;
      }
      return [header(0, 1), []];
    }

    if (q.includes("update events set") && q.includes("status = 'draft'")) {
      const eventId = Number(params[params.length - 1]);
      const event = this.getEvent(eventId);
      if (event) {
        event.status = "draft";
        event.submitted_for_approval_at = null;
        if (q.includes("approval_rejection_reason")) {
          event.approval_rejection_reason =
            params[0] != null ? String(params[0]) : null;
        }
      }
      return [header(0, 1), []];
    }

    if (q.includes("insert into organizer_member_events")) {
      return [header(0, 1), []];
    }

    if (q.startsWith("update events set") && q.includes("title = ?")) {
      const hasOrganizerId = q.includes("organizer_id = ?");
      const eventIdIdx = params.length - (hasOrganizerId ? 2 : 1);
      const eventId = Number(params[eventIdIdx]);
      const event = this.getEvent(eventId);
      if (event) {
        event.title = String(params[0]);
        event.sport_type_id = Number(params[1]);
        const statusIdx = params.findIndex((p) => typeof p === "string" && ["draft", "pending_approval", "published", "cancelled", "completed"].includes(String(p)));
        if (statusIdx >= 0) {
          event.status = String(params[statusIdx]);
          if (event.status === "draft") {
            event.submitted_for_approval_at = null;
          }
        }
        event.location_name = params[eventIdIdx - 9] as string | null;
        event.location_city = params[eventIdIdx - 8] as string | null;
        event.location_state = params[eventIdIdx - 7] as string | null;
        event.location_lat = params[eventIdIdx - 6] as number | null;
        event.location_lng = params[eventIdIdx - 5] as number | null;
        event.hero_image_url = params[eventIdIdx - 4] as string | null;
        event.banner_image_url = params[eventIdIdx - 3] as string | null;
        event.max_registrations = params[eventIdIdx - 2] as number | null;
      }
      if (q.includes("submitted_for_approval_at = null")) {
        event.submitted_for_approval_at = null;
      }
      return [header(0, 1), []];
    }

    if (
      q.includes("from events e") &&
      q.includes("join sport_types st") &&
      q.includes("where e.organizer_id = ?")
    ) {
      const rows = this.events
        .filter((e) => e.organizer_id === Number(params[0]) && !e.deleted_at)
        .map((e) => ({
          id: e.id,
          slug: e.slug,
          title: e.title,
          status: e.status,
          start_date: e.start_date,
          organizer_id: e.organizer_id,
          registration_count: 0,
          location_city: e.location_city,
          sport_name: "Running",
        }));
      return [rows, []];
    }

    if (
      q.includes("select count(*) as pending_approval_events") ||
      (q.includes("pending_approval") && q.includes("count(*)"))
    ) {
      const pending = this.events.filter(
        (e) => e.status === "pending_approval" && !e.deleted_at,
      ).length;
      return [[{ pending_approval_events: pending }], []];
    }

    if (
      q.includes("select id from events where slug = ? and status = 'published'")
    ) {
      const slug = String(params[0]);
      const hit = this.events.find(
        (e) => e.slug === slug && e.status === "published" && !e.deleted_at,
      );
      return hit ? [[{ id: hit.id }], []] : [[], []];
    }

    if (
      q.includes("select status, featured from events") &&
      q.includes("organizer_id = ?")
    ) {
      const eventId = Number(params[0]);
      const organizerId = Number(params[1]);
      const event = this.events.find(
        (e) => e.id === eventId && e.organizer_id === organizerId && !e.deleted_at,
      );
      return event
        ? [[{ status: event.status, featured: event.featured }], []]
        : [[], []];
    }

    if (
      q.includes("from admins") &&
      q.includes("status = 'active'") &&
      q.includes("deleted_at is null")
    ) {
      return [[], []];
    }

    if (
      q.includes("from organizer_members") &&
      q.includes("preferred_language") &&
      q.includes("role in (")
    ) {
      const organizerId = Number(params[0]);
      const includeFinance = q.includes("'finance'");
      const roles = includeFinance
        ? new Set(["owner", "organizer", "finance"])
        : new Set(["owner", "organizer"]);
      const rows = this.members
        .filter(
          (m) =>
            m.organizer_id === organizerId &&
            m.status === "active" &&
            !m.deleted_at &&
            roles.has(String(m.role)),
        )
        .map((m) => ({
          email: m.email,
          first_name: m.first_name,
          preferred_language: m.preferred_language,
        }));
      return [rows, []];
    }

    if (
      q.includes("from organizers o") &&
      q.includes("where o.id = ?") &&
      q.includes("deleted_at is null") &&
      q.includes("stripe_account_id")
    ) {
      const row = this.organizerConnectRow(Number(params[0]));
      return row ? [[row], []] : [[], []];
    }

    if (
      q.includes("from geo_cities gc") &&
      q.includes("join geo_states gs") &&
      q.includes("lower(trim(gc.name))")
    ) {
      const city = String(params[1] ?? "").trim().toLowerCase();
      const catalog = new Map([
        ["ciudad de méxico", { name: "Ciudad de México", state_name: "CDMX" }],
        ["ciudad de mexico", { name: "Ciudad de México", state_name: "CDMX" }],
        ["homún", { name: "Homún", state_name: "Yucatán" }],
        ["homun", { name: "Homún", state_name: "Yucatán" }],
      ]);
      const hit = catalog.get(city);
      return hit ? [[hit], []] : [[], []];
    }

    if (q.includes("select id from organizers where email = ? and deleted_at is null")) {
      const email = String(params[0]).toLowerCase();
      const hit = this.organizers.find(
        (o) => o.email.toLowerCase() === email && !o.deleted_at,
      );
      return hit ? [[{ id: hit.id }], []] : [[], []];
    }

    if (
      q.includes("select id from organizer_members") &&
      q.includes("lower(trim(email)) = ?") &&
      q.includes("status = 'active'")
    ) {
      const email = String(params[0]).toLowerCase();
      const hit = this.members.find(
        (m) => m.email.toLowerCase() === email && m.status === "active" && !m.deleted_at,
      );
      return hit ? [[{ id: hit.id }], []] : [[], []];
    }

    if (q.includes("select id from organizers where slug = ? and deleted_at is null")) {
      const slug = String(params[0]);
      const hit = this.organizers.find((o) => o.slug === slug && !o.deleted_at);
      return hit ? [[{ id: hit.id }], []] : [[], []];
    }

    if (q.includes("select status from organizers where id = ? and deleted_at is null")) {
      const org = this.organizers.find(
        (o) => o.id === Number(params[0]) && !o.deleted_at,
      );
      return org ? [[{ status: org.status }], []] : [[], []];
    }

    if (q.includes("insert into organizers")) {
      const id = this.nextOrganizerId++;
      const row = {
        id,
        public_uuid: String(params[0]),
        slug: String(params[1]),
        name: String(params[2]),
        email: String(params[3]),
        phone: (params[4] as string | null) ?? null,
        city: (params[5] as string | null) ?? null,
        country: String(params[6]),
        status: "active",
        service_fee_percent: Number(params[7]),
        deleted_at: null,
      } as OrganizerRow;
      this.organizers.push(row);
      this.lastRegisteredOrganizerId = id;
      return [header(id, 1), []];
    }

    if (q.includes("insert into organizer_members")) {
      const id = this.nextMemberId++;
      this.members.push({
        id,
        public_uuid: String(params[0]),
        organizer_id: Number(params[1]),
        email: String(params[2]),
        first_name: String(params[3]),
        last_name: String(params[4]),
        phone: (params[5] as string | null) ?? null,
        role: "owner",
        event_access_scope: "organization",
        status: "active",
        preferred_language: String(params[6] ?? "es"),
        deleted_at: null,
      } as OrganizerMemberRow);
      this.lastRegisteredMemberId = id;
      return [header(id, 1), []];
    }

    if (q.includes("insert into organizer_settings")) {
      this.organizerSettings.push({
        organizer_id: Number(params[0]),
        setting_key: String(params[1]),
        setting_value: JSON.parse(String(params[2])),
      });
      return [header(this.organizerSettings.length, 1), []];
    }

    if (q.includes("select setting_value from organizer_settings")) {
      const organizerId = Number(params[0]);
      const key = String(params[1]);
      const hit = this.organizerSettings.find(
        (s) => s.organizer_id === organizerId && s.setting_key === key,
      );
      return hit ? [[{ setting_value: hit.setting_value }], []] : [[], []];
    }

    if (
      q.includes("select e.fee_presentation, e.service_fee_percent") &&
      q.includes("join organizers o on o.id = e.organizer_id")
    ) {
      const eventId = Number(params[0]);
      const event = this.getEvent(eventId);
      const org = this.organizers.find((o) => o.id === event?.organizer_id);
      if (!event || !org) return [[], []];
      return [
        [
          {
            fee_presentation: null,
            service_fee_percent: null,
            org_fee_presentation: "pass_through",
            org_fee_percent: org.service_fee_percent,
          },
        ],
        [],
      ];
    }

    if (q.includes("delete from event_extras")) {
      const extraId = Number(params[0]);
      const eventId = Number(params[1]);
      const idx = this.extras.findIndex(
        (e) => Number(e.id) === extraId && Number(e.event_id) === eventId,
      );
      if (idx >= 0) this.extras.splice(idx, 1);
      return [header(0, idx >= 0 ? 1 : 0), []];
    }

    if (q.includes("from event_extras")) {
      let rows = [...this.extras];

      if (q.includes("where id = ? and event_id = ?")) {
        const extraId = Number(params[0]);
        const eventId = Number(params[1]);
        rows = rows.filter(
          (e) => Number(e.id) === extraId && Number(e.event_id) === eventId,
        );
      } else {
        const eventId = Number(params[0]);
        rows = rows.filter((e) => Number(e.event_id) === eventId);
      }

      if (q.includes("is_active = 1")) {
        rows = rows.filter((e) => Number(e.is_active) === 1);
      }

      rows = [...rows].sort(
        (a, b) =>
          Number(a.sort_order) - Number(b.sort_order) ||
          Number(a.id) - Number(b.id),
      );

      if (q.includes("sold_count from event_extras")) {
        return [rows.map((e) => ({ sold_count: e.sold_count })), []];
      }

      return [
        rows.map((e) => ({
          id: e.id,
          public_uuid: e.public_uuid,
          event_id: e.event_id,
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
          is_active: e.is_active,
          scope_type: e.scope_type ?? "all_categories",
          sales_opens_at: e.sales_opens_at ?? null,
          sales_closes_at: e.sales_closes_at ?? null,
        })),
        [],
      ];
    }

    if (q.includes("insert into event_extras")) {
      const id = this.nextExtraId++;
      const hasScopeColumns = q.includes("scope_type");
      const row = {
        id,
        public_uuid: String(params[0]),
        event_id: Number(params[1]),
        name: String(params[2]),
        description: params[3] != null ? String(params[3]) : null,
        price_cents: Number(params[4]),
        currency: String(params[5] ?? "MXN"),
        image_url: params[6] != null ? String(params[6]) : null,
        extra_type: String(params[7] ?? "custom"),
        max_per_athlete: Number(params[8] ?? 1),
        capacity: params[9] != null ? Number(params[9]) : null,
        sold_count: 0,
        is_required: Number(params[10] ?? 0),
        sort_order: Number(params[11] ?? 0),
        is_active: 1,
        scope_type: hasScopeColumns ? String(params[12] ?? "all_categories") : "all_categories",
        sales_opens_at: hasScopeColumns ? ((params[13] as string | null) ?? null) : null,
        sales_closes_at: hasScopeColumns ? ((params[14] as string | null) ?? null) : null,
      };
      this.extras.push(row as RowDataPacket);
      return [header(id, 1), []];
    }

    if (q.includes("update event_extras set")) {
      const extraId = Number(params[params.length - 2]);
      const eventId = Number(params[params.length - 1]);
      const extra = this.extras.find(
        (e) => Number(e.id) === extraId && Number(e.event_id) === eventId,
      );
      if (!extra) return [header(0, 0), []];
      if (q.includes("is_active = 0")) {
        extra.is_active = 0;
        return [header(0, 1), []];
      }
      const setPart = q.split("update event_extras set")[1]?.split(" where ")[0] ?? "";
      const assignments = setPart.split(",").map((part) => part.trim());
      let paramIdx = 0;
      for (const assignment of assignments) {
        const field = assignment.split("=")[0]?.trim();
        if (!field) continue;
        (extra as Record<string, unknown>)[field] = params[paramIdx];
        paramIdx += 1;
      }
      return [header(0, 1), []];
    }

    if (
      q.includes("select status, organizer_id from events where id = ? and deleted_at is null")
    ) {
      const event = this.getEvent(Number(params[0]));
      if (!event) return [[], []];
      return [
        [{ status: event.status, organizer_id: event.organizer_id }],
        [],
      ];
    }

    if (
      q.includes("from payments p") &&
      q.includes("left join athletes a") &&
      q.includes("count(*) as total")
    ) {
      const rows = this.filterPayments(params, q);
      return [[{ total: rows.length }], []];
    }

    if (
      q.includes("from payments p") &&
      q.includes("left join athletes a") &&
      q.includes("seller_first_name")
    ) {
      const rows = this.filterPayments(params, q);
      const limit = Number(params[params.length - 2]);
      const offset = Number(params[params.length - 1]);
      const page = rows.slice(offset, offset + limit).map((p) => this.paymentListRow(p));
      return [page, []];
    }

    if (
      q.includes("from payments p") &&
      q.includes("join organizer_members om on om.id = p.recorded_by_member_id") &&
      q.includes("group by om.id")
    ) {
      const organizerId = Number(params[0]);
      const grouped = new Map<
        number,
        { member_id: number; first_name: string; last_name: string; email: string; sale_count: number; total_cents: number }
      >();
      for (const pay of this.payments) {
        if (
          pay.organizer_id !== organizerId ||
          pay.provider !== "manual" ||
          pay.status !== "succeeded" ||
          pay.recorded_by_member_id == null
        ) {
          continue;
        }
        const seller = this.memberRowById(pay.recorded_by_member_id);
        if (!seller) continue;
        const existing = grouped.get(seller.id);
        if (existing) {
          existing.sale_count += 1;
          existing.total_cents += pay.amount_cents;
        } else {
          grouped.set(seller.id, {
            member_id: seller.id,
            first_name: seller.first_name,
            last_name: seller.last_name,
            email: seller.email,
            sale_count: 1,
            total_cents: pay.amount_cents,
          });
        }
      }
      return [Array.from(grouped.values()), []];
    }

    if (
      q.includes("from payments") &&
      q.includes("manual_sale_count") &&
      q.includes("manual_sale_total_cents")
    ) {
      const organizerId = Number(params[0]);
      const manual = this.payments.filter(
        (p) =>
          p.organizer_id === organizerId &&
          p.provider === "manual" &&
          p.status === "succeeded",
      );
      return [
        [
          {
            manual_sale_count: manual.length,
            manual_sale_total_cents: manual.reduce((sum, p) => sum + p.amount_cents, 0),
          },
        ],
        [],
      ];
    }

    throw new Error(`Unmocked SQL in staff portal test: ${sql.slice(0, 160)}…`);
  };

  asPool(): Pool {
    const query = this.query;
    const getConnection = async (): Promise<PoolConnection> =>
      ({
        query,
        beginTransaction: async () => undefined,
        commit: async () => undefined,
        rollback: async () => undefined,
        release: () => undefined,
      }) as unknown as PoolConnection;
    return { query, getConnection } as unknown as Pool;
  }
}

export const staffSeeds = {
  draftWithCategory(): StaffPortalSeed {
    return {
      events: [{ id: STAFF_SCENARIO.defaultEventId, status: "draft" }],
    };
  },
  pendingApproval(): StaffPortalSeed {
    return {
      events: [{ id: STAFF_SCENARIO.defaultEventId, status: "pending_approval" }],
    };
  },
  financeUser(): StaffPortalSeed {
    return { memberId: STAFF_SCENARIO.financeMemberId, memberRole: "finance", events: [] };
  },
  sellerUser(): StaffPortalSeed {
    return {
      memberId: STAFF_SCENARIO.sellerMemberId,
      memberRole: "seller",
      events: [{ id: STAFF_SCENARIO.defaultEventId, status: "published" }],
    };
  },
  withManualPayments(): StaffPortalSeed {
    return {
      events: [{ id: STAFF_SCENARIO.defaultEventId, status: "published" }],
      manualPayments: [
        {
          sellerMemberId: STAFF_SCENARIO.sellerMemberId,
          amount_cents: 50000,
        },
      ],
    };
  },
  empty(): StaffPortalSeed {
    return { events: [] };
  },
};

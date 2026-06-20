import type { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";

export const STAFF_SCENARIO = {
  memberId: 2001,
  financeMemberId: 2002,
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
  | "sponsor";

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

  private nextEventId: number;
  private nextCategoryId = 500;
  private nextPublicUuid = 1;

  constructor(seed: StaffPortalSeed = {}) {
    this.memberRole = seed.memberRole ?? "owner";
    this.memberId = seed.memberId ?? STAFF_SCENARIO.memberId;
    this.nextEventId = STAFF_SCENARIO.defaultEventId;

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
  }

  getEvent(eventId: number): EventRow | undefined {
    return this.events.find((e) => e.id === eventId && !e.deleted_at);
  }

  publishedSlugs(): string[] {
    return this.events
      .filter((e) => e.status === "published" && !e.deleted_at)
      .map((e) => e.slug);
  }

  private memberRow(memberId: number) {
    if (memberId === this.financeMemberId) {
      return {
        id: this.financeMemberId,
        organizer_id: STAFF_SCENARIO.organizerId,
        role: "finance",
        event_access_scope: "organization",
        status: "active",
        deleted_at: null,
      };
    }
    return {
      id: this.memberId,
      organizer_id: STAFF_SCENARIO.organizerId,
      role: this.memberRole,
      event_access_scope: "organization",
      status: "active",
      deleted_at: null,
    };
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

  query = async (
    sql: string,
    params: unknown[] = [],
  ): Promise<[unknown, unknown]> => {
    const q = normalizeSql(sql);

    if (
      q.includes("select role from organizer_members") &&
      q.includes("where id = ? and organizer_id = ?")
    ) {
      const memberId = Number(params[0]);
      const organizerId = Number(params[1]);
      if (organizerId !== STAFF_SCENARIO.organizerId) return [[], []];
      const row = this.memberRow(memberId);
      if (memberId !== row.id) return [[], []];
      return [[{ role: row.role }], []];
    }

    if (
      q.includes("select role, event_access_scope from organizer_members") &&
      q.includes("where id = ? and organizer_id = ?")
    ) {
      const memberId = Number(params[0]);
      const organizerId = Number(params[1]);
      if (organizerId !== STAFF_SCENARIO.organizerId) return [[], []];
      const row = this.memberRow(memberId);
      if (memberId !== row.id) return [[], []];
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
      row.max_registrations = params[23] as number | null;
      row.requires_waiver = Number(params[24]);
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
      const eventId = Number(params[params.length - 2]);
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
        event.location_name = params[params.length - 10] as string | null;
        event.location_city = params[params.length - 9] as string | null;
        event.location_state = params[params.length - 8] as string | null;
        event.location_lat = params[params.length - 7] as number | null;
        event.location_lng = params[params.length - 6] as number | null;
        event.hero_image_url = params[params.length - 5] as string | null;
        event.banner_image_url = params[params.length - 4] as string | null;
        event.max_registrations = params[params.length - 3] as number | null;
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
      q.includes("role in ('owner', 'organizer')")
    ) {
      return [[], []];
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

    throw new Error(`Unmocked SQL in staff portal test: ${sql.slice(0, 160)}…`);
  };

  asPool(): Pool {
    const query = this.query;
    const getConnection = async (): Promise<PoolConnection> =>
      ({
        query,
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
  empty(): StaffPortalSeed {
    return { events: [] };
  },
};

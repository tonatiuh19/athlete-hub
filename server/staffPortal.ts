import type { Express, NextFunction, RequestHandler, Request, Response } from "express";
import type { Pool, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import {
  CATEGORY_SOLD_COUNT_UNALIASED_SQL,
  DISCOUNT_USED_COUNT_SQL,
  EVENT_REGISTRATION_COUNT_SQL,
  WAVE_REGISTERED_COUNT_SQL,
} from "./registrationCounts.js";
import { handleEventAssetUpload } from "./eventAssetUpload.js";
import {
  fetchEventWaiversForStaff,
  getRegistrationWaiverStatus,
  enrichRegistrationRowsWithWaiverOutdated,
  markRegistrationWaiverWaivedByStaff,
  syncEventWaivers,
  validateEventPublishWaivers,
} from "./eventWaivers.js";

type ActorType = "athlete" | "organizer" | "admin";

export interface StaffPortalAuth {
  actor: ActorType;
  id: number;
  email: string;
  organizerId?: number;
  jti: string;
}

export interface AuthedRequest extends Request {
  auth?: StaffPortalAuth;
}

export interface StaffPortalDeps {
  pool: Pool;
  requireAdmin: RequestHandler;
  requireOrganizer: RequestHandler;
  newPublicUuid: () => string;
  newQrToken: () => string;
  nextRegistrationNumber: (eventId: number) => Promise<string>;
  normalizeLocale: (value: unknown) => string;
  sendEmail: (opts: {
    to: string;
    subject: string;
    html: string;
    text?: string;
  }) => Promise<{ id: string }>;
  appUrl: string;
  processPaymentRefund?: (opts: {
    paymentId: number;
    adminId: number;
    reason?: string;
  }) => Promise<void>;
  buildWelcomeStaffEmail: (params: {
    locale: string;
    firstName: string;
    audience: "admin" | "organizer";
    appUrl: string;
  }) => { subject: string; html: string; text: string };
  sendStaffLoginOtp: (opts: {
    adminId: number;
    to: string;
    firstName: string;
    preferredLanguage?: unknown;
  }) => Promise<void>;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}

async function uniqueEventSlug(
  pool: Pool,
  base: string,
  excludeEventId?: number,
): Promise<string> {
  const candidate = base || "event";
  let n = 0;
  while (n < 100) {
    const slug = n === 0 ? candidate : `${candidate}-${n}`;
    const params: (string | number)[] = [slug];
    let sql =
      "SELECT id FROM events WHERE slug = ? AND deleted_at IS NULL LIMIT 1";
    if (excludeEventId != null) {
      sql =
        "SELECT id FROM events WHERE slug = ? AND id <> ? AND deleted_at IS NULL LIMIT 1";
      params.push(excludeEventId);
    }
    const [rows] = await pool.query<RowDataPacket[]>(sql, params);
    if (rows.length === 0) return slug;
    n += 1;
  }
  return `${candidate}-${Date.now()}`;
}

function fieldKeyFromLabel(label: string): string {
  return slugify(label).slice(0, 80) || "field";
}

function parseFinishTimeToMs(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.round(value);
  }
  const s = String(value ?? "").trim();
  if (!s) return null;
  if (/^\d+$/.test(s)) return Number(s) * 1000;
  const parts = s.split(":").map((p) => parseFloat(p));
  if (parts.length === 3 && parts.every((n) => Number.isFinite(n))) {
    return Math.round((parts[0] * 3600 + parts[1] * 60 + parts[2]) * 1000);
  }
  if (parts.length === 2 && parts.every((n) => Number.isFinite(n))) {
    return Math.round((parts[0] * 60 + parts[1]) * 1000);
  }
  return null;
}

async function getOrganizerMemberRole(
  pool: Pool,
  memberId: number,
  organizerId: number,
): Promise<string | null> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT role FROM organizer_members
     WHERE id = ? AND organizer_id = ? AND status = 'active' AND deleted_at IS NULL LIMIT 1`,
    [memberId, organizerId],
  );
  return (rows[0]?.role as string) ?? null;
}

async function assertOrganizerOwnsEvent(
  pool: Pool,
  organizerId: number,
  eventId: number,
): Promise<boolean> {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT id FROM events WHERE id = ? AND organizer_id = ? AND deleted_at IS NULL LIMIT 1",
    [eventId, organizerId],
  );
  return rows.length > 0;
}

type MemberEventAccess = "all" | number[];

async function getMemberEventAccess(
  pool: Pool,
  memberId: number,
  organizerId: number,
): Promise<MemberEventAccess> {
  const [[member]] = await pool.query<RowDataPacket[]>(
    `SELECT role, event_access_scope FROM organizer_members
     WHERE id = ? AND organizer_id = ? AND status = 'active' AND deleted_at IS NULL LIMIT 1`,
    [memberId, organizerId],
  );
  if (!member) return [];
  if (
    member.role === "owner" ||
    member.role === "organizer" ||
    member.event_access_scope === "organization"
  ) {
    return "all";
  }
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT event_id FROM organizer_member_events WHERE organizer_member_id = ?",
    [memberId],
  );
  return rows.map((r) => Number(r.event_id));
}

export async function listOrganizerMemberEvents(
  pool: Pool,
  memberId: number,
  organizerId: number,
): Promise<RowDataPacket[]> {
  const access = await getMemberEventAccess(pool, memberId, organizerId);
  if (Array.isArray(access) && access.length === 0) {
    return [];
  }

  const params: unknown[] = [organizerId];
  let eventFilter = "";
  if (access !== "all") {
    eventFilter = ` AND e.id IN (${access.map(() => "?").join(", ")})`;
    params.push(...access);
  }

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT e.id, e.slug, e.title, e.status, e.start_date,
            ${EVENT_REGISTRATION_COUNT_SQL} AS registration_count,
            e.location_city, st.name AS sport_name
     FROM events e
     JOIN sport_types st ON st.id = e.sport_type_id
     WHERE e.organizer_id = ? AND e.deleted_at IS NULL${eventFilter}
     ORDER BY e.start_date DESC`,
    params,
  );
  return rows;
}

export async function assertMemberCanAccessEvent(
  pool: Pool,
  memberId: number,
  organizerId: number,
  eventId: number,
): Promise<boolean> {
  if (!(await assertOrganizerOwnsEvent(pool, organizerId, eventId))) {
    return false;
  }
  const access = await getMemberEventAccess(pool, memberId, organizerId);
  if (access === "all") return true;
  return access.includes(eventId);
}

async function assignEventsToOrganizer(
  pool: Pool,
  organizerId: number,
  eventIds: number[],
): Promise<void> {
  const uniqueIds = [...new Set(eventIds.filter((id) => Number.isFinite(id)))];
  if (uniqueIds.length === 0) return;
  const placeholders = uniqueIds.map(() => "?").join(", ");
  await pool.query<ResultSetHeader>(
    `UPDATE events SET organizer_id = ? WHERE id IN (${placeholders}) AND deleted_at IS NULL`,
    [organizerId, ...uniqueIds],
  );
}

async function fetchOrganizerLinkedEvents(pool: Pool, organizerId: number) {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT e.id, e.title, e.slug, e.status, e.start_date, e.organizer_id,
            o.name AS organizer_name,
            ${EVENT_REGISTRATION_COUNT_SQL} AS registration_count
     FROM events e
     JOIN organizers o ON o.id = e.organizer_id
     WHERE e.organizer_id = ? AND e.deleted_at IS NULL
     ORDER BY e.start_date DESC, e.id DESC`,
    [organizerId],
  );
  return rows;
}

async function fetchStaffEventDetail(
  pool: Pool,
  eventId: number,
): Promise<RowDataPacket | null> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT e.id, e.public_uuid, e.organizer_id, e.sport_type_id, e.slug, e.title,
            e.short_description, e.description, e.status, e.visibility, e.featured,
            e.start_date, e.end_date, e.registration_opens_at, e.registration_closes_at,
            e.timezone, e.location_name, e.location_city, e.location_state, e.location_country,
            e.location_lat, e.location_lng,
            e.hero_image_url, e.requires_waiver, ${EVENT_REGISTRATION_COUNT_SQL} AS registration_count, e.max_registrations,
            st.name AS sport_name, o.name AS organizer_name
     FROM events e
     JOIN sport_types st ON st.id = e.sport_type_id
     JOIN organizers o ON o.id = e.organizer_id
     WHERE e.id = ? AND e.deleted_at IS NULL LIMIT 1`,
    [eventId],
  );
  return rows[0] ?? null;
}

async function fetchEventCategories(pool: Pool, eventId: number) {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id, public_uuid, name, description, distance_km, difficulty, capacity,
            ${CATEGORY_SOLD_COUNT_UNALIASED_SQL} AS sold_count,
            price_cents, currency, gender_restriction, min_age, max_age, waitlist_enabled,
            registration_opens_at, registration_closes_at,
            sort_order, is_active
     FROM event_categories WHERE event_id = ? ORDER BY sort_order ASC, id ASC`,
    [eventId],
  );
  return rows;
}

async function assertEventExists(pool: Pool, eventId: number): Promise<boolean> {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT id FROM events WHERE id = ? AND deleted_at IS NULL LIMIT 1",
    [eventId],
  );
  return rows.length > 0;
}

type SortDir = "ASC" | "DESC";

interface ListQueryOptions {
  page?: unknown;
  limit?: unknown;
  sortBy?: unknown;
  sortDir?: unknown;
  defaultSort?: string;
  sortColumns: Record<string, string>;
}

function parseListQuery(opts: ListQueryOptions) {
  const page = Math.max(1, Number(opts.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(opts.limit) || 20));
  const sortKey = String(opts.sortBy ?? opts.defaultSort ?? "created_at");
  const sortCol = opts.sortColumns[sortKey] ?? opts.sortColumns[opts.defaultSort ?? "created_at"];
  const sortDir: SortDir =
    String(opts.sortDir ?? "DESC").toUpperCase() === "ASC" ? "ASC" : "DESC";
  return {
    page,
    limit,
    offset: (page - 1) * limit,
    sortCol,
    sortDir,
    sortKey,
  };
}

function buildPagination(page: number, limit: number, total: number) {
  return {
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

const REGISTRATION_SORT_COLUMNS: Record<string, string> = {
  created_at: "r.created_at",
  registration_number: "r.registration_number",
  status: "r.status",
  total_cents: "r.total_cents",
  bib_number: "r.bib_number",
  athlete_last_name: "a.last_name",
  category_name: "ec.name",
};

async function fetchEventHubSummary(pool: Pool, eventId: number) {
  const [[stats]] = await pool.query<RowDataPacket[]>(
    `SELECT
       (SELECT COUNT(*) FROM registrations
        WHERE event_id = ? AND status = 'confirmed' AND deleted_at IS NULL) AS confirmed_count,
       (SELECT COUNT(*) FROM registrations
        WHERE event_id = ? AND status = 'pending_payment' AND deleted_at IS NULL) AS pending_count,
       (SELECT COUNT(*) FROM registrations
        WHERE event_id = ? AND status IN ('cancelled','refunded') AND deleted_at IS NULL) AS cancelled_count,
       (SELECT COUNT(*) FROM registrations
        WHERE event_id = ? AND checked_in_at IS NOT NULL AND deleted_at IS NULL) AS checked_in_count,
       (SELECT COALESCE(SUM(total_cents), 0) FROM registrations
        WHERE event_id = ? AND status = 'confirmed' AND deleted_at IS NULL) AS revenue_cents,
       (SELECT COUNT(*) FROM waitlist_entries
        WHERE event_id = ? AND status IN ('waiting','offered')) AS waitlist_count`,
    [eventId, eventId, eventId, eventId, eventId, eventId],
  );

  const [categories] = await pool.query<RowDataPacket[]>(
    `SELECT ec.id, ec.name, ec.capacity,
            (SELECT COUNT(*) FROM registrations r
             WHERE r.event_category_id = ec.id AND r.status = 'confirmed' AND r.deleted_at IS NULL) AS sold_count
     FROM event_categories ec
     WHERE ec.event_id = ?
     ORDER BY ec.sort_order ASC, ec.id ASC`,
    [eventId],
  );

  return {
    confirmed_count: Number(stats?.confirmed_count ?? 0),
    pending_count: Number(stats?.pending_count ?? 0),
    cancelled_count: Number(stats?.cancelled_count ?? 0),
    checked_in_count: Number(stats?.checked_in_count ?? 0),
    revenue_cents: Number(stats?.revenue_cents ?? 0),
    waitlist_count: Number(stats?.waitlist_count ?? 0),
    categories: categories.map((row) => ({
      id: row.id,
      name: row.name,
      capacity: row.capacity != null ? Number(row.capacity) : null,
      sold_count: Number(row.sold_count ?? 0),
    })),
  };
}

async function listEventHubRegistrations(
  pool: Pool,
  eventId: number,
  options: {
    q?: string;
    page?: unknown;
    limit?: unknown;
    sortBy?: unknown;
    sortDir?: unknown;
  } = {},
) {
  const { page, limit, offset, sortCol, sortDir } = parseListQuery({
    ...options,
    defaultSort: "created_at",
    sortColumns: REGISTRATION_SORT_COLUMNS,
  });

  const params: (string | number)[] = [eventId];
  let searchFilter = "";
  if (options.q) {
    const like = `%${options.q}%`;
    searchFilter =
      " AND (r.registration_number LIKE ? OR a.email LIKE ? OR CONCAT(a.first_name, ' ', a.last_name) LIKE ? OR r.bib_number LIKE ?)";
    params.push(like, like, like, like);
  }

  const [[countRow]] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS total
     FROM registrations r
     JOIN athletes a ON a.id = r.athlete_id AND a.deleted_at IS NULL
     WHERE r.event_id = ? AND r.deleted_at IS NULL${searchFilter}`,
    params,
  );
  const total = Number(countRow?.total ?? 0);

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT r.id, r.registration_number, r.bib_number, r.status, r.total_cents, r.created_at,
            r.checked_in_at, r.waiver_signed_at,
            e.id AS event_id, e.title AS event_title, e.slug AS event_slug,
            ec.name AS category_name,
            a.first_name AS athlete_first_name, a.last_name AS athlete_last_name,
            a.email AS athlete_email
     FROM registrations r
     JOIN events e ON e.id = r.event_id AND e.deleted_at IS NULL
     JOIN event_categories ec ON ec.id = r.event_category_id
     JOIN athletes a ON a.id = r.athlete_id AND a.deleted_at IS NULL
     WHERE r.event_id = ? AND r.deleted_at IS NULL${searchFilter}
     ORDER BY ${sortCol} ${sortDir}, r.id DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );

  const [[eventRow]] = await pool.query<RowDataPacket[]>(
    `SELECT requires_waiver FROM events WHERE id = ? LIMIT 1`,
    [eventId],
  );
  const enriched = await enrichRegistrationRowsWithWaiverOutdated(
    pool,
    rows,
    Boolean(eventRow?.requires_waiver),
  );

  return { registrations: enriched, pagination: buildPagination(page, limit, total) };
}

const ATHLETE_SORT_COLUMNS: Record<string, string> = {
  created_at: "a.created_at",
  first_name: "a.first_name",
  last_name: "a.last_name",
  email: "a.email",
  registration_count: "registration_count",
  status: "a.status",
};

export async function listAdminAthletes(
  pool: Pool,
  options: {
    q?: string;
    page?: unknown;
    limit?: unknown;
    sortBy?: unknown;
    sortDir?: unknown;
  } = {},
) {
  const { page, limit, offset, sortCol, sortDir } = parseListQuery({
    ...options,
    defaultSort: "created_at",
    sortColumns: ATHLETE_SORT_COLUMNS,
  });

  const params: string[] = [];
  let searchFilter = "";
  if (options.q) {
    const like = `%${options.q}%`;
    searchFilter =
      " AND (a.email LIKE ? OR a.phone LIKE ? OR CONCAT(a.first_name, ' ', a.last_name) LIKE ?)";
    params.push(like, like, like);
  }

  const [[countRow]] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS total FROM athletes a WHERE a.deleted_at IS NULL${searchFilter}`,
    params,
  );
  const total = Number(countRow?.total ?? 0);

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT a.id, a.email, a.phone, a.first_name, a.last_name, a.city, a.country, a.status,
            a.created_at,
            (SELECT COUNT(*) FROM registrations r
             WHERE r.athlete_id = a.id AND r.status = 'confirmed' AND r.deleted_at IS NULL) AS registration_count
     FROM athletes a
     WHERE a.deleted_at IS NULL${searchFilter}
     ORDER BY ${sortCol} ${sortDir}, a.id DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );

  return { athletes: rows, pagination: buildPagination(page, limit, total) };
}

async function uniqueOrganizerSlug(pool: Pool, base: string): Promise<string> {
  const candidate = base || "organizer";
  let n = 0;
  while (n < 100) {
    const slug = n === 0 ? candidate : `${candidate}-${n}`;
    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT id FROM organizers WHERE slug = ? AND deleted_at IS NULL LIMIT 1",
      [slug],
    );
    if (rows.length === 0) return slug;
    n += 1;
  }
  return `${candidate}-${Date.now()}`;
}

const ORGANIZER_SORT_COLUMNS: Record<string, string> = {
  name: "o.name",
  email: "o.email",
  city: "o.city",
  status: "o.status",
  created_at: "o.created_at",
  event_count: "event_count",
  member_count: "member_count",
};

export async function listAdminOrganizers(
  pool: Pool,
  options: {
    q?: string;
    status?: string;
    page?: unknown;
    limit?: unknown;
    sortBy?: unknown;
    sortDir?: unknown;
  } = {},
) {
  const { page, limit, offset, sortCol, sortDir } = parseListQuery({
    ...options,
    defaultSort: "name",
    sortColumns: ORGANIZER_SORT_COLUMNS,
  });

  const params: string[] = [];
  let filters = " WHERE o.deleted_at IS NULL";
  if (options.status && ["pending", "active", "suspended", "inactive"].includes(options.status)) {
    filters += " AND o.status = ?";
    params.push(options.status);
  }
  if (options.q) {
    const like = `%${options.q}%`;
    filters += " AND (o.name LIKE ? OR o.email LIKE ? OR o.slug LIKE ? OR o.city LIKE ?)";
    params.push(like, like, like, like);
  }

  const [[countRow]] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS total FROM organizers o${filters}`,
    params,
  );
  const total = Number(countRow?.total ?? 0);

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT o.id, o.name, o.slug, o.email, o.city, o.country, o.status, o.logo_url, o.created_at,
            (SELECT COUNT(*) FROM events e WHERE e.organizer_id = o.id AND e.deleted_at IS NULL) AS event_count,
            (SELECT COUNT(*) FROM organizer_members om WHERE om.organizer_id = o.id AND om.deleted_at IS NULL) AS member_count
     FROM organizers o
     ${filters}
     ORDER BY ${sortCol} ${sortDir}, o.id DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );

  return { organizers: rows, pagination: buildPagination(page, limit, total) };
}

const ADMIN_STAFF_SORT_COLUMNS: Record<string, string> = {
  created_at: "a.created_at",
  first_name: "a.first_name",
  last_name: "a.last_name",
  email: "a.email",
  role: "a.role",
  status: "a.status",
  last_login_at: "a.last_login_at",
};

export async function listAdminStaff(
  pool: Pool,
  options: {
    q?: string;
    page?: unknown;
    limit?: unknown;
    sortBy?: unknown;
    sortDir?: unknown;
  } = {},
) {
  const { page, limit, offset, sortCol, sortDir } = parseListQuery({
    ...options,
    defaultSort: "created_at",
    sortColumns: ADMIN_STAFF_SORT_COLUMNS,
  });

  const params: string[] = [];
  let filters = " WHERE a.deleted_at IS NULL";
  if (options.q) {
    const like = `%${options.q}%`;
    filters +=
      " AND (a.email LIKE ? OR CONCAT(a.first_name, ' ', a.last_name) LIKE ? OR a.phone LIKE ?)";
    params.push(like, like, like);
  }

  const [[countRow]] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS total FROM admins a${filters}`,
    params,
  );
  const total = Number(countRow?.total ?? 0);

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT a.id, a.email, a.first_name, a.last_name, a.phone, a.role, a.status,
            a.last_login_at, a.created_at
     FROM admins a
     ${filters}
     ORDER BY ${sortCol} ${sortDir}, a.id DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );

  return { admins: rows, pagination: buildPagination(page, limit, total) };
}

async function getAdminRole(pool: Pool, adminId: number): Promise<string | null> {
  const [[row]] = await pool.query<RowDataPacket[]>(
    "SELECT role FROM admins WHERE id = ? AND deleted_at IS NULL LIMIT 1",
    [adminId],
  );
  return row?.role != null ? String(row.role) : null;
}

const PAYMENT_SORT_COLUMNS: Record<string, string> = {
  created_at: "p.created_at",
  amount_cents: "p.amount_cents",
  status: "p.status",
  paid_at: "p.paid_at",
};

export async function listAdminPayments(
  pool: Pool,
  options: {
    q?: string;
    status?: string;
    organizerId?: number;
    eventId?: number;
    page?: unknown;
    limit?: unknown;
    sortBy?: unknown;
    sortDir?: unknown;
  } = {},
) {
  const { page, limit, offset, sortCol, sortDir } = parseListQuery({
    ...options,
    defaultSort: "created_at",
    sortColumns: PAYMENT_SORT_COLUMNS,
  });

  const params: (string | number)[] = [];
  let filters = " WHERE 1=1";
  if (options.status && ["pending", "processing", "succeeded", "failed", "refunded", "partially_refunded"].includes(options.status)) {
    filters += " AND p.status = ?";
    params.push(options.status);
  }
  if (options.organizerId != null) {
    filters += " AND p.organizer_id = ?";
    params.push(options.organizerId);
  }
  if (options.eventId != null) {
    filters += " AND p.event_id = ?";
    params.push(options.eventId);
  }
  if (options.q) {
    const like = `%${options.q}%`;
    filters +=
      " AND (a.email LIKE ? OR CONCAT(a.first_name, ' ', a.last_name) LIKE ? OR e.title LIKE ? OR r.registration_number LIKE ? OR p.stripe_payment_intent_id LIKE ?)";
    params.push(like, like, like, like, like);
  }

  const [[countRow]] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS total
     FROM payments p
     LEFT JOIN athletes a ON a.id = p.athlete_id
     LEFT JOIN events e ON e.id = p.event_id
     LEFT JOIN registrations r ON r.id = p.registration_id
     ${filters}`,
    params,
  );
  const total = Number(countRow?.total ?? 0);

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT p.id, p.public_uuid, p.registration_id, p.athlete_id, p.organizer_id, p.event_id,
            p.amount_cents, p.registration_amount_cents, p.service_fee_cents, p.currency, p.status,
            p.provider, p.stripe_payment_intent_id, p.paid_at, p.created_at,
            a.first_name AS athlete_first_name, a.last_name AS athlete_last_name, a.email AS athlete_email,
            e.title AS event_title, e.slug AS event_slug,
            o.name AS organizer_name,
            r.registration_number
     FROM payments p
     LEFT JOIN athletes a ON a.id = p.athlete_id
     LEFT JOIN events e ON e.id = p.event_id
     LEFT JOIN organizers o ON o.id = p.organizer_id
     LEFT JOIN registrations r ON r.id = p.registration_id
     ${filters}
     ORDER BY ${sortCol} ${sortDir}, p.id DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );

  return { payments: rows, pagination: buildPagination(page, limit, total) };
}

export async function fetchAdminPaymentDetail(
  pool: Pool,
  paymentId: number,
  options: { organizerId?: number } = {},
) {
  const params: number[] = [paymentId];
  let scope = " WHERE p.id = ?";
  if (options.organizerId != null) {
    scope += " AND p.organizer_id = ?";
    params.push(options.organizerId);
  }

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT p.id, p.public_uuid, p.registration_id, p.athlete_id, p.organizer_id, p.event_id,
            p.amount_cents, p.registration_amount_cents, p.service_fee_cents, p.currency, p.status,
            p.provider, p.stripe_payment_intent_id, p.stripe_charge_id, p.paid_at, p.created_at,
            p.failure_code, p.failure_message,
            a.first_name AS athlete_first_name, a.last_name AS athlete_last_name, a.email AS athlete_email,
            e.title AS event_title, e.slug AS event_slug,
            o.name AS organizer_name,
            r.registration_number, r.status AS registration_status, r.bib_number
     FROM payments p
     LEFT JOIN athletes a ON a.id = p.athlete_id
     LEFT JOIN events e ON e.id = p.event_id
     LEFT JOIN organizers o ON o.id = p.organizer_id
     LEFT JOIN registrations r ON r.id = p.registration_id
     ${scope}
     LIMIT 1`,
    params,
  );

  return rows[0] ?? null;
}

async function fetchStaffRegistrationDetail(
  pool: Pool,
  eventId: number,
  registrationId: number,
) {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT r.id, r.public_uuid, r.registration_number, r.bib_number, r.qr_code_token,
            r.status, r.price_cents, r.service_fee_cents, r.total_cents, r.source,
            r.waiver_signed_at, r.checked_in_at, r.created_at, r.updated_at, r.payment_id,
            r.event_category_id, r.athlete_id,
            ec.name AS category_name,
            a.first_name AS athlete_first_name, a.last_name AS athlete_last_name,
            a.email AS athlete_email, a.phone AS athlete_phone,
            e.title AS event_title, e.slug AS event_slug
     FROM registrations r
     JOIN event_categories ec ON ec.id = r.event_category_id
     JOIN athletes a ON a.id = r.athlete_id AND a.deleted_at IS NULL
     JOIN events e ON e.id = r.event_id AND e.deleted_at IS NULL
     WHERE r.id = ? AND r.event_id = ? AND r.deleted_at IS NULL
     LIMIT 1`,
    [registrationId, eventId],
  );
  if (rows.length === 0) return null;

  const reg = rows[0];
  let payment: RowDataPacket | null = null;
  if (reg.payment_id) {
    const [payRows] = await pool.query<RowDataPacket[]>(
      `SELECT id, public_uuid, amount_cents, registration_amount_cents, service_fee_cents,
              currency, status, provider, stripe_payment_intent_id, stripe_charge_id,
              paid_at, created_at
       FROM payments WHERE id = ? LIMIT 1`,
      [reg.payment_id],
    );
    payment = payRows[0] ?? null;
  } else {
    const [payRows] = await pool.query<RowDataPacket[]>(
      `SELECT id, public_uuid, amount_cents, registration_amount_cents, service_fee_cents,
              currency, status, provider, stripe_payment_intent_id, stripe_charge_id,
              paid_at, created_at
       FROM payments WHERE registration_id = ? ORDER BY created_at DESC LIMIT 1`,
      [registrationId],
    );
    payment = payRows[0] ?? null;
  }

  const [fieldValues] = await pool.query<RowDataPacket[]>(
    `SELECT erf.field_key, erf.label, erf.field_type, fv.value_text, fv.value_file_url
     FROM registration_field_values fv
     JOIN event_registration_fields erf ON erf.id = fv.field_id
     WHERE fv.registration_id = ?
     ORDER BY erf.sort_order ASC, erf.id ASC`,
    [registrationId],
  );

  const [waiverRows] = await pool.query<RowDataPacket[]>(
    `SELECT rws.signed_at, rws.signature_data, ew.title AS waiver_name, ew.version AS waiver_version
     FROM registration_waiver_signatures rws
     JOIN event_waivers ew ON ew.id = rws.waiver_id
     WHERE rws.registration_id = ?
     ORDER BY ew.sort_order ASC, rws.signed_at ASC`,
    [registrationId],
  );

  const [statusHistory] = await pool.query<RowDataPacket[]>(
    `SELECT from_status, to_status, actor_type, reason, created_at
     FROM registration_status_history
     WHERE registration_id = ?
     ORDER BY created_at DESC LIMIT 25`,
    [registrationId],
  );

  const [transfers] = await pool.query<RowDataPacket[]>(
    `SELECT rt.status, rt.transfer_fee_cents, rt.completed_at, rt.created_at,
            fa.first_name AS from_first_name, fa.last_name AS from_last_name,
            ta.first_name AS to_first_name, ta.last_name AS to_last_name
     FROM registration_transfers rt
     JOIN athletes fa ON fa.id = rt.from_athlete_id
     JOIN athletes ta ON ta.id = rt.to_athlete_id
     WHERE rt.registration_id = ?
     ORDER BY rt.created_at DESC`,
    [registrationId],
  );

  const [refunds] = payment
    ? await pool.query<RowDataPacket[]>(
        `SELECT id, amount_cents, currency, status, reason, stripe_refund_id, processed_at, created_at
         FROM payment_refunds WHERE payment_id = ? ORDER BY created_at DESC`,
        [payment.id],
      )
    : [[] as RowDataPacket[]];

  return {
    registration: reg,
    payment,
    field_values: fieldValues,
    waiver: waiverRows[0] ?? null,
    waivers: waiverRows,
    status_history: statusHistory,
    transfers,
    refunds,
  };
}

export async function listStaffRegistrations(
  pool: Pool,
  options: {
    organizerId?: number;
    eventId?: number;
    q?: string;
    page?: unknown;
    limit?: unknown;
    sortBy?: unknown;
    sortDir?: unknown;
  },
) {
  const { page, limit, offset, sortCol, sortDir } = parseListQuery({
    ...options,
    defaultSort: "created_at",
    sortColumns: REGISTRATION_SORT_COLUMNS,
  });

  const params: (string | number)[] = [];
  let filters = " WHERE r.deleted_at IS NULL";

  if (options.organizerId != null) {
    filters += " AND e.organizer_id = ? AND e.deleted_at IS NULL";
    params.push(options.organizerId);
  }
  if (options.eventId != null) {
    filters += " AND r.event_id = ?";
    params.push(options.eventId);
  }
  if (options.q) {
    const like = `%${options.q}%`;
    filters +=
      " AND (r.registration_number LIKE ? OR a.email LIKE ? OR CONCAT(a.first_name, ' ', a.last_name) LIKE ? OR e.title LIKE ?)";
    params.push(like, like, like, like);
  }

  const [[countRow]] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS total
     FROM registrations r
     JOIN events e ON e.id = r.event_id
     JOIN athletes a ON a.id = r.athlete_id AND a.deleted_at IS NULL
     ${filters}`,
    params,
  );
  const total = Number(countRow?.total ?? 0);

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT r.id, r.registration_number, r.bib_number, r.status, r.total_cents, r.created_at,
            r.checked_in_at, r.waiver_signed_at,
            e.id AS event_id, e.title AS event_title, e.slug AS event_slug,
            ec.name AS category_name,
            a.first_name AS athlete_first_name, a.last_name AS athlete_last_name,
            a.email AS athlete_email
     FROM registrations r
     JOIN events e ON e.id = r.event_id
     JOIN event_categories ec ON ec.id = r.event_category_id
     JOIN athletes a ON a.id = r.athlete_id AND a.deleted_at IS NULL
     ${filters}
     ORDER BY ${sortCol} ${sortDir}, r.id DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );

  return { registrations: rows, pagination: buildPagination(page, limit, total) };
}

async function assertRegistrationInEvent(
  pool: Pool,
  registrationId: number,
  eventId: number,
): Promise<RowDataPacket | null> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT r.id, r.status, r.event_category_id, r.schedule_wave_id, r.checked_in_at,
            r.waiver_signed_at, r.registration_number, r.bib_number, r.qr_code_token
     FROM registrations r
     WHERE r.id = ? AND r.event_id = ? AND r.deleted_at IS NULL LIMIT 1`,
    [registrationId, eventId],
  );
  return rows[0] ?? null;
}

function mountEventHubRoutes(
  app: Express,
  pool: Pool,
  guard: RequestHandler,
  basePath: string,
  canAccess: (req: AuthedRequest, eventId: number) => Promise<boolean>,
  hubHelpers: {
    newPublicUuid: () => string;
    newQrToken: () => string;
    nextRegistrationNumber: (eventId: number) => Promise<string>;
  },
) {
  app.get(`${basePath}/:eventId/summary`, guard, async (req: AuthedRequest, res) => {
    const eventId = Number(req.params.eventId);
    if (!Number.isFinite(eventId)) {
      return res.status(400).json({ error: "Invalid event id" });
    }
    if (!(await canAccess(req, eventId))) {
      return res.status(404).json({ error: "Event not found" });
    }
    const summary = await fetchEventHubSummary(pool, eventId);
    res.json({ summary });
  });

  app.get(`${basePath}/:eventId/registrations`, guard, async (req: AuthedRequest, res) => {
    const eventId = Number(req.params.eventId);
    if (!Number.isFinite(eventId)) {
      return res.status(400).json({ error: "Invalid event id" });
    }
    if (!(await canAccess(req, eventId))) {
      return res.status(404).json({ error: "Event not found" });
    }
    const q = String(req.query.q ?? "").trim();
    const result = await listEventHubRegistrations(pool, eventId, {
      q: q || undefined,
      page: req.query.page,
      limit: req.query.limit,
      sortBy: req.query.sortBy,
      sortDir: req.query.sortDir,
    });
    res.json(result);
  });

  app.get(
    `${basePath}/:eventId/registrations/lookup`,
    guard,
    async (req: AuthedRequest, res) => {
      const eventId = Number(req.params.eventId);
      if (!Number.isFinite(eventId)) {
        return res.status(400).json({ error: "Invalid event id" });
      }
      if (!(await canAccess(req, eventId))) {
        return res.status(404).json({ error: "Event not found" });
      }
      const q = String(req.query.q ?? "").trim();
      if (!q) {
        return res.status(400).json({ error: "q required" });
      }

      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT r.id, r.registration_number, r.bib_number, r.status, r.qr_code_token,
                r.checked_in_at, r.waiver_signed_at, r.total_cents, r.created_at,
                e.id AS event_id, e.title AS event_title, e.slug AS event_slug, e.requires_waiver,
                ec.name AS category_name,
                a.first_name AS athlete_first_name, a.last_name AS athlete_last_name,
                a.email AS athlete_email
         FROM registrations r
         JOIN events e ON e.id = r.event_id AND e.deleted_at IS NULL
         JOIN event_categories ec ON ec.id = r.event_category_id
         JOIN athletes a ON a.id = r.athlete_id AND a.deleted_at IS NULL
         WHERE r.event_id = ? AND r.deleted_at IS NULL AND r.status = 'confirmed'
           AND (r.qr_code_token = ? OR r.registration_number = ? OR r.bib_number = ?)
         LIMIT 1`,
        [eventId, q, q, q],
      );

      if (rows.length === 0) {
        return res.status(404).json({ error: "Registration not found" });
      }
      const registration = rows[0];
      let waiver_outdated = false;
      if (Boolean(registration.requires_waiver)) {
        const status = await getRegistrationWaiverStatus(pool, registration.id as number);
        waiver_outdated = status.outdated;
      }
      res.json({ registration: { ...registration, waiver_outdated } });
    },
  );

  app.post(
    `${basePath}/:eventId/registrations/:registrationId/check-in`,
    guard,
    async (req: AuthedRequest, res) => {
      const eventId = Number(req.params.eventId);
      const registrationId = Number(req.params.registrationId);
      if (!Number.isFinite(eventId) || !Number.isFinite(registrationId)) {
        return res.status(400).json({ error: "Invalid id" });
      }
      if (!(await canAccess(req, eventId))) {
        return res.status(404).json({ error: "Event not found" });
      }

      const reg = await assertRegistrationInEvent(pool, registrationId, eventId);
      if (!reg) {
        return res.status(404).json({ error: "Registration not found" });
      }
      if (reg.status !== "confirmed") {
        return res.status(400).json({ error: "Only confirmed registrations can be checked in" });
      }
      if (reg.checked_in_at) {
        return res.status(409).json({ error: "Already checked in" });
      }

      const [[eventRow]] = await pool.query<RowDataPacket[]>(
        "SELECT requires_waiver FROM events WHERE id = ? LIMIT 1",
        [eventId],
      );
      const forceCheckIn = Boolean(req.body?.force);
      const waiverStatus = await getRegistrationWaiverStatus(pool, registrationId);
      if (Boolean(eventRow?.requires_waiver) && !forceCheckIn) {
        if (!reg.waiver_signed_at || waiverStatus.outdated) {
          return res.status(400).json({
            error: waiverStatus.outdated
              ? "Waiver updated — athlete must re-sign or use force check-in"
              : "Waiver not signed — check in blocked",
            code: waiverStatus.outdated ? "waiver_outdated" : "waiver_unsigned",
          });
        }
      }

      const method = String(req.body?.method ?? "manual");
      const validMethods = new Set(["qr_scan", "manual", "kiosk", "api"]);
      const checkMethod = validMethods.has(method) ? method : "manual";
      const locationLabel = req.body?.location_label
        ? String(req.body.location_label).slice(0, 100)
        : null;
      const deviceInfo = req.headers["user-agent"]
        ? String(req.headers["user-agent"]).slice(0, 255)
        : null;

      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();
        await conn.query<ResultSetHeader>(
          `INSERT INTO check_in_logs (registration_id, event_id, method, operator_type, operator_id, location_label, device_info, metadata_json)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            registrationId,
            eventId,
            checkMethod,
            req.auth!.actor === "admin" ? "admin" : "organizer_member",
            req.auth!.id,
            locationLabel,
            deviceInfo,
            forceCheckIn ? JSON.stringify({ force_waiver: true }) : null,
          ],
        );
        await conn.query<ResultSetHeader>(
          "UPDATE registrations SET checked_in_at = NOW() WHERE id = ? AND checked_in_at IS NULL",
          [registrationId],
        );
        await conn.commit();
      } catch (err) {
        await conn.rollback();
        throw err;
      } finally {
        conn.release();
      }

      const [updated] = await pool.query<RowDataPacket[]>(
        `SELECT r.id, r.registration_number, r.bib_number, r.status, r.checked_in_at,
                r.total_cents, r.created_at,
                e.id AS event_id, e.title AS event_title, e.slug AS event_slug,
                ec.name AS category_name,
                a.first_name AS athlete_first_name, a.last_name AS athlete_last_name,
                a.email AS athlete_email
         FROM registrations r
         JOIN events e ON e.id = r.event_id
         JOIN event_categories ec ON ec.id = r.event_category_id
         JOIN athletes a ON a.id = r.athlete_id
         WHERE r.id = ? LIMIT 1`,
        [registrationId],
      );
      res.json({ ok: true, registration: updated[0] });
    },
  );

  app.patch(
    `${basePath}/:eventId/registrations/:registrationId/bib`,
    guard,
    async (req: AuthedRequest, res) => {
      const eventId = Number(req.params.eventId);
      const registrationId = Number(req.params.registrationId);
      if (!Number.isFinite(eventId) || !Number.isFinite(registrationId)) {
        return res.status(400).json({ error: "Invalid id" });
      }
      if (!(await canAccess(req, eventId))) {
        return res.status(404).json({ error: "Event not found" });
      }

      const bibRaw = req.body?.bib_number;
      const bib_number =
        bibRaw === null || bibRaw === undefined || bibRaw === ""
          ? null
          : String(bibRaw).trim().slice(0, 20);

      const reg = await assertRegistrationInEvent(pool, registrationId, eventId);
      if (!reg) {
        return res.status(404).json({ error: "Registration not found" });
      }

      if (bib_number) {
        const [dup] = await pool.query<RowDataPacket[]>(
          `SELECT id FROM registrations
           WHERE event_id = ? AND bib_number = ? AND id <> ? AND deleted_at IS NULL LIMIT 1`,
          [eventId, bib_number, registrationId],
        );
        if (dup.length > 0) {
          return res.status(409).json({ error: "Bib number already assigned" });
        }
      }

      await pool.query<ResultSetHeader>(
        "UPDATE registrations SET bib_number = ? WHERE id = ?",
        [bib_number, registrationId],
      );

      res.json({
        ok: true,
        registration: { ...reg, bib_number },
      });
    },
  );

  app.patch(
    `${basePath}/:eventId/registrations/:registrationId/cancel`,
    guard,
    async (req: AuthedRequest, res) => {
      const eventId = Number(req.params.eventId);
      const registrationId = Number(req.params.registrationId);
      if (!Number.isFinite(eventId) || !Number.isFinite(registrationId)) {
        return res.status(400).json({ error: "Invalid id" });
      }
      if (!(await canAccess(req, eventId))) {
        return res.status(404).json({ error: "Event not found" });
      }

      const reg = await assertRegistrationInEvent(pool, registrationId, eventId);
      if (!reg) {
        return res.status(404).json({ error: "Registration not found" });
      }
      if (reg.status === "cancelled") {
        return res.status(409).json({ error: "Registration is already cancelled" });
      }
      if (reg.status === "refunded" || reg.status === "transferred") {
        return res.status(400).json({ error: "Registration cannot be cancelled" });
      }

      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();
        await conn.query<ResultSetHeader>(
          "UPDATE registrations SET status = 'cancelled' WHERE id = ?",
          [registrationId],
        );
        if (reg.status === "confirmed") {
          await conn.query<ResultSetHeader>(
            "UPDATE event_categories SET sold_count = GREATEST(0, sold_count - 1) WHERE id = ?",
            [reg.event_category_id],
          );
          if (reg.schedule_wave_id) {
            await conn.query<ResultSetHeader>(
              `UPDATE event_schedule_waves
               SET registered_count = GREATEST(0, registered_count - 1)
               WHERE id = ?`,
              [reg.schedule_wave_id],
            );
          }
        }
        await conn.commit();
      } catch (err) {
        await conn.rollback();
        throw err;
      } finally {
        conn.release();
      }

      const [updated] = await pool.query<RowDataPacket[]>(
        `SELECT r.id, r.registration_number, r.bib_number, r.status, r.total_cents, r.created_at,
                r.checked_in_at,
                e.id AS event_id, e.title AS event_title, e.slug AS event_slug,
                ec.name AS category_name,
                a.first_name AS athlete_first_name, a.last_name AS athlete_last_name,
                a.email AS athlete_email
         FROM registrations r
         JOIN events e ON e.id = r.event_id
         JOIN event_categories ec ON ec.id = r.event_category_id
         JOIN athletes a ON a.id = r.athlete_id
         WHERE r.id = ? LIMIT 1`,
        [registrationId],
      );
      res.json({ ok: true, registration: updated[0] });
    },
  );

  app.post(`${basePath}/:eventId/registrations/bulk-bib`, guard, async (req: AuthedRequest, res) => {
    const eventId = Number(req.params.eventId);
    if (!Number.isFinite(eventId)) {
      return res.status(400).json({ error: "Invalid event id" });
    }
    if (!(await canAccess(req, eventId))) {
      return res.status(404).json({ error: "Event not found" });
    }

    const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
    if (rows.length === 0) {
      return res.status(400).json({ error: "rows array required" });
    }
    if (rows.length > 500) {
      return res.status(400).json({ error: "Maximum 500 rows per import" });
    }

    let updated = 0;
    const errors: Array<{ folio: string; error: string }> = [];

    for (const row of rows) {
      const folio = String(row?.folio ?? "").trim();
      const bib = String(row?.bib ?? "").trim().slice(0, 20);
      if (!folio || !bib) {
        errors.push({ folio: folio || "?", error: "folio and bib required" });
        continue;
      }

      const [regRows] = await pool.query<RowDataPacket[]>(
        `SELECT r.id FROM registrations r
         WHERE r.event_id = ? AND r.registration_number = ? AND r.deleted_at IS NULL LIMIT 1`,
        [eventId, folio],
      );
      if (regRows.length === 0) {
        errors.push({ folio, error: "Registration not found" });
        continue;
      }
      const regId = regRows[0].id as number;

      const [dup] = await pool.query<RowDataPacket[]>(
        `SELECT id FROM registrations
         WHERE event_id = ? AND bib_number = ? AND id <> ? AND deleted_at IS NULL LIMIT 1`,
        [eventId, bib, regId],
      );
      if (dup.length > 0) {
        errors.push({ folio, error: "Bib number already assigned in this event" });
        continue;
      }

      await pool.query<ResultSetHeader>(
        "UPDATE registrations SET bib_number = ? WHERE id = ?",
        [bib, regId],
      );
      updated += 1;
    }

    res.json({ updated, errors });
  });

  app.get(
    `${basePath}/:eventId/registrations/:registrationId`,
    guard,
    async (req: AuthedRequest, res) => {
      const eventId = Number(req.params.eventId);
      const registrationId = Number(req.params.registrationId);
      if (!Number.isFinite(eventId) || !Number.isFinite(registrationId)) {
        return res.status(400).json({ error: "Invalid id" });
      }
      if (!(await canAccess(req, eventId))) {
        return res.status(404).json({ error: "Event not found" });
      }
      const detail = await fetchStaffRegistrationDetail(pool, eventId, registrationId);
      if (!detail) {
        return res.status(404).json({ error: "Registration not found" });
      }
      res.json(detail);
    },
  );

  app.post(`${basePath}/:eventId/registrations`, guard, async (req: AuthedRequest, res) => {
    const eventId = Number(req.params.eventId);
    if (!Number.isFinite(eventId)) {
      return res.status(400).json({ error: "Invalid event id" });
    }
    if (!(await canAccess(req, eventId))) {
      return res.status(404).json({ error: "Event not found" });
    }

    const categoryId = Number(req.body?.event_category_id);
    if (!Number.isFinite(categoryId)) {
      return res.status(400).json({ error: "event_category_id required" });
    }

    let athleteId = req.body?.athlete_id != null ? Number(req.body.athlete_id) : null;
    const athleteEmail = String(req.body?.athlete_email ?? "")
      .trim()
      .toLowerCase();
    if (!athleteId && athleteEmail) {
      const [athRows] = await pool.query<RowDataPacket[]>(
        "SELECT id FROM athletes WHERE email = ? AND deleted_at IS NULL LIMIT 1",
        [athleteEmail],
      );
      if (athRows.length === 0) {
        return res.status(404).json({ error: "Athlete not found" });
      }
      athleteId = Number(athRows[0].id);
    }
    if (!athleteId || !Number.isFinite(athleteId)) {
      return res.status(400).json({ error: "athlete_id or athlete_email required" });
    }

    const comp = Boolean(req.body?.comp);
    const waiverWaived = Boolean(req.body?.waiver_waived);
    const bib_number = req.body?.bib_number
      ? String(req.body.bib_number).trim().slice(0, 20)
      : null;

    const [[category]] = await pool.query<RowDataPacket[]>(
      `SELECT ec.id, ec.price_cents, ec.capacity, ec.sold_count, ec.currency, e.organizer_id,
              e.requires_waiver, e.service_fee_percent, o.service_fee_percent AS org_fee_percent
       FROM event_categories ec
       JOIN events e ON e.id = ec.event_id AND e.deleted_at IS NULL
       JOIN organizers o ON o.id = e.organizer_id
       WHERE ec.id = ? AND ec.event_id = ? AND ec.is_active = 1
       LIMIT 1`,
      [categoryId, eventId],
    );
    if (!category) {
      return res.status(404).json({ error: "Category not found" });
    }

    if (Boolean(category.requires_waiver) && !waiverWaived) {
      return res.status(400).json({
        error: "This event requires a waiver — confirm waiver waived for manual registration",
      });
    }

    const [dupReg] = await pool.query<RowDataPacket[]>(
      `SELECT id FROM registrations
       WHERE event_id = ? AND athlete_id = ? AND status IN ('confirmed','pending_payment')
         AND deleted_at IS NULL LIMIT 1`,
      [eventId, athleteId],
    );
    if (dupReg.length > 0) {
      return res.status(409).json({ error: "Athlete already registered for this event" });
    }

    if (
      category.capacity != null &&
      Number(category.sold_count) >= Number(category.capacity)
    ) {
      return res.status(409).json({ error: "Category is sold out" });
    }

    if (bib_number) {
      const [dupBib] = await pool.query<RowDataPacket[]>(
        `SELECT id FROM registrations
         WHERE event_id = ? AND bib_number = ? AND deleted_at IS NULL LIMIT 1`,
        [eventId, bib_number],
      );
      if (dupBib.length > 0) {
        return res.status(409).json({ error: "Bib number already assigned" });
      }
    }

    const priceCents = comp ? 0 : Number(category.price_cents);
    const feePercent = Number(
      category.service_fee_percent ?? category.org_fee_percent ?? 11,
    );
    const serviceFeeCents = comp
      ? 0
      : Math.round(priceCents * (feePercent / 100));
    const totalCents = priceCents + serviceFeeCents;

    if (!comp && totalCents > 0) {
      return res.status(400).json({
        error:
          "Paid manual registrations require comp mode — athletes must checkout online for paid entries",
      });
    }
    const regNumber = await hubHelpers.nextRegistrationNumber(eventId);
    const qrToken = hubHelpers.newQrToken();
    const regUuid = hubHelpers.newPublicUuid();

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const [regResult] = await conn.query<ResultSetHeader>(
        `INSERT INTO registrations (
           public_uuid, event_id, event_category_id, athlete_id, registration_number,
           qr_code_token, bib_number, status, price_cents, service_fee_cents, total_cents,
           currency, source
         ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?, 'admin')`,
        [
          regUuid,
          eventId,
          categoryId,
          athleteId,
          regNumber,
          qrToken,
          bib_number,
          "confirmed",
          priceCents,
          serviceFeeCents,
          totalCents,
          category.currency || "MXN",
        ],
      );
      const registrationId = regResult.insertId;

      if (comp || totalCents === 0) {
        const payUuid = hubHelpers.newPublicUuid();
        const [payResult] = await conn.query<ResultSetHeader>(
          `INSERT INTO payments (
             public_uuid, registration_id, athlete_id, organizer_id, event_id,
             amount_cents, registration_amount_cents, service_fee_cents, currency,
             status, provider, paid_at
           ) VALUES (?,?,?,?,?,?,?,?,?,'succeeded','mock',NOW())`,
          [
            payUuid,
            registrationId,
            athleteId,
            category.organizer_id,
            eventId,
            totalCents,
            priceCents,
            serviceFeeCents,
            category.currency || "MXN",
          ],
        );
        await conn.query<ResultSetHeader>(
          "UPDATE registrations SET payment_id = ? WHERE id = ?",
          [payResult.insertId, registrationId],
        );
      }

      const [soldInc] = await conn.query<ResultSetHeader>(
        `UPDATE event_categories SET sold_count = sold_count + 1
         WHERE id = ? AND (capacity IS NULL OR sold_count < capacity)`,
        [categoryId],
      );
      if (soldInc.affectedRows === 0) {
        await conn.rollback();
        return res.status(409).json({ error: "Category is sold out" });
      }

      const fieldValues = req.body?.field_values;
      if (fieldValues && typeof fieldValues === "object") {
        const [fieldRows] = await conn.query<RowDataPacket[]>(
          `SELECT id, field_key FROM event_registration_fields
           WHERE event_id = ? AND is_active = 1`,
          [eventId],
        );
        for (const field of fieldRows) {
          const key = field.field_key as string;
          const raw = (fieldValues as Record<string, unknown>)[key];
          if (raw == null || String(raw).trim() === "") continue;
          await conn.query<ResultSetHeader>(
            `INSERT INTO registration_field_values (registration_id, field_id, value_text)
             VALUES (?,?,?)`,
            [registrationId, field.id, String(raw).trim()],
          );
        }
      }

      if (waiverWaived && Boolean(category.requires_waiver)) {
        await markRegistrationWaiverWaivedByStaff(conn, registrationId, req.auth?.id);
      }

      await conn.commit();

      const detail = await fetchStaffRegistrationDetail(pool, eventId, registrationId);
      res.status(201).json(detail);
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  });
}

function mountEventResultsRoutes(
  app: Express,
  pool: Pool,
  guard: RequestHandler,
  basePath: string,
  canAccess: (req: AuthedRequest, eventId: number) => Promise<boolean>,
) {
  app.get(`${basePath}/:eventId/results`, guard, async (req: AuthedRequest, res) => {
    const eventId = Number(req.params.eventId);
    if (!Number.isFinite(eventId)) {
      return res.status(400).json({ error: "Invalid event id" });
    }
    if (!(await canAccess(req, eventId))) {
      return res.status(404).json({ error: "Event not found" });
    }

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT er.id, er.registration_id, er.event_category_id,
              er.overall_rank, er.category_rank, er.gender_rank,
              er.finish_time_ms, er.status, er.published_at,
              r.registration_number, r.bib_number,
              a.first_name AS athlete_first_name, a.last_name AS athlete_last_name,
              ec.name AS category_name
       FROM event_results er
       JOIN registrations r ON r.id = er.registration_id
       JOIN athletes a ON a.id = r.athlete_id
       JOIN event_categories ec ON ec.id = er.event_category_id
       WHERE er.event_id = ?
       ORDER BY er.overall_rank IS NULL, er.overall_rank ASC, er.id ASC`,
      [eventId],
    );
    res.json({ results: rows });
  });

  app.post(`${basePath}/:eventId/results`, guard, async (req: AuthedRequest, res) => {
    const eventId = Number(req.params.eventId);
    if (!Number.isFinite(eventId)) {
      return res.status(400).json({ error: "Invalid event id" });
    }
    if (!(await canAccess(req, eventId))) {
      return res.status(404).json({ error: "Event not found" });
    }

    const items = Array.isArray(req.body?.results)
      ? req.body.results
      : req.body?.registration_number
        ? [req.body]
        : [];
    if (items.length === 0) {
      return res.status(400).json({ error: "results array or single result required" });
    }

    const upserted: RowDataPacket[] = [];
    const errors: string[] = [];

    for (const item of items) {
      const regNum = String(item.registration_number ?? "").trim();
      if (!regNum) {
        errors.push("Missing registration_number");
        continue;
      }

      const [regs] = await pool.query<RowDataPacket[]>(
        `SELECT r.id, r.event_category_id
         FROM registrations r
         WHERE r.event_id = ? AND r.registration_number = ? AND r.deleted_at IS NULL
           AND r.status = 'confirmed' LIMIT 1`,
        [eventId, regNum],
      );
      if (regs.length === 0) {
        errors.push(`Registration not found: ${regNum}`);
        continue;
      }

      const reg = regs[0];
      const finish_time_ms =
        item.finish_time_ms != null
          ? Number(item.finish_time_ms)
          : parseFinishTimeToMs(item.finish_time ?? item.time);
      const status = String(item.status ?? "finished");
      if (!["finished", "dnf", "dns", "dq"].includes(status)) {
        errors.push(`Invalid status for ${regNum}`);
        continue;
      }

      const overall_rank = item.overall_rank != null ? Number(item.overall_rank) : null;
      const category_rank = item.category_rank != null ? Number(item.category_rank) : null;
      const gender_rank = item.gender_rank != null ? Number(item.gender_rank) : null;

      await pool.query<ResultSetHeader>(
        `INSERT INTO event_results (
           event_id, registration_id, event_category_id,
           overall_rank, category_rank, gender_rank, finish_time_ms, status
         ) VALUES (?,?,?,?,?,?,?,?)
         ON DUPLICATE KEY UPDATE
           overall_rank = VALUES(overall_rank),
           category_rank = VALUES(category_rank),
           gender_rank = VALUES(gender_rank),
           finish_time_ms = VALUES(finish_time_ms),
           status = VALUES(status),
           published_at = NULL`,
        [
          eventId,
          reg.id,
          reg.event_category_id,
          overall_rank,
          category_rank,
          gender_rank,
          finish_time_ms,
          status,
        ],
      );

      const [saved] = await pool.query<RowDataPacket[]>(
        `SELECT er.id, er.registration_id, er.overall_rank, er.category_rank,
                er.finish_time_ms, er.status, er.published_at,
                r.registration_number, r.bib_number
         FROM event_results er
         JOIN registrations r ON r.id = er.registration_id
         WHERE er.registration_id = ? LIMIT 1`,
        [reg.id],
      );
      if (saved[0]) upserted.push(saved[0]);
    }

    res.status(errors.length > 0 && upserted.length === 0 ? 400 : 200).json({
      results: upserted,
      errors: errors.length > 0 ? errors : undefined,
    });
  });

  app.patch(
    `${basePath}/:eventId/results/:resultId`,
    guard,
    async (req: AuthedRequest, res) => {
      const eventId = Number(req.params.eventId);
      const resultId = Number(req.params.resultId);
      if (!Number.isFinite(eventId) || !Number.isFinite(resultId)) {
        return res.status(400).json({ error: "Invalid id" });
      }
      if (!(await canAccess(req, eventId))) {
        return res.status(404).json({ error: "Event not found" });
      }

      const updates: string[] = [];
      const params: (string | number | null)[] = [];
      const body = req.body ?? {};

      if (body.overall_rank !== undefined) {
        updates.push("overall_rank = ?");
        params.push(body.overall_rank == null ? null : Number(body.overall_rank));
      }
      if (body.category_rank !== undefined) {
        updates.push("category_rank = ?");
        params.push(body.category_rank == null ? null : Number(body.category_rank));
      }
      if (body.gender_rank !== undefined) {
        updates.push("gender_rank = ?");
        params.push(body.gender_rank == null ? null : Number(body.gender_rank));
      }
      if (body.finish_time_ms != null || body.finish_time != null || body.time != null) {
        const ms =
          body.finish_time_ms != null
            ? Number(body.finish_time_ms)
            : parseFinishTimeToMs(body.finish_time ?? body.time);
        updates.push("finish_time_ms = ?");
        params.push(ms);
      }
      if (body.status != null) {
        const status = String(body.status);
        if (!["finished", "dnf", "dns", "dq"].includes(status)) {
          return res.status(400).json({ error: "invalid status" });
        }
        updates.push("status = ?");
        params.push(status);
      }
      if (updates.length === 0) {
        return res.status(400).json({ error: "No updates provided" });
      }
      updates.push("published_at = NULL");

      params.push(resultId, eventId);
      const [result] = await pool.query<ResultSetHeader>(
        `UPDATE event_results SET ${updates.join(", ")} WHERE id = ? AND event_id = ?`,
        params,
      );
      if (result.affectedRows === 0) {
        return res.status(404).json({ error: "Result not found" });
      }

      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT er.id, er.registration_id, er.overall_rank, er.category_rank,
                er.finish_time_ms, er.status, er.published_at,
                r.registration_number, r.bib_number
         FROM event_results er
         JOIN registrations r ON r.id = er.registration_id
         WHERE er.id = ? LIMIT 1`,
        [resultId],
      );
      res.json({ result: rows[0] });
    },
  );

  app.post(`${basePath}/:eventId/results/publish`, guard, async (req: AuthedRequest, res) => {
    const eventId = Number(req.params.eventId);
    if (!Number.isFinite(eventId)) {
      return res.status(400).json({ error: "Invalid event id" });
    }
    if (!(await canAccess(req, eventId))) {
      return res.status(404).json({ error: "Event not found" });
    }

    const ids = Array.isArray(req.body?.result_ids)
      ? req.body.result_ids.map(Number).filter(Number.isFinite)
      : null;

    if (ids && ids.length > 0) {
      const placeholders = ids.map(() => "?").join(",");
      await pool.query<ResultSetHeader>(
        `UPDATE event_results SET published_at = NOW()
         WHERE event_id = ? AND id IN (${placeholders})`,
        [eventId, ...ids],
      );
    } else {
      await pool.query<ResultSetHeader>(
        `UPDATE event_results SET published_at = NOW()
         WHERE event_id = ? AND published_at IS NULL`,
        [eventId],
      );
    }

    const [count] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS published FROM event_results
       WHERE event_id = ? AND published_at IS NOT NULL`,
      [eventId],
    );
    res.json({ ok: true, published_count: Number(count[0]?.published ?? 0) });
  });

  app.delete(
    `${basePath}/:eventId/results/:resultId`,
    guard,
    async (req: AuthedRequest, res) => {
      const eventId = Number(req.params.eventId);
      const resultId = Number(req.params.resultId);
      if (!Number.isFinite(eventId) || !Number.isFinite(resultId)) {
        return res.status(400).json({ error: "Invalid id" });
      }
      if (!(await canAccess(req, eventId))) {
        return res.status(404).json({ error: "Event not found" });
      }

      const [result] = await pool.query<ResultSetHeader>(
        "DELETE FROM event_results WHERE id = ? AND event_id = ?",
        [resultId, eventId],
      );
      if (result.affectedRows === 0) {
        return res.status(404).json({ error: "Result not found" });
      }
      res.json({ ok: true });
    },
  );

  app.get(
    `${basePath}/:eventId/results/:resultId/splits`,
    guard,
    async (req: AuthedRequest, res) => {
      const eventId = Number(req.params.eventId);
      const resultId = Number(req.params.resultId);
      if (!Number.isFinite(eventId) || !Number.isFinite(resultId)) {
        return res.status(400).json({ error: "Invalid id" });
      }
      if (!(await canAccess(req, eventId))) {
        return res.status(404).json({ error: "Event not found" });
      }

      const [resultRows] = await pool.query<RowDataPacket[]>(
        "SELECT id FROM event_results WHERE id = ? AND event_id = ? LIMIT 1",
        [resultId, eventId],
      );
      if (resultRows.length === 0) {
        return res.status(404).json({ error: "Result not found" });
      }

      const [splits] = await pool.query<RowDataPacket[]>(
        `SELECT id, split_name, split_order, distance_km, elapsed_ms, pace_per_km_ms
         FROM result_splits WHERE result_id = ? ORDER BY split_order ASC, id ASC`,
        [resultId],
      );
      res.json({ splits });
    },
  );

  app.put(
    `${basePath}/:eventId/results/:resultId/splits`,
    guard,
    async (req: AuthedRequest, res) => {
      const eventId = Number(req.params.eventId);
      const resultId = Number(req.params.resultId);
      if (!Number.isFinite(eventId) || !Number.isFinite(resultId)) {
        return res.status(400).json({ error: "Invalid id" });
      }
      if (!(await canAccess(req, eventId))) {
        return res.status(404).json({ error: "Event not found" });
      }

      const [resultRows] = await pool.query<RowDataPacket[]>(
        "SELECT id FROM event_results WHERE id = ? AND event_id = ? LIMIT 1",
        [resultId, eventId],
      );
      if (resultRows.length === 0) {
        return res.status(404).json({ error: "Result not found" });
      }

      const raw = req.body?.splits;
      if (!Array.isArray(raw)) {
        return res.status(400).json({ error: "splits array required" });
      }

      const splits = raw
        .map((s: Record<string, unknown>, index: number) => {
          const split_name = String(s.split_name ?? "").trim();
          const elapsed_ms = Number(s.elapsed_ms);
          if (!split_name || !Number.isFinite(elapsed_ms) || elapsed_ms < 0) {
            return null;
          }
          const distance_km =
            s.distance_km == null || s.distance_km === ""
              ? null
              : Number(s.distance_km);
          const pace_per_km_ms =
            s.pace_per_km_ms == null || s.pace_per_km_ms === ""
              ? null
              : Number(s.pace_per_km_ms);
          return {
            split_name: split_name.slice(0, 100),
            split_order: Number(s.split_order) || index,
            distance_km:
              distance_km != null && Number.isFinite(distance_km) ? distance_km : null,
            elapsed_ms: Math.round(elapsed_ms),
            pace_per_km_ms:
              pace_per_km_ms != null && Number.isFinite(pace_per_km_ms)
                ? Math.round(pace_per_km_ms)
                : null,
          };
        })
        .filter(Boolean) as Array<{
        split_name: string;
        split_order: number;
        distance_km: number | null;
        elapsed_ms: number;
        pace_per_km_ms: number | null;
      }>;

      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();
        await conn.query("DELETE FROM result_splits WHERE result_id = ?", [resultId]);
        for (const s of splits) {
          await conn.query<ResultSetHeader>(
            `INSERT INTO result_splits (result_id, split_name, split_order, distance_km, elapsed_ms, pace_per_km_ms)
             VALUES (?,?,?,?,?,?)`,
            [
              resultId,
              s.split_name,
              s.split_order,
              s.distance_km,
              s.elapsed_ms,
              s.pace_per_km_ms,
            ],
          );
        }
        await conn.commit();
      } catch (err) {
        await conn.rollback();
        throw err;
      } finally {
        conn.release();
      }

      const [saved] = await pool.query<RowDataPacket[]>(
        `SELECT id, split_name, split_order, distance_km, elapsed_ms, pace_per_km_ms
         FROM result_splits WHERE result_id = ? ORDER BY split_order ASC, id ASC`,
        [resultId],
      );
      res.json({ splits: saved });
    },
  );
}

type CategoryRouteError = { status: number; error: string };

async function createEventCategoryRecord(
  pool: Pool,
  newUuid: () => string,
  eventId: number,
  body: Record<string, unknown>,
): Promise<CategoryRouteError | null> {
  const name = String(body?.name ?? "").trim();
  const price_cents = Number(body?.price_cents);
  if (!name) return { status: 400, error: "name required" };
  if (!Number.isFinite(price_cents) || price_cents < 0) {
    return { status: 400, error: "price_cents required" };
  }

  const capacityRaw = body?.capacity;
  const capacity =
    capacityRaw === null || capacityRaw === undefined || capacityRaw === ""
      ? null
      : Number(capacityRaw);

  const distanceRaw = body?.distance_km;
  const distance_km =
    distanceRaw === null || distanceRaw === undefined || distanceRaw === ""
      ? null
      : Number(distanceRaw);

  let gender_restriction = "any";
  if (body?.gender_restriction != null) {
    const g = String(body.gender_restriction);
    if (!["any", "male", "female"].includes(g)) {
      return { status: 400, error: "invalid gender_restriction" };
    }
    gender_restriction = g;
  }

  let difficulty: string | null = null;
  if (body?.difficulty != null && body.difficulty !== "") {
    const d = String(body.difficulty);
    if (!["beginner", "intermediate", "advanced", "expert"].includes(d)) {
      return { status: 400, error: "invalid difficulty" };
    }
    difficulty = d;
  }

  const min_age =
    body?.min_age === null || body?.min_age === undefined || body?.min_age === ""
      ? null
      : Number(body.min_age);
  const max_age =
    body?.max_age === null || body?.max_age === undefined || body?.max_age === ""
      ? null
      : Number(body.max_age);

  await pool.query<ResultSetHeader>(
    `INSERT INTO event_categories (
       public_uuid, event_id, name, description, distance_km, difficulty, capacity,
       price_cents, gender_restriction, min_age, max_age, waitlist_enabled, sort_order, is_active
     ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,1)`,
    [
      newUuid(),
      eventId,
      name.slice(0, 150),
      body?.description ? String(body.description).slice(0, 2000) : null,
      distance_km != null && Number.isFinite(distance_km) ? distance_km : null,
      difficulty,
      capacity,
      Math.round(price_cents),
      gender_restriction,
      min_age != null && Number.isFinite(min_age) ? min_age : null,
      max_age != null && Number.isFinite(max_age) ? max_age : null,
      body?.waitlist_enabled ? 1 : 0,
      Number(body?.sort_order) || 0,
    ],
  );
  return null;
}

async function deleteEventCategoryRecord(
  pool: Pool,
  eventId: number,
  categoryId: number,
): Promise<CategoryRouteError | null> {
  const [sold] = await pool.query<RowDataPacket[]>(
    "SELECT sold_count FROM event_categories WHERE id = ? AND event_id = ? LIMIT 1",
    [categoryId, eventId],
  );
  if (sold.length === 0) {
    return { status: 404, error: "Category not found" };
  }
  if (Number(sold[0].sold_count) > 0) {
    await pool.query(
      "UPDATE event_categories SET is_active = 0 WHERE id = ? AND event_id = ?",
      [categoryId, eventId],
    );
  } else {
    await pool.query(
      "DELETE FROM event_categories WHERE id = ? AND event_id = ?",
      [categoryId, eventId],
    );
  }
  return null;
}

async function patchEventCategoryRecord(
  pool: Pool,
  eventId: number,
  categoryId: number,
  body: Record<string, unknown>,
): Promise<CategoryRouteError | null> {
  const [existing] = await pool.query<RowDataPacket[]>(
    "SELECT id FROM event_categories WHERE id = ? AND event_id = ? LIMIT 1",
    [categoryId, eventId],
  );
  if (existing.length === 0) {
    return { status: 404, error: "Category not found" };
  }

  const updates: string[] = [];
  const params: (string | number | null)[] = [];

  if (body.name != null) {
    const name = String(body.name).trim();
    if (!name) return { status: 400, error: "name cannot be empty" };
    updates.push("name = ?");
    params.push(name.slice(0, 150));
  }
  if (body.description !== undefined) {
    updates.push("description = ?");
    params.push(body.description ? String(body.description).slice(0, 2000) : null);
  }
  if (body.price_cents != null) {
    const price_cents = Number(body.price_cents);
    if (!Number.isFinite(price_cents) || price_cents < 0) {
      return { status: 400, error: "invalid price_cents" };
    }
    updates.push("price_cents = ?");
    params.push(Math.round(price_cents));
  }
  if (body.capacity !== undefined) {
    const cap =
      body.capacity === null || body.capacity === "" ? null : Number(body.capacity);
    if (cap != null && (!Number.isFinite(cap) || cap < 0)) {
      return { status: 400, error: "invalid capacity" };
    }
    updates.push("capacity = ?");
    params.push(cap);
  }
  if (body.distance_km !== undefined) {
    const dist =
      body.distance_km === null || body.distance_km === ""
        ? null
        : Number(body.distance_km);
    updates.push("distance_km = ?");
    params.push(dist != null && Number.isFinite(dist) ? dist : null);
  }
  if (body.gender_restriction != null) {
    const g = String(body.gender_restriction);
    if (!["any", "male", "female"].includes(g)) {
      return { status: 400, error: "invalid gender_restriction" };
    }
    updates.push("gender_restriction = ?");
    params.push(g);
  }
  if (body.min_age !== undefined) {
    updates.push("min_age = ?");
    params.push(body.min_age == null ? null : Number(body.min_age));
  }
  if (body.max_age !== undefined) {
    updates.push("max_age = ?");
    params.push(body.max_age == null ? null : Number(body.max_age));
  }
  if (body.difficulty !== undefined) {
    if (body.difficulty == null || body.difficulty === "") {
      updates.push("difficulty = ?");
      params.push(null);
    } else {
      const d = String(body.difficulty);
      if (!["beginner", "intermediate", "advanced", "expert"].includes(d)) {
        return { status: 400, error: "invalid difficulty" };
      }
      updates.push("difficulty = ?");
      params.push(d);
    }
  }
  if (body.sort_order != null) {
    updates.push("sort_order = ?");
    params.push(Number(body.sort_order) || 0);
  }
  if (body.is_active != null) {
    updates.push("is_active = ?");
    params.push(body.is_active ? 1 : 0);
  }
  if (body.waitlist_enabled != null) {
    updates.push("waitlist_enabled = ?");
    params.push(body.waitlist_enabled ? 1 : 0);
  }
  if (body.registration_opens_at !== undefined) {
    updates.push("registration_opens_at = ?");
    params.push(body.registration_opens_at ? String(body.registration_opens_at) : null);
  }
  if (body.registration_closes_at !== undefined) {
    updates.push("registration_closes_at = ?");
    params.push(body.registration_closes_at ? String(body.registration_closes_at) : null);
  }

  if (updates.length === 0) {
    return { status: 400, error: "No updates provided" };
  }

  params.push(categoryId, eventId);
  await pool.query<ResultSetHeader>(
    `UPDATE event_categories SET ${updates.join(", ")} WHERE id = ? AND event_id = ?`,
    params,
  );
  return null;
}

function parseOptionalCoord(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

type ParsedEventBody = {
  title: string;
  slug?: string;
  sport_type_id: number;
  short_description: string | null;
  description: string | null;
  status: string;
  visibility: string;
  featured: boolean;
  start_date: string;
  end_date: string | null;
  registration_opens_at: string | null;
  registration_closes_at: string | null;
  location_city: string | null;
  location_state: string | null;
  location_name: string | null;
  location_lat: number | null;
  location_lng: number | null;
  hero_image_url: string | null;
  banner_image_url: string | null;
  max_registrations: number | null;
  requires_waiver: boolean;
};

function eventBodySqlTail(): string {
  return `location_name = ?, location_city = ?, location_state = ?, location_lat = ?, location_lng = ?,
           hero_image_url = ?, banner_image_url = ?, max_registrations = ?`;
}

function eventBodySqlValues(data: ParsedEventBody): (
  | string
  | number
  | null
)[] {
  return [
    data.location_name,
    data.location_city,
    data.location_state,
    data.location_lat,
    data.location_lng,
    data.hero_image_url,
    data.banner_image_url,
    data.max_registrations,
  ];
}

function parseEventBody(body: Record<string, unknown>):
  | { error: string }
  | { data: ParsedEventBody } {
  const title = String(body.title ?? "").trim();
  if (!title || title.length > 255) {
    return { error: "title required (max 255)" };
  }

  const sport_type_id = Number(body.sport_type_id);
  if (!Number.isFinite(sport_type_id) || sport_type_id <= 0) {
    return { error: "sport_type_id required" };
  }

  const start_date = String(body.start_date ?? "").trim();
  if (!start_date) {
    return { error: "start_date required" };
  }

  const status = String(body.status ?? "draft");
  if (!["draft", "published", "cancelled", "completed"].includes(status)) {
    return { error: "invalid status" };
  }

  const visibility = String(body.visibility ?? "public");
  if (!["public", "private", "unlisted"].includes(visibility)) {
    return { error: "invalid visibility" };
  }

  const endRaw = body.end_date;
  const end_date =
    endRaw === null || endRaw === undefined || endRaw === ""
      ? null
      : String(endRaw).trim();

  const regOpenRaw = body.registration_opens_at;
  const registration_opens_at =
    regOpenRaw === null || regOpenRaw === undefined || regOpenRaw === ""
      ? null
      : String(regOpenRaw).trim();

  const regCloseRaw = body.registration_closes_at;
  const registration_closes_at =
    regCloseRaw === null || regCloseRaw === undefined || regCloseRaw === ""
      ? null
      : String(regCloseRaw).trim();

  const maxRaw = body.max_registrations;
  const max_registrations =
    maxRaw === null || maxRaw === undefined || maxRaw === ""
      ? null
      : Number(maxRaw);
  if (max_registrations != null && (!Number.isFinite(max_registrations) || max_registrations < 0)) {
    return { error: "invalid max_registrations" };
  }

  return {
    data: {
      title,
      slug: body.slug ? String(body.slug).trim().slice(0, 120) : undefined,
      sport_type_id,
      short_description: body.short_description
        ? String(body.short_description).trim().slice(0, 500)
        : null,
      description: body.description ? String(body.description).trim() : null,
      status,
      visibility,
      featured: Boolean(body.featured),
      start_date,
      end_date,
      registration_opens_at,
      registration_closes_at,
      location_city: body.location_city
        ? String(body.location_city).trim().slice(0, 100)
        : null,
      location_state: body.location_state
        ? String(body.location_state).trim().slice(0, 100)
        : null,
      location_name: body.location_name
        ? String(body.location_name).trim().slice(0, 255)
        : null,
      location_lat: parseOptionalCoord(body.location_lat),
      location_lng: parseOptionalCoord(body.location_lng),
      hero_image_url: body.hero_image_url
        ? String(body.hero_image_url).trim().slice(0, 500)
        : null,
      banner_image_url: body.banner_image_url
        ? String(body.banner_image_url).trim().slice(0, 500)
        : null,
      max_registrations,
      requires_waiver: body.requires_waiver === false || body.requires_waiver === 0 ? false : true,
    },
  };
}

async function analyticsTimeSeries(pool: Pool, organizerId?: number) {
  const orgFilter = organizerId
    ? ` AND r.event_id IN (SELECT id FROM events WHERE organizer_id = ${Number(organizerId)})`
    : "";

  const [regRows] = await pool.query<RowDataPacket[]>(
    `SELECT DATE(r.created_at) AS day, COUNT(*) AS registrations
     FROM registrations r
     WHERE r.status = 'confirmed' AND r.deleted_at IS NULL
       AND r.created_at >= DATE_SUB(CURDATE(), INTERVAL 29 DAY)${orgFilter}
     GROUP BY DATE(r.created_at)
     ORDER BY day ASC`,
  );

  const [revRows] = await pool.query<RowDataPacket[]>(
    `SELECT DATE(p.created_at) AS day, COALESCE(SUM(p.amount_cents), 0) AS revenue_cents
     FROM payments p
     WHERE p.status = 'succeeded'
       AND p.created_at >= DATE_SUB(CURDATE(), INTERVAL 29 DAY)
       ${organizerId ? `AND p.organizer_id = ${Number(organizerId)}` : ""}
     GROUP BY DATE(p.created_at)
     ORDER BY day ASC`,
  );

  return {
    registrations_by_day: regRows.map((r) => ({
      day: String(r.day).slice(0, 10),
      registrations: Number(r.registrations),
    })),
    revenue_by_day: revRows.map((r) => ({
      day: String(r.day).slice(0, 10),
      revenue_cents: Number(r.revenue_cents),
    })),
  };
}

export function registerStaffPortalRoutes(
  app: Express,
  deps: StaffPortalDeps,
): void {
  const {
    pool,
    requireAdmin,
    requireOrganizer,
    newPublicUuid,
    newQrToken,
    nextRegistrationNumber,
    normalizeLocale,
    sendEmail,
    appUrl,
    processPaymentRefund,
    buildWelcomeStaffEmail,
    sendStaffLoginOtp,
  } = deps;

  app.post(
    "/api/admin/events/upload-asset",
    requireAdmin,
    (req, res) => void handleEventAssetUpload(req, res),
  );

  app.post(
    "/api/organizer/events/upload-asset",
    requireOrganizer,
    (req, res) => void handleEventAssetUpload(req, res),
  );

  function sendStaffWelcomeEmail(opts: {
    to: string;
    firstName: string;
    audience: "admin" | "organizer";
    preferredLanguage?: unknown;
  }) {
    const welcome = buildWelcomeStaffEmail({
      locale: normalizeLocale(opts.preferredLanguage),
      firstName: opts.firstName,
      audience: opts.audience,
      appUrl,
    });
    void sendEmail({
      to: opts.to,
      subject: welcome.subject,
      html: welcome.html,
      text: welcome.text,
    }).catch((err) => console.error("[email:welcome-staff]", err));
  }

  async function organizerEventAccess(req: AuthedRequest, eventId: number): Promise<boolean> {
    const organizerId = req.auth!.organizerId;
    if (!organizerId || !req.auth?.id) return false;
    return assertMemberCanAccessEvent(pool, req.auth.id, organizerId, eventId);
  }

  const hubHelpers = { newPublicUuid, newQrToken, nextRegistrationNumber };

  mountEventHubRoutes(
    app,
    pool,
    requireOrganizer,
    "/api/organizer/events",
    async (req, eventId) => organizerEventAccess(req, eventId),
    hubHelpers,
  );

  mountEventHubRoutes(
    app,
    pool,
    requireAdmin,
    "/api/admin/events",
    async (_req, eventId) => assertEventExists(pool, eventId),
    hubHelpers,
  );

  mountEventResultsRoutes(
    app,
    pool,
    requireOrganizer,
    "/api/organizer/events",
    async (req, eventId) => organizerEventAccess(req, eventId),
  );

  mountEventResultsRoutes(
    app,
    pool,
    requireAdmin,
    "/api/admin/events",
    async (_req, eventId) => assertEventExists(pool, eventId),
  );

  app.get("/api/admin/registrations", requireAdmin, async (req, res) => {
    const eventIdRaw = req.query.eventId;
    const eventId =
      eventIdRaw != null && String(eventIdRaw).trim() !== ""
        ? Number(eventIdRaw)
        : undefined;
    if (eventId != null && !Number.isFinite(eventId)) {
      return res.status(400).json({ error: "Invalid eventId" });
    }
    const q = String(req.query.q ?? "").trim();
    const result = await listStaffRegistrations(pool, {
      eventId,
      q: q || undefined,
      page: req.query.page,
      limit: req.query.limit,
      sortBy: req.query.sortBy,
      sortDir: req.query.sortDir,
    });
    res.json(result);
  });

  // ── Organizer: event detail ──────────────────────────────────────────────
  app.get(
    "/api/organizer/events/:eventId",
    requireOrganizer,
    async (req: AuthedRequest, res) => {
      const organizerId = req.auth!.organizerId;
      if (!organizerId) {
        return res.status(403).json({ error: "Organizer context missing" });
      }
      const eventId = Number(req.params.eventId);
      if (!Number.isFinite(eventId)) {
        return res.status(400).json({ error: "Invalid event id" });
      }
      if (!(await assertMemberCanAccessEvent(pool, req.auth!.id, organizerId, eventId))) {
        return res.status(404).json({ error: "Event not found" });
      }
      const event = await fetchStaffEventDetail(pool, eventId);
      const categories = await fetchEventCategories(pool, eventId);
      res.json({ event, categories });
    },
  );

  app.post(
    "/api/organizer/events",
    requireOrganizer,
    async (req: AuthedRequest, res) => {
      const organizerId = req.auth!.organizerId;
      if (!organizerId) {
        return res.status(403).json({ error: "Organizer context missing" });
      }
      const parsed = parseEventBody((req.body ?? {}) as Record<string, unknown>);
      if ("error" in parsed) {
        return res.status(400).json({ error: parsed.error });
      }
      const { data } = parsed;
      const baseSlug = slugify(data.slug || data.title);
      const slug = await uniqueEventSlug(pool, baseSlug);

      const [sportRows] = await pool.query<RowDataPacket[]>(
        "SELECT id FROM sport_types WHERE id = ? AND is_active = 1 LIMIT 1",
        [data.sport_type_id],
      );
      if (sportRows.length === 0) {
        return res.status(400).json({ error: "Invalid sport_type_id" });
      }

      const [result] = await pool.query<ResultSetHeader>(
        `INSERT INTO events (
           public_uuid, organizer_id, sport_type_id, slug, title, short_description, description,
           status, visibility, featured, start_date, end_date, registration_opens_at,
           registration_closes_at, location_name, location_city, location_state, location_lat, location_lng,
           hero_image_url, banner_image_url, max_registrations, requires_waiver
         ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          newPublicUuid(),
          organizerId,
          data.sport_type_id,
          slug,
          data.title,
          data.short_description,
          data.description,
          "draft",
          data.visibility,
          data.featured ? 1 : 0,
          data.start_date,
          data.end_date,
          data.registration_opens_at,
          data.registration_closes_at,
          ...eventBodySqlValues(data),
          data.requires_waiver ? 1 : 0,
        ],
      );

      const event = await fetchStaffEventDetail(pool, result.insertId);
      res.status(201).json({ event, categories: [] });
    },
  );

  app.patch(
    "/api/organizer/events/:eventId",
    requireOrganizer,
    async (req: AuthedRequest, res) => {
      const organizerId = req.auth!.organizerId;
      if (!organizerId) {
        return res.status(403).json({ error: "Organizer context missing" });
      }
      const eventId = Number(req.params.eventId);
      if (!Number.isFinite(eventId)) {
        return res.status(400).json({ error: "Invalid event id" });
      }
      if (!(await assertMemberCanAccessEvent(pool, req.auth!.id, organizerId, eventId))) {
        return res.status(404).json({ error: "Event not found" });
      }

      const parsed = parseEventBody((req.body ?? {}) as Record<string, unknown>);
      if ("error" in parsed) {
        return res.status(400).json({ error: parsed.error });
      }
      const { data } = parsed;

      let slug = data.slug ? slugify(data.slug) : undefined;
      if (slug) {
        slug = await uniqueEventSlug(pool, slug, eventId);
      }

      await pool.query<ResultSetHeader>(
        `UPDATE events SET
           title = ?, sport_type_id = ?,
           ${slug ? "slug = ?," : ""}
           short_description = ?, description = ?, status = ?, visibility = ?,
           featured = ?, start_date = ?, end_date = ?,
           registration_opens_at = ?, registration_closes_at = ?,
           requires_waiver = ?,
           ${eventBodySqlTail()}
         WHERE id = ? AND organizer_id = ?`,
        [
          data.title,
          data.sport_type_id,
          ...(slug ? [slug] : []),
          data.short_description,
          data.description,
          data.status,
          data.visibility,
          data.featured ? 1 : 0,
          data.start_date,
          data.end_date,
          data.registration_opens_at,
          data.registration_closes_at,
          data.requires_waiver ? 1 : 0,
          ...eventBodySqlValues(data),
          eventId,
          organizerId,
        ],
      );

      const event = await fetchStaffEventDetail(pool, eventId);
      const categories = await fetchEventCategories(pool, eventId);
      res.json({ event, categories });
    },
  );

  app.post(
    "/api/organizer/events/:eventId/publish",
    requireOrganizer,
    async (req: AuthedRequest, res) => {
      const organizerId = req.auth!.organizerId;
      if (!organizerId) {
        return res.status(403).json({ error: "Organizer context missing" });
      }
      const eventId = Number(req.params.eventId);
      if (!(await assertMemberCanAccessEvent(pool, req.auth!.id, organizerId, eventId))) {
        return res.status(404).json({ error: "Event not found" });
      }

      const categories = await fetchEventCategories(pool, eventId);
      const activeCategories = categories.filter((c) => c.is_active);
      if (activeCategories.length === 0) {
        return res.status(400).json({
          error: "Add at least one active category before publishing",
        });
      }

      const waiverCheck = await validateEventPublishWaivers(pool, eventId);
      if ("error" in waiverCheck) {
        return res.status(400).json({ error: waiverCheck.error });
      }

      await pool.query<ResultSetHeader>(
        "UPDATE events SET status = 'published' WHERE id = ? AND organizer_id = ?",
        [eventId, organizerId],
      );

      const event = await fetchStaffEventDetail(pool, eventId);
      res.json({ event, categories: await fetchEventCategories(pool, eventId) });
    },
  );

  app.post(
    "/api/organizer/events/:eventId/categories",
    requireOrganizer,
    async (req: AuthedRequest, res) => {
      const organizerId = req.auth!.organizerId;
      if (!organizerId) {
        return res.status(403).json({ error: "Organizer context missing" });
      }
      const eventId = Number(req.params.eventId);
      if (!(await assertMemberCanAccessEvent(pool, req.auth!.id, organizerId, eventId))) {
        return res.status(404).json({ error: "Event not found" });
      }

      const err = await createEventCategoryRecord(
        pool,
        newPublicUuid,
        eventId,
        (req.body ?? {}) as Record<string, unknown>,
      );
      if (err) return res.status(err.status).json({ error: err.error });

      res.status(201).json({ categories: await fetchEventCategories(pool, eventId) });
    },
  );

  app.delete(
    "/api/organizer/events/:eventId/categories/:categoryId",
    requireOrganizer,
    async (req: AuthedRequest, res) => {
      const organizerId = req.auth!.organizerId;
      if (!organizerId) {
        return res.status(403).json({ error: "Organizer context missing" });
      }
      const eventId = Number(req.params.eventId);
      const categoryId = Number(req.params.categoryId);
      if (!(await assertMemberCanAccessEvent(pool, req.auth!.id, organizerId, eventId))) {
        return res.status(404).json({ error: "Event not found" });
      }

      const err = await deleteEventCategoryRecord(pool, eventId, categoryId);
      if (err) return res.status(err.status).json({ error: err.error });

      res.json({ categories: await fetchEventCategories(pool, eventId) });
    },
  );

  app.patch(
    "/api/organizer/events/:eventId/categories/:categoryId",
    requireOrganizer,
    async (req: AuthedRequest, res) => {
      const organizerId = req.auth!.organizerId;
      if (!organizerId) {
        return res.status(403).json({ error: "Organizer context missing" });
      }
      const eventId = Number(req.params.eventId);
      const categoryId = Number(req.params.categoryId);
      if (!(await assertMemberCanAccessEvent(pool, req.auth!.id, organizerId, eventId))) {
        return res.status(404).json({ error: "Event not found" });
      }

      const err = await patchEventCategoryRecord(
        pool,
        eventId,
        categoryId,
        (req.body ?? {}) as Record<string, unknown>,
      );
      if (err) return res.status(err.status).json({ error: err.error });

      res.json({ categories: await fetchEventCategories(pool, eventId) });
    },
  );

  // ── Organizer: registration fields & waivers ─────────────────────────────
  app.get(
    "/api/organizer/events/:eventId/registration-fields",
    requireOrganizer,
    async (req: AuthedRequest, res) => {
      const organizerId = req.auth!.organizerId;
      if (!organizerId) {
        return res.status(403).json({ error: "Organizer context missing" });
      }
      const eventId = Number(req.params.eventId);
      if (!(await assertMemberCanAccessEvent(pool, req.auth!.id, organizerId, eventId))) {
        return res.status(404).json({ error: "Event not found" });
      }
      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT id, field_key, label, field_type, options_json, is_required, sort_order, is_active
         FROM event_registration_fields WHERE event_id = ? ORDER BY sort_order ASC, id ASC`,
        [eventId],
      );
      res.json({ fields: rows });
    },
  );

  app.put(
    "/api/organizer/events/:eventId/registration-fields",
    requireOrganizer,
    async (req: AuthedRequest, res) => {
      const organizerId = req.auth!.organizerId;
      if (!organizerId) {
        return res.status(403).json({ error: "Organizer context missing" });
      }
      const eventId = Number(req.params.eventId);
      if (!(await assertMemberCanAccessEvent(pool, req.auth!.id, organizerId, eventId))) {
        return res.status(404).json({ error: "Event not found" });
      }

      const raw = req.body?.fields;
      if (!Array.isArray(raw)) {
        return res.status(400).json({ error: "fields array required" });
      }

      const validTypes = new Set([
        "text",
        "textarea",
        "select",
        "checkbox",
        "number",
        "date",
        "file",
      ]);

      const fields = raw
        .map((f: Record<string, unknown>, index: number) => {
          const label = String(f.label ?? "").trim();
          if (!label) return null;
          const field_type = String(f.field_type ?? "text");
          if (!validTypes.has(field_type)) return null;
          const field_key =
            String(f.field_key ?? "").trim() || fieldKeyFromLabel(label);
          const options = Array.isArray(f.options)
            ? f.options.map((o) => String(o).trim()).filter(Boolean)
            : null;
          return {
            field_key: field_key.slice(0, 80),
            label: label.slice(0, 200),
            field_type,
            options_json: options?.length ? JSON.stringify(options) : null,
            is_required: f.is_required ? 1 : 0,
            sort_order: Number(f.sort_order) || index,
            is_active: f.is_active === false ? 0 : 1,
          };
        })
        .filter(Boolean) as Array<{
        field_key: string;
        label: string;
        field_type: string;
        options_json: string | null;
        is_required: number;
        sort_order: number;
        is_active: number;
      }>;

      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();
        await conn.query("DELETE FROM event_registration_fields WHERE event_id = ?", [
          eventId,
        ]);
        for (const f of fields) {
          await conn.query<ResultSetHeader>(
            `INSERT INTO event_registration_fields (
               event_id, field_key, label, field_type, options_json, is_required, sort_order, is_active
             ) VALUES (?,?,?,?,?,?,?,?)`,
            [
              eventId,
              f.field_key,
              f.label,
              f.field_type,
              f.options_json,
              f.is_required,
              f.sort_order,
              f.is_active,
            ],
          );
        }
        await conn.commit();
      } catch (err) {
        await conn.rollback();
        throw err;
      } finally {
        conn.release();
      }

      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT id, field_key, label, field_type, options_json, is_required, sort_order, is_active
         FROM event_registration_fields WHERE event_id = ? ORDER BY sort_order ASC, id ASC`,
        [eventId],
      );
      res.json({ fields: rows });
    },
  );

  app.get(
    "/api/organizer/events/:eventId/waivers",
    requireOrganizer,
    async (req: AuthedRequest, res) => {
      const organizerId = req.auth!.organizerId;
      if (!organizerId) {
        return res.status(403).json({ error: "Organizer context missing" });
      }
      const eventId = Number(req.params.eventId);
      if (!(await assertMemberCanAccessEvent(pool, req.auth!.id, organizerId, eventId))) {
        return res.status(404).json({ error: "Event not found" });
      }
      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT id, event_id, title, content_html, pdf_url, content_type,
                version, is_active, sort_order, created_at
         FROM event_waivers WHERE event_id = ? ORDER BY is_active DESC, sort_order ASC, id ASC`,
        [eventId],
      );
      res.json({ waivers: rows });
    },
  );

  app.put(
    "/api/organizer/events/:eventId/waivers",
    requireOrganizer,
    async (req: AuthedRequest, res) => {
      const organizerId = req.auth!.organizerId;
      if (!organizerId) {
        return res.status(403).json({ error: "Organizer context missing" });
      }
      const eventId = Number(req.params.eventId);
      if (!(await assertMemberCanAccessEvent(pool, req.auth!.id, organizerId, eventId))) {
        return res.status(404).json({ error: "Event not found" });
      }

      const result = await syncEventWaivers(pool, eventId, req.body);
      if ("error" in result) {
        return res.status(result.status).json({ error: result.error });
      }
      res.json({ waivers: result.waivers });
    },
  );

  // ── Organizer: check-in ──────────────────────────────────────────────────
  app.get(
    "/api/organizer/registrations/lookup",
    requireOrganizer,
    async (req: AuthedRequest, res) => {
      const organizerId = req.auth!.organizerId;
      if (!organizerId) {
        return res.status(403).json({ error: "Organizer context missing" });
      }
      const q = String(req.query.q ?? "").trim();
      if (!q) {
        return res.status(400).json({ error: "q required" });
      }

      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT r.id, r.registration_number, r.bib_number, r.status, r.qr_code_token,
                r.checked_in_at, r.waiver_signed_at, r.total_cents, r.created_at,
                e.id AS event_id, e.title AS event_title, e.slug AS event_slug, e.requires_waiver,
                ec.name AS category_name,
                a.first_name AS athlete_first_name, a.last_name AS athlete_last_name,
                a.email AS athlete_email
         FROM registrations r
         JOIN events e ON e.id = r.event_id AND e.organizer_id = ?
         JOIN event_categories ec ON ec.id = r.event_category_id
         JOIN athletes a ON a.id = r.athlete_id
         WHERE r.deleted_at IS NULL AND r.status = 'confirmed'
           AND (r.qr_code_token = ? OR r.registration_number = ?)
         LIMIT 1`,
        [organizerId, q, q],
      );

      if (rows.length === 0) {
        return res.status(404).json({ error: "Registration not found" });
      }
      const registration = rows[0];
      let waiver_outdated = false;
      if (Boolean(registration.requires_waiver)) {
        const status = await getRegistrationWaiverStatus(pool, registration.id as number);
        waiver_outdated = status.outdated;
      }
      res.json({ registration: { ...registration, waiver_outdated } });
    },
  );

  app.post(
    "/api/organizer/registrations/:registrationId/check-in",
    requireOrganizer,
    async (req: AuthedRequest, res) => {
      const organizerId = req.auth!.organizerId;
      if (!organizerId) {
        return res.status(403).json({ error: "Organizer context missing" });
      }
      const registrationId = Number(req.params.registrationId);
      if (!Number.isFinite(registrationId)) {
        return res.status(400).json({ error: "Invalid registration id" });
      }

      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT r.id, r.event_id, r.checked_in_at, r.status, r.waiver_signed_at, e.requires_waiver
         FROM registrations r
         JOIN events e ON e.id = r.event_id AND e.organizer_id = ?
         WHERE r.id = ? AND r.deleted_at IS NULL LIMIT 1`,
        [organizerId, registrationId],
      );
      if (rows.length === 0) {
        return res.status(404).json({ error: "Registration not found" });
      }

      const reg = rows[0];
      if (reg.status !== "confirmed") {
        return res.status(400).json({ error: "Registration is not confirmed" });
      }
      if (reg.checked_in_at) {
        return res.status(409).json({
          error: "Already checked in",
          checked_in_at: reg.checked_in_at,
        });
      }

      const forceCheckIn = Boolean(req.body?.force);
      const waiverStatus = await getRegistrationWaiverStatus(pool, registrationId);
      if (Boolean(reg.requires_waiver) && !forceCheckIn) {
        if (!reg.waiver_signed_at || waiverStatus.outdated) {
          return res.status(400).json({
            error: waiverStatus.outdated
              ? "Waiver updated — athlete must re-sign or use force check-in"
              : "Waiver not signed — check in blocked",
            code: waiverStatus.outdated ? "waiver_outdated" : "waiver_unsigned",
          });
        }
      }

      const method = String(req.body?.method ?? "manual");
      const validMethods = new Set(["qr_scan", "manual", "kiosk", "api"]);
      const checkMethod = validMethods.has(method) ? method : "manual";
      const locationLabel = req.body?.location_label
        ? String(req.body.location_label).slice(0, 100)
        : null;
      const deviceInfo = req.headers["user-agent"]
        ? String(req.headers["user-agent"]).slice(0, 255)
        : null;

      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();
        await conn.query<ResultSetHeader>(
          `INSERT INTO check_in_logs (registration_id, event_id, method, operator_type, operator_id, location_label, device_info, metadata_json)
           VALUES (?, ?, ?, 'organizer_member', ?, ?, ?, ?)`,
          [
            registrationId,
            reg.event_id,
            checkMethod,
            req.auth!.id,
            locationLabel,
            deviceInfo,
            forceCheckIn ? JSON.stringify({ force_waiver: true }) : null,
          ],
        );
        await conn.query<ResultSetHeader>(
          "UPDATE registrations SET checked_in_at = NOW() WHERE id = ? AND checked_in_at IS NULL",
          [registrationId],
        );
        await conn.commit();
      } catch (err) {
        await conn.rollback();
        throw err;
      } finally {
        conn.release();
      }

      const [updated] = await pool.query<RowDataPacket[]>(
        `SELECT r.id, r.registration_number, r.bib_number, r.status, r.checked_in_at,
                e.title AS event_title,
                a.first_name AS athlete_first_name, a.last_name AS athlete_last_name
         FROM registrations r
         JOIN events e ON e.id = r.event_id
         JOIN athletes a ON a.id = r.athlete_id
         WHERE r.id = ? LIMIT 1`,
        [registrationId],
      );
      res.json({ ok: true, registration: updated[0] });
    },
  );

  app.patch(
    "/api/organizer/registrations/:registrationId/bib",
    requireOrganizer,
    async (req: AuthedRequest, res) => {
      const organizerId = req.auth!.organizerId;
      if (!organizerId) {
        return res.status(403).json({ error: "Organizer context missing" });
      }
      const registrationId = Number(req.params.registrationId);
      const bibRaw = req.body?.bib_number;
      const bib_number =
        bibRaw === null || bibRaw === undefined || bibRaw === ""
          ? null
          : String(bibRaw).trim().slice(0, 20);

      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT r.id, r.registration_number, r.bib_number, r.status
         FROM registrations r
         JOIN events e ON e.id = r.event_id AND e.organizer_id = ?
         WHERE r.id = ? AND r.deleted_at IS NULL LIMIT 1`,
        [organizerId, registrationId],
      );
      if (rows.length === 0) {
        return res.status(404).json({ error: "Registration not found" });
      }

      if (bib_number) {
        const [dup] = await pool.query<RowDataPacket[]>(
          `SELECT id FROM registrations
           WHERE event_id = (SELECT event_id FROM registrations WHERE id = ?)
             AND bib_number = ? AND id <> ? AND deleted_at IS NULL LIMIT 1`,
          [registrationId, bib_number, registrationId],
        );
        if (dup.length > 0) {
          return res.status(409).json({ error: "Bib number already assigned" });
        }
      }

      await pool.query<ResultSetHeader>(
        "UPDATE registrations SET bib_number = ? WHERE id = ?",
        [bib_number, registrationId],
      );

      res.json({
        ok: true,
        registration: { ...rows[0], bib_number },
      });
    },
  );


  // ── Organizer: team ──────────────────────────────────────────────────────
  app.get(
    "/api/organizer/members",
    requireOrganizer,
    async (req: AuthedRequest, res) => {
      const organizerId = req.auth!.organizerId;
      if (!organizerId) {
        return res.status(403).json({ error: "Organizer context missing" });
      }
      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT id, email, first_name, last_name, phone, role, status, invited_at, last_login_at, created_at
         FROM organizer_members
         WHERE organizer_id = ? AND deleted_at IS NULL
         ORDER BY FIELD(role,'owner','organizer','operations','marketing','finance','timing','sponsor'), created_at ASC`,
        [organizerId],
      );
      res.json({ members: rows });
    },
  );

  app.post(
    "/api/organizer/members",
    requireOrganizer,
    async (req: AuthedRequest, res) => {
      const organizerId = req.auth!.organizerId;
      if (!organizerId) {
        return res.status(403).json({ error: "Organizer context missing" });
      }

      const actorRole = await getOrganizerMemberRole(
        pool,
        req.auth!.id,
        organizerId,
      );
      if (actorRole !== "owner") {
        return res.status(403).json({ error: "Only owners can add team members" });
      }

      const email = String(req.body?.email ?? "")
        .trim()
        .toLowerCase();
      const first_name = String(req.body?.first_name ?? "").trim();
      const last_name = String(req.body?.last_name ?? "").trim();
      const role = String(req.body?.role ?? "organizer");
      const validRoles = new Set([
        "organizer",
        "marketing",
        "finance",
        "timing",
        "operations",
        "sponsor",
      ]);
      if (!email || !first_name || !last_name) {
        return res.status(400).json({ error: "email, first_name, last_name required" });
      }
      if (!validRoles.has(role)) {
        return res.status(400).json({ error: "invalid role" });
      }

      const [existing] = await pool.query<RowDataPacket[]>(
        "SELECT id FROM organizer_members WHERE organizer_id = ? AND email = ? AND deleted_at IS NULL LIMIT 1",
        [organizerId, email],
      );
      if (existing.length > 0) {
        return res.status(409).json({ error: "Member already exists" });
      }

      await pool.query<ResultSetHeader>(
        `INSERT INTO organizer_members (
           public_uuid, organizer_id, email, first_name, last_name, phone, role, status,
           invited_at, invited_by_member_id
         ) VALUES (?,?,?,?,?,?,?,'active',NOW(),?)`,
        [
          newPublicUuid(),
          organizerId,
          email,
          first_name.slice(0, 100),
          last_name.slice(0, 100),
          req.body?.phone ? String(req.body.phone).slice(0, 20) : null,
          role,
          req.auth!.id,
        ],
      );

      sendStaffWelcomeEmail({
        to: email,
        firstName: first_name,
        audience: "organizer",
        preferredLanguage: req.body?.preferred_language,
      });

      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT id, email, first_name, last_name, phone, role, status, invited_at, last_login_at, created_at
         FROM organizer_members WHERE organizer_id = ? AND deleted_at IS NULL ORDER BY created_at ASC`,
        [organizerId],
      );
      res.status(201).json({ members: rows });
    },
  );

  app.patch(
    "/api/organizer/members/:memberId",
    requireOrganizer,
    async (req: AuthedRequest, res) => {
      const organizerId = req.auth!.organizerId;
      if (!organizerId) {
        return res.status(403).json({ error: "Organizer context missing" });
      }

      const actorRole = await getOrganizerMemberRole(
        pool,
        req.auth!.id,
        organizerId,
      );
      if (actorRole !== "owner") {
        return res.status(403).json({ error: "Only owners can update members" });
      }

      const memberId = Number(req.params.memberId);
      const [target] = await pool.query<RowDataPacket[]>(
        "SELECT id, role FROM organizer_members WHERE id = ? AND organizer_id = ? AND deleted_at IS NULL LIMIT 1",
        [memberId, organizerId],
      );
      if (target.length === 0) {
        return res.status(404).json({ error: "Member not found" });
      }
      if (target[0].role === "owner" && memberId !== req.auth!.id) {
        return res.status(403).json({ error: "Cannot modify owner" });
      }

      const status = req.body?.status ? String(req.body.status) : null;
      const role = req.body?.role ? String(req.body.role) : null;
      const updates: string[] = [];
      const params: (string | number)[] = [];

      if (status) {
        if (!["invited", "active", "inactive", "suspended"].includes(status)) {
          return res.status(400).json({ error: "invalid status" });
        }
        updates.push("status = ?");
        params.push(status);
        if (status === "active") {
          updates.push("invited_at = COALESCE(invited_at, NOW())");
        }
      }
      if (role && target[0].role !== "owner") {
        const validRoles = new Set([
          "organizer",
          "marketing",
          "finance",
          "timing",
          "operations",
          "sponsor",
        ]);
        if (!validRoles.has(role)) {
          return res.status(400).json({ error: "invalid role" });
        }
        updates.push("role = ?");
        params.push(role);
      }

      if (updates.length === 0) {
        return res.status(400).json({ error: "No updates provided" });
      }

      params.push(memberId, organizerId);
      await pool.query<ResultSetHeader>(
        `UPDATE organizer_members SET ${updates.join(", ")} WHERE id = ? AND organizer_id = ?`,
        params,
      );

      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT id, email, first_name, last_name, phone, role, status, invited_at, last_login_at, created_at
         FROM organizer_members WHERE organizer_id = ? AND deleted_at IS NULL ORDER BY created_at ASC`,
        [organizerId],
      );
      res.json({ members: rows });
    },
  );

  app.get(
    "/api/organizer/analytics",
    requireOrganizer,
    async (req: AuthedRequest, res) => {
      const organizerId = req.auth!.organizerId;
      if (!organizerId) {
        return res.status(403).json({ error: "Organizer context missing" });
      }

      const [[stats]] = await pool.query<RowDataPacket[]>(
        `SELECT
           (SELECT COUNT(*) FROM events e WHERE e.organizer_id = ? AND e.deleted_at IS NULL) AS total_events,
           (SELECT COUNT(*) FROM events e WHERE e.organizer_id = ? AND e.status = 'published' AND e.deleted_at IS NULL) AS published_events,
           (SELECT COUNT(*) FROM registrations r JOIN events e ON e.id = r.event_id
            WHERE e.organizer_id = ? AND r.status = 'confirmed' AND r.deleted_at IS NULL) AS confirmed_registrations,
           (SELECT COALESCE(SUM(p.amount_cents),0) FROM payments p WHERE p.organizer_id = ? AND p.status = 'succeeded') AS total_revenue_cents`,
        [organizerId, organizerId, organizerId, organizerId],
      );

      const timeSeries = await analyticsTimeSeries(pool, organizerId);
      res.json({ stats: stats ?? {}, ...timeSeries });
    },
  );

  app.get("/api/organizer/payments", requireOrganizer, async (req: AuthedRequest, res) => {
    const organizerId = req.auth!.organizerId;
    if (!organizerId) {
      return res.status(403).json({ error: "Organizer context missing" });
    }
    const memberRole = await getOrganizerMemberRole(pool, req.auth!.id, organizerId);
    if (!memberRole || !["owner", "finance", "organizer"].includes(memberRole)) {
      return res.status(403).json({ error: "Insufficient permissions for payments" });
    }

    const q = String(req.query.q ?? "").trim();
    const status = String(req.query.status ?? "").trim();
    const eventIdRaw = req.query.eventId;
    const eventId =
      eventIdRaw != null && String(eventIdRaw).trim() !== ""
        ? Number(eventIdRaw)
        : undefined;
    const result = await listAdminPayments(pool, {
      q: q || undefined,
      status: status || undefined,
      organizerId,
      eventId: Number.isFinite(eventId!) ? eventId : undefined,
      page: req.query.page,
      limit: req.query.limit,
      sortBy: req.query.sortBy,
      sortDir: req.query.sortDir,
    });
    res.json(result);
  });

  app.get(
    "/api/organizer/payments/:paymentId",
    requireOrganizer,
    async (req: AuthedRequest, res) => {
      const organizerId = req.auth!.organizerId;
      if (!organizerId) {
        return res.status(403).json({ error: "Organizer context missing" });
      }
      const memberRole = await getOrganizerMemberRole(pool, req.auth!.id, organizerId);
      if (!memberRole || !["owner", "finance", "organizer"].includes(memberRole)) {
        return res.status(403).json({ error: "Insufficient permissions for payments" });
      }

      const paymentId = Number(req.params.paymentId);
      if (!Number.isFinite(paymentId)) {
        return res.status(400).json({ error: "Invalid payment id" });
      }
      const payment = await fetchAdminPaymentDetail(pool, paymentId, { organizerId });
      if (!payment) {
        return res.status(404).json({ error: "Payment not found" });
      }
      res.json({ payment });
    },
  );

  // ── Admin: athlete detail / suspend ──────────────────────────────────────
  app.get(
    "/api/admin/athletes/:athleteId",
    requireAdmin,
    async (req: AuthedRequest, res) => {
      const athleteId = Number(req.params.athleteId);
      if (!Number.isFinite(athleteId)) {
        return res.status(400).json({ error: "Invalid athlete id" });
      }

      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT a.id, a.email, a.phone, a.first_name, a.last_name, a.city, a.country,
                a.status, a.date_of_birth, a.gender, a.shirt_size, a.created_at, a.last_login_at,
                (SELECT COUNT(*) FROM registrations r
                 WHERE r.athlete_id = a.id AND r.status = 'confirmed' AND r.deleted_at IS NULL) AS registration_count
         FROM athletes a
         WHERE a.id = ? AND a.deleted_at IS NULL LIMIT 1`,
        [athleteId],
      );
      if (rows.length === 0) {
        return res.status(404).json({ error: "Athlete not found" });
      }

      const [regs] = await pool.query<RowDataPacket[]>(
        `SELECT r.id, r.registration_number, r.status, r.total_cents, r.created_at,
                e.title AS event_title, e.slug AS event_slug
         FROM registrations r
         JOIN events e ON e.id = r.event_id
         WHERE r.athlete_id = ? AND r.deleted_at IS NULL
         ORDER BY r.created_at DESC LIMIT 20`,
        [athleteId],
      );

      res.json({ athlete: rows[0], registrations: regs });
    },
  );

  app.patch(
    "/api/admin/athletes/:athleteId",
    requireAdmin,
    async (req: AuthedRequest, res) => {
      const athleteId = Number(req.params.athleteId);
      const status = String(req.body?.status ?? "").trim();
      if (!["active", "suspended"].includes(status)) {
        return res.status(400).json({ error: "status must be active or suspended" });
      }

      const [result] = await pool.query<ResultSetHeader>(
        "UPDATE athletes SET status = ? WHERE id = ? AND deleted_at IS NULL",
        [status, athleteId],
      );
      if (result.affectedRows === 0) {
        return res.status(404).json({ error: "Athlete not found" });
      }

      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT id, email, phone, first_name, last_name, city, country, status, created_at
         FROM athletes WHERE id = ? LIMIT 1`,
        [athleteId],
      );
      res.json({ athlete: rows[0] });
    },
  );

  // ── Admin: event detail / publish ────────────────────────────────────────
  app.get(
    "/api/admin/events/:eventId",
    requireAdmin,
    async (req: AuthedRequest, res) => {
      const eventId = Number(req.params.eventId);
      if (!Number.isFinite(eventId)) {
        return res.status(400).json({ error: "Invalid event id" });
      }
      const event = await fetchStaffEventDetail(pool, eventId);
      if (!event) {
        return res.status(404).json({ error: "Event not found" });
      }
      const categories = await fetchEventCategories(pool, eventId);
      res.json({ event, categories });
    },
  );

  app.patch(
    "/api/admin/events/:eventId",
    requireAdmin,
    async (req: AuthedRequest, res) => {
      const eventId = Number(req.params.eventId);
      const event = await fetchStaffEventDetail(pool, eventId);
      if (!event) {
        return res.status(404).json({ error: "Event not found" });
      }

      const parsed = parseEventBody((req.body ?? {}) as Record<string, unknown>);
      if ("error" in parsed) {
        return res.status(400).json({ error: parsed.error });
      }
      const { data } = parsed;

      let slug = data.slug ? slugify(data.slug) : undefined;
      if (slug) {
        slug = await uniqueEventSlug(pool, slug, eventId);
      }

      await pool.query<ResultSetHeader>(
        `UPDATE events SET
           title = ?, sport_type_id = ?,
           ${slug ? "slug = ?," : ""}
           short_description = ?, description = ?, status = ?, visibility = ?,
           featured = ?, start_date = ?, end_date = ?,
           registration_opens_at = ?, registration_closes_at = ?,
           requires_waiver = ?,
           ${eventBodySqlTail()}
         WHERE id = ?`,
        [
          data.title,
          data.sport_type_id,
          ...(slug ? [slug] : []),
          data.short_description,
          data.description,
          data.status,
          data.visibility,
          data.featured ? 1 : 0,
          data.start_date,
          data.end_date,
          data.registration_opens_at,
          data.registration_closes_at,
          data.requires_waiver ? 1 : 0,
          ...eventBodySqlValues(data),
          eventId,
        ],
      );

      res.json({
        event: await fetchStaffEventDetail(pool, eventId),
        categories: await fetchEventCategories(pool, eventId),
      });
    },
  );

  app.post(
    "/api/admin/events/:eventId/publish",
    requireAdmin,
    async (req: AuthedRequest, res) => {
      const eventId = Number(req.params.eventId);
      const event = await fetchStaffEventDetail(pool, eventId);
      if (!event) {
        return res.status(404).json({ error: "Event not found" });
      }

      const categories = await fetchEventCategories(pool, eventId);
      if (categories.filter((c) => c.is_active).length === 0) {
        return res.status(400).json({
          error: "Add at least one active category before publishing",
        });
      }

      const waiverCheck = await validateEventPublishWaivers(pool, eventId);
      if ("error" in waiverCheck) {
        return res.status(400).json({ error: waiverCheck.error });
      }

      await pool.query<ResultSetHeader>(
        "UPDATE events SET status = 'published' WHERE id = ?",
        [eventId],
      );

      res.json({
        event: await fetchStaffEventDetail(pool, eventId),
        categories: await fetchEventCategories(pool, eventId),
      });
    },
  );

  app.get("/api/admin/analytics/timeseries", requireAdmin, async (_req, res) => {
    const timeSeries = await analyticsTimeSeries(pool);
    res.json(timeSeries);
  });

  // ── Organizer: schedule waves ──────────────────────────────────────────────
  app.get(
    "/api/organizer/events/:eventId/schedule-waves",
    requireOrganizer,
    async (req: AuthedRequest, res) => {
      const organizerId = req.auth!.organizerId;
      if (!organizerId) {
        return res.status(403).json({ error: "Organizer context missing" });
      }
      const eventId = Number(req.params.eventId);
      if (!(await assertMemberCanAccessEvent(pool, req.auth!.id, organizerId, eventId))) {
        return res.status(404).json({ error: "Event not found" });
      }
      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT id, event_category_id, name, starts_at, capacity, ${WAVE_REGISTERED_COUNT_SQL} AS registered_count, sort_order
         FROM event_schedule_waves WHERE event_id = ? ORDER BY sort_order ASC, starts_at ASC`,
        [eventId],
      );
      res.json({ waves: rows });
    },
  );

  app.put(
    "/api/organizer/events/:eventId/schedule-waves",
    requireOrganizer,
    async (req: AuthedRequest, res) => {
      const organizerId = req.auth!.organizerId;
      if (!organizerId) {
        return res.status(403).json({ error: "Organizer context missing" });
      }
      const eventId = Number(req.params.eventId);
      if (!(await assertMemberCanAccessEvent(pool, req.auth!.id, organizerId, eventId))) {
        return res.status(404).json({ error: "Event not found" });
      }

      const raw = req.body?.waves;
      if (!Array.isArray(raw)) {
        return res.status(400).json({ error: "waves array required" });
      }

      const waves = raw
        .map((w: Record<string, unknown>, index: number) => {
          const name = String(w.name ?? "").trim();
          const starts_at = String(w.starts_at ?? "").trim();
          if (!name || !starts_at) return null;
          const startsAtDate = new Date(starts_at);
          if (Number.isNaN(startsAtDate.getTime())) return null;
          const event_category_id =
            w.event_category_id != null && Number(w.event_category_id) > 0
              ? Number(w.event_category_id)
              : null;
          const capacity =
            w.capacity != null && w.capacity !== ""
              ? Math.max(0, Number(w.capacity))
              : null;
          return {
            name: name.slice(0, 100),
            starts_at: startsAtDate.toISOString().slice(0, 19).replace("T", " "),
            event_category_id,
            capacity,
            sort_order: Number(w.sort_order) || index,
          };
        })
        .filter(Boolean) as Array<{
        name: string;
        starts_at: string;
        event_category_id: number | null;
        capacity: number | null;
        sort_order: number;
      }>;

      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();
        await conn.query("DELETE FROM event_schedule_waves WHERE event_id = ?", [eventId]);
        for (const w of waves) {
          await conn.query<ResultSetHeader>(
            `INSERT INTO event_schedule_waves (
               event_id, event_category_id, name, starts_at, capacity, sort_order
             ) VALUES (?,?,?,?,?,?)`,
            [eventId, w.event_category_id, w.name, w.starts_at, w.capacity, w.sort_order],
          );
        }
        await conn.commit();
      } catch (err) {
        await conn.rollback();
        throw err;
      } finally {
        conn.release();
      }

      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT id, event_category_id, name, starts_at, capacity, ${WAVE_REGISTERED_COUNT_SQL} AS registered_count, sort_order
         FROM event_schedule_waves WHERE event_id = ? ORDER BY sort_order ASC, starts_at ASC`,
        [eventId],
      );
      res.json({ waves: rows });
    },
  );

  // ── Organizer: course map ──────────────────────────────────────────────────
  app.get(
    "/api/organizer/events/:eventId/course",
    requireOrganizer,
    async (req: AuthedRequest, res) => {
      const organizerId = req.auth!.organizerId;
      if (!organizerId) {
        return res.status(403).json({ error: "Organizer context missing" });
      }
      const eventId = Number(req.params.eventId);
      if (!(await assertMemberCanAccessEvent(pool, req.auth!.id, organizerId, eventId))) {
        return res.status(404).json({ error: "Event not found" });
      }

      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT route_geojson, points_json, distance_km, elevation_gain_m, elevation_profile_json
         FROM event_courses WHERE event_id = ? LIMIT 1`,
        [eventId],
      );
      const row = rows[0];
      if (!row) {
        return res.json({ course: null });
      }

      let elevationProfile = null;
      try {
        elevationProfile =
          typeof row.elevation_profile_json === "string"
            ? JSON.parse(row.elevation_profile_json as string)
            : row.elevation_profile_json;
      } catch {
        elevationProfile = null;
      }

      res.json({
        course: {
          routeGeojson:
            typeof row.route_geojson === "string"
              ? JSON.parse(row.route_geojson as string)
              : row.route_geojson,
          points:
            typeof row.points_json === "string"
              ? JSON.parse(row.points_json as string)
              : row.points_json,
          distanceKm: row.distance_km,
          elevationGainM: row.elevation_gain_m,
          elevationProfile,
        },
      });
    },
  );

  app.put(
    "/api/organizer/events/:eventId/course",
    requireOrganizer,
    async (req: AuthedRequest, res) => {
      const organizerId = req.auth!.organizerId;
      if (!organizerId) {
        return res.status(403).json({ error: "Organizer context missing" });
      }
      const eventId = Number(req.params.eventId);
      if (!(await assertMemberCanAccessEvent(pool, req.auth!.id, organizerId, eventId))) {
        return res.status(404).json({ error: "Event not found" });
      }

      const routeGeojson = req.body?.routeGeojson;
      const points = req.body?.points;
      if (!routeGeojson || !Array.isArray(points)) {
        return res.status(400).json({ error: "routeGeojson and points array required" });
      }

      const distanceKm =
        req.body?.distanceKm != null && req.body.distanceKm !== ""
          ? Number(req.body.distanceKm)
          : null;
      const elevationGainM =
        req.body?.elevationGainM != null && req.body.elevationGainM !== ""
          ? Math.max(0, Number(req.body.elevationGainM))
          : null;
      const elevationProfile =
        req.body?.elevationProfile != null ? req.body.elevationProfile : null;

      await pool.query<ResultSetHeader>(
        `INSERT INTO event_courses (event_id, route_geojson, points_json, distance_km, elevation_gain_m, elevation_profile_json)
         VALUES (?,?,?,?,?,?)
         ON DUPLICATE KEY UPDATE
           route_geojson = VALUES(route_geojson),
           points_json = VALUES(points_json),
           distance_km = VALUES(distance_km),
           elevation_gain_m = VALUES(elevation_gain_m),
           elevation_profile_json = VALUES(elevation_profile_json),
           updated_at = NOW()`,
        [
          eventId,
          JSON.stringify(routeGeojson),
          JSON.stringify(points),
          distanceKm,
          elevationGainM,
          elevationProfile ? JSON.stringify(elevationProfile) : null,
        ],
      );

      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT route_geojson, points_json, distance_km, elevation_gain_m, elevation_profile_json
         FROM event_courses WHERE event_id = ? LIMIT 1`,
        [eventId],
      );
      const row = rows[0];
      let elevationProfileOut = null;
      try {
        elevationProfileOut =
          typeof row.elevation_profile_json === "string"
            ? JSON.parse(row.elevation_profile_json as string)
            : row.elevation_profile_json;
      } catch {
        elevationProfileOut = null;
      }
      res.json({
        course: {
          routeGeojson:
            typeof row.route_geojson === "string"
              ? JSON.parse(row.route_geojson as string)
              : row.route_geojson,
          points:
            typeof row.points_json === "string"
              ? JSON.parse(row.points_json as string)
              : row.points_json,
          distanceKm: row.distance_km,
          elevationGainM: row.elevation_gain_m,
          elevationProfile: elevationProfileOut,
        },
      });
    },
  );

  // ── Organizer: discount codes ──────────────────────────────────────────────
  app.get(
    "/api/organizer/events/:eventId/discount-codes",
    requireOrganizer,
    async (req: AuthedRequest, res) => {
      const organizerId = req.auth!.organizerId;
      if (!organizerId) {
        return res.status(403).json({ error: "Organizer context missing" });
      }
      const eventId = Number(req.params.eventId);
      if (!(await assertMemberCanAccessEvent(pool, req.auth!.id, organizerId, eventId))) {
        return res.status(404).json({ error: "Event not found" });
      }

      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT id, event_id, code, description, discount_type, discount_value, applies_to,
                max_uses, ${DISCOUNT_USED_COUNT_SQL} AS used_count, min_purchase_cents, valid_from, valid_until, is_active, created_at
         FROM discount_codes
         WHERE event_id = ? AND organizer_id = ?
         ORDER BY created_at DESC`,
        [eventId, organizerId],
      );
      res.json({ discountCodes: rows });
    },
  );

  app.post(
    "/api/organizer/events/:eventId/discount-codes",
    requireOrganizer,
    async (req: AuthedRequest, res) => {
      const organizerId = req.auth!.organizerId;
      if (!organizerId) {
        return res.status(403).json({ error: "Organizer context missing" });
      }
      const eventId = Number(req.params.eventId);
      if (!(await assertMemberCanAccessEvent(pool, req.auth!.id, organizerId, eventId))) {
        return res.status(404).json({ error: "Event not found" });
      }

      const code = String(req.body?.code ?? "")
        .trim()
        .toUpperCase()
        .slice(0, 40);
      const discount_value = Number(req.body?.discount_value);
      if (!code || !Number.isFinite(discount_value) || discount_value <= 0) {
        return res.status(400).json({ error: "code and discount_value required" });
      }

      const discount_type = String(req.body?.discount_type ?? "percent");
      if (!["percent", "fixed_cents"].includes(discount_type)) {
        return res.status(400).json({ error: "Invalid discount_type" });
      }
      if (discount_type === "percent" && discount_value > 100) {
        return res.status(400).json({ error: "Percent discount cannot exceed 100" });
      }

      const applies_to = String(req.body?.applies_to ?? "registration");
      if (!["registration", "service_fee", "total"].includes(applies_to)) {
        return res.status(400).json({ error: "Invalid applies_to" });
      }

      try {
        const [result] = await pool.query<ResultSetHeader>(
          `INSERT INTO discount_codes (
             event_id, organizer_id, code, description, discount_type, discount_value,
             applies_to, max_uses, min_purchase_cents, valid_from, valid_until, is_active
           ) VALUES (?,?,?,?,?,?,?,?,?,?,?,1)`,
          [
            eventId,
            organizerId,
            code,
            req.body?.description ? String(req.body.description).slice(0, 255) : null,
            discount_type,
            Math.round(discount_value),
            applies_to,
            req.body?.max_uses != null ? Math.max(0, Number(req.body.max_uses)) : null,
            req.body?.min_purchase_cents != null
              ? Math.max(0, Number(req.body.min_purchase_cents))
              : null,
            req.body?.valid_from || null,
            req.body?.valid_until || null,
          ],
        );

        const [rows] = await pool.query<RowDataPacket[]>(
          `SELECT id, event_id, code, description, discount_type, discount_value, applies_to,
                  max_uses, ${DISCOUNT_USED_COUNT_SQL} AS used_count, min_purchase_cents, valid_from, valid_until, is_active, created_at
           FROM discount_codes WHERE id = ? LIMIT 1`,
          [result.insertId],
        );
        res.status(201).json({ discountCode: rows[0] });
      } catch (err: unknown) {
        const mysqlErr = err as { code?: string };
        if (mysqlErr.code === "ER_DUP_ENTRY") {
          return res.status(409).json({ error: "Discount code already exists for this event" });
        }
        throw err;
      }
    },
  );

  app.patch(
    "/api/organizer/events/:eventId/discount-codes/:codeId",
    requireOrganizer,
    async (req: AuthedRequest, res) => {
      const organizerId = req.auth!.organizerId;
      if (!organizerId) {
        return res.status(403).json({ error: "Organizer context missing" });
      }
      const eventId = Number(req.params.eventId);
      const codeId = Number(req.params.codeId);
      if (!(await assertMemberCanAccessEvent(pool, req.auth!.id, organizerId, eventId))) {
        return res.status(404).json({ error: "Event not found" });
      }

      const [existing] = await pool.query<RowDataPacket[]>(
        `SELECT id FROM discount_codes
         WHERE id = ? AND event_id = ? AND organizer_id = ? LIMIT 1`,
        [codeId, eventId, organizerId],
      );
      if (existing.length === 0) {
        return res.status(404).json({ error: "Discount code not found" });
      }

      const updates: string[] = [];
      const params: unknown[] = [];

      if (req.body?.description !== undefined) {
        updates.push("description = ?");
        params.push(
          req.body.description ? String(req.body.description).slice(0, 255) : null,
        );
      }
      if (req.body?.discount_type != null) {
        const dt = String(req.body.discount_type);
        if (!["percent", "fixed_cents"].includes(dt)) {
          return res.status(400).json({ error: "Invalid discount_type" });
        }
        updates.push("discount_type = ?");
        params.push(dt);
      }
      if (req.body?.discount_value != null) {
        const dv = Math.round(Number(req.body.discount_value));
        if (!Number.isFinite(dv) || dv <= 0) {
          return res.status(400).json({ error: "Invalid discount_value" });
        }
        updates.push("discount_value = ?");
        params.push(dv);
      }
      if (req.body?.applies_to != null) {
        const at = String(req.body.applies_to);
        if (!["registration", "service_fee", "total"].includes(at)) {
          return res.status(400).json({ error: "Invalid applies_to" });
        }
        updates.push("applies_to = ?");
        params.push(at);
      }
      if (req.body?.max_uses !== undefined) {
        updates.push("max_uses = ?");
        params.push(
          req.body.max_uses != null ? Math.max(0, Number(req.body.max_uses)) : null,
        );
      }
      if (req.body?.min_purchase_cents !== undefined) {
        updates.push("min_purchase_cents = ?");
        params.push(
          req.body.min_purchase_cents != null
            ? Math.max(0, Number(req.body.min_purchase_cents))
            : null,
        );
      }
      if (req.body?.valid_from !== undefined) {
        updates.push("valid_from = ?");
        params.push(req.body.valid_from || null);
      }
      if (req.body?.valid_until !== undefined) {
        updates.push("valid_until = ?");
        params.push(req.body.valid_until || null);
      }
      if (req.body?.is_active !== undefined) {
        updates.push("is_active = ?");
        params.push(req.body.is_active ? 1 : 0);
      }

      if (updates.length === 0) {
        return res.status(400).json({ error: "No fields to update" });
      }

      params.push(codeId);
      await pool.query<ResultSetHeader>(
        `UPDATE discount_codes SET ${updates.join(", ")} WHERE id = ?`,
        params,
      );

      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT id, event_id, code, description, discount_type, discount_value, applies_to,
                max_uses, ${DISCOUNT_USED_COUNT_SQL} AS used_count, min_purchase_cents, valid_from, valid_until, is_active, created_at
         FROM discount_codes WHERE id = ? LIMIT 1`,
        [codeId],
      );
      res.json({ discountCode: rows[0] });
    },
  );

  app.delete(
    "/api/organizer/events/:eventId/discount-codes/:codeId",
    requireOrganizer,
    async (req: AuthedRequest, res) => {
      const organizerId = req.auth!.organizerId;
      if (!organizerId) {
        return res.status(403).json({ error: "Organizer context missing" });
      }
      const eventId = Number(req.params.eventId);
      const codeId = Number(req.params.codeId);
      if (!(await assertMemberCanAccessEvent(pool, req.auth!.id, organizerId, eventId))) {
        return res.status(404).json({ error: "Event not found" });
      }

      const [result] = await pool.query<ResultSetHeader>(
        `DELETE FROM discount_codes
         WHERE id = ? AND event_id = ? AND organizer_id = ?`,
        [codeId, eventId, organizerId],
      );
      if (result.affectedRows === 0) {
        return res.status(404).json({ error: "Discount code not found" });
      }
      res.json({ ok: true });
    },
  );

  // ── Organizer: cancel registration (no Stripe refund) ────────────────────────
  app.patch(
    "/api/organizer/registrations/:registrationId/cancel",
    requireOrganizer,
    async (req: AuthedRequest, res) => {
      const organizerId = req.auth!.organizerId;
      if (!organizerId) {
        return res.status(403).json({ error: "Organizer context missing" });
      }
      const registrationId = Number(req.params.registrationId);

      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT r.id, r.status, r.event_category_id, r.schedule_wave_id
         FROM registrations r
         JOIN events e ON e.id = r.event_id AND e.organizer_id = ?
         WHERE r.id = ? AND r.deleted_at IS NULL LIMIT 1`,
        [organizerId, registrationId],
      );
      if (rows.length === 0) {
        return res.status(404).json({ error: "Registration not found" });
      }

      const reg = rows[0];
      if (reg.status === "cancelled") {
        return res.status(409).json({ error: "Registration is already cancelled" });
      }
      if (reg.status === "refunded" || reg.status === "transferred") {
        return res.status(400).json({ error: "Registration cannot be cancelled" });
      }

      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();
        await conn.query<ResultSetHeader>(
          "UPDATE registrations SET status = 'cancelled' WHERE id = ?",
          [registrationId],
        );
        if (reg.status === "confirmed") {
          await conn.query<ResultSetHeader>(
            "UPDATE event_categories SET sold_count = GREATEST(0, sold_count - 1) WHERE id = ?",
            [reg.event_category_id],
          );
          if (reg.schedule_wave_id) {
            await conn.query<ResultSetHeader>(
              `UPDATE event_schedule_waves
               SET registered_count = GREATEST(0, registered_count - 1)
               WHERE id = ?`,
              [reg.schedule_wave_id],
            );
          }
        }
        await conn.commit();
      } catch (err) {
        await conn.rollback();
        throw err;
      } finally {
        conn.release();
      }

      const [updated] = await pool.query<RowDataPacket[]>(
        `SELECT r.id, r.registration_number, r.bib_number, r.status, r.total_cents, r.created_at,
                e.title AS event_title, e.slug AS event_slug,
                ec.name AS category_name,
                a.first_name AS athlete_first_name, a.last_name AS athlete_last_name,
                a.email AS athlete_email, r.checked_in_at
         FROM registrations r
         JOIN events e ON e.id = r.event_id
         JOIN event_categories ec ON ec.id = r.event_category_id
         JOIN athletes a ON a.id = r.athlete_id
         WHERE r.id = ? LIMIT 1`,
        [registrationId],
      );
      res.json({ ok: true, registration: updated[0] });
    },
  );

  // ── Organizer: waitlist ────────────────────────────────────────────────────
  app.get(
    "/api/organizer/events/:eventId/waitlist",
    requireOrganizer,
    async (req: AuthedRequest, res) => {
      const organizerId = req.auth!.organizerId;
      if (!organizerId) {
        return res.status(403).json({ error: "Organizer context missing" });
      }
      const eventId = Number(req.params.eventId);
      if (!(await assertMemberCanAccessEvent(pool, req.auth!.id, organizerId, eventId))) {
        return res.status(404).json({ error: "Event not found" });
      }

      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT w.id, w.event_id, w.event_category_id, w.athlete_id, w.status, w.position,
                w.offered_at, w.offer_expires_at, w.created_at,
                ec.name AS category_name,
                a.first_name AS athlete_first_name, a.last_name AS athlete_last_name,
                a.email AS athlete_email
         FROM waitlist_entries w
         JOIN event_categories ec ON ec.id = w.event_category_id
         JOIN athletes a ON a.id = w.athlete_id
         WHERE w.event_id = ?
         ORDER BY w.event_category_id ASC, w.position ASC, w.created_at ASC`,
        [eventId],
      );
      res.json({ entries: rows });
    },
  );

  app.post(
    "/api/organizer/events/:eventId/waitlist/offer",
    requireOrganizer,
    async (req: AuthedRequest, res) => {
      const organizerId = req.auth!.organizerId;
      if (!organizerId) {
        return res.status(403).json({ error: "Organizer context missing" });
      }
      const eventId = Number(req.params.eventId);
      if (!(await assertMemberCanAccessEvent(pool, req.auth!.id, organizerId, eventId))) {
        return res.status(404).json({ error: "Event not found" });
      }

      const waitlistEntryId = Number(req.body?.waitlistEntryId);
      const offerExpiresHours = Math.min(
        168,
        Math.max(1, Number(req.body?.offerExpiresHours ?? 24) || 24),
      );

      if (!Number.isFinite(waitlistEntryId)) {
        return res.status(400).json({ error: "waitlistEntryId required" });
      }

      const [entryRows] = await pool.query<RowDataPacket[]>(
        `SELECT w.id, w.event_id, w.event_category_id, w.athlete_id, w.status,
                e.title AS event_title, e.slug AS event_slug,
                ec.name AS category_name,
                a.email AS athlete_email, a.first_name AS athlete_first_name,
                a.preferred_language
         FROM waitlist_entries w
         JOIN events e ON e.id = w.event_id
         JOIN event_categories ec ON ec.id = w.event_category_id
         JOIN athletes a ON a.id = w.athlete_id
         WHERE w.id = ? AND w.event_id = ? LIMIT 1`,
        [waitlistEntryId, eventId],
      );
      if (entryRows.length === 0) {
        return res.status(404).json({ error: "Waitlist entry not found" });
      }
      const entry = entryRows[0];
      if (entry.status !== "waiting") {
        return res.status(409).json({ error: "Entry is not in waiting status" });
      }

      await pool.query<ResultSetHeader>(
        `UPDATE waitlist_entries
         SET status = 'offered', offered_at = NOW(),
             offer_expires_at = DATE_ADD(NOW(), INTERVAL ? HOUR)
         WHERE id = ?`,
        [offerExpiresHours, waitlistEntryId],
      );

      const athleteEmail = entry.athlete_email as string | null;
      if (athleteEmail) {
        const locale = entry.preferred_language === "en" ? "en" : "es";
        const eventUrl = `${appUrl}/events/${entry.event_slug}`;
        const subject =
          locale === "en"
            ? `Spot available: ${entry.event_title}`
            : `Cupo disponible: ${entry.event_title}`;
        const body =
          locale === "en"
            ? `Hi ${entry.athlete_first_name},\n\nA spot has opened for ${entry.category_name} at ${entry.event_title}. Register within ${offerExpiresHours} hours:\n${eventUrl}`
            : `Hola ${entry.athlete_first_name},\n\nSe abrió un cupo para ${entry.category_name} en ${entry.event_title}. Regístrate en las próximas ${offerExpiresHours} horas:\n${eventUrl}`;

        await pool.query<ResultSetHeader>(
          `INSERT INTO notification_queue (
             recipient_type, recipient_id, channel, to_address, subject, body, payload_json
           ) VALUES ('athlete', ?, 'email', ?, ?, ?, ?)`,
          [
            entry.athlete_id,
            athleteEmail,
            subject,
            body,
            JSON.stringify({
              type: "waitlist_offer",
              waitlist_entry_id: waitlistEntryId,
              event_id: eventId,
              event_slug: entry.event_slug,
            }),
          ],
        );

        void sendEmail({
          to: athleteEmail,
          subject,
          text: body,
          html: body.replace(/\n/g, "<br>"),
        }).catch((err) => console.error("[email:waitlist-offer]", err));
      }

      const [updated] = await pool.query<RowDataPacket[]>(
        `SELECT id, event_id, event_category_id, athlete_id, status, position,
                offered_at, offer_expires_at, created_at
         FROM waitlist_entries WHERE id = ? LIMIT 1`,
        [waitlistEntryId],
      );
      res.json({ ok: true, entry: updated[0] });
    },
  );

  app.post(
    "/api/organizer/events/:eventId/waitlist/revoke",
    requireOrganizer,
    async (req: AuthedRequest, res) => {
      const organizerId = req.auth!.organizerId;
      if (!organizerId) {
        return res.status(403).json({ error: "Organizer context missing" });
      }
      const eventId = Number(req.params.eventId);
      if (!(await assertMemberCanAccessEvent(pool, req.auth!.id, organizerId, eventId))) {
        return res.status(404).json({ error: "Event not found" });
      }

      const waitlistEntryId = Number(req.body?.waitlistEntryId);
      if (!Number.isFinite(waitlistEntryId)) {
        return res.status(400).json({ error: "waitlistEntryId required" });
      }

      const [result] = await pool.query<ResultSetHeader>(
        `UPDATE waitlist_entries
         SET status = 'cancelled', offered_at = NULL, offer_expires_at = NULL
         WHERE id = ? AND event_id = ? AND status IN ('waiting', 'offered')`,
        [waitlistEntryId, eventId],
      );
      if (result.affectedRows === 0) {
        return res.status(404).json({ error: "Waitlist entry not found or already resolved" });
      }

      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT w.id, w.event_id, w.event_category_id, w.athlete_id, w.status, w.position,
                w.offered_at, w.offer_expires_at, w.created_at,
                ec.name AS category_name,
                a.first_name AS athlete_first_name, a.last_name AS athlete_last_name,
                a.email AS athlete_email
         FROM waitlist_entries w
         JOIN event_categories ec ON ec.id = w.event_category_id
         JOIN athletes a ON a.id = w.athlete_id
         WHERE w.event_id = ?
         ORDER BY w.event_category_id ASC, w.position ASC, w.created_at ASC`,
        [eventId],
      );
      res.json({ ok: true, entries: rows });
    },
  );

  // ── Organizer: bulk bib import ─────────────────────────────────────────────
  app.post(
    "/api/organizer/registrations/bulk-bib",
    requireOrganizer,
    async (req: AuthedRequest, res) => {
      const organizerId = req.auth!.organizerId;
      if (!organizerId) {
        return res.status(403).json({ error: "Organizer context missing" });
      }

      const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
      if (rows.length === 0) {
        return res.status(400).json({ error: "rows array required" });
      }
      if (rows.length > 500) {
        return res.status(400).json({ error: "Maximum 500 rows per import" });
      }

      let updated = 0;
      const errors: Array<{ folio: string; error: string }> = [];

      for (const row of rows) {
        const folio = String(row?.folio ?? "").trim();
        const bib = String(row?.bib ?? "").trim().slice(0, 20);
        if (!folio || !bib) {
          errors.push({ folio: folio || "?", error: "folio and bib required" });
          continue;
        }

        const [regRows] = await pool.query<RowDataPacket[]>(
          `SELECT r.id, r.event_id, r.bib_number
           FROM registrations r
           JOIN events e ON e.id = r.event_id AND e.organizer_id = ?
           WHERE r.registration_number = ? AND r.deleted_at IS NULL LIMIT 1`,
          [organizerId, folio],
        );
        if (regRows.length === 0) {
          errors.push({ folio, error: "Registration not found" });
          continue;
        }
        const reg = regRows[0];

        const [dup] = await pool.query<RowDataPacket[]>(
          `SELECT id FROM registrations
           WHERE event_id = ? AND bib_number = ? AND id <> ? AND deleted_at IS NULL LIMIT 1`,
          [reg.event_id, bib, reg.id],
        );
        if (dup.length > 0) {
          errors.push({ folio, error: "Bib number already assigned in this event" });
          continue;
        }

        await pool.query<ResultSetHeader>(
          "UPDATE registrations SET bib_number = ? WHERE id = ?",
          [bib, reg.id],
        );
        updated += 1;
      }

      res.json({ updated, errors });
    },
  );


  // ── Organizer: event media ───────────────────────────────────────────────────
  app.get(
    "/api/organizer/events/:eventId/media",
    requireOrganizer,
    async (req: AuthedRequest, res) => {
      const organizerId = req.auth!.organizerId;
      if (!organizerId) {
        return res.status(403).json({ error: "Organizer context missing" });
      }
      const eventId = Number(req.params.eventId);
      if (!(await assertMemberCanAccessEvent(pool, req.auth!.id, organizerId, eventId))) {
        return res.status(404).json({ error: "Event not found" });
      }

      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT id, public_uuid, asset_type, url, alt_text, mime_type,
                file_size_bytes, width_px, height_px, sort_order, is_primary
         FROM media_assets
         WHERE entity_type = 'event' AND entity_id = ? AND deleted_at IS NULL
         ORDER BY sort_order ASC, id ASC`,
        [eventId],
      );
      res.json({ media: rows });
    },
  );

  app.put(
    "/api/organizer/events/:eventId/media",
    requireOrganizer,
    async (req: AuthedRequest, res) => {
      const organizerId = req.auth!.organizerId;
      if (!organizerId) {
        return res.status(403).json({ error: "Organizer context missing" });
      }
      const eventId = Number(req.params.eventId);
      if (!(await assertMemberCanAccessEvent(pool, req.auth!.id, organizerId, eventId))) {
        return res.status(404).json({ error: "Event not found" });
      }

      const raw = req.body?.media;
      if (!Array.isArray(raw)) {
        return res.status(400).json({ error: "media array required" });
      }

      const validAssetTypes = new Set([
        "hero",
        "banner",
        "logo",
        "gallery",
        "document",
        "route_map",
        "other",
      ]);

      const mediaItems = raw
        .map((m: Record<string, unknown>, index: number) => {
          const url = String(m.url ?? "").trim();
          if (!url) return null;
          const asset_type = String(m.asset_type ?? "other");
          if (!validAssetTypes.has(asset_type)) return null;
          return {
            asset_type,
            url: url.slice(0, 1000),
            alt_text: m.alt_text ? String(m.alt_text).trim().slice(0, 255) : null,
            mime_type: m.mime_type ? String(m.mime_type).trim().slice(0, 100) : null,
            file_size_bytes:
              m.file_size_bytes != null ? Number(m.file_size_bytes) || null : null,
            width_px: m.width_px != null ? Number(m.width_px) || null : null,
            height_px: m.height_px != null ? Number(m.height_px) || null : null,
            sort_order: Number(m.sort_order) || index,
            is_primary: m.is_primary ? 1 : 0,
          };
        })
        .filter(Boolean) as Array<{
        asset_type: string;
        url: string;
        alt_text: string | null;
        mime_type: string | null;
        file_size_bytes: number | null;
        width_px: number | null;
        height_px: number | null;
        sort_order: number;
        is_primary: number;
      }>;

      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();
        await conn.query(
          `UPDATE media_assets SET deleted_at = NOW()
           WHERE entity_type = 'event' AND entity_id = ? AND deleted_at IS NULL`,
          [eventId],
        );
        for (const item of mediaItems) {
          await conn.query<ResultSetHeader>(
            `INSERT INTO media_assets (
               public_uuid, entity_type, entity_id, asset_type, url, alt_text, mime_type,
               file_size_bytes, width_px, height_px, sort_order, is_primary
             ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
            [
              newPublicUuid(),
              "event",
              eventId,
              item.asset_type,
              item.url,
              item.alt_text,
              item.mime_type,
              item.file_size_bytes,
              item.width_px,
              item.height_px,
              item.sort_order,
              item.is_primary,
            ],
          );
        }
        await conn.commit();
      } catch (err) {
        await conn.rollback();
        throw err;
      } finally {
        conn.release();
      }

      const [saved] = await pool.query<RowDataPacket[]>(
        `SELECT id, public_uuid, asset_type, url, alt_text, mime_type,
                file_size_bytes, width_px, height_px, sort_order, is_primary
         FROM media_assets
         WHERE entity_type = 'event' AND entity_id = ? AND deleted_at IS NULL
         ORDER BY sort_order ASC, id ASC`,
        [eventId],
      );
      res.json({ media: saved });
    },
  );

  // ── Admin: course / waves (mirror organizer, any event) ────────────────────
  async function adminEventExists(eventId: number): Promise<boolean> {
    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT id FROM events WHERE id = ? AND deleted_at IS NULL LIMIT 1",
      [eventId],
    );
    return rows.length > 0;
  }

  app.get("/api/admin/events/:eventId/course", requireAdmin, async (req, res) => {
    const eventId = Number(req.params.eventId);
    if (!(await adminEventExists(eventId))) {
      return res.status(404).json({ error: "Event not found" });
    }
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT route_geojson, points_json, distance_km, elevation_gain_m, elevation_profile_json
       FROM event_courses WHERE event_id = ? LIMIT 1`,
      [eventId],
    );
    const row = rows[0];
    if (!row) return res.json({ course: null });
    let elevationProfile = null;
    try {
      elevationProfile =
        typeof row.elevation_profile_json === "string"
          ? JSON.parse(row.elevation_profile_json as string)
          : row.elevation_profile_json;
    } catch {
      elevationProfile = null;
    }
    res.json({
      course: {
        routeGeojson:
          typeof row.route_geojson === "string"
            ? JSON.parse(row.route_geojson as string)
            : row.route_geojson,
        points:
          typeof row.points_json === "string"
            ? JSON.parse(row.points_json as string)
            : row.points_json,
        distanceKm: row.distance_km,
        elevationGainM: row.elevation_gain_m,
        elevationProfile,
      },
    });
  });

  app.put("/api/admin/events/:eventId/course", requireAdmin, async (req, res) => {
    const eventId = Number(req.params.eventId);
    if (!(await adminEventExists(eventId))) {
      return res.status(404).json({ error: "Event not found" });
    }
    const routeGeojson = req.body?.routeGeojson;
    const points = req.body?.points;
    if (!routeGeojson || !Array.isArray(points)) {
      return res.status(400).json({ error: "routeGeojson and points array required" });
    }
    const distanceKm =
      req.body?.distanceKm != null && req.body.distanceKm !== ""
        ? Number(req.body.distanceKm)
        : null;
    const elevationGainM =
      req.body?.elevationGainM != null && req.body.elevationGainM !== ""
        ? Math.max(0, Number(req.body.elevationGainM))
        : null;
    const elevationProfile =
      req.body?.elevationProfile != null ? req.body.elevationProfile : null;
    await pool.query<ResultSetHeader>(
      `INSERT INTO event_courses (event_id, route_geojson, points_json, distance_km, elevation_gain_m, elevation_profile_json)
       VALUES (?,?,?,?,?,?)
       ON DUPLICATE KEY UPDATE
         route_geojson = VALUES(route_geojson),
         points_json = VALUES(points_json),
         distance_km = VALUES(distance_km),
         elevation_gain_m = VALUES(elevation_gain_m),
         elevation_profile_json = VALUES(elevation_profile_json),
         updated_at = NOW()`,
      [
        eventId,
        JSON.stringify(routeGeojson),
        JSON.stringify(points),
        distanceKm,
        elevationGainM,
        elevationProfile ? JSON.stringify(elevationProfile) : null,
      ],
    );
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT route_geojson, points_json, distance_km, elevation_gain_m, elevation_profile_json
       FROM event_courses WHERE event_id = ? LIMIT 1`,
      [eventId],
    );
    const row = rows[0];
    let elevationProfileOut = null;
    try {
      elevationProfileOut =
        typeof row.elevation_profile_json === "string"
          ? JSON.parse(row.elevation_profile_json as string)
          : row.elevation_profile_json;
    } catch {
      elevationProfileOut = null;
    }
    res.json({
      course: {
        routeGeojson:
          typeof row.route_geojson === "string"
            ? JSON.parse(row.route_geojson as string)
            : row.route_geojson,
        points:
          typeof row.points_json === "string"
            ? JSON.parse(row.points_json as string)
            : row.points_json,
        distanceKm: row.distance_km,
        elevationGainM: row.elevation_gain_m,
        elevationProfile: elevationProfileOut,
      },
    });
  });

  app.get("/api/admin/events/:eventId/schedule-waves", requireAdmin, async (req, res) => {
    const eventId = Number(req.params.eventId);
    if (!(await adminEventExists(eventId))) {
      return res.status(404).json({ error: "Event not found" });
    }
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT id, event_category_id, name, starts_at, capacity, ${WAVE_REGISTERED_COUNT_SQL} AS registered_count, sort_order
       FROM event_schedule_waves WHERE event_id = ? ORDER BY sort_order ASC, starts_at ASC`,
      [eventId],
    );
    res.json({ waves: rows });
  });

  app.get("/api/admin/events/:eventId/discount-codes", requireAdmin, async (req, res) => {
    const eventId = Number(req.params.eventId);
    if (!(await adminEventExists(eventId))) {
      return res.status(404).json({ error: "Event not found" });
    }
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT id, event_id, code, description, discount_type, discount_value, applies_to,
              max_uses, ${DISCOUNT_USED_COUNT_SQL} AS used_count, min_purchase_cents, valid_from, valid_until, is_active, created_at
       FROM discount_codes WHERE event_id = ? ORDER BY created_at DESC`,
      [eventId],
    );
    res.json({ discountCodes: rows });
  });

  // ── Admin: waitlist, media, fields, waivers, discount mutations ─────────────
  app.get("/api/admin/events/:eventId/waitlist", requireAdmin, async (req, res) => {
    const eventId = Number(req.params.eventId);
    if (!(await adminEventExists(eventId))) {
      return res.status(404).json({ error: "Event not found" });
    }
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT w.id, w.event_id, w.event_category_id, w.athlete_id, w.status, w.position,
              w.offered_at, w.offer_expires_at, w.created_at,
              ec.name AS category_name,
              a.first_name AS athlete_first_name, a.last_name AS athlete_last_name,
              a.email AS athlete_email
       FROM waitlist_entries w
       JOIN event_categories ec ON ec.id = w.event_category_id
       JOIN athletes a ON a.id = w.athlete_id
       WHERE w.event_id = ?
       ORDER BY w.event_category_id ASC, w.position ASC, w.created_at ASC`,
      [eventId],
    );
    res.json({ entries: rows });
  });

  app.post("/api/admin/events/:eventId/waitlist/offer", requireAdmin, async (req, res) => {
    const eventId = Number(req.params.eventId);
    if (!(await adminEventExists(eventId))) {
      return res.status(404).json({ error: "Event not found" });
    }
    const waitlistEntryId = Number(req.body?.waitlistEntryId);
    const offerExpiresHours = Math.min(
      168,
      Math.max(1, Number(req.body?.offerExpiresHours ?? 24) || 24),
    );
    if (!Number.isFinite(waitlistEntryId)) {
      return res.status(400).json({ error: "waitlistEntryId required" });
    }
    const [entryRows] = await pool.query<RowDataPacket[]>(
      `SELECT w.id, w.event_id, w.event_category_id, w.athlete_id, w.status,
              e.title AS event_title, e.slug AS event_slug,
              ec.name AS category_name,
              a.email AS athlete_email, a.first_name AS athlete_first_name,
              a.preferred_language
       FROM waitlist_entries w
       JOIN events e ON e.id = w.event_id
       JOIN event_categories ec ON ec.id = w.event_category_id
       JOIN athletes a ON a.id = w.athlete_id
       WHERE w.id = ? AND w.event_id = ? LIMIT 1`,
      [waitlistEntryId, eventId],
    );
    if (entryRows.length === 0) {
      return res.status(404).json({ error: "Waitlist entry not found" });
    }
    const entry = entryRows[0];
    if (entry.status !== "waiting") {
      return res.status(409).json({ error: "Entry is not in waiting status" });
    }
    await pool.query<ResultSetHeader>(
      `UPDATE waitlist_entries
       SET status = 'offered', offered_at = NOW(),
           offer_expires_at = DATE_ADD(NOW(), INTERVAL ? HOUR)
       WHERE id = ?`,
      [offerExpiresHours, waitlistEntryId],
    );
    const athleteEmail = entry.athlete_email as string | null;
    if (athleteEmail) {
      const locale = entry.preferred_language === "en" ? "en" : "es";
      const eventUrl = `${appUrl}/events/${entry.event_slug}`;
      const subject =
        locale === "en"
          ? `Spot available: ${entry.event_title}`
          : `Cupo disponible: ${entry.event_title}`;
      const body =
        locale === "en"
          ? `Hi ${entry.athlete_first_name},\n\nA spot has opened for ${entry.category_name} at ${entry.event_title}. Register within ${offerExpiresHours} hours:\n${eventUrl}`
          : `Hola ${entry.athlete_first_name},\n\nSe abrió un cupo para ${entry.category_name} en ${entry.event_title}. Regístrate en las próximas ${offerExpiresHours} horas:\n${eventUrl}`;
      void sendEmail({
        to: athleteEmail,
        subject,
        text: body,
        html: body.replace(/\n/g, "<br>"),
      }).catch((err) => console.error("[email:waitlist-offer]", err));
    }
    const [updated] = await pool.query<RowDataPacket[]>(
      `SELECT id, event_id, event_category_id, athlete_id, status, position,
              offered_at, offer_expires_at, created_at
       FROM waitlist_entries WHERE id = ? LIMIT 1`,
      [waitlistEntryId],
    );
    res.json({ ok: true, entry: updated[0] });
  });

  app.post("/api/admin/events/:eventId/waitlist/revoke", requireAdmin, async (req, res) => {
    const eventId = Number(req.params.eventId);
    if (!(await adminEventExists(eventId))) {
      return res.status(404).json({ error: "Event not found" });
    }
    const waitlistEntryId = Number(req.body?.waitlistEntryId);
    if (!Number.isFinite(waitlistEntryId)) {
      return res.status(400).json({ error: "waitlistEntryId required" });
    }
    const [result] = await pool.query<ResultSetHeader>(
      `UPDATE waitlist_entries
       SET status = 'cancelled', offered_at = NULL, offer_expires_at = NULL
       WHERE id = ? AND event_id = ? AND status IN ('waiting', 'offered')`,
      [waitlistEntryId, eventId],
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Waitlist entry not found or already resolved" });
    }
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT w.id, w.event_id, w.event_category_id, w.athlete_id, w.status, w.position,
              w.offered_at, w.offer_expires_at, w.created_at,
              ec.name AS category_name,
              a.first_name AS athlete_first_name, a.last_name AS athlete_last_name,
              a.email AS athlete_email
       FROM waitlist_entries w
       JOIN event_categories ec ON ec.id = w.event_category_id
       JOIN athletes a ON a.id = w.athlete_id
       WHERE w.event_id = ?
       ORDER BY w.event_category_id ASC, w.position ASC, w.created_at ASC`,
      [eventId],
    );
    res.json({ ok: true, entries: rows });
  });

  app.post("/api/admin/events/:eventId/categories", requireAdmin, async (req, res) => {
    const eventId = Number(req.params.eventId);
    if (!(await adminEventExists(eventId))) {
      return res.status(404).json({ error: "Event not found" });
    }
    const err = await createEventCategoryRecord(
      pool,
      newPublicUuid,
      eventId,
      (req.body ?? {}) as Record<string, unknown>,
    );
    if (err) return res.status(err.status).json({ error: err.error });
    res.status(201).json({ categories: await fetchEventCategories(pool, eventId) });
  });

  app.patch(
    "/api/admin/events/:eventId/categories/:categoryId",
    requireAdmin,
    async (req, res) => {
      const eventId = Number(req.params.eventId);
      const categoryId = Number(req.params.categoryId);
      if (!(await adminEventExists(eventId))) {
        return res.status(404).json({ error: "Event not found" });
      }
      const err = await patchEventCategoryRecord(
        pool,
        eventId,
        categoryId,
        (req.body ?? {}) as Record<string, unknown>,
      );
      if (err) return res.status(err.status).json({ error: err.error });
      res.json({ categories: await fetchEventCategories(pool, eventId) });
    },
  );

  app.delete(
    "/api/admin/events/:eventId/categories/:categoryId",
    requireAdmin,
    async (req, res) => {
      const eventId = Number(req.params.eventId);
      const categoryId = Number(req.params.categoryId);
      if (!(await adminEventExists(eventId))) {
        return res.status(404).json({ error: "Event not found" });
      }
      const err = await deleteEventCategoryRecord(pool, eventId, categoryId);
      if (err) return res.status(err.status).json({ error: err.error });
      res.json({ categories: await fetchEventCategories(pool, eventId) });
    },
  );

  app.get("/api/admin/events/:eventId/media", requireAdmin, async (req, res) => {
    const eventId = Number(req.params.eventId);
    if (!(await adminEventExists(eventId))) {
      return res.status(404).json({ error: "Event not found" });
    }
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT id, public_uuid, asset_type, url, alt_text, mime_type,
              file_size_bytes, width_px, height_px, sort_order, is_primary
       FROM media_assets
       WHERE entity_type = 'event' AND entity_id = ? AND deleted_at IS NULL
       ORDER BY sort_order ASC, id ASC`,
      [eventId],
    );
    res.json({ media: rows });
  });

  app.put("/api/admin/events/:eventId/media", requireAdmin, async (req, res) => {
    const eventId = Number(req.params.eventId);
    if (!(await adminEventExists(eventId))) {
      return res.status(404).json({ error: "Event not found" });
    }
    const raw = req.body?.media;
    if (!Array.isArray(raw)) {
      return res.status(400).json({ error: "media array required" });
    }
    const validAssetTypes = new Set([
      "hero",
      "banner",
      "logo",
      "gallery",
      "document",
      "route_map",
      "other",
    ]);
    const mediaItems = raw
      .map((m: Record<string, unknown>, index: number) => {
        const url = String(m.url ?? "").trim();
        if (!url) return null;
        const asset_type = String(m.asset_type ?? "other");
        if (!validAssetTypes.has(asset_type)) return null;
        return {
          asset_type,
          url: url.slice(0, 1000),
          alt_text: m.alt_text ? String(m.alt_text).trim().slice(0, 255) : null,
          mime_type: m.mime_type ? String(m.mime_type).trim().slice(0, 100) : null,
          file_size_bytes:
            m.file_size_bytes != null ? Number(m.file_size_bytes) || null : null,
          width_px: m.width_px != null ? Number(m.width_px) || null : null,
          height_px: m.height_px != null ? Number(m.height_px) || null : null,
          sort_order: Number(m.sort_order) || index,
          is_primary: m.is_primary ? 1 : 0,
        };
      })
      .filter(Boolean) as Array<{
      asset_type: string;
      url: string;
      alt_text: string | null;
      mime_type: string | null;
      file_size_bytes: number | null;
      width_px: number | null;
      height_px: number | null;
      sort_order: number;
      is_primary: number;
    }>;
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      await conn.query(
        `UPDATE media_assets SET deleted_at = NOW()
         WHERE entity_type = 'event' AND entity_id = ? AND deleted_at IS NULL`,
        [eventId],
      );
      for (const item of mediaItems) {
        await conn.query<ResultSetHeader>(
          `INSERT INTO media_assets (
             public_uuid, entity_type, entity_id, asset_type, url, alt_text, mime_type,
             file_size_bytes, width_px, height_px, sort_order, is_primary
           ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
          [
            newPublicUuid(),
            "event",
            eventId,
            item.asset_type,
            item.url,
            item.alt_text,
            item.mime_type,
            item.file_size_bytes,
            item.width_px,
            item.height_px,
            item.sort_order,
            item.is_primary,
          ],
        );
      }
      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
    const [saved] = await pool.query<RowDataPacket[]>(
      `SELECT id, public_uuid, asset_type, url, alt_text, mime_type,
              file_size_bytes, width_px, height_px, sort_order, is_primary
       FROM media_assets
       WHERE entity_type = 'event' AND entity_id = ? AND deleted_at IS NULL
       ORDER BY sort_order ASC, id ASC`,
      [eventId],
    );
    res.json({ media: saved });
  });

  app.get("/api/admin/events/:eventId/registration-fields", requireAdmin, async (req, res) => {
    const eventId = Number(req.params.eventId);
    if (!(await adminEventExists(eventId))) {
      return res.status(404).json({ error: "Event not found" });
    }
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT id, field_key, label, field_type, options_json, is_required, sort_order, is_active
       FROM event_registration_fields WHERE event_id = ? ORDER BY sort_order ASC, id ASC`,
      [eventId],
    );
    res.json({ fields: rows });
  });

  app.put("/api/admin/events/:eventId/registration-fields", requireAdmin, async (req, res) => {
    const eventId = Number(req.params.eventId);
    if (!(await adminEventExists(eventId))) {
      return res.status(404).json({ error: "Event not found" });
    }
    const raw = req.body?.fields;
    if (!Array.isArray(raw)) {
      return res.status(400).json({ error: "fields array required" });
    }
    const validTypes = new Set([
      "text",
      "textarea",
      "select",
      "checkbox",
      "number",
      "date",
      "file",
    ]);
    const fields = raw
      .map((f: Record<string, unknown>, index: number) => {
        const label = String(f.label ?? "").trim();
        if (!label) return null;
        const field_type = String(f.field_type ?? "text");
        if (!validTypes.has(field_type)) return null;
        const field_key =
          String(f.field_key ?? "").trim() || fieldKeyFromLabel(label);
        const options = Array.isArray(f.options)
          ? f.options.map((o) => String(o).trim()).filter(Boolean)
          : null;
        return {
          field_key: field_key.slice(0, 80),
          label: label.slice(0, 200),
          field_type,
          options_json: options?.length ? JSON.stringify(options) : null,
          is_required: f.is_required ? 1 : 0,
          sort_order: Number(f.sort_order) || index,
          is_active: f.is_active === false ? 0 : 1,
        };
      })
      .filter(Boolean) as Array<{
      field_key: string;
      label: string;
      field_type: string;
      options_json: string | null;
      is_required: number;
      sort_order: number;
      is_active: number;
    }>;
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      await conn.query("DELETE FROM event_registration_fields WHERE event_id = ?", [
        eventId,
      ]);
      for (const f of fields) {
        await conn.query<ResultSetHeader>(
          `INSERT INTO event_registration_fields (
             event_id, field_key, label, field_type, options_json, is_required, sort_order, is_active
           ) VALUES (?,?,?,?,?,?,?,?)`,
          [
            eventId,
            f.field_key,
            f.label,
            f.field_type,
            f.options_json,
            f.is_required,
            f.sort_order,
            f.is_active,
          ],
        );
      }
      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT id, field_key, label, field_type, options_json, is_required, sort_order, is_active
       FROM event_registration_fields WHERE event_id = ? ORDER BY sort_order ASC, id ASC`,
      [eventId],
    );
    res.json({ fields: rows });
  });

  app.get("/api/admin/events/:eventId/waivers", requireAdmin, async (req, res) => {
    const eventId = Number(req.params.eventId);
    if (!(await adminEventExists(eventId))) {
      return res.status(404).json({ error: "Event not found" });
    }
    const rows = await fetchEventWaiversForStaff(pool, eventId);
    res.json({ waivers: rows });
  });

  app.put("/api/admin/events/:eventId/waivers", requireAdmin, async (req, res) => {
    const eventId = Number(req.params.eventId);
    if (!(await adminEventExists(eventId))) {
      return res.status(404).json({ error: "Event not found" });
    }
    const result = await syncEventWaivers(pool, eventId, req.body);
    if ("error" in result) {
      return res.status(result.status).json({ error: result.error });
    }
    res.json({ waivers: result.waivers });
  });

  app.post("/api/admin/events/:eventId/discount-codes", requireAdmin, async (req, res) => {
    const eventId = Number(req.params.eventId);
    if (!(await adminEventExists(eventId))) {
      return res.status(404).json({ error: "Event not found" });
    }
    const [[eventRow]] = await pool.query<RowDataPacket[]>(
      "SELECT organizer_id FROM events WHERE id = ? LIMIT 1",
      [eventId],
    );
    const organizerId = Number(eventRow?.organizer_id);
    if (!Number.isFinite(organizerId)) {
      return res.status(400).json({ error: "Event has no organizer" });
    }
    const code = String(req.body?.code ?? "")
      .trim()
      .toUpperCase()
      .slice(0, 40);
    const discount_value = Number(req.body?.discount_value);
    if (!code || !Number.isFinite(discount_value) || discount_value <= 0) {
      return res.status(400).json({ error: "code and discount_value required" });
    }
    const discount_type = String(req.body?.discount_type ?? "percent");
    if (!["percent", "fixed_cents"].includes(discount_type)) {
      return res.status(400).json({ error: "Invalid discount_type" });
    }
    if (discount_type === "percent" && discount_value > 100) {
      return res.status(400).json({ error: "Percent discount cannot exceed 100" });
    }
    const applies_to = String(req.body?.applies_to ?? "registration");
    if (!["registration", "service_fee", "total"].includes(applies_to)) {
      return res.status(400).json({ error: "Invalid applies_to" });
    }
    try {
      const [result] = await pool.query<ResultSetHeader>(
        `INSERT INTO discount_codes (
           event_id, organizer_id, code, description, discount_type, discount_value,
           applies_to, max_uses, min_purchase_cents, valid_from, valid_until, is_active
         ) VALUES (?,?,?,?,?,?,?,?,?,?,?,1)`,
        [
          eventId,
          organizerId,
          code,
          req.body?.description ? String(req.body.description).slice(0, 255) : null,
          discount_type,
          Math.round(discount_value),
          applies_to,
          req.body?.max_uses != null ? Math.max(0, Number(req.body.max_uses)) : null,
          req.body?.min_purchase_cents != null
            ? Math.max(0, Number(req.body.min_purchase_cents))
            : null,
          req.body?.valid_from || null,
          req.body?.valid_until || null,
        ],
      );
      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT id, event_id, code, description, discount_type, discount_value, applies_to,
                max_uses, ${DISCOUNT_USED_COUNT_SQL} AS used_count, min_purchase_cents, valid_from, valid_until, is_active, created_at
         FROM discount_codes WHERE id = ? LIMIT 1`,
        [result.insertId],
      );
      res.status(201).json({ discountCode: rows[0] });
    } catch (err: unknown) {
      const mysqlErr = err as { code?: string };
      if (mysqlErr.code === "ER_DUP_ENTRY") {
        return res.status(409).json({ error: "Discount code already exists for this event" });
      }
      throw err;
    }
  });

  app.patch(
    "/api/admin/events/:eventId/discount-codes/:codeId",
    requireAdmin,
    async (req, res) => {
      const eventId = Number(req.params.eventId);
      const codeId = Number(req.params.codeId);
      if (!(await adminEventExists(eventId))) {
        return res.status(404).json({ error: "Event not found" });
      }
      const [existing] = await pool.query<RowDataPacket[]>(
        "SELECT id FROM discount_codes WHERE id = ? AND event_id = ? LIMIT 1",
        [codeId, eventId],
      );
      if (existing.length === 0) {
        return res.status(404).json({ error: "Discount code not found" });
      }
      const updates: string[] = [];
      const params: unknown[] = [];
      if (req.body?.description !== undefined) {
        updates.push("description = ?");
        params.push(
          req.body.description ? String(req.body.description).slice(0, 255) : null,
        );
      }
      if (req.body?.is_active !== undefined) {
        updates.push("is_active = ?");
        params.push(req.body.is_active ? 1 : 0);
      }
      if (updates.length === 0) {
        return res.status(400).json({ error: "No fields to update" });
      }
      params.push(codeId);
      await pool.query<ResultSetHeader>(
        `UPDATE discount_codes SET ${updates.join(", ")} WHERE id = ?`,
        params,
      );
      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT id, event_id, code, description, discount_type, discount_value, applies_to,
                max_uses, ${DISCOUNT_USED_COUNT_SQL} AS used_count, min_purchase_cents, valid_from, valid_until, is_active, created_at
         FROM discount_codes WHERE id = ? LIMIT 1`,
        [codeId],
      );
      res.json({ discountCode: rows[0] });
    },
  );

  app.delete(
    "/api/admin/events/:eventId/discount-codes/:codeId",
    requireAdmin,
    async (req, res) => {
      const eventId = Number(req.params.eventId);
      const codeId = Number(req.params.codeId);
      if (!(await adminEventExists(eventId))) {
        return res.status(404).json({ error: "Event not found" });
      }
      const [result] = await pool.query<ResultSetHeader>(
        "DELETE FROM discount_codes WHERE id = ? AND event_id = ?",
        [codeId, eventId],
      );
      if (result.affectedRows === 0) {
        return res.status(404).json({ error: "Discount code not found" });
      }
      res.json({ ok: true });
    },
  );

  app.post(
    "/api/admin/events",
    requireAdmin,
    async (req: AuthedRequest, res) => {
      const organizer_id = Number(req.body?.organizer_id);
      if (!Number.isFinite(organizer_id) || organizer_id <= 0) {
        return res.status(400).json({ error: "organizer_id required" });
      }

      const [orgRows] = await pool.query<RowDataPacket[]>(
        "SELECT id FROM organizers WHERE id = ? AND deleted_at IS NULL LIMIT 1",
        [organizer_id],
      );
      if (orgRows.length === 0) {
        return res.status(400).json({ error: "Invalid organizer_id" });
      }

      const parsed = parseEventBody((req.body ?? {}) as Record<string, unknown>);
      if ("error" in parsed) {
        return res.status(400).json({ error: parsed.error });
      }
      const { data } = parsed;
      const baseSlug = slugify(data.slug || data.title);
      const slug = await uniqueEventSlug(pool, baseSlug);

      const [sportRows] = await pool.query<RowDataPacket[]>(
        "SELECT id FROM sport_types WHERE id = ? AND is_active = 1 LIMIT 1",
        [data.sport_type_id],
      );
      if (sportRows.length === 0) {
        return res.status(400).json({ error: "Invalid sport_type_id" });
      }

      const [result] = await pool.query<ResultSetHeader>(
        `INSERT INTO events (
           public_uuid, organizer_id, sport_type_id, slug, title, short_description, description,
           status, visibility, featured, start_date, end_date, registration_opens_at,
           registration_closes_at, location_name, location_city, location_state, location_lat, location_lng,
           hero_image_url, banner_image_url, max_registrations, requires_waiver
         ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          newPublicUuid(),
          organizer_id,
          data.sport_type_id,
          slug,
          data.title,
          data.short_description,
          data.description,
          "draft",
          data.visibility,
          data.featured ? 1 : 0,
          data.start_date,
          data.end_date,
          data.registration_opens_at,
          data.registration_closes_at,
          ...eventBodySqlValues(data),
          data.requires_waiver ? 1 : 0,
        ],
      );

      const event = await fetchStaffEventDetail(pool, result.insertId);
      res.status(201).json({ event, categories: [] });
    },
  );

  app.get("/api/admin/organizers", requireAdmin, async (req, res) => {
    const q = String(req.query.q ?? "").trim();
    const pageRaw = req.query.page;
    if (pageRaw != null && String(pageRaw).trim() !== "") {
      const status = String(req.query.status ?? "").trim();
      const result = await listAdminOrganizers(pool, {
        q: q || undefined,
        status: status || undefined,
        page: req.query.page,
        limit: req.query.limit,
        sortBy: req.query.sortBy,
        sortDir: req.query.sortDir,
      });
      return res.json(result);
    }

    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
    const params: (string | number)[] = [];
    let where = "deleted_at IS NULL AND status IN ('active','pending')";
    if (q) {
      where += " AND (name LIKE ? OR email LIKE ? OR slug LIKE ? OR city LIKE ?)";
      const like = `%${q}%`;
      params.push(like, like, like, like);
    }
    params.push(limit);
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT id, name, slug, email, city, status, logo_url
       FROM organizers WHERE ${where}
       ORDER BY name ASC LIMIT ?`,
      params,
    );
    res.json({ organizers: rows });
  });

  app.post("/api/admin/organizers", requireAdmin, async (req: AuthedRequest, res) => {
    const name = String(req.body?.name ?? "").trim();
    const email = String(req.body?.email ?? "")
      .trim()
      .toLowerCase();
    const ownerEmail = String(req.body?.owner_email ?? "")
      .trim()
      .toLowerCase();
    const ownerFirst = String(req.body?.owner_first_name ?? "").trim();
    const ownerLast = String(req.body?.owner_last_name ?? "").trim();
    const city = req.body?.city ? String(req.body.city).trim().slice(0, 100) : null;
    const country = String(req.body?.country ?? "MX")
      .trim()
      .slice(0, 2)
      .toUpperCase();
    const phone = req.body?.phone ? String(req.body.phone).trim().slice(0, 20) : null;

    if (!name || !email || !ownerEmail || !ownerFirst || !ownerLast) {
      return res.status(400).json({
        error: "name, email, owner_email, owner_first_name, owner_last_name required",
      });
    }

    const baseSlug = slugify(String(req.body?.slug ?? name).trim() || name);
    const slug = await uniqueOrganizerSlug(pool, baseSlug);

    const [existingOrg] = await pool.query<RowDataPacket[]>(
      "SELECT id FROM organizers WHERE email = ? AND deleted_at IS NULL LIMIT 1",
      [email],
    );
    if (existingOrg.length > 0) {
      return res.status(409).json({ error: "Organizer email already exists" });
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const [orgResult] = await conn.query<ResultSetHeader>(
        `INSERT INTO organizers (
           public_uuid, slug, name, email, phone, city, country, status
         ) VALUES (?,?,?,?,?,?,?,'active')`,
        [newPublicUuid(), slug, name.slice(0, 200), email, phone, city, country],
      );
      const organizerId = orgResult.insertId;

      const [existingMember] = await conn.query<RowDataPacket[]>(
        "SELECT id FROM organizer_members WHERE organizer_id = ? AND email = ? AND deleted_at IS NULL LIMIT 1",
        [organizerId, ownerEmail],
      );
      if (existingMember.length === 0) {
        await conn.query<ResultSetHeader>(
          `INSERT INTO organizer_members (
             public_uuid, organizer_id, email, first_name, last_name, role, status, invited_at
           ) VALUES (?,?,?,?,?,'owner','active',NOW())`,
          [newPublicUuid(), organizerId, ownerEmail, ownerFirst.slice(0, 100), ownerLast.slice(0, 100)],
        );
      }

      await conn.commit();

      const eventIdsRaw = req.body?.event_ids;
      if (Array.isArray(eventIdsRaw) && eventIdsRaw.length > 0) {
        const eventIds = eventIdsRaw
          .map((id: unknown) => Number(id))
          .filter((id) => Number.isFinite(id));
        await assignEventsToOrganizer(pool, organizerId, eventIds);
      }

      sendStaffWelcomeEmail({
        to: ownerEmail,
        firstName: ownerFirst,
        audience: "organizer",
        preferredLanguage: req.body?.preferred_language,
      });

      const [[organizer]] = await pool.query<RowDataPacket[]>(
        `SELECT o.id, o.name, o.slug, o.email, o.city, o.country, o.status, o.logo_url, o.created_at,
                (SELECT COUNT(*) FROM events e WHERE e.organizer_id = o.id AND e.deleted_at IS NULL) AS event_count,
                (SELECT COUNT(*) FROM organizer_members om WHERE om.organizer_id = o.id AND om.deleted_at IS NULL) AS member_count
         FROM organizers o WHERE o.id = ? LIMIT 1`,
        [organizerId],
      );
      res.status(201).json({ organizer });
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  });

  app.get("/api/admin/organizers/:organizerId", requireAdmin, async (req, res) => {
    const organizerId = Number(req.params.organizerId);
    if (!Number.isFinite(organizerId)) {
      return res.status(400).json({ error: "Invalid organizer id" });
    }
    const [[organizer]] = await pool.query<RowDataPacket[]>(
      `SELECT o.id, o.name, o.slug, o.email, o.city, o.country, o.status, o.logo_url,
              o.phone, o.website_url, o.description, o.legal_name, o.billing_email, o.created_at,
              o.stripe_account_id, o.stripe_onboarding_complete, o.service_fee_percent, o.rfc,
              (SELECT COUNT(*) FROM events e WHERE e.organizer_id = o.id AND e.deleted_at IS NULL) AS event_count,
              (SELECT COUNT(*) FROM organizer_members om WHERE om.organizer_id = o.id AND om.deleted_at IS NULL) AS member_count
       FROM organizers o
       WHERE o.id = ? AND o.deleted_at IS NULL
       LIMIT 1`,
      [organizerId],
    );
    if (!organizer) {
      return res.status(404).json({ error: "Organizer not found" });
    }
    const [members] = await pool.query<RowDataPacket[]>(
      `SELECT id, email, first_name, last_name, phone, role, event_access_scope, status,
              invited_at, last_login_at, created_at
       FROM organizer_members
       WHERE organizer_id = ? AND deleted_at IS NULL
       ORDER BY FIELD(role,'owner','organizer','operations','marketing','finance','timing','sponsor'), created_at ASC`,
      [organizerId],
    );
    const memberIds = members.map((m) => Number(m.id));
    const assignedByMember = new Map<number, number[]>();
    if (memberIds.length > 0) {
      const placeholders = memberIds.map(() => "?").join(", ");
      const [assignments] = await pool.query<RowDataPacket[]>(
        `SELECT organizer_member_id, event_id FROM organizer_member_events
         WHERE organizer_member_id IN (${placeholders})`,
        memberIds,
      );
      for (const row of assignments) {
        const memberId = Number(row.organizer_member_id);
        const list = assignedByMember.get(memberId) ?? [];
        list.push(Number(row.event_id));
        assignedByMember.set(memberId, list);
      }
    }
    const events = await fetchOrganizerLinkedEvents(pool, organizerId);
    res.json({
      organizer,
      members: members.map((m) => ({
        ...m,
        assigned_event_ids: assignedByMember.get(Number(m.id)) ?? [],
      })),
      events,
    });
  });

  app.post(
    "/api/admin/organizers/:organizerId/events/assign",
    requireAdmin,
    async (req, res) => {
      const organizerId = Number(req.params.organizerId);
      if (!Number.isFinite(organizerId)) {
        return res.status(400).json({ error: "Invalid organizer id" });
      }
      const [[orgRow]] = await pool.query<RowDataPacket[]>(
        "SELECT id FROM organizers WHERE id = ? AND deleted_at IS NULL LIMIT 1",
        [organizerId],
      );
      if (!orgRow) {
        return res.status(404).json({ error: "Organizer not found" });
      }
      const eventIdsRaw = req.body?.event_ids;
      if (!Array.isArray(eventIdsRaw) || eventIdsRaw.length === 0) {
        return res.status(400).json({ error: "event_ids array required" });
      }
      const eventIds = eventIdsRaw
        .map((id: unknown) => Number(id))
        .filter((id) => Number.isFinite(id));
      if (eventIds.length === 0) {
        return res.status(400).json({ error: "No valid event ids" });
      }
      await assignEventsToOrganizer(pool, organizerId, eventIds);
      const events = await fetchOrganizerLinkedEvents(pool, organizerId);
      res.json({ events });
    },
  );

  app.patch(
    "/api/admin/organizers/:organizerId/members/:memberId/access",
    requireAdmin,
    async (req, res) => {
      const organizerId = Number(req.params.organizerId);
      const memberId = Number(req.params.memberId);
      if (!Number.isFinite(organizerId) || !Number.isFinite(memberId)) {
        return res.status(400).json({ error: "Invalid id" });
      }
      const [[target]] = await pool.query<RowDataPacket[]>(
        "SELECT id, role FROM organizer_members WHERE id = ? AND organizer_id = ? AND deleted_at IS NULL LIMIT 1",
        [memberId, organizerId],
      );
      if (!target) {
        return res.status(404).json({ error: "Member not found" });
      }
      if (target.role === "owner") {
        return res.status(403).json({ error: "Owner always has organization-wide event access" });
      }

      const scopeRaw = req.body?.event_access_scope;
      const scope =
        scopeRaw === "events" || scopeRaw === "organization" ? scopeRaw : null;
      if (!scope) {
        return res.status(400).json({ error: "event_access_scope must be organization or events" });
      }

      await pool.query<ResultSetHeader>(
        "UPDATE organizer_members SET event_access_scope = ? WHERE id = ? AND organizer_id = ?",
        [scope, memberId, organizerId],
      );

      await pool.query<ResultSetHeader>(
        "DELETE FROM organizer_member_events WHERE organizer_member_id = ?",
        [memberId],
      );

      if (scope === "events") {
        const eventIdsRaw = req.body?.event_ids;
        if (!Array.isArray(eventIdsRaw) || eventIdsRaw.length === 0) {
          return res.status(400).json({ error: "event_ids required when scope is events" });
        }
        const eventIds = eventIdsRaw
          .map((id: unknown) => Number(id))
          .filter((id) => Number.isFinite(id));
        for (const eventId of eventIds) {
          if (!(await assertOrganizerOwnsEvent(pool, organizerId, eventId))) {
            return res.status(400).json({ error: `Event ${eventId} is not linked to this organization` });
          }
          await pool.query<ResultSetHeader>(
            "INSERT INTO organizer_member_events (organizer_member_id, event_id) VALUES (?, ?)",
            [memberId, eventId],
          );
        }
      }

      const [members] = await pool.query<RowDataPacket[]>(
        `SELECT id, email, first_name, last_name, phone, role, event_access_scope, status,
                invited_at, last_login_at, created_at
         FROM organizer_members WHERE organizer_id = ? AND deleted_at IS NULL
         ORDER BY FIELD(role,'owner','organizer','operations','marketing','finance','timing','sponsor'), created_at ASC`,
        [organizerId],
      );
      const assignedByMember = new Map<number, number[]>();
      const memberIds = members.map((m) => Number(m.id));
      if (memberIds.length > 0) {
        const placeholders = memberIds.map(() => "?").join(", ");
        const [assignments] = await pool.query<RowDataPacket[]>(
          `SELECT organizer_member_id, event_id FROM organizer_member_events
           WHERE organizer_member_id IN (${placeholders})`,
          memberIds,
        );
        for (const row of assignments) {
          const mid = Number(row.organizer_member_id);
          const list = assignedByMember.get(mid) ?? [];
          list.push(Number(row.event_id));
          assignedByMember.set(mid, list);
        }
      }
      res.json({
        members: members.map((m) => ({
          ...m,
          assigned_event_ids: assignedByMember.get(Number(m.id)) ?? [],
        })),
      });
    },
  );

  app.patch("/api/admin/organizers/:organizerId", requireAdmin, async (req, res) => {
    const organizerId = Number(req.params.organizerId);
    if (!Number.isFinite(organizerId)) {
      return res.status(400).json({ error: "Invalid organizer id" });
    }
    const [[existing]] = await pool.query<RowDataPacket[]>(
      "SELECT id, slug FROM organizers WHERE id = ? AND deleted_at IS NULL LIMIT 1",
      [organizerId],
    );
    if (!existing) {
      return res.status(404).json({ error: "Organizer not found" });
    }

    const updates: string[] = [];
    const params: (string | number)[] = [];

    if (req.body?.name != null) {
      updates.push("name = ?");
      params.push(String(req.body.name).trim().slice(0, 200));
    }
    if (req.body?.email != null) {
      updates.push("email = ?");
      params.push(String(req.body.email).trim().toLowerCase().slice(0, 255));
    }
    if (req.body?.city != null) {
      updates.push("city = ?");
      params.push(String(req.body.city).trim().slice(0, 100) || null);
    }
    if (req.body?.country != null) {
      updates.push("country = ?");
      params.push(String(req.body.country).trim().slice(0, 2).toUpperCase());
    }
    if (req.body?.phone != null) {
      updates.push("phone = ?");
      params.push(String(req.body.phone).trim().slice(0, 20) || null);
    }
    if (req.body?.status != null) {
      const status = String(req.body.status);
      if (!["pending", "active", "suspended", "inactive"].includes(status)) {
        return res.status(400).json({ error: "Invalid status" });
      }
      updates.push("status = ?");
      params.push(status);
    }
    if (req.body?.slug != null) {
      const baseSlug = slugify(String(req.body.slug).trim());
      const slug =
        baseSlug === existing.slug
          ? existing.slug
          : await uniqueOrganizerSlug(pool, baseSlug);
      updates.push("slug = ?");
      params.push(slug);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: "No fields to update" });
    }

    params.push(organizerId);
    await pool.query<ResultSetHeader>(
      `UPDATE organizers SET ${updates.join(", ")} WHERE id = ?`,
      params,
    );

    const [[organizer]] = await pool.query<RowDataPacket[]>(
      `SELECT o.id, o.name, o.slug, o.email, o.city, o.country, o.status, o.logo_url,
              o.phone, o.website_url, o.description, o.legal_name, o.billing_email, o.created_at,
              (SELECT COUNT(*) FROM events e WHERE e.organizer_id = o.id AND e.deleted_at IS NULL) AS event_count,
              (SELECT COUNT(*) FROM organizer_members om WHERE om.organizer_id = o.id AND om.deleted_at IS NULL) AS member_count
       FROM organizers o WHERE o.id = ? LIMIT 1`,
      [organizerId],
    );
    res.json({ organizer });
  });

  app.post(
    "/api/admin/organizers/:organizerId/members",
    requireAdmin,
    async (req: AuthedRequest, res) => {
      const organizerId = Number(req.params.organizerId);
      if (!Number.isFinite(organizerId)) {
        return res.status(400).json({ error: "Invalid organizer id" });
      }
      const [[orgRow]] = await pool.query<RowDataPacket[]>(
        "SELECT id, name FROM organizers WHERE id = ? AND deleted_at IS NULL LIMIT 1",
        [organizerId],
      );
      if (!orgRow) {
        return res.status(404).json({ error: "Organizer not found" });
      }

      const email = String(req.body?.email ?? "")
        .trim()
        .toLowerCase();
      const first_name = String(req.body?.first_name ?? "").trim();
      const last_name = String(req.body?.last_name ?? "").trim();
      const role = String(req.body?.role ?? "organizer");
      const validRoles = new Set([
        "organizer",
        "marketing",
        "finance",
        "timing",
        "operations",
        "sponsor",
      ]);
      if (!email || !first_name || !last_name) {
        return res.status(400).json({ error: "email, first_name, last_name required" });
      }
      if (!validRoles.has(role)) {
        return res.status(400).json({ error: "invalid role" });
      }

      const [existing] = await pool.query<RowDataPacket[]>(
        "SELECT id FROM organizer_members WHERE organizer_id = ? AND email = ? AND deleted_at IS NULL LIMIT 1",
        [organizerId, email],
      );
      if (existing.length > 0) {
        return res.status(409).json({ error: "Member already exists" });
      }

      await pool.query<ResultSetHeader>(
        `INSERT INTO organizer_members (
           public_uuid, organizer_id, email, first_name, last_name, phone, role, status, invited_at
         ) VALUES (?,?,?,?,?,?,?,'active',NOW())`,
        [
          newPublicUuid(),
          organizerId,
          email,
          first_name.slice(0, 100),
          last_name.slice(0, 100),
          req.body?.phone ? String(req.body.phone).slice(0, 20) : null,
          role,
        ],
      );

      sendStaffWelcomeEmail({
        to: email,
        firstName: first_name,
        audience: "organizer",
        preferredLanguage: req.body?.preferred_language,
      });

      const [members] = await pool.query<RowDataPacket[]>(
        `SELECT id, email, first_name, last_name, phone, role, status, invited_at, last_login_at, created_at
         FROM organizer_members WHERE organizer_id = ? AND deleted_at IS NULL
         ORDER BY FIELD(role,'owner','organizer','operations','marketing','finance','timing','sponsor'), created_at ASC`,
        [organizerId],
      );
      res.status(201).json({ members });
    },
  );

  app.patch(
    "/api/admin/organizers/:organizerId/members/:memberId",
    requireAdmin,
    async (req, res) => {
      const organizerId = Number(req.params.organizerId);
      const memberId = Number(req.params.memberId);
      if (!Number.isFinite(organizerId) || !Number.isFinite(memberId)) {
        return res.status(400).json({ error: "Invalid id" });
      }
      const [target] = await pool.query<RowDataPacket[]>(
        "SELECT id, role FROM organizer_members WHERE id = ? AND organizer_id = ? AND deleted_at IS NULL LIMIT 1",
        [memberId, organizerId],
      );
      if (target.length === 0) {
        return res.status(404).json({ error: "Member not found" });
      }
      if (target[0].role === "owner") {
        return res.status(403).json({ error: "Cannot modify owner" });
      }

      const status = req.body?.status != null ? String(req.body.status) : null;
      if (status && !["invited", "active", "inactive", "suspended"].includes(status)) {
        return res.status(400).json({ error: "Invalid status" });
      }
      if (!status) {
        return res.status(400).json({ error: "status required" });
      }

      await pool.query<ResultSetHeader>(
        "UPDATE organizer_members SET status = ? WHERE id = ? AND organizer_id = ?",
        [status, memberId, organizerId],
      );

      const [members] = await pool.query<RowDataPacket[]>(
        `SELECT id, email, first_name, last_name, phone, role, status, invited_at, last_login_at, created_at
         FROM organizer_members WHERE organizer_id = ? AND deleted_at IS NULL
         ORDER BY FIELD(role,'owner','organizer','operations','marketing','finance','timing','sponsor'), created_at ASC`,
        [organizerId],
      );
      res.json({ members });
    },
  );

  app.get("/api/admin/admins", requireAdmin, async (req, res) => {
    const q = String(req.query.q ?? "").trim();
    const result = await listAdminStaff(pool, {
      q: q || undefined,
      page: req.query.page,
      limit: req.query.limit,
      sortBy: req.query.sortBy,
      sortDir: req.query.sortDir,
    });
    res.json(result);
  });

  app.post("/api/admin/admins", requireAdmin, async (req: AuthedRequest, res) => {
    const actorRole = await getAdminRole(pool, req.auth!.id);
    if (actorRole !== "super_admin") {
      return res.status(403).json({ error: "Only super admins can add platform admins" });
    }

    const email = String(req.body?.email ?? "")
      .trim()
      .toLowerCase();
    const first_name = String(req.body?.first_name ?? "").trim();
    const last_name = String(req.body?.last_name ?? "").trim();
    const role = String(req.body?.role ?? "admin");
    const phone = req.body?.phone ? String(req.body.phone).trim().slice(0, 20) : null;

    if (!email || !first_name || !last_name) {
      return res.status(400).json({ error: "email, first_name, last_name required" });
    }
    if (!["admin", "super_admin"].includes(role)) {
      return res.status(400).json({ error: "invalid role" });
    }

    const [existing] = await pool.query<RowDataPacket[]>(
      "SELECT id FROM admins WHERE LOWER(TRIM(email)) = ? AND deleted_at IS NULL LIMIT 1",
      [email],
    );
    if (existing.length > 0) {
      return res.status(409).json({ error: "Admin already exists" });
    }

    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO admins (public_uuid, email, first_name, last_name, phone, role, status)
       VALUES (?,?,?,?,?,?,'active')`,
      [newPublicUuid(), email, first_name.slice(0, 100), last_name.slice(0, 100), phone, role],
    );

    sendStaffWelcomeEmail({
      to: email,
      firstName: first_name,
      audience: "admin",
      preferredLanguage: req.body?.preferred_language,
    });

    void sendStaffLoginOtp({
      adminId: result.insertId,
      to: email,
      firstName: first_name,
      preferredLanguage: req.body?.preferred_language,
    }).catch((err) => console.error("[email:admin-invite-otp]", err));

    const [[admin]] = await pool.query<RowDataPacket[]>(
      `SELECT id, email, first_name, last_name, phone, role, status, last_login_at, created_at
       FROM admins WHERE id = ? LIMIT 1`,
      [result.insertId],
    );
    res.status(201).json({ admin });
  });

  app.patch("/api/admin/admins/:adminId", requireAdmin, async (req: AuthedRequest, res) => {
    const actorRole = await getAdminRole(pool, req.auth!.id);
    if (actorRole !== "super_admin") {
      return res.status(403).json({ error: "Only super admins can update platform admins" });
    }

    const adminId = Number(req.params.adminId);
    if (!Number.isFinite(adminId)) {
      return res.status(400).json({ error: "Invalid admin id" });
    }
    if (adminId === req.auth!.id && req.body?.status === "suspended") {
      return res.status(403).json({ error: "Cannot suspend your own account" });
    }

    const [[existing]] = await pool.query<RowDataPacket[]>(
      "SELECT id, role FROM admins WHERE id = ? AND deleted_at IS NULL LIMIT 1",
      [adminId],
    );
    if (!existing) {
      return res.status(404).json({ error: "Admin not found" });
    }

    const updates: string[] = [];
    const params: (string | number)[] = [];

    if (req.body?.status != null) {
      const status = String(req.body.status);
      if (!["active", "inactive", "suspended"].includes(status)) {
        return res.status(400).json({ error: "Invalid status" });
      }
      updates.push("status = ?");
      params.push(status);
    }
    if (req.body?.role != null) {
      const role = String(req.body.role);
      if (!["admin", "super_admin"].includes(role)) {
        return res.status(400).json({ error: "Invalid role" });
      }
      if (adminId === req.auth!.id && role !== "super_admin") {
        return res.status(403).json({ error: "Cannot demote your own role" });
      }
      updates.push("role = ?");
      params.push(role);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: "No fields to update" });
    }

    params.push(adminId);
    await pool.query<ResultSetHeader>(
      `UPDATE admins SET ${updates.join(", ")} WHERE id = ?`,
      params,
    );

    const [[admin]] = await pool.query<RowDataPacket[]>(
      `SELECT id, email, first_name, last_name, phone, role, status, last_login_at, created_at
       FROM admins WHERE id = ? LIMIT 1`,
      [adminId],
    );
    res.json({ admin });
  });

  app.get("/api/admin/payments", requireAdmin, async (req, res) => {
    const q = String(req.query.q ?? "").trim();
    const status = String(req.query.status ?? "").trim();
    const organizerIdRaw = req.query.organizerId;
    const eventIdRaw = req.query.eventId;
    const organizerId =
      organizerIdRaw != null && String(organizerIdRaw).trim() !== ""
        ? Number(organizerIdRaw)
        : undefined;
    const eventId =
      eventIdRaw != null && String(eventIdRaw).trim() !== ""
        ? Number(eventIdRaw)
        : undefined;
    const result = await listAdminPayments(pool, {
      q: q || undefined,
      status: status || undefined,
      organizerId: Number.isFinite(organizerId!) ? organizerId : undefined,
      eventId: Number.isFinite(eventId!) ? eventId : undefined,
      page: req.query.page,
      limit: req.query.limit,
      sortBy: req.query.sortBy,
      sortDir: req.query.sortDir,
    });
    res.json(result);
  });

  app.get("/api/admin/payments/:paymentId", requireAdmin, async (req, res) => {
    const paymentId = Number(req.params.paymentId);
    if (!Number.isFinite(paymentId)) {
      return res.status(400).json({ error: "Invalid payment id" });
    }
    const payment = await fetchAdminPaymentDetail(pool, paymentId);
    if (!payment) {
      return res.status(404).json({ error: "Payment not found" });
    }
    res.json({ payment });
  });

  app.post(
    "/api/admin/payments/:paymentId/refund",
    requireAdmin,
    async (req: AuthedRequest, res) => {
      const paymentId = Number(req.params.paymentId);
      if (!Number.isFinite(paymentId)) {
        return res.status(400).json({ error: "Invalid payment id" });
      }
      if (!processPaymentRefund) {
        return res.status(503).json({ error: "Refunds are not configured" });
      }
      const reason = req.body?.reason ? String(req.body.reason).slice(0, 500) : undefined;
      try {
        await processPaymentRefund({
          paymentId,
          adminId: req.auth!.id,
          reason,
        });
        const [[payment]] = await pool.query<RowDataPacket[]>(
          `SELECT p.id, p.public_uuid, p.registration_id, p.amount_cents, p.currency, p.status,
                  p.stripe_payment_intent_id, p.paid_at, p.created_at,
                  r.registration_number, r.status AS registration_status
           FROM payments p
           LEFT JOIN registrations r ON r.id = p.registration_id
           WHERE p.id = ? LIMIT 1`,
          [paymentId],
        );
        res.json({ ok: true, payment });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Refund failed";
        res.status(400).json({ error: message });
      }
    },
  );

  async function fetchSponsorAnalytics(eventId: number) {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT es.id AS sponsor_id, es.name, es.tier,
              SUM(CASE WHEN sa.event_type = 'impression' THEN 1 ELSE 0 END) AS impressions,
              SUM(CASE WHEN sa.event_type = 'click' THEN 1 ELSE 0 END) AS clicks
       FROM event_sponsors es
       LEFT JOIN sponsor_analytics_events sa ON sa.event_sponsor_id = es.id
       WHERE es.event_id = ? AND es.is_active = 1
       GROUP BY es.id, es.name, es.tier
       ORDER BY es.sort_order ASC, es.id ASC`,
      [eventId],
    );
    const sponsors = rows.map((r) => {
      const impressions = Number(r.impressions ?? 0);
      const clicks = Number(r.clicks ?? 0);
      const ctr = impressions > 0 ? Math.round((clicks / impressions) * 1000) / 10 : 0;
      return {
        sponsor_id: r.sponsor_id,
        name: r.name,
        tier: r.tier,
        impressions,
        clicks,
        ctr,
      };
    });
    const totals = sponsors.reduce(
      (acc, s) => ({
        impressions: acc.impressions + s.impressions,
        clicks: acc.clicks + s.clicks,
        ctr: 0,
      }),
      { impressions: 0, clicks: 0, ctr: 0 },
    );
    totals.ctr =
      totals.impressions > 0
        ? Math.round((totals.clicks / totals.impressions) * 1000) / 10
        : 0;
    return { sponsors, totals };
  }

  app.get(
    "/api/organizer/events/:eventId/sponsor-analytics",
    requireOrganizer,
    async (req: AuthedRequest, res) => {
      const organizerId = req.auth!.organizerId;
      if (!organizerId) {
        return res.status(403).json({ error: "Organizer context missing" });
      }
      const eventId = Number(req.params.eventId);
      if (!(await assertMemberCanAccessEvent(pool, req.auth!.id, organizerId, eventId))) {
        return res.status(404).json({ error: "Event not found" });
      }
      res.json(await fetchSponsorAnalytics(eventId));
    },
  );

  app.get(
    "/api/admin/events/:eventId/sponsor-analytics",
    requireAdmin,
    async (req, res) => {
      const eventId = Number(req.params.eventId);
      if (!(await adminEventExists(eventId))) {
        return res.status(404).json({ error: "Event not found" });
      }
      res.json(await fetchSponsorAnalytics(eventId));
    },
  );
}

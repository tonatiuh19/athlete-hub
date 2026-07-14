import type { Pool, RowDataPacket } from "mysql2/promise";
import { EVENT_REGISTRATION_COUNT_SQL } from "./registrationCounts.js";

export type StaffEventsSortDir = "ASC" | "DESC";

export const STAFF_EVENTS_SORT_COLUMNS: Record<string, string> = {
  start_date: "e.start_date",
  title: "e.title",
  status: "e.status",
  registration_count: "registration_count",
  organizer_name: "o.name",
  created_at: "e.created_at",
  id: "e.id",
  location_city: "e.location_city",
};

export const STAFF_EVENT_STATUSES = [
  "draft",
  "pending_approval",
  "published",
  "cancelled",
  "completed",
] as const;

export type StaffEventStatus = (typeof STAFF_EVENT_STATUSES)[number];

export function isStaffEventStatus(value: string): value is StaffEventStatus {
  return (STAFF_EVENT_STATUSES as readonly string[]).includes(value);
}

export function parseStaffEventsListQuery(options: {
  page?: unknown;
  limit?: unknown;
  sortBy?: unknown;
  sortDir?: unknown;
  defaultSort?: string;
}): {
  page: number;
  limit: number;
  offset: number;
  sortCol: string;
  sortDir: StaffEventsSortDir;
  sortKey: string;
} {
  const page = Math.max(1, Number(options.page) || 1);
  const parsedLimit = Number(options.limit);
  const limit = Math.min(
    100,
    Math.max(1, Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : 20),
  );
  const defaultSort = options.defaultSort ?? "start_date";
  const sortKey = String(options.sortBy ?? defaultSort);
  const sortCol =
    STAFF_EVENTS_SORT_COLUMNS[sortKey] ?? STAFF_EVENTS_SORT_COLUMNS[defaultSort];
  const sortDir: StaffEventsSortDir =
    String(options.sortDir ?? "DESC").toUpperCase() === "ASC" ? "ASC" : "DESC";
  return {
    page,
    limit,
    offset: (page - 1) * limit,
    sortCol,
    sortDir,
    sortKey,
  };
}

export function buildStaffEventsPagination(page: number, limit: number, total: number) {
  return {
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

export interface ListStaffEventsOptions {
  q?: string;
  status?: string;
  organizerId?: number;
  /** Restrict to specific event IDs (member scoped). Empty array = none. Undefined = no filter. */
  eventIds?: number[];
  page?: unknown;
  limit?: unknown;
  sortBy?: unknown;
  sortDir?: unknown;
}

export interface StaffEventListRow {
  id: number;
  slug: string;
  title: string;
  status: string;
  start_date: string;
  organizer_id: number;
  registration_count: number;
  location_city?: string | null;
  sport_name?: string | null;
  organizer_name?: string | null;
}

export async function listStaffEvents(
  pool: Pool,
  options: ListStaffEventsOptions = {},
): Promise<{
  events: StaffEventListRow[];
  pagination: ReturnType<typeof buildStaffEventsPagination>;
}> {
  const { page, limit, offset, sortCol, sortDir } = parseStaffEventsListQuery(options);

  if (Array.isArray(options.eventIds) && options.eventIds.length === 0) {
    return {
      events: [],
      pagination: buildStaffEventsPagination(page, limit, 0),
    };
  }

  const params: (string | number)[] = [];
  const where: string[] = ["e.deleted_at IS NULL"];

  if (options.organizerId != null) {
    where.push("e.organizer_id = ?");
    params.push(options.organizerId);
  }

  if (options.eventIds && options.eventIds.length > 0) {
    where.push(`e.id IN (${options.eventIds.map(() => "?").join(", ")})`);
    params.push(...options.eventIds);
  }

  const status = String(options.status ?? "").trim();
  if (status && isStaffEventStatus(status)) {
    where.push("e.status = ?");
    params.push(status);
  }

  const q = String(options.q ?? "").trim();
  if (q) {
    const like = `%${q}%`;
    where.push("(e.title LIKE ? OR e.slug LIKE ? OR o.name LIKE ?)");
    params.push(like, like, like);
  }

  const whereSql = `WHERE ${where.join(" AND ")}`;

  const [[countRow]] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS total
     FROM events e
     JOIN sport_types st ON st.id = e.sport_type_id
     JOIN organizers o ON o.id = e.organizer_id
     ${whereSql}`,
    params,
  );
  const total = Number(countRow?.total ?? 0);

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT e.id, e.slug, e.title, e.status, e.start_date, e.organizer_id,
            ${EVENT_REGISTRATION_COUNT_SQL} AS registration_count,
            e.location_city, st.name AS sport_name, o.name AS organizer_name
     FROM events e
     JOIN sport_types st ON st.id = e.sport_type_id
     JOIN organizers o ON o.id = e.organizer_id
     ${whereSql}
     ORDER BY ${sortCol} ${sortDir}, e.id DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );

  const events: StaffEventListRow[] = rows.map((row) => ({
    id: Number(row.id),
    slug: String(row.slug),
    title: String(row.title),
    status: String(row.status),
    start_date: String(row.start_date),
    organizer_id: Number(row.organizer_id),
    registration_count: Number(row.registration_count ?? 0),
    location_city: row.location_city != null ? String(row.location_city) : null,
    sport_name: row.sport_name != null ? String(row.sport_name) : null,
    organizer_name: row.organizer_name != null ? String(row.organizer_name) : null,
  }));

  return {
    events,
    pagination: buildStaffEventsPagination(page, limit, total),
  };
}

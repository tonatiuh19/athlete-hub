import type { Pool, RowDataPacket } from "mysql2/promise";
import {
  evaluateCheckInWindow,
  eventEndWallTime,
  normalizeWallDateTimeFromDb,
  type CheckInWindowEvaluation,
  type WallDateTime,
} from "../shared/checkInWindow.js";

export interface EventCheckInContext {
  eventId: number;
  title: string;
  status: string;
  startDate: WallDateTime;
  endDate: WallDateTime | null;
  timezone: string;
  checkInOpensAt: WallDateTime | null;
  checkInClosesAt: WallDateTime | null;
}

export interface CheckInWindowGuardOptions {
  actor: "admin" | "organizer" | "athlete";
  bypassWindow?: boolean;
}

const EVENT_CHECK_IN_SELECT = `
  e.id AS event_id,
  e.title,
  e.status,
  DATE_FORMAT(e.start_date, '%Y-%m-%d %H:%i:%s') AS start_date,
  DATE_FORMAT(e.end_date, '%Y-%m-%d %H:%i:%s') AS end_date,
  e.timezone,
  DATE_FORMAT(e.check_in_opens_at, '%Y-%m-%d %H:%i:%s') AS check_in_opens_at,
  DATE_FORMAT(e.check_in_closes_at, '%Y-%m-%d %H:%i:%s') AS check_in_closes_at
`;

export async function loadEventCheckInContext(
  pool: Pool,
  eventId: number,
): Promise<EventCheckInContext | null> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT ${EVENT_CHECK_IN_SELECT}
     FROM events e
     WHERE e.id = ? AND e.deleted_at IS NULL
     LIMIT 1`,
    [eventId],
  );
  const row = rows[0];
  if (!row) return null;

  return {
    eventId: Number(row.event_id),
    title: String(row.title),
    status: String(row.status ?? "draft"),
    startDate: normalizeWallDateTimeFromDb(row.start_date),
    endDate: row.end_date ? normalizeWallDateTimeFromDb(row.end_date) : null,
    timezone: String(row.timezone || "America/Mexico_City"),
    checkInOpensAt: row.check_in_opens_at
      ? normalizeWallDateTimeFromDb(row.check_in_opens_at)
      : null,
    checkInClosesAt: row.check_in_closes_at
      ? normalizeWallDateTimeFromDb(row.check_in_closes_at)
      : null,
  };
}

export function evaluateEventCheckInWindow(
  ctx: EventCheckInContext,
  now?: Date,
): CheckInWindowEvaluation {
  return evaluateCheckInWindow(
    {
      startDate: ctx.startDate,
      endDate: ctx.endDate,
      timezone: ctx.timezone,
      checkInOpensAt: ctx.checkInOpensAt,
      checkInClosesAt: ctx.checkInClosesAt,
    },
    { now },
  );
}

export function checkInWindowResponsePayload(
  ctx: EventCheckInContext,
  window: CheckInWindowEvaluation,
) {
  return {
    eventId: ctx.eventId,
    eventTitle: ctx.title,
    open: window.open,
    status: window.status,
    timezone: window.timezone,
    opensAt: window.opensAt,
    closesAt: window.closesAt,
    opensAtLocal: window.opensAtLocal,
    closesAtLocal: window.closesAtLocal,
    firstEventDay: window.firstEventDay,
    lastEventDay: window.lastEventDay,
    usesCustomWindow: window.usesCustomWindow,
  };
}

export type CheckInWindowBlocked = {
  blocked: true;
  status: number;
  body: {
    error: string;
    code: "check_in_not_yet" | "check_in_window_closed" | "invalid_check_in_timezone";
    window: ReturnType<typeof checkInWindowResponsePayload>;
  };
};

export type CheckInWindowAllowed = { blocked: false; window: CheckInWindowEvaluation };

export function guardCheckInWindow(
  ctx: EventCheckInContext,
  window: CheckInWindowEvaluation,
  options: CheckInWindowGuardOptions,
): CheckInWindowBlocked | CheckInWindowAllowed {
  if (ctx.status === "cancelled") {
    const payload = checkInWindowResponsePayload(ctx, window);
    return {
      blocked: true,
      status: 403,
      body: {
        error: "Check-in is not available for cancelled events",
        code: "check_in_window_closed",
        window: payload,
      },
    };
  }

  if (window.open) {
    return { blocked: false, window };
  }

  const adminBypass = options.actor === "admin" && options.bypassWindow === true;
  if (adminBypass) {
    return { blocked: false, window };
  }

  const payload = checkInWindowResponsePayload(ctx, window);
  if (window.status === "not_yet") {
    return {
      blocked: true,
      status: 403,
      body: {
        error: "Check-in is not open yet for this event",
        code: "check_in_not_yet",
        window: payload,
      },
    };
  }

  if (window.status === "invalid_timezone") {
    return {
      blocked: true,
      status: 503,
      body: {
        error: "Event timezone configuration is invalid — contact support",
        code: "invalid_check_in_timezone",
        window: payload,
      },
    };
  }

  return {
    blocked: true,
    status: 403,
    body: {
      error: "Check-in window has closed for this event",
      code: "check_in_window_closed",
      window: payload,
    },
  };
}

export async function assertCheckInWindowForEvent(
  pool: Pool,
  eventId: number,
  options: CheckInWindowGuardOptions,
): Promise<
  | { ok: true; ctx: EventCheckInContext; window: CheckInWindowEvaluation }
  | { ok: false; response: CheckInWindowBlocked }
> {
  const ctx = await loadEventCheckInContext(pool, eventId);
  if (!ctx) {
    return {
      ok: false,
      response: {
        blocked: true,
        status: 404,
        body: {
          error: "Event not found",
          code: "check_in_window_closed",
          window: {
            eventId,
            eventTitle: "",
            open: false,
            status: "closed",
            timezone: "America/Mexico_City",
            opensAt: new Date(0).toISOString(),
            closesAt: new Date(0).toISOString(),
            opensAtLocal: "",
            closesAtLocal: "",
            firstEventDay: "",
            lastEventDay: "",
            usesCustomWindow: false,
          },
        },
      },
    };
  }

  const window = evaluateEventCheckInWindow(ctx);
  const guard = guardCheckInWindow(ctx, window, options);
  if (guard.blocked === true) {
    return { ok: false, response: guard };
  }
  return { ok: true, ctx, window: guard.window };
}

/** Event-local wall clock, e.g. "2026-06-15 08:00:00" */
export type WallDateTime = string;

export interface CheckInWindowEventInput {
  startDate: WallDateTime;
  endDate?: WallDateTime | null;
  timezone: string;
  /** Per-event wall times in event timezone — when both null, derived from start/end */
  checkInOpensAt?: WallDateTime | null;
  checkInClosesAt?: WallDateTime | null;
}

export type CheckInWindowStatus = "open" | "not_yet" | "closed" | "invalid_timezone";

export interface CheckInWindowEvaluation {
  status: CheckInWindowStatus;
  open: boolean;
  timezone: string;
  opensAt: string;
  closesAt: string;
  opensAtLocal: string;
  closesAtLocal: string;
  firstEventDay: string;
  lastEventDay: string;
  /** True when event has explicit check_in_opens_at + check_in_closes_at in DB */
  usesCustomWindow: boolean;
}

const FALLBACK_TZ = "America/Mexico_City";

type ZonedParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function parseWallDateTime(raw: string): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
} {
  const normalized = raw.trim().replace("T", " ").slice(0, 19);
  const [datePart, timePart = "00:00:00"] = normalized.split(" ");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute, second = 0] = timePart.split(":").map(Number);
  return { year, month, day, hour, minute, second };
}

function calendarDayKey(p: Pick<ZonedParts, "year" | "month" | "day">): string {
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

function isValidTimeZone(tz: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

function zonedParts(date: Date, timeZone: string): ZonedParts {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value ?? "0");
  let hour = get("hour");
  if (hour === 24) hour = 0;
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour,
    minute: get("minute"),
    second: get("second"),
  };
}

/** UTC instant for a wall-clock moment in `timeZone`. */
export function wallClockToUtc(
  wall: WallDateTime,
  timeZone: string,
): Date | null {
  if (!isValidTimeZone(timeZone)) return null;
  const target = parseWallDateTime(wall);

  let guess = Date.UTC(
    target.year,
    target.month - 1,
    target.day,
    target.hour,
    target.minute,
    target.second,
  );

  for (let i = 0; i < 6; i++) {
    const parts = zonedParts(new Date(guess), timeZone);
    const diffMinutes =
      (target.year - parts.year) * 525600 +
      (target.month - parts.month) * 43200 +
      (target.day - parts.day) * 1440 +
      (target.hour - parts.hour) * 60 +
      (target.minute - parts.minute) +
      (target.second - parts.second) / 60;
    if (Math.abs(diffMinutes) < 0.01) break;
    guess += Math.round(diffMinutes * 60_000);
  }

  const verify = zonedParts(new Date(guess), timeZone);
  if (
    verify.year !== target.year ||
    verify.month !== target.month ||
    verify.day !== target.day ||
    verify.hour !== target.hour ||
    verify.minute !== target.minute
  ) {
    return null;
  }
  return new Date(guess);
}

function formatWallLocal(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })
    .format(date)
    .replace("T", " ");
}

function compareCalendarDays(a: string, b: string): number {
  return a.localeCompare(b);
}

export function eventCalendarDays(startDate: WallDateTime, endDate?: WallDateTime | null): {
  firstEventDay: string;
  lastEventDay: string;
} {
  const startParts = parseWallDateTime(startDate);
  const endWall = endDate?.trim() ? endDate : startDate;
  const endParts = parseWallDateTime(endWall);
  const firstEventDay = calendarDayKey(startParts);
  let lastEventDay = calendarDayKey(endParts);
  if (compareCalendarDays(lastEventDay, firstEventDay) < 0) {
    lastEventDay = firstEventDay;
  }
  return { firstEventDay, lastEventDay };
}

/** Latest moment check-in may close — event end_date, or start_date if no end. */
export function eventEndWallTime(
  startDate: WallDateTime,
  endDate?: WallDateTime | null,
): WallDateTime {
  return endDate?.trim()
    ? endDate.trim().replace("T", " ").slice(0, 19)
    : startDate.trim().replace("T", " ").slice(0, 19);
}

/** Default QR check-in bounds when event has no custom window configured. */
export function defaultCheckInWindowBounds(
  startDate: WallDateTime,
  endDate?: WallDateTime | null,
): { opensAtLocal: WallDateTime; closesAtLocal: WallDateTime } {
  const { firstEventDay } = eventCalendarDays(startDate, endDate);
  const opensAtLocal = `${firstEventDay} 00:00:00`;
  const closesAtLocal = eventEndWallTime(startDate, endDate);
  return { opensAtLocal, closesAtLocal };
}

function minWallTime(a: WallDateTime, b: WallDateTime, timezone: string): WallDateTime {
  const aUtc = wallClockToUtc(a, timezone);
  const bUtc = wallClockToUtc(b, timezone);
  if (!aUtc || !bUtc) return a;
  return aUtc.getTime() <= bUtc.getTime() ? a : b;
}

function resolveEffectiveBounds(event: CheckInWindowEventInput): {
  opensWall: WallDateTime;
  closesWall: WallDateTime;
  usesCustomWindow: boolean;
} {
  const customOpen = event.checkInOpensAt?.trim() || null;
  const customClose = event.checkInClosesAt?.trim() || null;
  const usesCustomWindow = Boolean(customOpen && customClose);

  if (usesCustomWindow) {
    const eventEnd = eventEndWallTime(event.startDate, event.endDate);
    return {
      opensWall: customOpen!,
      closesWall: minWallTime(customClose!, eventEnd, event.timezone),
      usesCustomWindow: true,
    };
  }

  const defaults = defaultCheckInWindowBounds(event.startDate, event.endDate);
  const eventEnd = eventEndWallTime(event.startDate, event.endDate);
  const opensWall = customOpen ?? defaults.opensAtLocal;
  let closesWall = customClose ?? defaults.closesAtLocal;
  closesWall = minWallTime(closesWall, eventEnd, event.timezone);

  return {
    opensWall,
    closesWall,
    usesCustomWindow: false,
  };
}

export function evaluateCheckInWindow(
  event: CheckInWindowEventInput,
  options?: { now?: Date },
): CheckInWindowEvaluation {
  const now = options?.now ?? new Date();
  const timezone = isValidTimeZone(event.timezone) ? event.timezone : FALLBACK_TZ;
  const invalidTz = !isValidTimeZone(event.timezone);
  const { firstEventDay, lastEventDay } = eventCalendarDays(
    event.startDate,
    event.endDate,
  );

  const { opensWall, closesWall, usesCustomWindow } = resolveEffectiveBounds(event);
  const opensAtUtc = wallClockToUtc(opensWall, timezone);
  const closesAtUtc = wallClockToUtc(closesWall, timezone);

  if (!opensAtUtc || !closesAtUtc || closesAtUtc.getTime() < opensAtUtc.getTime()) {
    return {
      status: invalidTz ? "invalid_timezone" : "closed",
      open: false,
      timezone,
      opensAt: new Date(0).toISOString(),
      closesAt: new Date(0).toISOString(),
      opensAtLocal: opensWall,
      closesAtLocal: closesWall,
      firstEventDay,
      lastEventDay,
      usesCustomWindow,
    };
  }

  const nowMs = now.getTime();
  const open = nowMs >= opensAtUtc.getTime() && nowMs <= closesAtUtc.getTime();
  let status: CheckInWindowStatus = open
    ? "open"
    : nowMs < opensAtUtc.getTime()
      ? "not_yet"
      : "closed";
  if (invalidTz && !open) status = "invalid_timezone";

  return {
    status,
    open,
    timezone,
    opensAt: opensAtUtc.toISOString(),
    closesAt: closesAtUtc.toISOString(),
    opensAtLocal: formatWallLocal(opensAtUtc, timezone),
    closesAtLocal: formatWallLocal(closesAtUtc, timezone),
    firstEventDay,
    lastEventDay,
    usesCustomWindow,
  };
}

export type CheckInWindowValidationError =
  | "pair_required"
  | "opens_not_before_closes"
  | "opens_after_event_end"
  | "closes_after_event_end";

/** Normalize HTML datetime-local (`YYYY-MM-DDTHH:mm`) to wall time for comparisons. */
export function normalizeFormDatetimeLocal(value: string | null | undefined): WallDateTime | null {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return null;
  return trimmed.replace("T", " ").concat(":00").slice(0, 19);
}

export function validateCheckInWindowFields(input: {
  checkInOpensAt: string | null | undefined;
  checkInClosesAt: string | null | undefined;
  startDate: string;
  endDate?: string | null | undefined;
}): CheckInWindowValidationError | null {
  const opens = normalizeFormDatetimeLocal(input.checkInOpensAt);
  const closes = normalizeFormDatetimeLocal(input.checkInClosesAt);

  if ((opens && !closes) || (!opens && closes)) {
    return "pair_required";
  }
  if (!opens || !closes) return null;

  if (opens >= closes) return "opens_not_before_closes";

  const startWall = normalizeFormDatetimeLocal(input.startDate);
  if (!startWall) return null;

  const endWall = normalizeFormDatetimeLocal(input.endDate ?? null);
  const eventEnd = eventEndWallTime(startWall, endWall);
  if (closes > eventEnd) return "closes_after_event_end";
  if (opens > eventEnd) return "opens_after_event_end";

  return null;
}

/** True when a custom close time exceeds event end (server caps at evaluation). */
export function checkInCloseWouldBeCapped(input: {
  checkInClosesAt: string | null | undefined;
  startDate: string;
  endDate?: string | null | undefined;
}): boolean {
  const closes = normalizeFormDatetimeLocal(input.checkInClosesAt);
  if (!closes) return false;
  const startWall = normalizeFormDatetimeLocal(input.startDate);
  if (!startWall) return false;
  const endWall = normalizeFormDatetimeLocal(input.endDate ?? null);
  return closes > eventEndWallTime(startWall, endWall);
}

export function normalizeWallDateTimeFromDb(value: unknown): WallDateTime {
  if (value instanceof Date) {
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${value.getUTCFullYear()}-${pad(value.getUTCMonth() + 1)}-${pad(value.getUTCDate())} ${pad(value.getUTCHours())}:${pad(value.getUTCMinutes())}:${pad(value.getUTCSeconds())}`;
  }
  return String(value ?? "")
    .trim()
    .replace("T", " ")
    .slice(0, 19);
}

/** Normalize API / form datetime (ISO or wall) to wall clock for comparisons and DB. */
export function parseIncomingEventDateTime(value: unknown): WallDateTime | null {
  if (value === null || value === undefined || value === "") return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  return normalizeWallDateTimeFromDb(trimmed);
}

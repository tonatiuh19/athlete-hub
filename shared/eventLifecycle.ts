/**
 * Pure helpers for event day end + registration/listing lifecycle.
 * Event day ends at 23:59:59.999 UTC on the calendar day of end_date (or start_date).
 */

export function getEventLifecycleEndMs(
  startDate: string | Date,
  endDate?: string | Date | null,
): number {
  const raw = endDate ?? startDate;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return Number.POSITIVE_INFINITY;
  return Date.UTC(
    d.getUTCFullYear(),
    d.getUTCMonth(),
    d.getUTCDate(),
    23,
    59,
    59,
    999,
  );
}

export function hasEventDayPassed(
  startDate: string | Date,
  endDate?: string | Date | null,
  nowMs: number = Date.now(),
): boolean {
  return nowMs > getEventLifecycleEndMs(startDate, endDate);
}

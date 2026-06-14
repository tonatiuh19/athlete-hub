import { fromDatetimeLocal } from "@/utils/datetimeLocal";

/** True when end is set and strictly before start (wall-clock comparison). */
export function isEventEndBeforeStart(startDate: string, endDate: string): boolean {
  const start = (fromDatetimeLocal(startDate) ?? startDate).trim();
  const end = (fromDatetimeLocal(endDate) ?? endDate).trim();
  if (!start || !end) return false;
  return end < start;
}

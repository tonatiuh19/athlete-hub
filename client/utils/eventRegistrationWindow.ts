import type { EventDetailEvent } from "@shared/api";
import { hasEventDayPassed } from "@shared/eventLifecycle";

export type RegistrationWindowStatus = "open" | "not_open" | "closed";

export function getRegistrationWindowStatus(
  event: Pick<
    EventDetailEvent,
    "registration_opens_at" | "registration_closes_at" | "start_date" | "end_date"
  >,
  now = Date.now(),
): RegistrationWindowStatus {
  const openTimes: number[] = [];
  const closeTimes: number[] = [];

  if (event.registration_opens_at) {
    openTimes.push(new Date(event.registration_opens_at).getTime());
  }
  if (event.registration_closes_at) {
    closeTimes.push(new Date(event.registration_closes_at).getTime());
  }

  const effectiveOpen = openTimes.length ? Math.max(...openTimes) : null;
  const effectiveClose = closeTimes.length ? Math.min(...closeTimes) : null;

  if (effectiveOpen != null && now < effectiveOpen) return "not_open";
  if (effectiveClose != null && now > effectiveClose) return "closed";

  // Past event day: registrations stay closed even if the event is still listed.
  if (event.start_date && hasEventDayPassed(event.start_date, event.end_date ?? null, now)) {
    return "closed";
  }

  return "open";
}

export function isRegistrationOpen(
  event: Pick<
    EventDetailEvent,
    "registration_opens_at" | "registration_closes_at" | "start_date" | "end_date"
  >,
): boolean {
  return getRegistrationWindowStatus(event) === "open";
}

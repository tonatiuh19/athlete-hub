/** True when the staff console route is the create-event form (no :eventId param). */
export function isStaffEventCreateRoute(
  pathname: string,
  eventIdParam?: string | null,
): boolean {
  const normalized = pathname.replace(/\/$/, "");
  return eventIdParam === "new" || normalized === "/staff/events/new";
}

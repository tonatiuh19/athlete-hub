/** Organizer member roles allowed to create/edit events (shared client + server). */
export const EVENT_EDITOR_ROLES = new Set([
  "owner",
  "organizer",
  "operations",
  "marketing",
]);

export function canOrganizerCreateEvents(role: string): boolean {
  return EVENT_EDITOR_ROLES.has(role);
}

export function canOrganizerEditEvents(role: string): boolean {
  return EVENT_EDITOR_ROLES.has(role);
}

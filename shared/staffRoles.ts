/** Organizer member roles allowed to create/edit events (shared client + server). */
export const EVENT_EDITOR_ROLES = new Set([
  "owner",
  "organizer",
  "operations",
  "marketing",
]);

/** Roles that can capture paid manual sales (no platform commission). */
export const MANUAL_SALE_ROLES = new Set([
  "owner",
  "organizer",
  "operations",
  "finance",
  "seller",
]);

export function canOrganizerCreateEvents(role: string): boolean {
  return EVENT_EDITOR_ROLES.has(role);
}

export function canOrganizerEditEvents(role: string): boolean {
  return EVENT_EDITOR_ROLES.has(role);
}

export function canOrganizerRecordManualSale(role: string): boolean {
  return MANUAL_SALE_ROLES.has(role);
}

export function canOrganizerViewPayments(role: string): boolean {
  return ["owner", "organizer", "finance", "seller"].includes(role);
}

export function canOrganizerViewAllPayments(role: string): boolean {
  return ["owner", "organizer", "finance"].includes(role);
}

export function canOrganizerViewSellerSalesSummary(role: string): boolean {
  return canOrganizerViewAllPayments(role);
}

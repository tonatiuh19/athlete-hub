import type { EventCategory } from "@shared/api";

/** Event has at least one active paid category. */
export function eventHasPaidCategories(categories: Pick<EventCategory, "price_cents">[]): boolean {
  return categories.some((c) => Number(c.price_cents) > 0);
}

/** Paid online checkout is blocked (organizer payout / Connect not ready). */
export function isPaidCheckoutUnavailable(
  categories: Pick<EventCategory, "price_cents">[],
  paymentsAvailable?: boolean,
): boolean {
  return eventHasPaidCategories(categories) && paymentsAvailable === false;
}

export function isCategoryPaidCheckoutBlocked(
  category: Pick<EventCategory, "price_cents">,
  paymentsAvailable?: boolean,
): boolean {
  return Number(category.price_cents) > 0 && paymentsAvailable === false;
}

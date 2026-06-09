import type { EventDetailResponse, EventWaiverPublic } from "@shared/api";

export function getRegistrationWaivers(
  eventDetail: EventDetailResponse | null | undefined,
): EventWaiverPublic[] {
  if (!eventDetail) return [];
  if (eventDetail.waivers?.length) return eventDetail.waivers;
  if (eventDetail.waiver) return [eventDetail.waiver];
  return [];
}

export function eventRequiresWaiver(
  eventDetail: EventDetailResponse | null | undefined,
): boolean {
  return Boolean(eventDetail?.event.requires_waiver);
}

export function isWaiverMisconfigured(
  eventDetail: EventDetailResponse | null | undefined,
): boolean {
  return eventRequiresWaiver(eventDetail) && getRegistrationWaivers(eventDetail).length === 0;
}

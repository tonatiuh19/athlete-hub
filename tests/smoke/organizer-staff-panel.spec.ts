/**
 * UI + shared contract smoke for organizer staff panel (no HTTP / no DB).
 */
import { describe, it, expect } from "vitest";
import {
  canOrganizerCreateEvents,
  canOrganizerEditEvents,
  EVENT_EDITOR_ROLES,
} from "@shared/staffRoles";
import { isStaffEventCreateRoute } from "@/utils/staffEventRoutes";
import { resolvePublicEventSlugFromPathname } from "@/utils/registrationEventSlug";
import { isEventEndBeforeStart } from "@/utils/staffEventDateValidation";
import { buildStaffEventBody } from "@/utils/buildStaffEventBody";

const baseFormValues = {
  title: "Panel Test",
  slug: "panel-test",
  sport_type_id: 1,
  short_description: "",
  description: "",
  status: "draft",
  visibility: "public",
  featured: false,
  requires_waiver: false,
  start_date: "2026-11-01T09:00",
  end_date: "",
  registration_opens_at: "",
  registration_closes_at: "",
  check_in_opens_at: "",
  check_in_closes_at: "",
  location_city: "Ciudad de México",
  location_state: "CDMX",
  location_name: "",
  location_lat: "",
  location_lng: "",
  hero_image_url: "",
  banner_image_url: "",
  max_registrations: "",
  max_registrations_per_order: "10",
  fee_presentation: "pass_through" as const,
};

describe("smoke: public event slug from pathname", () => {
  it("does not treat /staff/events/new as a marketplace slug", () => {
    expect(resolvePublicEventSlugFromPathname("/staff/events/new")).toBeNull();
    expect(resolvePublicEventSlugFromPathname("/staff/events/42/edit")).toBeNull();
  });

  it("resolves public event detail paths", () => {
    expect(resolvePublicEventSlugFromPathname("/events/marathon-2026")).toBe(
      "marathon-2026",
    );
    expect(resolvePublicEventSlugFromPathname("/events/marathon-2026/register")).toBe(
      "marathon-2026",
    );
  });
});

describe("smoke: event date validation helpers", () => {
  it("flags end before start", () => {
    expect(isEventEndBeforeStart("2026-06-26T12:30", "2026-06-12T12:30")).toBe(true);
    expect(isEventEndBeforeStart("2026-06-12T12:30", "2026-06-26T12:30")).toBe(false);
  });
});

describe("smoke: staff event create route detection", () => {
  it("treats /staff/events/new as create (no :eventId param)", () => {
    expect(isStaffEventCreateRoute("/staff/events/new", undefined)).toBe(true);
    expect(isStaffEventCreateRoute("/staff/events/new/", undefined)).toBe(true);
  });

  it("treats /staff/events/:id/edit as edit", () => {
    expect(isStaffEventCreateRoute("/staff/events/42/edit", "42")).toBe(false);
  });

  it("supports legacy param route /staff/events/new as edit path param", () => {
    expect(isStaffEventCreateRoute("/staff/events/99/edit", "new")).toBe(true);
  });
});

describe("smoke: organizer role gates", () => {
  it("owner/organizer/operations/marketing can create and edit", () => {
    for (const role of EVENT_EDITOR_ROLES) {
      expect(canOrganizerCreateEvents(role)).toBe(true);
      expect(canOrganizerEditEvents(role)).toBe(true);
    }
  });

  it("finance/timing/sponsor cannot create or edit", () => {
    for (const role of ["finance", "timing", "sponsor"] as const) {
      expect(canOrganizerCreateEvents(role)).toBe(false);
      expect(canOrganizerEditEvents(role)).toBe(false);
    }
  });
});

describe("smoke: buildStaffEventBody preserves pending_approval status", () => {
  it("passes pending_approval through for organizer save payloads", () => {
    const body = buildStaffEventBody({
      ...baseFormValues,
      status: "pending_approval",
    });
    expect(body.status).toBe("pending_approval");
  });
});

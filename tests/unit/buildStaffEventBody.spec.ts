import { describe, it, expect } from "vitest";
import { buildStaffEventBody } from "@/utils/buildStaffEventBody";
import {
  parseFormCoordinate,
  validateFormCoordinatePair,
} from "@/utils/formCoordinates";
import { parseEventCoord } from "../../server/organizerEventGuards";

const baseFormValues = {
  title: "Homún Test",
  slug: "",
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
  location_city: "Homún",
  location_state: "Yucatán",
  location_name: "Homún",
  hero_image_url: "",
  banner_image_url: "",
  max_registrations: "",
  fee_presentation: "pass_through" as const,
};

describe("buildStaffEventBody coordinates", () => {
  it("parses string lat/lng from form fields", () => {
    const body = buildStaffEventBody({
      ...baseFormValues,
      location_lat: "20.7391800",
      location_lng: "-89.2849000",
    });
    expect(body.location_lat).toBeCloseTo(20.73918, 5);
    expect(body.location_lng).toBeCloseTo(-89.2849, 4);
  });

  it("handles numeric lat/lng without throwing", () => {
    const body = buildStaffEventBody({
      ...baseFormValues,
      location_lat: 20.73918 as unknown as string,
      location_lng: -89.2849 as unknown as string,
    });
    expect(body.location_lat).toBeCloseTo(20.73918, 5);
    expect(body.location_lng).toBeCloseTo(-89.2849, 4);
  });

  it("maps empty coords to null", () => {
    const body = buildStaffEventBody({
      ...baseFormValues,
      location_lat: "",
      location_lng: "",
    });
    expect(body.location_lat).toBeNull();
    expect(body.location_lng).toBeNull();
  });

  it("parses comma decimal separators", () => {
    const body = buildStaffEventBody({
      ...baseFormValues,
      location_lat: "20,73918",
      location_lng: "-89,2849",
    });
    expect(body.location_lat).toBeCloseTo(20.73918, 4);
    expect(body.location_lng).toBeCloseTo(-89.2849, 3);
  });
});

describe("form coordinate validation", () => {
  it("requires both lat and lng when one is set", () => {
    expect(validateFormCoordinatePair(20.7, null)).toBe("pair_required");
    expect(validateFormCoordinatePair(null, -89.2)).toBe("pair_required");
    expect(validateFormCoordinatePair(null, null)).toBeNull();
  });

  it("parseFormCoordinate accepts numbers", () => {
    expect(parseFormCoordinate(20.73918)).toBeCloseTo(20.73918, 4);
  });
});

describe("parseEventCoord", () => {
  it("accepts Homún catalog coordinates", () => {
    expect(parseEventCoord(20.7391800, "lat")).toBeCloseTo(20.73918, 5);
    expect(parseEventCoord(-89.2849000, "lng")).toBeCloseTo(-89.2849, 4);
  });

  it("rejects out-of-range latitude", () => {
    expect(parseEventCoord(95, "lat")).toBe("invalid");
  });
});

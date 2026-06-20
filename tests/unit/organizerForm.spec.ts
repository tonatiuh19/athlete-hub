import { describe, expect, it } from "vitest";
import {
  buildOrganizerUpdatePatch,
  normalizeOrganizerStatus,
} from "@/utils/organizerForm";

describe("organizerForm", () => {
  it("normalizes organizer status values", () => {
    expect(normalizeOrganizerStatus("active")).toBe("active");
    expect(normalizeOrganizerStatus(" Active ")).toBe("active");
    expect(normalizeOrganizerStatus("")).toBe("pending");
    expect(normalizeOrganizerStatus(undefined)).toBe("pending");
  });

  it("builds a safe patch without empty status", () => {
    const patch = buildOrganizerUpdatePatch({
      name: "ZAZACUALA",
      slug: "zazacuala",
      email: "test@example.com",
      phone: "",
      city: "Tapilula",
      status: "",
      service_fee_percent: 11,
      fee_presentation: "pass_through" as const,
      geoCityId: null,
      savedCity: "Tapilula",
      fallbackStatus: "active",
    });

    expect(patch.status).toBe("active");
    expect(patch.city).toBe("Tapilula");
    expect(patch.phone).toBeNull();
  });

  it("omits city when changed without catalog selection", () => {
    const patch = buildOrganizerUpdatePatch({
      name: "Org",
      slug: "org",
      email: "test@example.com",
      phone: "",
      city: "New City",
      status: "active",
      service_fee_percent: 11,
      fee_presentation: "pass_through" as const,
      geoCityId: null,
      savedCity: "Old City",
    });

    expect(patch.city).toBeUndefined();
  });

  it("includes slugified slug in patch when name changes", () => {
    const patch = buildOrganizerUpdatePatch({
      name: "Tapilula MTB",
      slug: "tapilula-mtb",
      email: "test@example.com",
      phone: "",
      city: "Tapilula",
      status: "active",
      service_fee_percent: 11,
      fee_presentation: "pass_through" as const,
      geoCityId: 1,
      savedCity: "Tapilula",
    });

    expect(patch.slug).toBe("tapilula-mtb");
  });

  it("derives slug from name when slug field is empty", () => {
    const patch = buildOrganizerUpdatePatch({
      name: "Tapilula MTB",
      slug: "",
      email: "test@example.com",
      phone: "",
      city: "",
      status: "active",
      service_fee_percent: 11,
      fee_presentation: "pass_through" as const,
      geoCityId: null,
    });

    expect(patch.slug).toBe("tapilula-mtb");
  });
});

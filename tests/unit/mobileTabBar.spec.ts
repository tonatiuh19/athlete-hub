import { describe, expect, it } from "vitest";
import { shouldShowPublicMobileTabBar } from "@/utils/mobileTabBar";

describe("shouldShowPublicMobileTabBar", () => {
  it("shows on home and events list", () => {
    expect(shouldShowPublicMobileTabBar("/")).toBe(true);
    expect(shouldShowPublicMobileTabBar("/events")).toBe(true);
  });

  it("hides on event detail, staff, portal, and login", () => {
    expect(shouldShowPublicMobileTabBar("/events/tapilula-mtb")).toBe(false);
    expect(shouldShowPublicMobileTabBar("/staff/events")).toBe(false);
    expect(shouldShowPublicMobileTabBar("/portal")).toBe(false);
    expect(shouldShowPublicMobileTabBar("/portal/registrations")).toBe(false);
    expect(shouldShowPublicMobileTabBar("/login")).toBe(false);
  });

  it("hides when staff or athlete session is active", () => {
    expect(shouldShowPublicMobileTabBar("/", { staffSessionActive: true })).toBe(false);
    expect(shouldShowPublicMobileTabBar("/events", { athleteSessionActive: true })).toBe(false);
  });
});

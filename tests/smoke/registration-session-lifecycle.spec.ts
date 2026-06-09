// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import {
  isInProgressRegistrationSession,
  registrationReturnPathAfterProfile,
  saveRegistrationSession,
  clearRegistrationSession,
} from "@/utils/registrationSessionStorage";

describe("smoke: registration session lifecycle", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("registrationReturnPathAfterProfile only resumes in-progress steps", () => {
    saveRegistrationSession({
      eventSlug: "trail-nevado-toluca-2026",
      categoryId: 3,
      idempotencyKey: "idem-1",
      step: "checkout",
      paymentPublicUuid: "pay-uuid",
    });
    expect(registrationReturnPathAfterProfile()).toBe("/events/trail-nevado-toluca-2026");

    clearRegistrationSession();
    saveRegistrationSession({
      eventSlug: "trail-nevado-toluca-2026",
      categoryId: 3,
      idempotencyKey: "idem-2",
      step: "result",
    });
    expect(registrationReturnPathAfterProfile()).toBeNull();
  });

  it("isInProgressRegistrationSession excludes completed result step", () => {
    expect(
      isInProgressRegistrationSession({
        eventSlug: "e",
        categoryId: 1,
        idempotencyKey: "k",
        step: "result",
        savedAt: Date.now(),
      }),
    ).toBe(false);
    expect(
      isInProgressRegistrationSession({
        eventSlug: "e",
        categoryId: 1,
        idempotencyKey: "k",
        step: "checkout",
        savedAt: Date.now(),
      }),
    ).toBe(true);
  });
});

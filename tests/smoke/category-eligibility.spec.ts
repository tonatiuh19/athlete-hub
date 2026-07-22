import { describe, it, expect } from "vitest";
import {
  ageOnReferenceDate,
  evaluateCategoryEligibility,
  suggestCategoryId,
} from "../../shared/categoryEligibility";

describe("category eligibility", () => {
  it("computes age on event date correctly", () => {
    expect(ageOnReferenceDate("1990-06-15", "2026-06-14")).toBe(35);
    expect(ageOnReferenceDate("1990-06-15", "2026-06-15")).toBe(36);
    expect(ageOnReferenceDate("1990-06-15", "2026-06-16")).toBe(36);
  });

  it("accepts mysql Date objects without false age rejection", () => {
    // mysql2 returns DATE/DATETIME as JS Date when dateStrings is off
    const dob = new Date("1998-11-22T00:00:00.000Z");
    const eventStart = new Date("2026-07-14T21:22:00.000Z");
    expect(ageOnReferenceDate(dob, eventStart)).toBe(27);
    const result = evaluateCategoryEligibility(
      { min_age: 18, max_age: 39, gender_restriction: "male" },
      { date_of_birth: dob, gender: "male" },
      eventStart,
    );
    expect(result).toEqual({ eligible: true });
  });

  it("does not treat String(Date).slice(0,10) style refs as valid", () => {
    // Guards against the pre-fix bug path if a caller still passes a bad ref
    expect(ageOnReferenceDate("1998-11-22", "Tue Jul 14" as string)).toBeNull();
  });

  it("flags master category for younger athletes", () => {
    const result = evaluateCategoryEligibility(
      { min_age: 40, gender_restriction: "any" },
      { date_of_birth: "1995-01-01", gender: "male" },
      "2026-03-01",
    );
    expect(result.eligible).toBe(false);
    if (result.eligible === false) {
      expect(result.reason).toBe("age");
    }
  });

  it("requires profile when category has restrictions", () => {
    const result = evaluateCategoryEligibility(
      { min_age: 18, gender_restriction: "female" },
      {},
      "2026-03-01",
    );
    expect(result).toEqual({ eligible: false, reason: "missing_profile" });
  });

  it("suggests first eligible category", () => {
    const id = suggestCategoryId(
      [
        { id: 1, min_age: 40, gender_restriction: "any" },
        { id: 2, min_age: null, max_age: 39, gender_restriction: "any" },
      ],
      { date_of_birth: "1995-05-01", gender: "male" },
      "2026-03-01",
    );
    expect(id).toBe(2);
  });
});

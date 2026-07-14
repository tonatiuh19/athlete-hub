import { describe, expect, it } from "vitest";
import {
  normalizeEventBibMode,
  resolveRegistrationBibNumber,
} from "../../shared/bibMode";

describe("normalizeEventBibMode", () => {
  it("defaults unknown values to folio", () => {
    expect(normalizeEventBibMode(undefined)).toBe("folio");
    expect(normalizeEventBibMode(null)).toBe("folio");
    expect(normalizeEventBibMode("weird")).toBe("folio");
  });

  it("preserves separate", () => {
    expect(normalizeEventBibMode("separate")).toBe("separate");
  });
});

describe("resolveRegistrationBibNumber", () => {
  it("copies folio in folio mode when no override", () => {
    expect(
      resolveRegistrationBibNumber({
        registrationNumber: "TRAIL-10K-00042",
        bibMode: "folio",
      }),
    ).toBe("TRAIL-10K-00042");
  });

  it("leaves bib empty in separate mode without override", () => {
    expect(
      resolveRegistrationBibNumber({
        registrationNumber: "TRAIL-10K-00042",
        bibMode: "separate",
      }),
    ).toBeNull();
  });

  it("lets explicit override win in either mode", () => {
    expect(
      resolveRegistrationBibNumber({
        registrationNumber: "TRAIL-10K-00042",
        bibMode: "folio",
        explicitBib: "1042",
      }),
    ).toBe("1042");
    expect(
      resolveRegistrationBibNumber({
        registrationNumber: "TRAIL-10K-00042",
        bibMode: "separate",
        explicitBib: "1042",
      }),
    ).toBe("1042");
  });
});

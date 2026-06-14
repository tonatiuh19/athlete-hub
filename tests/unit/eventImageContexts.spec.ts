import { describe, expect, it } from "vitest";
import { resolveEventImageRole } from "@/constants/eventImageContexts";

describe("resolveEventImageRole", () => {
  it("maps known asset types", () => {
    expect(resolveEventImageRole("hero")).toBe("hero");
    expect(resolveEventImageRole("banner")).toBe("banner");
    expect(resolveEventImageRole("logo")).toBe("sponsor");
    expect(resolveEventImageRole("gallery")).toBe("gallery");
  });

  it("defaults unknown types to gallery", () => {
    expect(resolveEventImageRole("document")).toBe("gallery");
    expect(resolveEventImageRole(undefined)).toBe("gallery");
  });
});

import { describe, expect, it } from "vitest";
import { normalizeTheme } from "@shared/theme";

describe("normalizeTheme", () => {
  it("accepts light/dark/system", () => {
    expect(normalizeTheme("light")).toBe("light");
    expect(normalizeTheme("dark")).toBe("dark");
    expect(normalizeTheme("system")).toBe("system");
  });

  it("defaults unknown/empty to system", () => {
    expect(normalizeTheme(null)).toBe("system");
    expect(normalizeTheme("")).toBe("system");
    expect(normalizeTheme("blue")).toBe("system");
  });
});

import { describe, expect, it } from "vitest";
import { normalizeCategoryScopeType } from "../../client/components/staff/StaffCategoryScopePicker";

describe("normalizeCategoryScopeType", () => {
  it("defaults unset or unknown values to all_categories", () => {
    expect(normalizeCategoryScopeType(undefined)).toBe("all_categories");
    expect(normalizeCategoryScopeType(null)).toBe("all_categories");
    expect(normalizeCategoryScopeType("")).toBe("all_categories");
    expect(normalizeCategoryScopeType("weird")).toBe("all_categories");
  });

  it("preserves selected_categories", () => {
    expect(normalizeCategoryScopeType("selected_categories")).toBe("selected_categories");
  });
});

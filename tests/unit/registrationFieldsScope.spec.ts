/**
 * @vitest-environment node
 */
import { describe, it, expect } from "vitest";
import {
  filterRegistrationFieldsForCategory,
  isRegistrationFieldVisibleForCategory,
} from "@shared/registrationFields";

describe("registration field category scope", () => {
  const fields = [
    {
      id: 1,
      field_key: "all",
      label: "All",
      field_type: "text" as const,
      is_required: true,
      sort_order: 0,
      scope_type: "all_categories" as const,
      category_ids: [],
    },
    {
      id: 2,
      field_key: "elite",
      label: "Elite",
      field_type: "text" as const,
      is_required: true,
      sort_order: 1,
      scope_type: "selected_categories" as const,
      category_ids: [10],
    },
    {
      id: 3,
      field_key: "other",
      label: "Other",
      field_type: "text" as const,
      is_required: false,
      sort_order: 2,
      scope_type: "selected_categories" as const,
      category_ids: [99],
    },
  ];

  it("shows all_categories fields for any category", () => {
    expect(isRegistrationFieldVisibleForCategory(fields[0], 10)).toBe(true);
    expect(isRegistrationFieldVisibleForCategory(fields[0], 99)).toBe(true);
  });

  it("filters selected_categories by category id", () => {
    expect(filterRegistrationFieldsForCategory(fields, 10).map((f) => f.field_key)).toEqual([
      "all",
      "elite",
    ]);
    expect(filterRegistrationFieldsForCategory(fields, 99).map((f) => f.field_key)).toEqual([
      "all",
      "other",
    ]);
  });
});

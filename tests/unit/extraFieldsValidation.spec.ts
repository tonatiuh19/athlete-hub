import { describe, expect, it } from "vitest";
import {
  buildMxShippingTemplate,
  filterExtrasForCategory,
  isExtraVisibleForCategory,
  MAX_EXTRA_FIELDS,
  validateExtraFieldAnswers,
  validateExtraFieldDefinitions,
  validateMxShippingValue,
} from "../../shared/extraFields";
import type { EventExtra } from "@shared/api";

describe("extraFields validation", () => {
  it("rejects more than MAX_EXTRA_FIELDS definitions", () => {
    const fields = Array.from({ length: MAX_EXTRA_FIELDS + 1 }, (_, i) => ({
      field_key: `field_${i}`,
      label: `Field ${i}`,
      field_type: "text" as const,
      is_required: false,
      sort_order: i,
    }));
    expect(validateExtraFieldDefinitions(fields)).toMatch(/maximum/i);
  });

  it("rejects select fields with fewer than two options", () => {
    const err = validateExtraFieldDefinitions([
      {
        field_key: "size",
        label: "Size",
        field_type: "select",
        options_json: ["M"],
        is_required: true,
        sort_order: 0,
      },
    ]);
    expect(err).toMatch(/two select options/i);
  });

  it("requires answers for required text fields", () => {
    const err = validateExtraFieldAnswers(
      [
        {
          field_key: "nickname",
          label: "Nickname",
          field_type: "text",
          is_required: true,
          sort_order: 0,
        },
      ],
      {},
    );
    expect(err).toMatch(/nickname/i);
  });

  it("validates MX shipping required fields", () => {
    const field = buildMxShippingTemplate("Ship to");
    const err = validateExtraFieldAnswers([field], {
      mx_shipping: { street: "Av Reforma", colonia: "Juárez" },
    });
    expect(err).toMatch(/postal code|city and state/i);
  });

  it("accepts complete MX shipping block", () => {
    const field = buildMxShippingTemplate("Ship to");
    const err = validateExtraFieldAnswers([field], {
      mx_shipping: {
        street: "Av Reforma 100",
        colonia: "Juárez",
        postal_code: "06600",
        city: "Ciudad de México",
        state: "CDMX",
      },
    });
    expect(err).toBeNull();
  });

  it("validateMxShippingValue allows empty optional block", () => {
    expect(validateMxShippingValue("Ship to", false, {})).toBeNull();
  });

  it("filterExtrasForCategory respects scope", () => {
    const extras: EventExtra[] = [
      {
        id: 1,
        public_uuid: "a",
        name: "All",
        price_cents: 100,
        currency: "MXN",
        extra_type: "custom",
        max_per_athlete: 1,
        sort_order: 0,
        scope_type: "all_categories",
      },
      {
        id: 2,
        public_uuid: "b",
        name: "10K only",
        price_cents: 200,
        currency: "MXN",
        extra_type: "custom",
        max_per_athlete: 1,
        sort_order: 1,
        scope_type: "selected_categories",
        category_ids: [10],
      },
    ];
    expect(isExtraVisibleForCategory(extras[1]!, 10)).toBe(true);
    expect(isExtraVisibleForCategory(extras[1]!, 99)).toBe(false);
    expect(filterExtrasForCategory(extras, 10)).toHaveLength(2);
    expect(filterExtrasForCategory(extras, 99)).toHaveLength(1);
  });
});

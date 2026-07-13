import { describe, expect, it } from "vitest";
import {
  findMatchingFolioSegment,
  findShadowedFolioSegmentIds,
  folioPatternPreview,
  legacyRegistrationNumber,
  renderFolioPattern,
  segmentMatchesRegistration,
} from "@shared/folioSegments";

describe("folioSegments", () => {
  const segments = [
    {
      id: 1,
      sort_order: 0,
      is_active: true,
      category_scope: "selected_categories" as const,
      category_ids: [10],
      coupon_scope: "specific_coupon" as const,
      discount_code_id: 99,
    },
    {
      id: 2,
      sort_order: 1,
      is_active: true,
      category_scope: "selected_categories" as const,
      category_ids: [10],
      coupon_scope: "none" as const,
    },
    {
      id: 3,
      sort_order: 2,
      is_active: true,
      category_scope: "all_categories" as const,
      coupon_scope: "any" as const,
    },
  ];

  it("matches first rule in sort order for category + coupon", () => {
    const match = findMatchingFolioSegment(segments, {
      categoryId: 10,
      discountCodeId: 99,
    });
    expect(match?.id).toBe(1);
  });

  it("matches no-coupon rule when athlete did not use a coupon", () => {
    const match = findMatchingFolioSegment(segments, {
      categoryId: 10,
      discountCodeId: null,
    });
    expect(match?.id).toBe(2);
  });

  it("falls through to catch-all rule", () => {
    const match = findMatchingFolioSegment(segments, {
      categoryId: 20,
      discountCodeId: null,
    });
    expect(match?.id).toBe(3);
  });

  it("renders pattern with padded sequence", () => {
    const value = renderFolioPattern(
      [
        { kind: "token", token: "PREFIX" },
        { kind: "literal", value: "-" },
        { kind: "token", token: "SEQ" },
      ],
      {
        prefix_value: "RMX",
        category_code: "5K",
        sequence: 7,
        seq_padding: 4,
      },
    );
    expect(value).toBe("RMX-0007");
  });

  it("builds preview sample for organizer UI", () => {
    const preview = folioPatternPreview({
      prefix_value: "VIP",
      category_code: "10K",
      pattern_tokens: [
        { kind: "token", token: "PREFIX" },
        { kind: "token", token: "CAT" },
        { kind: "literal", value: "-" },
        { kind: "token", token: "SEQ" },
      ],
      seq_padding: 3,
    });
    expect(preview).toBe("VIP10K-001");
  });

  it("flags shadowed overlapping rules", () => {
    const shadowed = findShadowedFolioSegmentIds([
      {
        id: 1,
        sort_order: 0,
        category_scope: "all_categories",
        coupon_scope: "any",
      },
      {
        id: 2,
        sort_order: 1,
        category_scope: "all_categories",
        coupon_scope: "any",
      },
    ]);
    expect(shadowed).toEqual([2]);
  });

  it("legacy fallback format stays stable", () => {
    expect(legacyRegistrationNumber(42, 3)).toBe("REG-0042-00003");
  });

  it("coupon none rejects discounted registrations", () => {
    expect(
      segmentMatchesRegistration(
        {
          sort_order: 0,
          coupon_scope: "none",
          category_scope: "all_categories",
        },
        { categoryId: 1, discountCodeId: 5 },
      ),
    ).toBe(false);
  });
});

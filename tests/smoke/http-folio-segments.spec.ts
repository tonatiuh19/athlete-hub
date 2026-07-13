/**
 * @vitest-environment node
 */
import { describe, it, expect, afterEach } from "vitest";
import request from "supertest";
import {
  mountStaffPortalScenario,
  teardownStaffPortalScenario,
  STAFF_SCENARIO,
} from "../helpers/staffPortalHarness";
import { staffSeeds } from "../helpers/staffPortalScenarioDb";

describe("HTTP smoke: organizer folio segments", () => {
  afterEach(async () => {
    await teardownStaffPortalScenario();
  });

  it("PUT saves folio segment rules with pattern and category scope", async () => {
    const { app, authHeader } = await mountStaffPortalScenario(staffSeeds.draftWithCategory());

    const saved = await request(app)
      .put(`/api/organizer/events/${STAFF_SCENARIO.defaultEventId}/folio-segments`)
      .set("Authorization", authHeader)
      .send({
        segments: [
          {
            name: "5K default",
            sort_order: 0,
            is_active: true,
            category_scope: "selected_categories",
            category_ids: [500],
            coupon_scope: "any",
            counter_scope: "segment",
            prefix_value: "RMX",
            category_code: "5K",
            pattern_tokens: [
              { kind: "token", token: "PREFIX" },
              { kind: "literal", value: "-" },
              { kind: "token", token: "CAT" },
              { kind: "literal", value: "-" },
              { kind: "token", token: "SEQ" },
            ],
            seq_padding: 4,
            start_number: 1,
          },
        ],
      });

    expect(saved.status).toBe(200);
    expect(saved.body.segments).toHaveLength(1);
    expect(saved.body.segments[0].name).toBe("5K default");
    expect(saved.body.segments[0].category_ids).toEqual([500]);
    expect(saved.body.segments[0].prefix_value).toBe("RMX");

    const listed = await request(app)
      .get(`/api/organizer/events/${STAFF_SCENARIO.defaultEventId}/folio-segments`)
      .set("Authorization", authHeader);

    expect(listed.status).toBe(200);
    expect(listed.body.segments).toHaveLength(1);
  });

  it("PUT rejects selected_categories without category_ids", async () => {
    const { app, authHeader } = await mountStaffPortalScenario(staffSeeds.draftWithCategory());

    const saved = await request(app)
      .put(`/api/organizer/events/${STAFF_SCENARIO.defaultEventId}/folio-segments`)
      .set("Authorization", authHeader)
      .send({
        segments: [
          {
            name: "Broken",
            sort_order: 0,
            category_scope: "selected_categories",
            category_ids: [],
            coupon_scope: "any",
            counter_scope: "segment",
            pattern_tokens: [{ kind: "token", token: "SEQ" }],
          },
        ],
      });

    expect(saved.status).toBe(400);
    expect(saved.body.error).toMatch(/at least one category/i);
  });

  it("PUT rejects segment without counter_scope", async () => {
    const { app, authHeader } = await mountStaffPortalScenario(staffSeeds.draftWithCategory());

    const saved = await request(app)
      .put(`/api/organizer/events/${STAFF_SCENARIO.defaultEventId}/folio-segments`)
      .set("Authorization", authHeader)
      .send({
        segments: [
          {
            name: "Broken counter",
            sort_order: 0,
            category_scope: "all_categories",
            coupon_scope: "none",
            pattern_tokens: [{ kind: "token", token: "SEQ" }],
          },
        ],
      });

    expect(saved.status).toBe(400);
    expect(saved.body.error).toMatch(/invalid segment/i);
  });
});

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

describe("HTTP smoke: organizer registration fields category scope", () => {
  afterEach(async () => {
    await teardownStaffPortalScenario();
  });

  it("PUT saves scope_type and category_ids per field", async () => {
    const { app, authHeader } = await mountStaffPortalScenario(staffSeeds.draftWithCategory());

    const saved = await request(app)
      .put(`/api/organizer/events/${STAFF_SCENARIO.defaultEventId}/registration-fields`)
      .set("Authorization", authHeader)
      .send({
        fields: [
          {
            label: "Elite bib name",
            field_type: "text",
            is_required: true,
            scope_type: "selected_categories",
            category_ids: [500],
          },
          {
            label: "General note",
            field_type: "textarea",
            scope_type: "all_categories",
          },
        ],
      });

    expect(saved.status).toBe(200);
    expect(saved.body.fields).toHaveLength(2);
    const elite = saved.body.fields.find(
      (row: { label: string }) => row.label === "Elite bib name",
    );
    expect(elite.scope_type).toBe("selected_categories");
    expect(elite.category_ids).toEqual([500]);
  });

  it("PUT rejects selected_categories without category_ids", async () => {
    const { app, authHeader } = await mountStaffPortalScenario(staffSeeds.draftWithCategory());

    const saved = await request(app)
      .put(`/api/organizer/events/${STAFF_SCENARIO.defaultEventId}/registration-fields`)
      .set("Authorization", authHeader)
      .send({
        fields: [
          {
            label: "Broken scope",
            field_type: "text",
            scope_type: "selected_categories",
            category_ids: [],
          },
        ],
      });

    expect(saved.status).toBe(400);
    expect(saved.body.error).toMatch(/at least one category/i);
  });

  it("PUT rejects invalid category selection", async () => {
    const { app, authHeader } = await mountStaffPortalScenario(staffSeeds.draftWithCategory());

    const saved = await request(app)
      .put(`/api/organizer/events/${STAFF_SCENARIO.defaultEventId}/registration-fields`)
      .set("Authorization", authHeader)
      .send({
        fields: [
          {
            label: "Wrong category",
            field_type: "text",
            scope_type: "selected_categories",
            category_ids: [99999],
          },
        ],
      });

    expect(saved.status).toBe(400);
    expect(saved.body.error).toMatch(/invalid category/i);
  });
});

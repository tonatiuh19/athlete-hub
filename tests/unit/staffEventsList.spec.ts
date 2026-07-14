import { describe, it, expect } from "vitest";
import {
  buildStaffEventsPagination,
  isStaffEventStatus,
  parseStaffEventsListQuery,
  STAFF_EVENTS_SORT_COLUMNS,
} from "../../server/staffEventsList";

describe("parseStaffEventsListQuery", () => {
  it("defaults to page 1, limit 20, start_date DESC", () => {
    const q = parseStaffEventsListQuery({});
    expect(q.page).toBe(1);
    expect(q.limit).toBe(20);
    expect(q.offset).toBe(0);
    expect(q.sortCol).toBe(STAFF_EVENTS_SORT_COLUMNS.start_date);
    expect(q.sortDir).toBe("DESC");
  });

  it("clamps page to minimum 1", () => {
    expect(parseStaffEventsListQuery({ page: 0 }).page).toBe(1);
    expect(parseStaffEventsListQuery({ page: -5 }).page).toBe(1);
    expect(parseStaffEventsListQuery({ page: "abc" }).page).toBe(1);
  });

  it("clamps limit between 1 and 100", () => {
    expect(parseStaffEventsListQuery({ limit: 0 }).limit).toBe(20);
    expect(parseStaffEventsListQuery({ limit: -3 }).limit).toBe(20);
    expect(parseStaffEventsListQuery({ limit: 500 }).limit).toBe(100);
    expect(parseStaffEventsListQuery({ limit: 50 }).limit).toBe(50);
    expect(parseStaffEventsListQuery({ limit: 1 }).limit).toBe(1);
  });

  it("computes offset from page and limit", () => {
    expect(parseStaffEventsListQuery({ page: 3, limit: 25 }).offset).toBe(50);
  });

  it("maps known sort keys and falls back to start_date", () => {
    expect(parseStaffEventsListQuery({ sortBy: "title" }).sortCol).toBe(
      STAFF_EVENTS_SORT_COLUMNS.title,
    );
    expect(parseStaffEventsListQuery({ sortBy: "registration_count" }).sortCol).toBe(
      STAFF_EVENTS_SORT_COLUMNS.registration_count,
    );
    expect(parseStaffEventsListQuery({ sortBy: "nope" }).sortCol).toBe(
      STAFF_EVENTS_SORT_COLUMNS.start_date,
    );
  });

  it("normalizes sortDir case-insensitively", () => {
    expect(parseStaffEventsListQuery({ sortDir: "asc" }).sortDir).toBe("ASC");
    expect(parseStaffEventsListQuery({ sortDir: "ASC" }).sortDir).toBe("ASC");
    expect(parseStaffEventsListQuery({ sortDir: "weird" }).sortDir).toBe("DESC");
  });
});

describe("buildStaffEventsPagination", () => {
  it("returns totalPages at least 1 for empty result sets", () => {
    expect(buildStaffEventsPagination(1, 20, 0)).toEqual({
      page: 1,
      limit: 20,
      total: 0,
      totalPages: 1,
    });
  });

  it("ceil-divides total by limit", () => {
    expect(buildStaffEventsPagination(2, 20, 45).totalPages).toBe(3);
    expect(buildStaffEventsPagination(1, 20, 20).totalPages).toBe(1);
    expect(buildStaffEventsPagination(1, 20, 21).totalPages).toBe(2);
  });
});

describe("isStaffEventStatus", () => {
  it("accepts known statuses only", () => {
    expect(isStaffEventStatus("draft")).toBe(true);
    expect(isStaffEventStatus("pending_approval")).toBe(true);
    expect(isStaffEventStatus("published")).toBe(true);
    expect(isStaffEventStatus("bogus")).toBe(false);
    expect(isStaffEventStatus("")).toBe(false);
  });
});

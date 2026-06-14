import { describe, it, expect } from "vitest";
import {
  defaultCheckInWindowBounds,
  evaluateCheckInWindow,
  parseIncomingEventDateTime,
  validateCheckInWindowFields,
} from "@shared/checkInWindow";

describe("check-in window", () => {
  const baseEvent = {
    startDate: "2026-06-15 08:00:00",
    endDate: "2026-06-15 18:00:00",
    timezone: "America/Mexico_City",
  };

  it("is open on event day during event hours (default window)", () => {
    const now = new Date("2026-06-15T15:00:00.000Z");
    const result = evaluateCheckInWindow(baseEvent, { now });
    expect(result.open).toBe(true);
    expect(result.status).toBe("open");
    expect(result.usesCustomWindow).toBe(false);
  });

  it("is closed the day before the event", () => {
    const now = new Date("2026-06-14T18:00:00.000Z");
    const result = evaluateCheckInWindow(baseEvent, { now });
    expect(result.open).toBe(false);
    expect(result.status).toBe("not_yet");
  });

  it("is closed the day after a single-day event", () => {
    const now = new Date("2026-06-16T15:00:00.000Z");
    const result = evaluateCheckInWindow(baseEvent, { now });
    expect(result.open).toBe(false);
    expect(result.status).toBe("closed");
  });

  it("allows multi-day events across inclusive calendar days", () => {
    const event = {
      startDate: "2026-06-14 07:00:00",
      endDate: "2026-06-15 20:00:00",
      timezone: "America/Mexico_City",
    };
    const sat = new Date("2026-06-14T16:00:00.000Z");
    const sun = new Date("2026-06-15T16:00:00.000Z");
    expect(evaluateCheckInWindow(event, { now: sat }).open).toBe(true);
    expect(evaluateCheckInWindow(event, { now: sun }).open).toBe(true);
    const fri = new Date("2026-06-13T16:00:00.000Z");
    expect(evaluateCheckInWindow(event, { now: fri }).open).toBe(false);
  });

  it("defaults to midnight first day through end_date", () => {
    const bounds = defaultCheckInWindowBounds(baseEvent.startDate, baseEvent.endDate);
    expect(bounds.opensAtLocal).toBe("2026-06-15 00:00:00");
    expect(bounds.closesAtLocal).toBe("2026-06-15 18:00:00");
  });

  it("respects per-event check_in_opens_at / check_in_closes_at", () => {
    const event = {
      ...baseEvent,
      checkInOpensAt: "2026-06-15 06:00:00",
      checkInClosesAt: "2026-06-15 12:00:00",
    };
    const inside = new Date("2026-06-15T17:00:00.000Z");
    const outside = new Date("2026-06-15T20:00:00.000Z");
    const insideResult = evaluateCheckInWindow(event, { now: inside });
    const outsideResult = evaluateCheckInWindow(event, { now: outside });
    expect(insideResult.open).toBe(true);
    expect(insideResult.usesCustomWindow).toBe(true);
    expect(outsideResult.open).toBe(false);
    expect(outsideResult.status).toBe("closed");
  });

  it("closes at start_date when end_date is missing (default window)", () => {
    const event = {
      startDate: "2026-06-15 08:00:00",
      timezone: "America/Mexico_City",
    };
    const bounds = defaultCheckInWindowBounds(event.startDate, null);
    expect(bounds.closesAtLocal).toBe("2026-06-15 08:00:00");

    const during = new Date("2026-06-15T14:00:00.000Z");
    const after = new Date("2026-06-15T15:00:00.000Z");
    expect(evaluateCheckInWindow(event, { now: during }).open).toBe(true);
    expect(evaluateCheckInWindow(event, { now: after }).open).toBe(false);
    expect(evaluateCheckInWindow(event, { now: after }).status).toBe("closed");
  });

  it("caps custom check_in_closes_at at event end_date", () => {
    const event = {
      startDate: "2026-06-15 08:00:00",
      endDate: "2026-06-15 18:00:00",
      timezone: "America/Mexico_City",
      checkInOpensAt: "2026-06-15 06:00:00",
      checkInClosesAt: "2026-06-15 22:00:00",
    };
    const afterEventEnd = new Date("2026-06-16T01:00:00.000Z");
    const result = evaluateCheckInWindow(event, { now: afterEventEnd });
    expect(result.open).toBe(false);
    expect(result.closesAtLocal).toBe("2026-06-15 18:00:00");
  });

  it("validateCheckInWindowFields rejects partial pair and closes after event end", () => {
    expect(
      validateCheckInWindowFields({
        checkInOpensAt: "2026-06-15T06:00",
        checkInClosesAt: "",
        startDate: "2026-06-15T08:00",
        endDate: "2026-06-15T18:00",
      }),
    ).toBe("pair_required");

    expect(
      validateCheckInWindowFields({
        checkInOpensAt: "2026-06-15T06:00",
        checkInClosesAt: "2026-06-15T22:00",
        startDate: "2026-06-15T08:00",
        endDate: "2026-06-15T18:00",
      }),
    ).toBe("closes_after_event_end");

    expect(
      validateCheckInWindowFields({
        checkInOpensAt: "2026-06-15T06:00",
        checkInClosesAt: "2026-06-15T12:00",
        startDate: "2026-06-15T08:00",
        endDate: "2026-06-15T18:00",
      }),
    ).toBeNull();
  });

  it("parseIncomingEventDateTime normalizes ISO for wall-clock comparisons", () => {
    expect(parseIncomingEventDateTime("2026-06-15T18:30:00.000Z")).toBe(
      "2026-06-15 18:30:00",
    );
    expect(parseIncomingEventDateTime("")).toBeNull();
  });
});

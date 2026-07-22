import { describe, expect, it } from "vitest";
import {
  getEventLifecycleEndMs,
  hasEventDayPassed,
} from "../../shared/eventLifecycle";
import { getRegistrationWindowStatus } from "../../client/utils/eventRegistrationWindow";
import { MARKETPLACE_AUTO_DEACTIVATE_SQL } from "../../server/eventLifecycle";

describe("eventLifecycle", () => {
  it("ends at UTC end of calendar day for start_date", () => {
    const end = getEventLifecycleEndMs("2026-07-20T15:00:00.000Z");
    expect(end).toBe(Date.UTC(2026, 6, 20, 23, 59, 59, 999));
  });

  it("prefers end_date when present", () => {
    const end = getEventLifecycleEndMs(
      "2026-07-20T15:00:00.000Z",
      "2026-07-22T08:00:00.000Z",
    );
    expect(end).toBe(Date.UTC(2026, 6, 22, 23, 59, 59, 999));
  });

  it("hasEventDayPassed is false during event day", () => {
    const during = Date.UTC(2026, 6, 20, 12, 0, 0, 0);
    expect(hasEventDayPassed("2026-07-20T10:00:00.000Z", null, during)).toBe(
      false,
    );
  });

  it("hasEventDayPassed is true after event day", () => {
    const after = Date.UTC(2026, 6, 21, 0, 0, 0, 0);
    expect(hasEventDayPassed("2026-07-20T10:00:00.000Z", null, after)).toBe(
      true,
    );
  });

  it("hasEventDayPassed is false at last ms of event day", () => {
    const lastMs = Date.UTC(2026, 6, 20, 23, 59, 59, 999);
    expect(hasEventDayPassed("2026-07-20T10:00:00.000Z", null, lastMs)).toBe(
      false,
    );
  });

  it("multi-day event stays open until end_date day finishes", () => {
    const mid = Date.UTC(2026, 6, 21, 12, 0, 0, 0);
    expect(
      hasEventDayPassed(
        "2026-07-20T10:00:00.000Z",
        "2026-07-22T08:00:00.000Z",
        mid,
      ),
    ).toBe(false);
    const after = Date.UTC(2026, 6, 23, 0, 0, 0, 0);
    expect(
      hasEventDayPassed(
        "2026-07-20T10:00:00.000Z",
        "2026-07-22T08:00:00.000Z",
        after,
      ),
    ).toBe(true);
  });

  it("exports marketplace SQL predicate for list hygiene", () => {
    expect(MARKETPLACE_AUTO_DEACTIVATE_SQL).toContain(
      "auto_deactivate_after_event",
    );
    expect(MARKETPLACE_AUTO_DEACTIVATE_SQL).toContain("UTC_DATE()");
  });
});

describe("getRegistrationWindowStatus past event", () => {
  it("closes registration after event day even without closes_at", () => {
    const after = Date.UTC(2026, 6, 21, 0, 0, 0, 0);
    const status = getRegistrationWindowStatus(
      {
        start_date: "2026-07-20T10:00:00.000Z",
        end_date: null as unknown as undefined,
        registration_opens_at: null,
        registration_closes_at: null,
      },
      after,
    );
    expect(status).toBe("closed");
  });

  it("stays open before event day when window is open", () => {
    const during = Date.UTC(2026, 6, 19, 12, 0, 0, 0);
    const status = getRegistrationWindowStatus(
      {
        start_date: "2026-07-20T10:00:00.000Z",
        registration_opens_at: "2026-01-01T00:00:00.000Z",
        registration_closes_at: null,
      },
      during,
    );
    expect(status).toBe("open");
  });

  it("respects explicit closes_at before event day", () => {
    const mid = Date.UTC(2026, 6, 10, 12, 0, 0, 0);
    const status = getRegistrationWindowStatus(
      {
        start_date: "2026-07-20T10:00:00.000Z",
        registration_opens_at: "2026-01-01T00:00:00.000Z",
        registration_closes_at: "2026-07-05T00:00:00.000Z",
      },
      mid,
    );
    expect(status).toBe("closed");
  });
});

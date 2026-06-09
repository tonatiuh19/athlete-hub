// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { parseIsoDate, toIsoDate } from "@/utils/datePickerValue";

describe("smoke: datePickerValue", () => {
  it("round-trips ISO dates", () => {
    const date = parseIsoDate("1995-03-10");
    expect(date?.getFullYear()).toBe(1995);
    expect(toIsoDate(date)).toBe("1995-03-10");
  });

  it("rejects invalid ISO strings", () => {
    expect(parseIsoDate("03-10-1995")).toBeUndefined();
    expect(parseIsoDate("")).toBeUndefined();
  });
});

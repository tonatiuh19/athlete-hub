import { describe, expect, it } from "vitest";
import {
  allowedNextVersions,
  checkDeployVersion,
  compareSemver,
  isConsecutiveBump,
  parseSemver,
  type DeployVersionCheck,
} from "@shared/deployVersion";

function expectRejected(r: DeployVersionCheck, pattern: RegExp | string) {
  expect(r).toEqual(
    expect.objectContaining({
      ok: false,
      reason: expect.any(String),
    }),
  );
  if (r.ok === false) {
    if (typeof pattern === "string") {
      expect(r.reason).toContain(pattern);
    } else {
      expect(r.reason).toMatch(pattern);
    }
  }
}

describe("parseSemver", () => {
  it("parses MAJOR.MINOR.PATCH", () => {
    expect(parseSemver("1.4.8")).toEqual([1, 4, 8]);
    expect(parseSemver("0.0.1")).toEqual([0, 0, 1]);
    expect(parseSemver("10.20.30")).toEqual([10, 20, 30]);
  });

  it("rejects incomplete and malformed versions", () => {
    for (const bad of [
      "1.",
      "1.0.",
      ".0.0",
      ".1.0",
      "1.0",
      "1",
      "1.0.0.",
      "v1.4.8",
      "1.4.8-beta",
      "01.2.3",
      "1.02.3",
      "1.2.03",
      "",
      " ",
    ]) {
      expect(parseSemver(bad), bad).toBeNull();
    }
  });
});

describe("compareSemver", () => {
  it("orders patch / minor / major", () => {
    expect(compareSemver([1, 4, 7], [1, 4, 8])).toBe(-1);
    expect(compareSemver([1, 4, 8], [1, 4, 7])).toBe(1);
    expect(compareSemver([1, 5, 0], [1, 4, 99])).toBe(1);
    expect(compareSemver([2, 0, 0], [1, 9, 9])).toBe(1);
    expect(compareSemver([1, 4, 7], [1, 4, 7])).toBe(0);
  });
});

describe("consecutive bumps", () => {
  it("lists only next patch / minor / major from current", () => {
    expect(allowedNextVersions([1, 4, 7]).map((v) => v.join("."))).toEqual([
      "1.4.8",
      "1.5.0",
      "2.0.0",
    ]);
  });

  it("accepts consecutive bumps and rejects skips like 10.4.7", () => {
    expect(isConsecutiveBump([1, 4, 7], [1, 4, 8])).toBe(true);
    expect(isConsecutiveBump([1, 4, 7], [1, 5, 0])).toBe(true);
    expect(isConsecutiveBump([1, 4, 7], [2, 0, 0])).toBe(true);
    expect(isConsecutiveBump([1, 4, 7], [10, 4, 7])).toBe(false);
    expect(isConsecutiveBump([1, 4, 7], [1, 4, 9])).toBe(false);
    expect(isConsecutiveBump([1, 4, 7], [1, 6, 0])).toBe(false);
    expect(isConsecutiveBump([1, 4, 7], [1, 5, 1])).toBe(false);
  });
});

describe("checkDeployVersion", () => {
  it("blocks older than production", () => {
    expectRejected(
      checkDeployVersion("1.4.6", "1.4.7"),
      /older than production/,
    );
  });

  it("blocks equal to production", () => {
    expectRejected(
      checkDeployVersion("1.4.7", "1.4.7"),
      /already in production/,
    );
  });

  it("allows consecutive newer versions", () => {
    expect(checkDeployVersion("1.4.8", "1.4.7")).toEqual({
      ok: true,
      version: "1.4.8",
    });
    expect(checkDeployVersion("1.5.0", "1.4.7")).toEqual({
      ok: true,
      version: "1.5.0",
    });
    expect(checkDeployVersion("2.0.0", "1.4.7")).toEqual({
      ok: true,
      version: "2.0.0",
    });
  });

  it("blocks accidental large jumps like 10.4.7", () => {
    const r = checkDeployVersion("10.4.7", "1.4.7");
    expectRejected(r, /skips ahead/);
    expectRejected(r, "1.4.8");
    expectRejected(r, "1.5.0");
    expectRejected(r, "2.0.0");
  });

  it("blocks skipped patch/minor bumps", () => {
    expect(checkDeployVersion("1.4.9", "1.4.7").ok).toBe(false);
    expect(checkDeployVersion("1.6.0", "1.4.7").ok).toBe(false);
  });

  it("allows any valid semver when production is unset", () => {
    expect(checkDeployVersion("0.1.0", null)).toEqual({
      ok: true,
      version: "0.1.0",
    });
  });

  it("rejects invalid formats with a clear message", () => {
    for (const bad of ["1.", "1.0.", ".0.0", "01.2.3"]) {
      expectRejected(checkDeployVersion(bad, "1.4.7"), /Invalid version/);
    }
  });
});

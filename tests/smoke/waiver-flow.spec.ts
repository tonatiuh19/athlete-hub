import { describe, it, expect } from "vitest";
import { parseWaiverSignatures, validateWaiverSignaturesForEvent, getRegistrationWaiverStatus } from "../../server/eventWaivers";
import { WAIVER_ACCEPTANCE_SIGNATURE } from "../../shared/waiverConstants";
import {
  FIXTURE_REGISTRATION_ID,
  registrationWaiverStatusPool,
  waiverValidationPool,
} from "../helpers/mockDb";

describe("smoke: waiver signature parsing", () => {
  it("accepts multi-waiver checkbox signatures with version binding", () => {
    const parsed = parseWaiverSignatures({
      waiverSignatures: [
        { waiverId: 1, signature: WAIVER_ACCEPTANCE_SIGNATURE, waiverVersion: 2 },
        { waiverId: 2, signature: WAIVER_ACCEPTANCE_SIGNATURE, waiverVersion: 1 },
      ],
    });
    expect(parsed).toHaveLength(2);
    expect(parsed![0]).toMatchObject({ waiverId: 1, waiverVersion: 2 });
  });

  it("supports snake_case legacy API fields", () => {
    const parsed = parseWaiverSignatures({
      waiverSignatures: [{ waiver_id: 3, waiver_version: 4 }],
    });
    expect(parsed).toEqual([
      { waiverId: 3, signature: WAIVER_ACCEPTANCE_SIGNATURE, waiverVersion: 4 },
    ]);
  });

  it("falls back to legacy single waiverId + waiverSignature", () => {
    const parsed = parseWaiverSignatures({
      waiverId: 9,
      waiverSignature: "Jane Athlete",
    });
    expect(parsed).toEqual([{ waiverId: 9, signature: "Jane Athlete" }]);
  });

  it("rejects empty or invalid signatures", () => {
    expect(parseWaiverSignatures({ waiverSignatures: [] })).toBeNull();
    expect(parseWaiverSignatures({ waiverSignatures: [{ waiverId: 1, signature: "x" }] })).toBeNull();
    expect(parseWaiverSignatures(null)).toBeNull();
  });
});

describe("smoke: waiver validation against active event waivers", () => {
  it("passes when all active waivers are signed at current version", async () => {
    const pool = waiverValidationPool();
    const result = await validateWaiverSignaturesForEvent(pool, 42, [
      { waiverId: 1, signature: WAIVER_ACCEPTANCE_SIGNATURE, waiverVersion: 2 },
      { waiverId: 2, signature: WAIVER_ACCEPTANCE_SIGNATURE, waiverVersion: 1 },
    ]);
    expect(result).toEqual({ ok: true });
  });

  it("fails when a required waiver is missing", async () => {
    const pool = waiverValidationPool();
    const result = await validateWaiverSignaturesForEvent(pool, 42, [
      { waiverId: 1, signature: WAIVER_ACCEPTANCE_SIGNATURE, waiverVersion: 2 },
    ]);
    expect(result).toEqual({ error: "All waivers must be accepted" });
  });

  it("fails on stale client-bound waiver version (organizer bumped waiver)", async () => {
    const pool = waiverValidationPool();
    const result = await validateWaiverSignaturesForEvent(pool, 42, [
      { waiverId: 1, signature: WAIVER_ACCEPTANCE_SIGNATURE, waiverVersion: 1 },
      { waiverId: 2, signature: WAIVER_ACCEPTANCE_SIGNATURE, waiverVersion: 1 },
    ]);
    expect(result).toEqual({
      error: "Waiver was updated — please review and accept the latest version",
    });
  });

  it("allows missing waiverVersion (backward compat) when waiver id matches", async () => {
    const pool = waiverValidationPool();
    const result = await validateWaiverSignaturesForEvent(pool, 42, [
      { waiverId: 1, signature: WAIVER_ACCEPTANCE_SIGNATURE },
      { waiverId: 2, signature: WAIVER_ACCEPTANCE_SIGNATURE },
    ]);
    expect(result).toEqual({ ok: true });
  });
});

describe("smoke: registration waiver status (check-in / portal outdated badge)", () => {
  it("returns signed + not outdated when versions match", async () => {
    const pool = registrationWaiverStatusPool({});
    const status = await getRegistrationWaiverStatus(pool, FIXTURE_REGISTRATION_ID);
    expect(status.signed).toBe(true);
    expect(status.outdated).toBe(false);
    expect(status.outdatedWaivers).toHaveLength(0);
  });

  it("flags outdated when organizer published newer waiver version", async () => {
    const pool = registrationWaiverStatusPool({
      signatures: [
        { waiver_id: 1, waiver_version_at_sign: 1 },
        { waiver_id: 2, waiver_version_at_sign: 1 },
      ],
    });
    const status = await getRegistrationWaiverStatus(pool, FIXTURE_REGISTRATION_ID);
    expect(status.outdated).toBe(true);
    expect(status.outdatedWaivers.some((w) => w.waiverId === 1)).toBe(true);
  });

  it("treats waiver as satisfied when event does not require waiver", async () => {
    const pool = registrationWaiverStatusPool({ requiresWaiver: false, waiverSignedAt: null });
    const status = await getRegistrationWaiverStatus(pool, FIXTURE_REGISTRATION_ID);
    expect(status).toEqual({ signed: true, outdated: false, outdatedWaivers: [] });
  });

  it("detects unsigned registration when requires waiver but no signatures", async () => {
    const pool = registrationWaiverStatusPool({
      waiverSignedAt: null,
      signatures: [],
    });
    const status = await getRegistrationWaiverStatus(pool, FIXTURE_REGISTRATION_ID);
    expect(status.signed).toBe(false);
    expect(status.outdated).toBe(true);
  });
});

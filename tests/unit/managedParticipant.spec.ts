import { describe, expect, it } from "vitest";
import { isMinorOnReferenceDate } from "../../shared/groupCheckout";

describe("managed participant / M3 rules", () => {
  it("treats under-18 on event day as minor", () => {
    expect(isMinorOnReferenceDate("2018-07-14", "2026-07-13")).toBe(true);
    expect(isMinorOnReferenceDate("2008-07-14", "2026-07-13")).toBe(true);
    expect(isMinorOnReferenceDate("2008-07-12", "2026-07-13")).toBe(false);
  });

  it("derives wallet hold flags for guest claim vs managed", () => {
    const unclaimed = { guest_claim_token: "tok", purchaser_athlete_id: 1, athlete_id: 2 };
    const managed = { guest_claim_token: null, purchaser_athlete_id: 1, athlete_id: 2 };
    const self = { guest_claim_token: null, purchaser_athlete_id: 1, athlete_id: 1 };

    const flags = (r: typeof unclaimed) => {
      const claimPending = Boolean(r.guest_claim_token);
      const isManaged =
        r.purchaser_athlete_id != null &&
        Number(r.purchaser_athlete_id) !== Number(r.athlete_id) &&
        !claimPending;
      return {
        wallet_held_by_purchaser: claimPending || isManaged,
        is_managed_participant: isManaged,
      };
    };

    expect(flags(unclaimed)).toEqual({
      wallet_held_by_purchaser: true,
      is_managed_participant: false,
    });
    expect(flags(managed)).toEqual({
      wallet_held_by_purchaser: true,
      is_managed_participant: true,
    });
    expect(flags(self)).toEqual({
      wallet_held_by_purchaser: false,
      is_managed_participant: false,
    });
  });
});

import { describe, it, expect, beforeEach } from "vitest";
import { claimGuestRegistration } from "../../server/groupRegistration";
import { GroupRegistrationMemoryPool } from "../helpers/groupRegistrationMemoryPool";
import { SCENARIO } from "../helpers/scenarioDb";

describe("claimGuestRegistration edge cases", () => {
  let memory: GroupRegistrationMemoryPool;

  beforeEach(() => {
    memory = new GroupRegistrationMemoryPool();
  });

  it("rejects empty claim token", async () => {
    const result = await claimGuestRegistration(memory.asPool(), SCENARIO.athleteId, "  ");
    expect(result.ok).toBe(false);
    if (result.ok === false) expect(result.error.status).toBe(400);
  });

  it("returns 404 for unknown token", async () => {
    const result = await claimGuestRegistration(
      memory.asPool(),
      SCENARIO.athleteId,
      "00000000-0000-4000-8000-000000000099",
    );
    expect(result.ok).toBe(false);
    if (result.ok === false) {
      expect(result.error.status).toBe(404);
      expect(result.error.body.code).toBe("claim_not_found");
    }
  });

  it("rejects email mismatch", async () => {
    const token = "11111111-1111-4111-8111-111111111111";
    memory.addConfirmedRegistration(2001, {
      guest_claim_token: token,
    });
    memory.athletes.set(2001, {
      id: 2001,
      email: "guest@test.local",
      first_name: "Guest",
      last_name: "User",
      date_of_birth: "2010-01-01",
      gender: "male",
      deleted_at: null,
      status: "active",
    });

    const result = await claimGuestRegistration(memory.asPool(), SCENARIO.athleteId, token);
    expect(result.ok).toBe(false);
    if (result.ok === false) {
      expect(result.error.status).toBe(403);
      expect(result.error.body.code).toBe("email_mismatch");
    }
  });

  it("rejects when claimer already registered for event", async () => {
    const token = "22222222-2222-4222-8222-222222222222";
    const sharedEmail = "claimer@test.local";
    const guestAthleteId = 2005;
    const claimerId = 2006;
    memory.athletes.set(guestAthleteId, {
      id: guestAthleteId,
      email: sharedEmail,
      first_name: "Guest",
      last_name: "Holder",
      date_of_birth: "1992-06-01",
      gender: "female",
      deleted_at: null,
      status: "active",
    });
    memory.athletes.set(claimerId, {
      id: claimerId,
      email: sharedEmail,
      first_name: "Claimer",
      last_name: "Runner",
      date_of_birth: "1990-01-01",
      gender: "male",
      deleted_at: null,
      status: "active",
    });
    memory.addConfirmedRegistration(guestAthleteId, { guest_claim_token: token });
    memory.addConfirmedRegistration(claimerId);

    const result = await claimGuestRegistration(memory.asPool(), claimerId, token);
    expect(result.ok).toBe(false);
    if (result.ok === false) {
      expect(result.error.status).toBe(409);
      expect(result.error.body.code).toBe("already_registered");
    }
  });

  it("reassigns registration to claimer and clears token", async () => {
    const token = "33333333-3333-4333-8333-333333333333";
    const guestAthleteId = 2002;
    memory.athletes.set(guestAthleteId, {
      id: guestAthleteId,
      email: "family@test.local",
      first_name: "Family",
      last_name: "Member",
      date_of_birth: "1992-06-01",
      gender: "female",
      deleted_at: null,
      status: "active",
    });
    const reg = memory.addConfirmedRegistration(guestAthleteId, {
      guest_claim_token: token,
    });

    const result = await claimGuestRegistration(memory.asPool(), 1002, token);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.registration.public_uuid).toBe(reg.public_uuid);
    }
    expect(reg.athlete_id).toBe(1002);
    expect(reg.guest_claim_token).toBeNull();
  });

  it("clears token when guest athlete matches claimer", async () => {
    const token = "44444444-4444-4444-8444-444444444444";
    const reg = memory.addConfirmedRegistration(1002, {
      guest_claim_token: token,
    });

    const result = await claimGuestRegistration(memory.asPool(), 1002, token);
    expect(result.ok).toBe(true);
    expect(reg.guest_claim_token).toBeNull();
    expect(reg.athlete_id).toBe(1002);
  });
});

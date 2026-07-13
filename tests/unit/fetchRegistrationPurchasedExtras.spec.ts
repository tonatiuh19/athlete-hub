import { describe, it, expect } from "vitest";
import { fetchRegistrationPurchasedExtras } from "../../server/eventExtras";
import { RegistrationScenarioDb, seeds } from "../helpers/scenarioDb";

describe("fetchRegistrationPurchasedExtras", () => {
  it("returns purchased add-ons sorted by name", async () => {
    const db = new RegistrationScenarioDb({
      ...seeds.withOptionalExtras(),
      athleteAlreadyRegistered: true,
    });
    db.registrationExtras.push(
      {
        registration_id: 999,
        event_extra_id: 202,
        name: "Gold Folio",
        quantity: 1,
        unit_price_cents: 1_500,
        total_cents: 1_500,
      } as never,
      {
        registration_id: 999,
        event_extra_id: 201,
        name: "Official Tee",
        quantity: 2,
        unit_price_cents: 4_500,
        total_cents: 9_000,
      } as never,
    );

    const extras = await fetchRegistrationPurchasedExtras(db.asPool(), 999);

    expect(extras).toHaveLength(2);
    expect(extras[0]).toEqual({
      event_extra_id: 202,
      name: "Gold Folio",
      quantity: 1,
      unit_price_cents: 1_500,
      total_cents: 1_500,
      field_answers: [],
    });
    expect(extras[1]).toEqual({
      event_extra_id: 201,
      name: "Official Tee",
      quantity: 2,
      unit_price_cents: 4_500,
      total_cents: 9_000,
      field_answers: [],
    });
  });

  it("returns empty array when registration has no add-ons", async () => {
    const db = new RegistrationScenarioDb({
      athleteAlreadyRegistered: true,
    });

    const extras = await fetchRegistrationPurchasedExtras(db.asPool(), 999);

    expect(extras).toEqual([]);
  });
});

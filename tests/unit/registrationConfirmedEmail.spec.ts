/**
 * @vitest-environment node
 */
import { describe, it, expect } from "vitest";
import { buildRegistrationConfirmedEmail } from "../../api/index";

describe("buildRegistrationConfirmedEmail", () => {
  const base = {
    firstName: "Alex",
    eventTitle: "Mock Marathon 2026",
    categoryName: "10K Elite",
    registrationNumber: "REG-0042-00001",
    appUrl: "https://triboosport.com",
  };

  it("omits add-ons section when none were purchased", () => {
    const mail = buildRegistrationConfirmedEmail({
      ...base,
      locale: "en",
    });

    expect(mail.html).toContain("Mock Marathon 2026");
    expect(mail.html).not.toContain("Add-ons");
    expect(mail.text).not.toContain("Add-ons:");
  });

  it("includes purchased add-ons in EN html and text", () => {
    const mail = buildRegistrationConfirmedEmail({
      ...base,
      locale: "en",
      purchasedExtras: [
        { name: "Official Tee", quantity: 2, total_cents: 9_000 },
        { name: "Gold Folio", quantity: 1, total_cents: 1_500 },
      ],
    });

    expect(mail.html).toContain("Add-ons");
    expect(mail.html).toContain("Official Tee");
    expect(mail.html).toContain("× 2");
    expect(mail.html).toContain("$90.00 MXN");
    expect(mail.html).toContain("Gold Folio");
    expect(mail.text).toContain("Add-ons:");
    expect(mail.text).toContain("- Official Tee × 2 — $90.00 MXN");
    expect(mail.text).toContain("- Gold Folio — $15.00 MXN");
  });

  it("localizes add-ons heading in ES", () => {
    const mail = buildRegistrationConfirmedEmail({
      ...base,
      locale: "es",
      purchasedExtras: [{ name: "Playera oficial", quantity: 1, total_cents: 4_500 }],
    });

    expect(mail.html).toContain("Complementos");
    expect(mail.html).toContain("Playera oficial");
    expect(mail.text).toContain("Complementos:");
  });

  it("includes field answers under purchased add-ons", () => {
    const mail = buildRegistrationConfirmedEmail({
      ...base,
      locale: "en",
      purchasedExtras: [
        {
          name: "Official Tee",
          quantity: 1,
          total_cents: 4_500,
          field_answers: [
            {
              field_key: "shirt_size",
              label: "T-shirt size",
              value_text: "L",
              field_kind: "standard",
              field_type: "select",
            },
          ],
        },
      ],
    });

    expect(mail.html).toContain("T-shirt size");
    expect(mail.html).toContain("L");
    expect(mail.text).toContain("T-shirt size: L");
  });
});

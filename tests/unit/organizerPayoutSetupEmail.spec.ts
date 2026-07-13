/**
 * @vitest-environment node
 */
import { describe, it, expect } from "vitest";
import { buildOrganizerPayoutSetupEmail } from "../../api/index";

describe("buildOrganizerPayoutSetupEmail", () => {
  it("includes payout CTA URL and event title in EN", () => {
    const mail = buildOrganizerPayoutSetupEmail({
      locale: "en",
      firstName: "Alex",
      eventTitle: "Smoke Test Marathon",
      appUrl: "https://triboosport.com",
    });

    expect(mail.subject).toMatch(/payout/i);
    expect(mail.html).toContain("/staff/payouts");
    expect(mail.html).toContain("Smoke Test Marathon");
    expect(mail.html).toContain("3 quick steps");
    expect(mail.text).toContain("https://triboosport.com/staff/payouts");
  });

  it("localizes steps heading in ES", () => {
    const mail = buildOrganizerPayoutSetupEmail({
      locale: "es",
      firstName: "María",
      eventTitle: "Carrera de prueba",
      appUrl: "https://triboosport.com",
    });

    expect(mail.subject).toMatch(/cobros/i);
    expect(mail.html).toContain("En 3 pasos");
    expect(mail.html).toContain("Carrera de prueba");
  });
});

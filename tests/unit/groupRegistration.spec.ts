import { describe, it, expect } from "vitest";
import { buildGroupOrderSummaryEmail, buildRegistrationConfirmedEmail } from "../../api/index";
import { claimGuestRegistration } from "../../server/groupRegistration";

describe("buildRegistrationConfirmedEmail guest claim", () => {
  it("includes claim URL in text when provided", () => {
    const mail = buildRegistrationConfirmedEmail({
      locale: "en",
      firstName: "Guest",
      eventTitle: "Trail Run",
      categoryName: "10K",
      registrationNumber: "REG-1",
      appUrl: "https://triboo.test",
      guestClaimUrl: "https://triboo.test/auth/login?claimToken=abc",
    });
    expect(mail.text).toContain("claimToken=abc");
    expect(mail.html).toContain("claimToken=abc");
  });
});

describe("buildGroupOrderSummaryEmail", () => {
  it("includes all participants in text body", () => {
    const mail = buildGroupOrderSummaryEmail({
      locale: "en",
      firstName: "Alex",
      eventTitle: "Trail Run",
      totalCents: 150_000,
      itemCount: 2,
      participants: [
        {
          label: "Alex Gomez",
          categoryName: "10K",
          registrationNumber: "TR-001",
          totalCents: 75_000,
        },
        {
          label: "Sam Gomez",
          categoryName: "5K",
          registrationNumber: "TR-002",
          totalCents: 75_000,
        },
      ],
      appUrl: "https://triboo.test",
    });

    expect(mail.subject).toContain("group order");
    expect(mail.text).toContain("Alex Gomez");
    expect(mail.text).toContain("Sam Gomez");
    expect(mail.text).toContain("TR-001");
    expect(mail.html).toContain("10K");
  });
});

describe("claimGuestRegistration", () => {
  it("rejects empty claim token", async () => {
    const fakePool = {
      getConnection: async () => {
        throw new Error("should not connect");
      },
    };

    const result = await claimGuestRegistration(
      fakePool as unknown as import("mysql2/promise").Pool,
      1,
      "   ",
    );

    expect(result.ok).toBe(false);
    if (result.ok === false) {
      expect(result.error.status).toBe(400);
    }
  });
});
